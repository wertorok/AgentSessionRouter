import { createHash } from "node:crypto";
import { revalidateClusterEvidence } from "./clusterEvidenceRevalidation.js";
import { consultCluster, type ClusterConsultResult } from "./clusterConsult.js";
import { ERROR_CODES } from "./constants.js";
import { ConsultService, type ConsultResult } from "./consult.js";
import type { RouterRuntime } from "./runtime.js";

const CLUSTER_REVALIDATION_FAILURE_COOLDOWN_MS = 60_000;
const CLUSTER_FALLBACK_RESULT_TTL_MS = 30_000;

export interface ClusterRecoveryState {
  revalidationFailureCooldowns: Map<string, ClusterRevalidationFailureCooldown>;
  fallbackPromises: Map<string, Promise<ConsultResult>>;
  fallbackResults: Map<string, ClusterFallbackCachedResult>;
}

interface ClusterRevalidationFailureCooldown {
  until_ms: number;
  reason: string;
}

interface ClusterFallbackCachedResult {
  until_ms: number;
  result: ConsultResult;
}

type ClusterRecoveryLockResult =
  | { kind: "result"; result: ClusterConsultResult | ConsultResult }
  | { kind: "fallback"; error: Exclude<ClusterConsultResult, { answer: string }> };

export function createClusterRecoveryState(): ClusterRecoveryState {
  return {
    revalidationFailureCooldowns: new Map(),
    fallbackPromises: new Map(),
    fallbackResults: new Map()
  };
}

export async function consultClusterForCaller(
  runtime: RouterRuntime,
  consultService: ConsultService,
  input: {
    projectId: string;
    clusterId: string;
    question: string;
    toolProfile?: "bare" | "focused" | "agent" | null;
  },
  recoveryState: ClusterRecoveryState
): Promise<ClusterConsultResult | ConsultResult> {
  const availability = await runtime.getProfileAvailability();
  const result = await consultCluster(runtime.db, runtime.cwd, runtime.claude, availability, input);
  if (!("error" in result)) {
    return result;
  }
  if (shouldReturnClusterErrorToCaller(result)) {
    return result;
  }
  if (result.error.code !== ERROR_CODES.CLUSTER_FACTSHEET_STALE || !runtime.config.cluster.autoRefresh) {
    return getOrCreateClusterFallback(runtime, consultService, recoveryState, input, result);
  }

  const lockResult = await runtime.locks.withLock(`cluster-evidence-revalidation:${input.projectId}:${input.clusterId}`, async () => {
    const afterWaitAvailability = await runtime.getProfileAvailability();
    const afterWaitResult = await consultCluster(runtime.db, runtime.cwd, runtime.claude, afterWaitAvailability, input);
    if (!("error" in afterWaitResult)) {
      return { kind: "result", result: afterWaitResult } satisfies ClusterRecoveryLockResult;
    }
    if (shouldReturnClusterErrorToCaller(afterWaitResult)) {
      return { kind: "result", result: afterWaitResult } satisfies ClusterRecoveryLockResult;
    }
    if (afterWaitResult.error.code !== ERROR_CODES.CLUSTER_FACTSHEET_STALE) {
      return { kind: "fallback", error: afterWaitResult } satisfies ClusterRecoveryLockResult;
    }

    const activeCooldown = getActiveRevalidationCooldown(runtime, recoveryState, input);
    if (activeCooldown) {
      runtime.db.logClusterEvent({
        clusterId: input.clusterId,
        projectId: input.projectId,
        eventType: "evidence_revalidation_suppressed",
        details: {
          reason: activeCooldown.reason,
          cooldown_until_ms: activeCooldown.until_ms
        }
      });
      return { kind: "fallback", error: afterWaitResult } satisfies ClusterRecoveryLockResult;
    }

    const revalidation = revalidateClusterEvidence(runtime.db, runtime.cwd, {
      projectId: input.projectId,
      clusterId: input.clusterId,
      minRetainedRatio: runtime.config.cluster.autoRefreshMinRetainedRatio
    });
    if ("error" in revalidation) {
      setRevalidationFailureCooldown(runtime, recoveryState, input, revalidation.error.message);
      return { kind: "fallback", error: revalidation } satisfies ClusterRecoveryLockResult;
    }

    const refreshedAvailability = await runtime.getProfileAvailability();
    return {
      kind: "result",
      result: await consultCluster(runtime.db, runtime.cwd, runtime.claude, refreshedAvailability, input)
    } satisfies ClusterRecoveryLockResult;
  });

  if (lockResult.kind === "result") {
    return lockResult.result;
  }
  return getOrCreateClusterFallback(runtime, consultService, recoveryState, input, lockResult.error);
}

export function isClusterConsultSuccess(
  result: ClusterConsultResult | ConsultResult
): result is Exclude<ClusterConsultResult, { error: unknown }> {
  return !("error" in result) && "cluster_id" in result && "metrics" in result;
}

function getOrCreateClusterFallback(
  runtime: RouterRuntime,
  consultService: ConsultService,
  recoveryState: ClusterRecoveryState,
  input: {
    projectId: string;
    clusterId: string;
    question: string;
  },
  revalidationError: Exclude<ClusterConsultResult, { answer: string }>
): Promise<ConsultResult> {
  const key = clusterFallbackKey(input);
  const cached = recoveryState.fallbackResults.get(key);
  if (cached && cached.until_ms > runtime.clock.nowMillis()) {
    runtime.db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "cluster_fallback_coalesced",
      details: {
        reason: revalidationError.error.message,
        question_hash: questionHash(input.question),
        source: "cached_result"
      }
    });
    return Promise.resolve(cached.result);
  }
  if (cached) {
    recoveryState.fallbackResults.delete(key);
  }

  const existing = recoveryState.fallbackPromises.get(key);
  if (existing) {
    runtime.db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "cluster_fallback_coalesced",
      details: {
        reason: revalidationError.error.message,
        question_hash: questionHash(input.question),
        source: "pending_promise"
      }
    });
    return existing;
  }

  const promise = fallbackToClaudeConsult(runtime, consultService, input, revalidationError)
    .then((result) => {
      recoveryState.fallbackResults.set(key, {
        until_ms: runtime.clock.nowMillis() + CLUSTER_FALLBACK_RESULT_TTL_MS,
        result
      });
      return result;
    })
    .finally(() => {
      recoveryState.fallbackPromises.delete(key);
    });
  recoveryState.fallbackPromises.set(key, promise);
  return promise;
}

async function fallbackToClaudeConsult(
  runtime: RouterRuntime,
  consultService: ConsultService,
  input: {
    projectId: string;
    clusterId: string;
    question: string;
  },
  revalidationError: Exclude<ClusterConsultResult, { answer: string }>
): Promise<ConsultResult> {
  runtime.db.markClusterNeedsPrepare(input.clusterId);
  const startedAt = runtime.clock.nowMillis();
  const result = await consultService.consult({
    projectId: input.projectId,
    topicHint: `cluster fallback ${input.clusterId}`,
    trigger: "cluster_consult_fallback",
    task: "Answer the caller's question after cluster evidence revalidation failed.",
    relevantCode: [
      `Cluster '${input.clusterId}' factsheet evidence failed strict revalidation.`,
      "Use normal project understanding/discovery as needed. Do not rely on the stale cluster factsheet."
    ].join("\n"),
    question: input.question
  });

  runtime.db.logClusterEvent({
    clusterId: input.clusterId,
    projectId: input.projectId,
    eventType: "error" in result ? "cluster_fallback_failed" : "cluster_fallback_to_claude_consult",
    details: {
      reason: revalidationError.error.message,
      revalidation_error: revalidationError.error,
      fallback_session_id: "error" in result ? null : result.session_id,
      fallback_claude_session_id: "error" in result ? null : result.claude_session_id
    },
    durationMs: runtime.clock.nowMillis() - startedAt
  });

  return result;
}

function getActiveRevalidationCooldown(
  runtime: RouterRuntime,
  recoveryState: ClusterRecoveryState,
  input: { projectId: string; clusterId: string }
): ClusterRevalidationFailureCooldown | null {
  const key = clusterRecoveryKey(input);
  const cooldown = recoveryState.revalidationFailureCooldowns.get(key);
  if (!cooldown) {
    return null;
  }
  if (cooldown.until_ms <= runtime.clock.nowMillis()) {
    recoveryState.revalidationFailureCooldowns.delete(key);
    return null;
  }
  return cooldown;
}

function setRevalidationFailureCooldown(
  runtime: RouterRuntime,
  recoveryState: ClusterRecoveryState,
  input: { projectId: string; clusterId: string },
  reason: string
): void {
  recoveryState.revalidationFailureCooldowns.set(clusterRecoveryKey(input), {
    until_ms: runtime.clock.nowMillis() + CLUSTER_REVALIDATION_FAILURE_COOLDOWN_MS,
    reason
  });
}

function clusterRecoveryKey(input: { projectId: string; clusterId: string }): string {
  return `${input.projectId}:${input.clusterId}`;
}

function clusterFallbackKey(input: { projectId: string; clusterId: string; question: string }): string {
  return `${clusterRecoveryKey(input)}:${questionHash(input.question)}`;
}

function questionHash(question: string): string {
  return createHash("sha256").update(question).digest("hex").slice(0, 16);
}

function shouldReturnClusterErrorToCaller(result: Extract<ClusterConsultResult, { error: unknown }>): boolean {
  return result.error.code === ERROR_CODES.CLUSTER_PROJECT_MISMATCH;
}

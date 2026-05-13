import type { ClaudeAdapter } from "./claude.js";
import { prepareCluster, verifyFactsheetStatic, type FactsheetInput, type PrepareClusterResult } from "./cluster.js";
import { ERROR_CODES } from "./constants.js";
import type { ClusterFactsheetRecord, ClusterRecord, RouterDatabase } from "./db.js";
import { errorPayload, type ErrorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";

export interface ClusterAutoRefreshInput {
  projectId: string;
  clusterId: string;
  allowStaticFactsheet?: boolean;
  minRetainedRatio: number;
}

export interface ClusterAutoRefreshSuccess {
  occurred: true;
  factsheet_id: string;
  factsheet_version: number;
  verification_stage: "static" | "llm";
  retained_facts: number;
  original_facts: number;
  retained_ratio: number;
  warning: {
    code: "CLUSTER_AUTO_REFRESHED";
    message: string;
  };
}

export type ClusterAutoRefreshResult = ClusterAutoRefreshSuccess | ErrorPayload;

export async function autoRefreshClusterFactsheet(
  db: RouterDatabase,
  cwd: string,
  claude: ClaudeAdapter,
  input: ClusterAutoRefreshInput
): Promise<ClusterAutoRefreshResult> {
  const loaded = loadLatestFactsheet(db, input.projectId, input.clusterId);
  if ("error" in loaded) {
    return loaded;
  }

  const factsheetInput = factsheetForCurrentEvidence(loaded.factsheet);
  const originalFacts = Array.isArray(factsheetInput.facts) ? factsheetInput.facts.length : 0;
  if (originalFacts === 0) {
    return unrecoverable(input.clusterId, {
      reason: "latest factsheet has no facts",
      original_facts: 0,
      retained_facts: 0,
      retained_ratio: 0
    });
  }

  let staticVerification;
  try {
    staticVerification = verifyFactsheetStatic(cwd, input.clusterId, factsheetInput);
  } catch (error: unknown) {
    return unrecoverable(input.clusterId, {
      reason: error instanceof Error ? error.message : String(error),
      original_facts: originalFacts,
      retained_facts: 0,
      retained_ratio: 0
    });
  }

  const staticRatio = retainedRatio(staticVerification.factsheet.facts.length, originalFacts);
  if (staticRatio < input.minRetainedRatio) {
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "auto_refresh_rejected",
      details: {
        stage: "static",
        original_facts: originalFacts,
        retained_facts: staticVerification.factsheet.facts.length,
        retained_ratio: staticRatio,
        min_retained_ratio: input.minRetainedRatio,
        rejected_facts: staticVerification.rejectedFacts
      }
    });
    return unrecoverable(input.clusterId, {
      reason: "automatic static refresh retained too few facts",
      original_facts: originalFacts,
      retained_facts: staticVerification.factsheet.facts.length,
      retained_ratio: staticRatio,
      min_retained_ratio: input.minRetainedRatio,
      rejected_facts: staticVerification.rejectedFacts,
      suggested_action: "Recreate the cluster with cluster_prepare or use claude_consult for fresh exploration."
    });
  }

  const verificationMode = shouldRunLlmVerification(loaded.factsheet, factsheetInput, input.allowStaticFactsheet) ? "llm" : "static";
  let prepared: PrepareClusterResult;
  try {
    prepared = await prepareCluster(db, cwd, claude, {
      projectId: input.projectId,
      clusterId: input.clusterId,
      name: loaded.cluster.name,
      description: loaded.cluster.description,
      toolProfileDefault: loaded.cluster.tool_profile_default,
      factsheet: factsheetInput,
      sourceSessionId: loaded.factsheet.source_session_id,
      gitRev: loaded.factsheet.git_rev,
      verificationMode,
      llmVerifierProfile: "focused"
    });
  } catch (error: unknown) {
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "auto_refresh_failed",
      details: {
        reason: error instanceof Error ? error.message : String(error),
        verification_mode: verificationMode
      }
    });
    return unrecoverable(input.clusterId, {
      reason: error instanceof Error ? error.message : String(error),
      original_facts: originalFacts,
      retained_facts: 0,
      retained_ratio: 0,
      verification_mode: verificationMode,
      suggested_action: "Use claude_consult for fresh exploration or recreate the cluster with cluster_prepare."
    });
  }

  const finalRatio = retainedRatio(prepared.verified_facts, originalFacts);
  if (finalRatio < input.minRetainedRatio) {
    db.markClusterFactsheetStale(prepared.factsheet_id);
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "auto_refresh_rejected",
      details: {
        stage: prepared.verification_stage,
        factsheet_id: prepared.factsheet_id,
        factsheet_version: prepared.factsheet_version,
        original_facts: originalFacts,
        retained_facts: prepared.verified_facts,
        retained_ratio: finalRatio,
        min_retained_ratio: input.minRetainedRatio,
        rejected_facts: prepared.rejected_fact_details
      }
    });
    return unrecoverable(input.clusterId, {
      reason: "automatic refresh retained too few facts after verification",
      original_facts: originalFacts,
      retained_facts: prepared.verified_facts,
      retained_ratio: finalRatio,
      min_retained_ratio: input.minRetainedRatio,
      rejected_facts: prepared.rejected_fact_details,
      suggested_action: "Recreate the cluster with cluster_prepare or use claude_consult for fresh exploration."
    });
  }

  db.logClusterEvent({
    clusterId: input.clusterId,
    projectId: input.projectId,
    eventType: "auto_refresh_succeeded",
    details: {
      factsheet_id: prepared.factsheet_id,
      factsheet_version: prepared.factsheet_version,
      verification_stage: prepared.verification_stage,
      original_facts: originalFacts,
      retained_facts: prepared.verified_facts,
      retained_ratio: finalRatio
    }
  });

  return {
    occurred: true,
    factsheet_id: prepared.factsheet_id,
    factsheet_version: prepared.factsheet_version,
    verification_stage: prepared.verification_stage,
    retained_facts: prepared.verified_facts,
    original_facts: originalFacts,
    retained_ratio: finalRatio,
    warning: {
      code: "CLUSTER_AUTO_REFRESHED",
      message: "Cluster factsheet evidence changed; router refreshed the factsheet before consulting."
    }
  };
}

function loadLatestFactsheet(
  db: RouterDatabase,
  projectId: string,
  clusterId: string
): { cluster: ClusterRecord; factsheet: ClusterFactsheetRecord } | ErrorPayload {
  const cluster = db.getClusterById(clusterId);
  if (!cluster) {
    return errorPayload(ERROR_CODES.CLUSTER_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_NOT_FOUND], {
      cluster_id: clusterId
    });
  }
  if (cluster.project_id !== projectId) {
    return errorPayload(ERROR_CODES.CLUSTER_PROJECT_MISMATCH, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_PROJECT_MISMATCH], {
      cluster_id: clusterId
    });
  }
  const factsheet = db.getLatestClusterFactsheet(clusterId);
  if (!factsheet) {
    return errorPayload(ERROR_CODES.CLUSTER_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_NOT_FOUND], {
      cluster_id: clusterId,
      reason: "Cluster has no factsheet to refresh."
    });
  }
  return { cluster, factsheet };
}

function factsheetForCurrentEvidence(factsheet: ClusterFactsheetRecord): FactsheetInput {
  const parsed = parseFactsheet(factsheet);
  const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
  return {
    ...parsed,
    facts: facts.map((fact) => {
      if (!isObject(fact)) {
        return fact;
      }
      const evidence = Array.isArray(fact.evidence) ? fact.evidence : [];
      return {
        ...fact,
        evidence: evidence.map((item) => {
          if (!isObject(item)) {
            return item;
          }
          const { hash: _hash, ...withoutHash } = item;
          return withoutHash;
        })
      };
    }) as FactsheetInput["facts"]
  };
}

function shouldRunLlmVerification(
  factsheet: ClusterFactsheetRecord,
  factsheetInput: FactsheetInput,
  allowStaticFactsheet: boolean | undefined
): boolean {
  if (factsheet.status === "llm_verified") {
    return true;
  }
  const facts = Array.isArray(factsheetInput.facts) ? factsheetInput.facts : [];
  if (facts.length > 0 && facts.every((fact) => isObject(fact) && fact.confidence === "llm_verified")) {
    return true;
  }
  return !allowStaticFactsheet;
}

function unrecoverable(clusterId: string, details: Record<string, unknown>): ErrorPayload {
  return errorPayload(
    ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE,
    SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE],
    {
      cluster_id: clusterId,
      details
    }
  );
}

function retainedRatio(retained: number, original: number): number {
  return original === 0 ? 0 : Math.round((retained / original) * 100) / 100;
}

function parseFactsheet(factsheet: ClusterFactsheetRecord): Record<string, unknown> {
  try {
    const parsed = JSON.parse(factsheet.content_json) as unknown;
    if (isObject(parsed)) {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

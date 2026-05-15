import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { revalidateClusterEvidence } from "./clusterEvidenceRevalidation.js";
import { consultCluster } from "./clusterConsult.js";
import type { ClusterConsultResult } from "./clusterConsult.js";
import { refreshCluster } from "./clusterRefresh.js";
import { prepareCluster, type FactsheetInput } from "./cluster.js";
import { isoHoursAgo } from "./clock.js";
import { ERROR_CODES, SESSION_STATUSES } from "./constants.js";
import { ConsultService, type ConsultResult } from "./consult.js";
import type {
  ClusterEventCount,
  ClusterFactsheetRecord,
  ConsultComparisonMonitorStats,
  EventCount,
  ShadowEvalHealth,
  SessionMetadataAffectedSession,
  SlowSessionEventCount,
  SlowSessionEventSample,
  StaleClusterView,
  StatusCount
} from "./db.js";
import { diagnoseClaudeFailure, errorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";
import { pickProfile, type ProfileSelection } from "./profiles.js";
import { resolveProjectId } from "./project.js";
import type { RouterRuntime } from "./runtime.js";
import { completeShadowComparison, scheduleShadowComparison } from "./shadowEval.js";
import { jsonToolResult } from "./toolResult.js";

const sessionsListInput = z.object({
  project_id: z.string().nullable().optional(),
  include_dormant: z.boolean().default(true),
  include_archived: z.boolean().default(false),
  include_orphaned: z.boolean().default(false)
});

const sessionInspectInput = z.object({
  project_id: z.string().nullable().optional(),
  session_id: z.string(),
  recent_events_limit: z.number().int().min(1).max(50).default(10)
});

const consultInput = z.object({
  project_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  topic_hint: z.string(),
  trigger: z.string(),
  task: z.string(),
  relevant_code: z.string(),
  question: z.string()
});

const archiveInput = z.object({
  project_id: z.string().nullable().optional(),
  session_id: z.string(),
  reason: z.string()
});

const routerResetInput = z.object({
  reason: z.string()
});

const routerStatusInput = z.object({
  project_id: z.string().nullable().optional(),
  recent_hours: z.number().int().min(1).max(168).default(24),
  warnings_limit: z.number().int().min(1).max(50).default(10)
});

const routerMonitorInput = z.object({
  project_id: z.string().nullable().optional(),
  recent_hours: z.number().int().min(1).max(168).default(24),
  sample_limit: z.number().int().min(1).max(50).default(10)
});

const SLOW_SESSION_TOKEN_BLOAT_THRESHOLD = 50_000;

const clusterToolProfileInput = z.enum(["bare", "focused", "agent"]);
const staticFactsheetPolicyInput = z.enum(["allow", "deny"]);

const factsheetEvidenceInput = z.object({
  path: z.string(),
  hash: z.string().optional(),
  selector: z.string().optional()
});

const factsheetInput = z
  .object({
    schema_version: z.number().int().optional(),
    cluster_id: z.string().optional(),
    summary: z.string().optional(),
    facts: z
      .array(
        z.object({
          id: z.string(),
          claim: z.string(),
          confidence: z.string().optional(),
          evidence: z.array(factsheetEvidenceInput)
        })
      )
      .optional(),
    pitfalls: z
      .array(
        z.object({
          id: z.string().optional(),
          text: z.string().optional()
        })
      )
      .optional(),
    forbidden_inferences: z.array(z.string()).optional()
  })
  .passthrough();

const clusterPrepareInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().min(1),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  tool_profile_default: clusterToolProfileInput.default("bare"),
  static_factsheet_policy: staticFactsheetPolicyInput.optional(),
  verification_mode: z.enum(["static", "llm"]).default("static"),
  llm_verifier_profile: z.enum(["focused", "bare"]).default("focused"),
  source_session_id: z.string().nullable().optional(),
  git_rev: z.string().nullable().optional(),
  factsheet: factsheetInput
});

const clusterGetInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().min(1),
  include_factsheet: z.boolean().default(true)
});

const clusterListInput = z.object({
  project_id: z.string().nullable().optional(),
  include_archived: z.boolean().default(false)
});

const clusterArchiveInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().min(1),
  reason: z.string().nullable().optional()
});

const clusterConsultInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().min(1),
  question: z.string().min(1),
  tool_profile: clusterToolProfileInput.nullable().optional()
});

const clusterRefreshInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().min(1),
  mode: z.enum(["verify_only"]).default("verify_only")
});

const comparisonPreferredInput = z.enum(["cluster", "direct", "tie"]);

const comparisonStatsInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().nullable().optional()
});

const comparisonListInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().nullable().optional(),
  preferred: comparisonPreferredInput.nullable().optional(),
  include_answers: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20)
});

const comparisonProcessPendingInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

const comparisonRejudgeInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().nullable().optional(),
  preferred: comparisonPreferredInput.nullable().optional(),
  judge_reasoning_contains: z.string().min(1).nullable().optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

export function registerTools(server: McpServer, runtime: RouterRuntime): void {
  const consultService = new ConsultService(runtime, runtime.locks);

  server.registerTool(
    "claude_sessions_list",
    {
      title: "List Claude sessions",
      description: "Returns known Claude sessions for a project.",
      inputSchema: sessionsListInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      runtime.db.applyLifecycle(projectId);
      const sessions = runtime.db.listSessions(
        projectId,
        input.include_dormant,
        input.include_archived,
        input.include_orphaned
      );

      return jsonToolResult({
        project_id: projectId,
        sessions
      });
    }
  );

  server.registerTool(
    "claude_session_inspect",
    {
      title: "Inspect Claude session",
      description: "Returns the full registry view of a session without invoking Claude.",
      inputSchema: sessionInspectInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const inspection = runtime.db.inspectSession(input.session_id, input.recent_events_limit);
      if (!inspection) {
        return jsonToolResult(
          errorPayload(ERROR_CODES.SESSION_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.SESSION_NOT_FOUND]),
          true
        );
      }

      if (inspection.session.project_id !== projectId) {
        return jsonToolResult(
          errorPayload(ERROR_CODES.PROJECT_MISMATCH, SPEC_ERROR_MESSAGES[ERROR_CODES.PROJECT_MISMATCH]),
          true
        );
      }

      return jsonToolResult({
        session: inspection.session,
        recent_events: inspection.recentEvents,
        recent_events_note: "truncated; default returns up to 10 events, hard max 50"
      });
    }
  );

  server.registerTool(
    "claude_consult",
    {
      title: "Consult Claude",
      description: "Calls Claude in an auto-routed or selected persistent session.",
      inputSchema: consultInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const result = await consultService.consult({
        projectId,
        sessionId: input.session_id,
        topicHint: input.topic_hint,
        trigger: input.trigger,
        task: input.task,
        relevantCode: input.relevant_code,
        question: input.question
      });

      return jsonToolResult(result, "error" in result);
    }
  );

  server.registerTool(
    "claude_session_archive",
    {
      title: "Archive Claude session",
      description: "Archives a session manually.",
      inputSchema: archiveInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const session = runtime.db.getSession(input.session_id);
      if (!session) {
        return jsonToolResult(
          errorPayload(ERROR_CODES.SESSION_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.SESSION_NOT_FOUND]),
          true
        );
      }
      if (session.project_id !== projectId) {
        return jsonToolResult(
          errorPayload(ERROR_CODES.PROJECT_MISMATCH, SPEC_ERROR_MESSAGES[ERROR_CODES.PROJECT_MISMATCH]),
          true
        );
      }

      return runtime.locks.withLock(session.claude_session_id, async () => {
        const lockedSession = runtime.db.getSession(input.session_id);
        if (!lockedSession) {
          return jsonToolResult(
            errorPayload(ERROR_CODES.SESSION_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.SESSION_NOT_FOUND]),
            true
          );
        }
        if (lockedSession.project_id !== projectId) {
          return jsonToolResult(
            errorPayload(ERROR_CODES.PROJECT_MISMATCH, SPEC_ERROR_MESSAGES[ERROR_CODES.PROJECT_MISMATCH]),
            true
          );
        }

        runtime.db.archiveSession(input.session_id, input.reason);
        return jsonToolResult({
          ok: true,
          status: "archived"
        });
      });
    }
  );

  server.registerTool(
    "claude_router_reset",
    {
      title: "Reset Claude router",
      description: "Exits degraded mode only after a successful health probe.",
      inputSchema: routerResetInput
    },
    async (input) => {
      const ok = await runtime.resetRouter(input.reason);
      if (!ok) {
        const diagnosis = diagnoseClaudeFailure(runtime.degradedReason);
        return jsonToolResult(
          errorPayload(ERROR_CODES.ROUTER_RESET_REJECTED, SPEC_ERROR_MESSAGES[ERROR_CODES.ROUTER_RESET_REJECTED], {
            detected_version: runtime.detectedClaudeVersion,
            tested_versions: runtime.testedClaudeVersions,
            reason: diagnosis.reason,
            category: diagnosis.category,
            operator_action: diagnosis.operator_action
          }),
          true
        );
      }

      return jsonToolResult({
        ok: true,
        mode: "normal"
      });
    }
  );

  server.registerTool(
    "router_status",
    {
      title: "Router status",
      description: "Returns aggregate router health, stale cluster, recent error, and shadow eval status.",
      inputSchema: routerStatusInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      runtime.db.applyLifecycle(projectId);
      const recentHours = input.recent_hours ?? 24;
      const warningsLimit = input.warnings_limit ?? 10;
      const sinceIso = isoHoursAgo(runtime.clock, recentHours);
      const fallbackCountLast24h = runtime.db.getClusterFallbackCount(projectId, isoHoursAgo(runtime.clock, 24));
      const staleClusters = runtime.db.listStaleClusters(projectId, warningsLimit);
      const sessionErrors = runtime.db.getRecentSessionErrorCounts(projectId, sinceIso);
      const slowSessionEvents = runtime.db.getRecentSlowSessionEvents(
        projectId,
        sinceIso,
        slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs)
      );
      const clusterAttention = runtime.db.getRecentClusterAttentionCounts(projectId, sinceIso);
      const shadowEval = runtime.db.getShadowEvalHealth(projectId);
      const sessionCounts = countMap(runtime.db.getSessionStatusCounts(projectId), SESSION_STATUSES);
      const clusterCounts = countMap(runtime.db.getClusterStatusCounts(projectId), [
        "active",
        "stale",
        "needs_prepare",
        "invalidated",
        "archived"
      ]);
      const warnings = buildStatusWarnings({
        degradedMode: runtime.degradedMode,
        degradedReason: runtime.degradedReason,
        staleClusters,
        sessionErrors,
        slowSessionEvents,
        clusterAttention,
        shadowEval,
        shadowEnabled: runtime.config.eval.shadowMode,
        limit: warningsLimit
      });

      return jsonToolResult({
        project_id: projectId,
        checked_at: runtime.clock.nowIso(),
        mode: runtime.degradedMode ? "degraded" : "normal",
        degraded_reason: runtime.degradedReason ?? null,
        uptime_hours: round2((runtime.clock.nowMillis() - new Date(runtime.startedAt).getTime()) / 3_600_000),
        claude: {
          detected_version: runtime.detectedClaudeVersion ?? null,
          tested_versions: runtime.testedClaudeVersions
        },
        v1_sessions: {
          ...sessionCounts,
          total: sumCounts(sessionCounts)
        },
        v2_clusters: {
          ...clusterCounts,
          total: sumCounts(clusterCounts),
          fallback_count_last_24h: fallbackCountLast24h,
          stale_clusters: staleClusters
        },
        recent_window_hours: recentHours,
        recent_errors: {
          session_events: sessionErrors,
          slow_session_events: slowSessionEvents,
          cluster_events: clusterAttention
        },
        shadow_eval: {
          enabled: runtime.config.eval.shadowMode,
          ...shadowEval
        },
        warnings
      });
    }
  );

  server.registerTool(
    "router_monitor",
    {
      title: "Router monitor",
      description:
        "Returns an operator-facing information monitor: quality stats, cache health, shadow eval health, recommendations, and next directions.",
      inputSchema: routerMonitorInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      runtime.db.applyLifecycle(projectId);
      const recentHours = input.recent_hours ?? 24;
      const sinceIso = isoHoursAgo(runtime.clock, recentHours);
      const staleClusters = runtime.db.listStaleClusters(projectId, input.sample_limit ?? 10);
      const sessionErrors = runtime.db.getRecentSessionErrorCounts(projectId, sinceIso);
      const slowSessionEvents = runtime.db.getRecentSlowSessionEvents(
        projectId,
        sinceIso,
        slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs)
      );
      const slowSessionSamples = runtime.db.listRecentSlowSessionEventSamples(
        projectId,
        sinceIso,
        slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs),
        input.sample_limit ?? 10
      );
      const metadataEventCounts = runtime.db.getRecentSessionMetadataEventCounts(projectId, sinceIso);
      const metadataAffectedSessions = runtime.db.listRecentSessionMetadataAffectedSessions(
        projectId,
        sinceIso,
        input.sample_limit ?? 10
      );
      const metadataSamples = runtime.db.listRecentSessionMetadataEventSamples(projectId, sinceIso, input.sample_limit ?? 10);
      const clusterAttention = runtime.db.getRecentClusterAttentionCounts(projectId, sinceIso);
      const clusterAttentionByCluster = runtime.db.getRecentClusterAttentionCountsByCluster(projectId, sinceIso);
      const shadowEval = runtime.db.getShadowEvalHealth(projectId);
      const activeClusterIds = new Set(runtime.db.listClusters(projectId, false).map((cluster) => cluster.id));
      const comparisonStats = runtime.db
        .getConsultComparisonMonitorStats(projectId, sinceIso)
        .filter((stats) => !stats.cluster_id || activeClusterIds.has(stats.cluster_id));
      const directWins = runtime.db
        .listConsultComparisons({
          projectId,
          preferred: "direct",
          limit: input.sample_limit ?? 10
        })
        .filter(
          (comparison) =>
            comparison.created_at >= sinceIso && (!comparison.cluster_id || activeClusterIds.has(comparison.cluster_id))
        )
        .map((comparison) => ({
          id: comparison.id,
          cluster_id: comparison.cluster_id,
          question: comparison.question,
          cluster_score: comparison.cluster_score,
          direct_score: comparison.direct_score,
          judge_reasoning: comparison.judge_reasoning,
          created_at: comparison.created_at
        }));
      const notInContextSamples = runtime.db
        .listConsultComparisons({
          projectId,
          limit: input.sample_limit ?? 10
        })
        .filter(
          (comparison) =>
            comparison.created_at >= sinceIso &&
            comparison.cluster_was_not_in_context === 1 &&
            (comparison.judged_at === null || (comparison.cluster_score ?? 0) <= 1) &&
            (!comparison.cluster_id || activeClusterIds.has(comparison.cluster_id))
        )
        .map((comparison) => ({
          id: comparison.id,
          cluster_id: comparison.cluster_id,
          question: comparison.question,
          preferred: comparison.preferred,
          created_at: comparison.created_at
        }));
      const sessionCounts = countMap(runtime.db.getSessionStatusCounts(projectId), SESSION_STATUSES);
      const clusterCounts = countMap(runtime.db.getClusterStatusCounts(projectId), [
        "active",
        "stale",
        "needs_prepare",
        "invalidated",
        "archived"
      ]);
      const autoRoutingCandidates = buildAutoRoutingCandidates(
        comparisonStats,
        clusterAttentionByCluster,
        staleClusters
      );
      const recommendations = buildMonitorRecommendations({
        degradedMode: runtime.degradedMode,
        degradedReason: runtime.degradedReason,
        shadowEnabled: runtime.config.eval.shadowMode,
        shadowEval,
        staleClusters,
        sessionErrors,
        metadataEventCounts,
        metadataAffectedSessions,
        slowSessionEvents,
        slowSessionSamples,
        clusterAttentionByCluster,
        comparisonStats,
        autoRoutingCandidates
      });

      return jsonToolResult({
        project_id: projectId,
        checked_at: runtime.clock.nowIso(),
        recent_window_hours: recentHours,
        health: {
          mode: runtime.degradedMode ? "degraded" : "normal",
          degraded_reason: runtime.degradedReason ?? null,
          claude: {
            detected_version: runtime.detectedClaudeVersion ?? null,
            tested_versions: runtime.testedClaudeVersions
          },
          v1_sessions: {
            ...sessionCounts,
            total: sumCounts(sessionCounts)
          },
          v2_clusters: {
            ...clusterCounts,
            total: sumCounts(clusterCounts),
            fallback_count_last_24h: runtime.db.getClusterFallbackCount(projectId, isoHoursAgo(runtime.clock, 24))
          },
          shadow_eval: {
            enabled: runtime.config.eval.shadowMode,
            ...shadowEval
          }
        },
        cache_health: {
          stale_or_needs_prepare: staleClusters,
          attention_by_event: clusterAttention,
          attention_by_cluster: clusterAttentionByCluster
        },
        latency: {
          slow_session_threshold_ms: slowSessionThresholdMs(runtime.config.claude.commandTimeoutMs),
          slow_session_events: slowSessionEvents,
          slow_session_samples: slowSessionSamples
        },
        metadata_health: {
          event_counts: metadataEventCounts,
          affected_sessions: metadataAffectedSessions,
          samples: metadataSamples
        },
        quality: {
          cluster_stats: comparisonStats,
          direct_win_samples: directWins,
          not_in_context_samples: notInContextSamples,
          auto_routing_candidates: autoRoutingCandidates
        },
        recommendations,
        next_directions: buildMonitorNextDirections(comparisonStats, clusterAttentionByCluster, staleClusters, shadowEval)
      });
    }
  );

  server.registerTool(
    "cluster_prepare",
    {
      title: "Prepare cluster factsheet",
      description:
        "Stores a static_verified factsheet, or runs no-tools LLM verification when verification_mode is llm.",
      inputSchema: clusterPrepareInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      let profileSelection: ProfileSelection | null = null;
      if ((input.verification_mode ?? "static") === "llm" && runtime.degradedMode) {
        const diagnosis = diagnoseClaudeFailure(runtime.degradedReason);
        return jsonToolResult(
          errorPayload(ERROR_CODES.CLAUDE_INCOMPATIBLE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INCOMPATIBLE], {
            cluster_id: input.cluster_id,
            reason: diagnosis.reason,
            category: diagnosis.category,
            operator_action: diagnosis.operator_action
          }),
          true
        );
      }
      try {
        if ((input.verification_mode ?? "static") === "llm") {
          const availability = await runtime.getProfileAvailability();
          profileSelection = pickProfile(input.llm_verifier_profile ?? "focused", availability);
          if (profileSelection.selected === "agent") {
            throw new Error("LLM verifier cannot use agent profile");
          }
        }

        const existingCluster = runtime.db.getClusterById(input.cluster_id);
        const result = await prepareCluster(runtime.db, runtime.cwd, runtime.claude, {
          projectId,
          clusterId: input.cluster_id,
          name: input.name ?? undefined,
          description: input.description ?? undefined,
          toolProfileDefault: input.tool_profile_default,
          staticFactsheetPolicy: input.static_factsheet_policy ?? (existingCluster ? undefined : runtime.config.cluster.staticFactsheetPolicy),
          factsheet: input.factsheet as FactsheetInput,
          sourceSessionId: input.source_session_id,
          gitRev: input.git_rev,
          verificationMode: input.verification_mode ?? "static",
          llmVerifierProfile: profileSelection?.selected === "bare" ? "bare" : "focused"
        });
        if (profileSelection?.downgraded) {
          runtime.db.logClusterEvent({
            clusterId: input.cluster_id,
            projectId,
            eventType: "tool_profile_downgraded",
            details: profileSelection
          });
        }

        return jsonToolResult({
          project_id: projectId,
          ...(profileSelection ? { profile_selection: profileSelection } : {}),
          ...result
        });
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        const code = reason.includes("belongs to project")
          ? ERROR_CODES.CLUSTER_PROJECT_MISMATCH
          : reason.includes("Claude") || reason.includes("Command failed")
            ? ERROR_CODES.CLAUDE_INVOCATION_FAILED
          : ERROR_CODES.CLUSTER_FACTSHEET_INVALID;
        return jsonToolResult(
          errorPayload(code, SPEC_ERROR_MESSAGES[code], {
            cluster_id: input.cluster_id,
            reason
          }),
          true
        );
      }
    }
  );

  server.registerTool(
    "cluster_get",
    {
      title: "Get cluster",
      description: "Returns cluster metadata and the current static_verified or llm_verified factsheet without invoking Claude.",
      inputSchema: clusterGetInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const cluster = runtime.db.getClusterById(input.cluster_id);
      if (!cluster) {
        return jsonToolResult(
          errorPayload(ERROR_CODES.CLUSTER_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_NOT_FOUND], {
            cluster_id: input.cluster_id
          }),
          true
        );
      }
      if (cluster.project_id !== projectId) {
        return jsonToolResult(
          errorPayload(
            ERROR_CODES.CLUSTER_PROJECT_MISMATCH,
            SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_PROJECT_MISMATCH],
            { cluster_id: input.cluster_id }
          ),
          true
        );
      }

      const factsheet = input.include_factsheet ? runtime.db.getCurrentClusterFactsheet(input.cluster_id) : null;
      return jsonToolResult({
        project_id: projectId,
        cluster,
        current_factsheet: factsheet ? serializeFactsheet(factsheet) : null,
        file_hashes: factsheet ? runtime.db.listClusterFileHashes(factsheet.id) : []
      });
    }
  );

  server.registerTool(
    "cluster_consult",
    {
      title: "Consult cluster",
      description: "Consults Claude with a verified cluster factsheet inline. Fork support is not implemented in this phase.",
      inputSchema: clusterConsultInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      if (runtime.degradedMode) {
        const diagnosis = diagnoseClaudeFailure(runtime.degradedReason);
        return jsonToolResult(
          errorPayload(ERROR_CODES.CLAUDE_INCOMPATIBLE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INCOMPATIBLE], {
            cluster_id: input.cluster_id,
            reason: diagnosis.reason,
            category: diagnosis.category,
            operator_action: diagnosis.operator_action
          }),
          true
        );
      }

      const result = await consultClusterForCaller(runtime, consultService, {
        projectId,
        clusterId: input.cluster_id,
        question: input.question,
        toolProfile: input.tool_profile
      });
      if (!("error" in result) && isClusterConsultSuccess(result)) {
        scheduleShadowComparison(runtime, {
          projectId,
          clusterId: input.cluster_id,
          question: input.question,
          clusterResult: result
        });
      }

      return jsonToolResult(
        {
          project_id: projectId,
          ...result
        },
        "error" in result
      );
    }
  );

  server.registerTool(
    "comparison_stats",
    {
      title: "Comparison stats",
      description: "Returns shadow comparison win/loss/tie aggregates by cluster.",
      inputSchema: comparisonStatsInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      return jsonToolResult({
        project_id: projectId,
        stats: runtime.db.getConsultComparisonStats(projectId, input.cluster_id)
      });
    }
  );

  server.registerTool(
    "comparison_list",
    {
      title: "List comparisons",
      description: "Lists recent shadow comparison records for a project.",
      inputSchema: comparisonListInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const comparisons = runtime.db
        .listConsultComparisons({
          projectId,
          clusterId: input.cluster_id,
          preferred: input.preferred ?? null,
          limit: input.limit ?? 20
        })
        .map((comparison) =>
          input.include_answers
            ? comparison
            : {
                ...comparison,
                cluster_answer: comparison.cluster_answer ? "[omitted]" : null,
                direct_answer: comparison.direct_answer ? "[omitted]" : null
              }
        );
      return jsonToolResult({
        project_id: projectId,
        comparisons
      });
    }
  );

  server.registerTool(
    "comparison_process_pending",
    {
      title: "Process pending comparisons",
      description:
        "Runs direct baseline and/or judge for pending or ok-unjudged shadow comparison rows. Operator tool; may invoke Claude.",
      inputSchema: comparisonProcessPendingInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      if (runtime.degradedMode) {
        const diagnosis = diagnoseClaudeFailure(runtime.degradedReason);
        return jsonToolResult(
          errorPayload(ERROR_CODES.CLAUDE_INCOMPATIBLE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INCOMPATIBLE], {
            reason: diagnosis.reason,
            category: diagnosis.category,
            operator_action: diagnosis.operator_action
          }),
          true
        );
      }

      const rows = runtime.db.listUnjudgedConsultComparisons({
        projectId,
        clusterId: input.cluster_id,
        limit: input.limit ?? 5
      });
      const processed: Array<{
        id: string;
        cluster_id: string | null;
        before_status: string;
        after_status?: string | null;
        judged_at?: string | null;
        error?: string;
      }> = [];

      for (const row of rows) {
        try {
          await completeShadowComparison(runtime, row.id);
          const updated = runtime.db.getConsultComparison(row.id);
          processed.push({
            id: row.id,
            cluster_id: row.cluster_id,
            before_status: row.shadow_status,
            after_status: updated?.shadow_status ?? null,
            judged_at: updated?.judged_at ?? null
          });
        } catch (error: unknown) {
          processed.push({
            id: row.id,
            cluster_id: row.cluster_id,
            before_status: row.shadow_status,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return jsonToolResult({
        project_id: projectId,
        requested_limit: input.limit ?? 5,
        processed_count: processed.length,
        processed
      });
    }
  );

  server.registerTool(
    "comparison_rejudge",
    {
      title: "Rejudge comparisons",
      description:
        "Re-runs the judge for already judged shadow comparison rows using current judge policy and current cluster factsheet ground truth.",
      inputSchema: comparisonRejudgeInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      if (runtime.degradedMode) {
        const diagnosis = diagnoseClaudeFailure(runtime.degradedReason);
        return jsonToolResult(
          errorPayload(ERROR_CODES.CLAUDE_INCOMPATIBLE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INCOMPATIBLE], {
            reason: diagnosis.reason,
            category: diagnosis.category,
            operator_action: diagnosis.operator_action
          }),
          true
        );
      }

      const rows = runtime.db.listJudgedConsultComparisons({
        projectId,
        clusterId: input.cluster_id,
        preferred: input.preferred ?? null,
        judgeReasoningContains: input.judge_reasoning_contains ?? null,
        limit: input.limit ?? 5
      });
      const processed: Array<{
        id: string;
        cluster_id: string | null;
        before_preferred: string | null;
        after_preferred?: string | null;
        before_cluster_score: number | null;
        after_cluster_score?: number | null;
        before_direct_score: number | null;
        after_direct_score?: number | null;
        error?: string;
      }> = [];

      for (const row of rows) {
        try {
          await completeShadowComparison(runtime, row.id, { forceJudge: true });
          const updated = runtime.db.getConsultComparison(row.id);
          processed.push({
            id: row.id,
            cluster_id: row.cluster_id,
            before_preferred: row.preferred,
            after_preferred: updated?.preferred ?? null,
            before_cluster_score: row.cluster_score,
            after_cluster_score: updated?.cluster_score ?? null,
            before_direct_score: row.direct_score,
            after_direct_score: updated?.direct_score ?? null
          });
        } catch (error: unknown) {
          processed.push({
            id: row.id,
            cluster_id: row.cluster_id,
            before_preferred: row.preferred,
            before_cluster_score: row.cluster_score,
            before_direct_score: row.direct_score,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return jsonToolResult({
        project_id: projectId,
        requested_limit: input.limit ?? 5,
        processed_count: processed.length,
        processed
      });
    }
  );

  server.registerTool(
    "cluster_refresh",
    {
      title: "Refresh cluster",
      description: "Revalidates the latest cluster factsheet by checking scoped evidence file hashes and selectors.",
      inputSchema: clusterRefreshInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const result = refreshCluster(runtime.db, runtime.cwd, {
        projectId,
        clusterId: input.cluster_id,
        mode: input.mode
      });

      return jsonToolResult(
        {
          project_id: projectId,
          ...result
        },
        "error" in result
      );
    }
  );

  server.registerTool(
    "cluster_list",
    {
      title: "List clusters",
      description: "Lists cluster cache entries for a project without invoking Claude.",
      inputSchema: clusterListInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const clusters = runtime.db.listClusters(projectId, input.include_archived).map((cluster) => {
        const factsheet = runtime.db.getCurrentClusterFactsheet(cluster.id);
        return {
          ...cluster,
          current_factsheet: factsheet
            ? {
                id: factsheet.id,
                version: factsheet.version,
                status: factsheet.status,
                git_rev: factsheet.git_rev,
                generated_at: factsheet.generated_at,
                verified_at: factsheet.verified_at,
                fact_count: factsheetFactCount(factsheet)
              }
            : null
        };
      });

      return jsonToolResult({
        project_id: projectId,
        clusters
      });
    }
  );

  server.registerTool(
    "cluster_archive",
    {
      title: "Archive cluster",
      description: "Archives a cluster cache entry so router_monitor stops treating it as active.",
      inputSchema: clusterArchiveInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const ok = runtime.db.archiveCluster(projectId, input.cluster_id, input.reason ?? null);
      if (!ok) {
        return jsonToolResult(
          errorPayload(ERROR_CODES.CLUSTER_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_NOT_FOUND], {
            cluster_id: input.cluster_id
          }),
          true
        );
      }
      return jsonToolResult({
        project_id: projectId,
        cluster_id: input.cluster_id,
        ok: true,
        status: "archived"
      });
    }
  );
}

async function consultClusterForCaller(
  runtime: RouterRuntime,
  consultService: ConsultService,
  input: {
    projectId: string;
    clusterId: string;
    question: string;
    toolProfile?: "bare" | "focused" | "agent" | null;
  }
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
    return fallbackToClaudeConsult(runtime, consultService, input, result);
  }

  return runtime.locks.withLock(`cluster-evidence-revalidation:${input.projectId}:${input.clusterId}`, async () => {
    const afterWaitAvailability = await runtime.getProfileAvailability();
    const afterWaitResult = await consultCluster(runtime.db, runtime.cwd, runtime.claude, afterWaitAvailability, input);
    if (!("error" in afterWaitResult)) {
      return afterWaitResult;
    }
    if (shouldReturnClusterErrorToCaller(afterWaitResult)) {
      return afterWaitResult;
    }
    if (afterWaitResult.error.code !== ERROR_CODES.CLUSTER_FACTSHEET_STALE) {
      return fallbackToClaudeConsult(runtime, consultService, input, afterWaitResult);
    }

    const revalidation = revalidateClusterEvidence(runtime.db, runtime.cwd, {
      projectId: input.projectId,
      clusterId: input.clusterId,
      minRetainedRatio: runtime.config.cluster.autoRefreshMinRetainedRatio
    });
    if ("error" in revalidation) {
      return fallbackToClaudeConsult(runtime, consultService, input, revalidation);
    }

    const refreshedAvailability = await runtime.getProfileAvailability();
    return consultCluster(runtime.db, runtime.cwd, runtime.claude, refreshedAvailability, input);
  });
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

function shouldReturnClusterErrorToCaller(result: Extract<ClusterConsultResult, { error: unknown }>): boolean {
  return result.error.code === ERROR_CODES.CLUSTER_PROJECT_MISMATCH;
}

function isClusterConsultSuccess(result: ClusterConsultResult | ConsultResult): result is Exclude<ClusterConsultResult, { error: unknown }> {
  return !("error" in result) && "cluster_id" in result && "metrics" in result;
}

function countMap(rows: StatusCount[], keys: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of keys) {
    counts[key] = 0;
  }
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function slowSessionThresholdMs(commandTimeoutMs: number): number {
  if (!Number.isFinite(commandTimeoutMs) || commandTimeoutMs <= 0) {
    return 100_000;
  }
  return Math.min(100_000, Math.max(30_000, Math.floor(commandTimeoutMs * 0.8)));
}

function buildStatusWarnings(input: {
  degradedMode: boolean;
  degradedReason?: string;
  staleClusters: StaleClusterView[];
  sessionErrors: EventCount[];
  slowSessionEvents: SlowSessionEventCount[];
  clusterAttention: EventCount[];
  shadowEval: ShadowEvalHealth;
  shadowEnabled: boolean;
  limit: number;
}): string[] {
  const warnings: string[] = [];
  if (input.degradedMode) {
    warnings.push(`Router is degraded: ${input.degradedReason ?? "unknown reason"}`);
  }
  for (const cluster of input.staleClusters) {
    warnings.push(
      `Cluster '${cluster.id}' is stale; latest factsheet ${cluster.factsheet_id ?? "unknown"} version ${
        cluster.factsheet_version ?? "unknown"
      } needs refresh or re-prepare.`
    );
  }
  for (const event of input.clusterAttention) {
    warnings.push(`Cluster event '${event.event_type}' occurred ${event.count} time(s) in the recent window.`);
  }
  for (const event of input.sessionErrors) {
    warnings.push(`Session event '${event.event_type}' has ${event.count} error row(s) in the recent window.`);
  }
  for (const event of input.slowSessionEvents) {
    warnings.push(
      `Session event '${event.event_type}' exceeded the slow-call threshold ${event.count} time(s); max duration ${event.max_duration_ms ?? "unknown"}ms.`
    );
  }
  if (input.shadowEnabled) {
    const stalled = input.shadowEval.pending + input.shadowEval.ok_unjudged;
    const failed = input.shadowEval.failed_auth + input.shadowEval.failed_timeout + input.shadowEval.failed_other;
    if (stalled > 0) {
      warnings.push(`Shadow eval has ${stalled} unjudged comparison(s).`);
    }
    if (failed > 0) {
      warnings.push(`Shadow eval has ${failed} failed shadow comparison(s).`);
    }
  }
  return warnings.slice(0, input.limit);
}

function buildMonitorRecommendations(input: {
  degradedMode: boolean;
  degradedReason?: string;
  shadowEnabled: boolean;
  shadowEval: ShadowEvalHealth;
  staleClusters: StaleClusterView[];
  sessionErrors: EventCount[];
  metadataEventCounts: EventCount[];
  metadataAffectedSessions: SessionMetadataAffectedSession[];
  slowSessionEvents: SlowSessionEventCount[];
  slowSessionSamples: SlowSessionEventSample[];
  clusterAttentionByCluster: ClusterEventCount[];
  comparisonStats: ConsultComparisonMonitorStats[];
  autoRoutingCandidates: AutoRoutingCandidate[];
}): Array<{ priority: "high" | "medium" | "low"; area: string; cluster_id?: string | null; action: string; reason: string }> {
  const recommendations: Array<{
    priority: "high" | "medium" | "low";
    area: string;
    cluster_id?: string | null;
    action: string;
    reason: string;
  }> = [];

  if (input.degradedMode) {
    recommendations.push({
      priority: "high",
      area: "infrastructure",
      action: "Fix Claude CLI compatibility/auth and run claude_router_reset.",
      reason: input.degradedReason ?? "Router is in degraded mode."
    });
  }

  if (!input.shadowEnabled) {
    recommendations.push({
      priority: "medium",
      area: "monitoring",
      action: "Enable [eval].shadow_mode when you want real quality telemetry.",
      reason: "Shadow eval is disabled, so comparison quality data will not accumulate."
    });
  }

  const stalledShadow = input.shadowEval.pending + input.shadowEval.ok_unjudged;
  const failedShadow = input.shadowEval.failed_auth + input.shadowEval.failed_timeout + input.shadowEval.failed_other;
  if (stalledShadow > 0) {
    recommendations.push({
      priority: "medium",
      area: "monitoring",
      action: "Inspect comparison_list and shadow logs; judge or direct baseline may be stalled.",
      reason: `Shadow eval has ${stalledShadow} unjudged comparison(s).`
    });
  }
  if (failedShadow > 0) {
    recommendations.push({
      priority: "high",
      area: "monitoring",
      action: "Fix shadow direct baseline failures before trusting comparison coverage.",
      reason: `Shadow eval has ${failedShadow} failed comparison(s).`
    });
  }

  for (const cluster of input.staleClusters) {
    recommendations.push({
      priority: "high",
      area: "cache",
      cluster_id: cluster.id,
      action: "Run cluster_prepare or expand/rebuild this factsheet.",
      reason: `Cluster is ${cluster.status}; factsheet ${cluster.factsheet_id ?? "unknown"} cannot be trusted as current cache.`
    });
  }

  for (const event of input.clusterAttentionByCluster) {
    if (event.event_type === "cluster_fallback_failed") {
      recommendations.push({
        priority: "high",
        area: "fallback",
        cluster_id: event.cluster_id,
        action: "Investigate Claude availability and fallback path immediately.",
        reason: `Fallback failed ${event.count} time(s) in the recent window.`
      });
    } else if (event.event_type === "cluster_fallback_to_claude_consult") {
      recommendations.push({
        priority: "medium",
        area: "cache",
        cluster_id: event.cluster_id,
        action: "Re-prepare or broaden this cluster if fallback is recurring.",
        reason: `Router fell back to claude_consult ${event.count} time(s), meaning cache could not serve those calls.`
      });
    } else if (event.event_type === "evidence_revalidation_failed") {
      recommendations.push({
        priority: "medium",
        area: "cache",
        cluster_id: event.cluster_id,
        action: "Refresh factsheet evidence; selectors or snippets changed.",
        reason: `Strict evidence revalidation failed ${event.count} time(s).`
      });
    } else if (event.event_type === "tool_profile_downgraded" || event.event_type === "bare_probe_failed") {
      recommendations.push({
        priority: "low",
        area: "profiles",
        cluster_id: event.cluster_id,
        action: "Check bare-profile auth/support if latency or cost regresses.",
        reason: `${event.event_type} occurred ${event.count} time(s).`
      });
    }
  }

  for (const stats of input.comparisonStats) {
    if ((stats.direct_wins ?? 0) > 0 && (stats.gap ?? 0) >= 0.5) {
      recommendations.push({
        priority: "high",
        area: "quality",
        cluster_id: stats.cluster_id,
        action: "Inspect direct_win_samples, then expand or rebuild the cluster factsheet.",
        reason: `Direct baseline is beating cluster by ${stats.gap} points on average.`
      });
    } else if ((stats.direct_wins ?? 0) >= 2) {
      recommendations.push({
        priority: "medium",
        area: "quality",
        cluster_id: stats.cluster_id,
        action: "Inspect recurring direct wins and decide whether the cluster needs narrower scope, richer facts, or routing away from that question type.",
        reason: `Direct baseline won ${stats.direct_wins} judged comparison(s) in the recent window even though the average gap is small.`
      });
    } else if ((stats.not_in_context ?? 0) > 0) {
      recommendations.push({
        priority: "medium",
        area: "coverage",
        cluster_id: stats.cluster_id,
        action: "Inspect NOT IN CONTEXT samples and decide whether to expand factsheet or route those questions to claude_consult.",
        reason: `Cluster produced ${stats.not_in_context} NOT IN CONTEXT answer(s).`
      });
    }
  }

  for (const event of input.sessionErrors) {
    recommendations.push({
      priority: "medium",
      area: "sessions",
      action: "Inspect recent session_events and raw responses.",
      reason: `Session event '${event.event_type}' has ${event.count} error row(s).`
    });
  }

  const metadataThresholdCount =
    input.metadataEventCounts.find((event) => event.event_type === "parse_failed_threshold_exceeded")?.count ?? 0;
  const metadataParseFailedCount =
    input.metadataEventCounts.find((event) => event.event_type === "parse_failed")?.count ?? 0;

  if (metadataThresholdCount > 0) {
    recommendations.push({
      priority: "high",
      area: "metadata",
      action: "Inspect archived SESSION_UPDATE_JSON sessions and confirm replacements bootstrap from archived registry context.",
      reason: `${metadataThresholdCount} session(s) crossed parse-failure threshold in the recent window.`
    });
  } else if (metadataParseFailedCount > 0) {
    recommendations.push({
      priority: "medium",
      area: "metadata",
      action: "Inspect metadata_health.samples raw responses and tighten SESSION_UPDATE_JSON prompting if failures repeat.",
      reason: `${metadataParseFailedCount} SESSION_UPDATE_JSON parse failure(s) occurred in the recent window.`
    });
  }

  for (const session of input.metadataAffectedSessions) {
    if (session.threshold_exceeded_count <= 0) {
      continue;
    }
    recommendations.push({
      priority: "high",
      area: "metadata",
      action: "Review this archived session's raw response path and verify the replacement session kept registry context.",
      reason:
        `Session ${session.session_id ?? "unknown"} (${session.topic ?? "unknown topic"}) had ` +
        `${session.parse_failed_count} parse failure(s), ${session.threshold_exceeded_count} threshold event(s), ` +
        `status=${session.session_status ?? "unknown"}, latest raw=${session.latest_raw_response_path ?? "n/a"}.`
    });
  }

  for (const event of input.slowSessionEvents) {
    recommendations.push({
      priority: "medium",
      area: "latency",
      action: "Prefer cluster_consult for covered questions, or inspect the raw Claude response when direct consults approach the caller timeout boundary.",
      reason: `Session event '${event.event_type}' exceeded the slow-call threshold ${event.count} time(s); max duration ${event.max_duration_ms ?? "unknown"}ms.`
    });
  }

  for (const sample of input.slowSessionSamples) {
    if ((sample.tokens_in ?? 0) < SLOW_SESSION_TOKEN_BLOAT_THRESHOLD) {
      continue;
    }
    recommendations.push({
      priority: "medium",
      area: "latency",
      action:
        "Treat this as direct-discovery/context bloat: reuse an existing session or a covered cluster before repeating a broad new_session consult.",
      reason:
        `Slow ${sample.event_type} used ${sample.tokens_in} input tokens over ${sample.duration_ms ?? "unknown"}ms` +
        ` for topic '${sample.topic ?? "unknown"}'. Raw response: ${sample.raw_response_path ?? "n/a"}.`
    });
  }

  for (const candidate of input.autoRoutingCandidates) {
    recommendations.push({
      priority: "low",
      area: "routing",
      cluster_id: candidate.cluster_id,
      action: "Keep explicit cluster_consult for now, but treat this cluster as a read-only candidate for future automatic routing suggestions.",
      reason: candidate.reason
    });
  }

  return recommendations.slice(0, 25);
}

interface AutoRoutingCandidate {
  cluster_id: string;
  judged: number;
  cluster_q: number | null;
  direct_q: number | null;
  gap: number | null;
  cluster_wins: number;
  ties: number;
  reason: string;
}

function buildAutoRoutingCandidates(
  comparisonStats: ConsultComparisonMonitorStats[],
  clusterAttentionByCluster: ClusterEventCount[],
  staleClusters: StaleClusterView[]
): AutoRoutingCandidate[] {
  const unhealthyClusters = new Set(staleClusters.map((cluster) => cluster.id));
  for (const event of clusterAttentionByCluster) {
    if (
      event.event_type === "cluster_fallback_to_claude_consult" ||
      event.event_type === "cluster_fallback_failed" ||
      event.event_type === "evidence_revalidation_failed"
    ) {
      unhealthyClusters.add(event.cluster_id);
    }
  }

  return comparisonStats
    .filter((stats) => {
      if (!stats.cluster_id || unhealthyClusters.has(stats.cluster_id)) {
        return false;
      }
      return (
        (stats.judged ?? 0) >= 3 &&
        (stats.failed_shadow ?? 0) === 0 &&
        (stats.direct_wins ?? 0) === 0 &&
        (stats.not_in_context ?? 0) === 0 &&
        (stats.gap ?? 1) <= 0
      );
    })
    .map((stats) => ({
      cluster_id: stats.cluster_id!,
      judged: stats.judged,
      cluster_q: stats.cluster_q,
      direct_q: stats.direct_q,
      gap: stats.gap,
      cluster_wins: stats.cluster_wins,
      ties: stats.ties,
      reason:
        `Cluster has ${stats.judged} judged comparison(s), ${stats.direct_wins} direct win(s), ` +
        `${stats.not_in_context} low-score NOT IN CONTEXT row(s), and average gap ${stats.gap}.`
    }));
}

function buildMonitorNextDirections(
  comparisonStats: ConsultComparisonMonitorStats[],
  clusterAttentionByCluster: ClusterEventCount[],
  staleClusters: StaleClusterView[],
  shadowEval: ShadowEvalHealth
): string[] {
  const directions: string[] = [];
  const hasQualityData = comparisonStats.some((stats) => stats.judged > 0);
  const strongClusters = comparisonStats.filter((stats) => (stats.judged ?? 0) >= 3 && (stats.gap ?? 1) <= 0);
  const weakClusters = comparisonStats.filter((stats) => (stats.direct_wins ?? 0) > 0 || (stats.not_in_context ?? 0) > 0);
  const fallbackClusters = new Set(
    clusterAttentionByCluster
      .filter((event) => event.event_type === "cluster_fallback_to_claude_consult" || event.event_type === "evidence_revalidation_failed")
      .map((event) => event.cluster_id)
  );

  if (!hasQualityData) {
    directions.push("Collect more shadow comparisons before deciding on auto-routing or factsheet expansion.");
  }
  if (weakClusters.length > 0) {
    directions.push("Prioritize factsheet expansion or distillation for clusters where direct wins or NOT IN CONTEXT appears.");
  }
  if (strongClusters.length > 0 && fallbackClusters.size === 0 && staleClusters.length === 0) {
    directions.push("Clusters with stable quality and no fallback are candidates for future automatic cluster routing.");
  }
  if (fallbackClusters.size > 0 || staleClusters.length > 0) {
    directions.push("Re-prepare decayed clusters before using their data to judge routing quality.");
  }
  if (shadowEval.failed_auth + shadowEval.failed_timeout + shadowEval.failed_other > 0 || shadowEval.pending + shadowEval.ok_unjudged > 0) {
    directions.push("Stabilize the shadow pipeline before trusting long-term trend reports.");
  }
  if (comparisonStats.some((stats) => (stats.judged ?? 0) >= 10 && (stats.gap ?? 1) <= 0 && (stats.not_in_context ?? 0) === 0)) {
    directions.push("Fork baselines are still low priority unless monitor data shows latency/cost, not quality, is the bottleneck.");
  }

  return directions;
}

function serializeFactsheet(factsheet: ClusterFactsheetRecord): object {
  return {
    id: factsheet.id,
    cluster_id: factsheet.cluster_id,
    version: factsheet.version,
    source_session_id: factsheet.source_session_id,
    baseline_session_id: factsheet.baseline_session_id,
    git_rev: factsheet.git_rev,
    generated_at: factsheet.generated_at,
    verified_at: factsheet.verified_at,
    status: factsheet.status,
    content: parseFactsheetContent(factsheet)
  };
}

function factsheetFactCount(factsheet: ClusterFactsheetRecord): number {
  const content = parseFactsheetContent(factsheet);
  return Array.isArray(content.facts) ? content.facts.length : 0;
}

function parseFactsheetContent(factsheet: ClusterFactsheetRecord): Record<string, unknown> {
  try {
    const parsed = JSON.parse(factsheet.content_json) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { consultCluster } from "./clusterConsult.js";
import { refreshCluster } from "./clusterRefresh.js";
import { prepareCluster, type FactsheetInput } from "./cluster.js";
import { ERROR_CODES } from "./constants.js";
import { ConsultService } from "./consult.js";
import type { ClusterFactsheetRecord } from "./db.js";
import { diagnoseClaudeFailure, errorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";
import { pickProfile, type ProfileSelection } from "./profiles.js";
import { resolveProjectId } from "./project.js";
import type { RouterRuntime } from "./runtime.js";
import { scheduleShadowComparison } from "./shadowEval.js";
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

const clusterToolProfileInput = z.enum(["bare", "focused", "agent"]);

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

const clusterConsultInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().min(1),
  question: z.string().min(1),
  tool_profile: clusterToolProfileInput.nullable().optional(),
  allow_static_factsheet: z.boolean().default(false)
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

        const result = await prepareCluster(runtime.db, runtime.cwd, runtime.claude, {
          projectId,
          clusterId: input.cluster_id,
          name: input.name ?? undefined,
          description: input.description ?? undefined,
          toolProfileDefault: input.tool_profile_default,
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

      const availability = await runtime.getProfileAvailability();
      const result = await consultCluster(runtime.db, runtime.cwd, runtime.claude, availability, {
        projectId,
        clusterId: input.cluster_id,
        question: input.question,
        toolProfile: input.tool_profile,
        allowStaticFactsheet: input.allow_static_factsheet
      });
      if (!("error" in result)) {
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

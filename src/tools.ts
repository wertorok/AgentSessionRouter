import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { refreshCluster } from "./clusterRefresh.js";
import { consultClusterForCaller, createClusterRecoveryState, isClusterConsultSuccess } from "./clusterRecovery.js";
import { prepareCluster, type FactsheetInput } from "./cluster.js";
import { ERROR_CODES } from "./constants.js";
import { ConsultService } from "./consult.js";
import type {
  ClusterFactsheetRecord,
} from "./db.js";
import { diagnoseClaudeFailure, errorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";
import { pickProfile, type ProfileSelection } from "./profiles.js";
import { resolveProjectId } from "./project.js";
import {
  MAX_IDENTIFIER_CHARS,
  MAX_QUESTION_CHARS,
  MAX_RELATED_FILES,
  MAX_RELATED_FILE_CHARS,
  MAX_RELEVANT_CODE_CHARS,
  MAX_TAGS,
  MAX_TAG_CHARS,
  MAX_TASK_CHARS,
  MAX_TOPIC_HINT_CHARS,
  MAX_TRIGGER_CHARS,
  SAFE_IDENTIFIER_RE,
  buildRouterDryRunCandidates,
  logRouterRouteDecision,
  normalizeRelatedFiles,
  normalizeRouterConsultInput,
  normalizeTags,
  resolveRouterConsultDecision,
  round2,
  sanitizeRequiredText
} from "./routeDecision.js";
import { buildRouterMonitorPayload, buildRouterStatusPayload } from "./routerMonitoring.js";
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
  task_type: z.enum(["architectural", "debug", "lookup", "review", "planning"]).nullable().optional(),
  related_files: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  relevant_code: z.string(),
  question: z.string()
});

const routerConsultInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  topic_hint: z.string().nullable().optional(),
  trigger: z.string().nullable().optional(),
  task: z.string().nullable().optional(),
  task_type: z.enum(["architectural", "debug", "lookup", "review", "planning"]).nullable().optional(),
  related_files: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  relevant_code: z.string().nullable().optional(),
  question: z.string().min(1),
  tool_profile: z.enum(["bare", "focused", "agent"]).nullable().optional()
});

const routerDryRunInput = routerConsultInput.extend({
  candidate_limit: z.number().int().min(1).max(10).default(5)
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
  sample_limit: z.number().int().min(1).max(200).default(10)
});

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

const clusterReprepareInput = z.object({
  project_id: z.string().nullable().optional(),
  cluster_id: z.string().min(1),
  verification_mode: z.enum(["static", "llm"]).default("llm"),
  llm_verifier_profile: z.enum(["focused", "bare"]).default("focused")
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
  const clusterRecoveryState = createClusterRecoveryState();

  server.registerTool(
    "claude_sessions_list",
    {
      title: "List Claude sessions",
      description:
        "[OBSERVE] Returns known Claude sessions for a project without invoking Claude. Use for routing/debug visibility, not as the normal answer path.",
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
      description:
        "[OBSERVE] Returns the full registry view of a session without invoking Claude. Use to inspect memory, metadata, and recent events.",
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
      description:
        "[ANSWER EXPERT] Calls Claude in an auto-routed or selected persistent session. Prefer router_consult as the default answer entry point. Use claude_consult directly when the caller intentionally wants v1 durable-session reasoning. For better routing, provide topic_hint, related_files, tags, and task_type when the parent agent knows them. Missing metadata is allowed; the router records low metadata quality and still returns an answer.",
      inputSchema: consultInput
    },
    async (input) => {
      const validation = validateConsultToolInput(input);
      if (validation) {
        return jsonToolResult(validation, true);
      }
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const result = await consultService.consult({
        projectId,
        sessionId: input.session_id,
        topicHint: sanitizeRequiredText(input.topic_hint, MAX_TOPIC_HINT_CHARS),
        trigger: sanitizeRequiredText(input.trigger, MAX_TRIGGER_CHARS),
        task: sanitizeRequiredText(input.task, MAX_TASK_CHARS),
        taskType: input.task_type ?? null,
        relatedFiles: normalizeRelatedFiles(input.related_files ?? []),
        tags: normalizeTags(input.tags ?? []),
        relevantCode: sanitizeRequiredText(input.relevant_code, MAX_RELEVANT_CODE_CHARS),
        question: input.question
      });

      return jsonToolResult(result, "error" in result);
    }
  );

  server.registerTool(
    "router_consult",
    {
      title: "Conservative router consult",
      description:
        "[ANSWER DEFAULT] Main answer entry point for parent agents. Chooses explicit cluster_consult, explicit/exact/high-confidence session reuse, router-disambiguated low-confidence reuse, or a new durable session, and records the route decision. Strongly recommended routing hints: topic_hint (3-10 word domain phrase), related_files (paths currently relevant to the question), tags (stable domain tags), and task_type. These hints improve matching but are not required; missing hints become route_health metadata telemetry, not caller-facing errors.",
      inputSchema: routerConsultInput
    },
    async (input) => {
      const validation = validateRouterConsultToolInput(input);
      if (validation) {
        return jsonToolResult(validation, true);
      }
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      runtime.db.applyLifecycle(projectId);
      const normalizedInput = normalizeRouterConsultInput(input);
      const decision = resolveRouterConsultDecision(runtime, projectId, normalizedInput);
      logRouterRouteDecision(runtime, projectId, normalizedInput.question, decision);

      if (decision.selected_path === "cluster_consult_explicit" && decision.cluster_id) {
        const result = await consultClusterForCaller(runtime, consultService, {
          projectId,
          clusterId: decision.cluster_id,
          question: normalizedInput.question,
          toolProfile: normalizedInput.tool_profile
        }, clusterRecoveryState);
        if (!("error" in result) && isClusterConsultSuccess(result)) {
          scheduleShadowComparison(runtime, {
            projectId,
            clusterId: decision.cluster_id,
            question: normalizedInput.question,
            clusterResult: result
          });
        }
        return jsonToolResult(
          {
            project_id: projectId,
            route_decision: decision,
            ...result
          },
          "error" in result
        );
      }

      const result = await consultService.consult({
        projectId,
        sessionId: decision.session_id ?? null,
        forceNewSession: decision.force_new_session ?? false,
        forceNewSessionReason: decision.force_new_session ? decision.reason : undefined,
        forceNewSessionScore: decision.force_new_session ? decision.match_score : undefined,
        topicHint: normalizedInput.topic_hint,
        trigger: normalizedInput.trigger,
        task: normalizedInput.task,
        taskType: normalizedInput.task_type,
        relatedFiles: normalizedInput.related_files,
        tags: normalizedInput.tags,
        relevantCode: normalizedInput.relevant_code,
        question: normalizedInput.question
      });

      return jsonToolResult(
        {
          project_id: projectId,
          route_decision: decision,
          ...result
        },
        "error" in result
      );
    }
  );

  server.registerTool(
    "router_dry_run",
    {
      title: "Dry-run router decision",
      description:
        "[OBSERVE] Previews the router_consult decision without invoking Claude, creating sessions, applying lifecycle changes, or writing route events. Use to debug routing and calibration before a real answer call.",
      inputSchema: routerDryRunInput
    },
    async (input) => {
      const validation = validateRouterConsultToolInput(input);
      if (validation) {
        return jsonToolResult(validation, true);
      }
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      const normalizedInput = normalizeRouterConsultInput(input);
      const decision = resolveRouterConsultDecision(runtime, projectId, normalizedInput);
      const topSessionCandidates = buildRouterDryRunCandidates(
        runtime,
        projectId,
        normalizedInput,
        input.candidate_limit ?? 5
      );

      return jsonToolResult({
        project_id: projectId,
        checked_at: runtime.clock.nowIso(),
        dry_run: true,
        invokes_claude: false,
        writes_route_event: false,
        lifecycle_applied: false,
        route_decision: decision,
        top_session_candidates: topSessionCandidates,
        notes: [
          "This is an observe-only preview. Use router_consult to execute the selected answer path.",
          "Lifecycle transitions are intentionally not applied during dry-run, so stale active/dormant status may differ from a real router_consult after lifecycle cleanup."
        ]
      });
    }
  );

  server.registerTool(
    "claude_session_archive",
    {
      title: "Archive Claude session",
      description: "[MAINTAIN] Archives a durable Claude session. Maintenance/debug path, not a normal answer path.",
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
      description:
        "[MAINTAIN] Exits degraded mode only after a successful Claude health probe. Maintenance/debug path, not a normal answer path.",
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
      description:
        "[OBSERVE] Returns aggregate router health, stale cluster, recent error, and shadow eval status without invoking Claude.",
      inputSchema: routerStatusInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      runtime.db.applyLifecycle(projectId);
      const recentHours = input.recent_hours ?? 24;
      const warningsLimit = input.warnings_limit ?? 10;
      return jsonToolResult(buildRouterStatusPayload(runtime, projectId, recentHours, warningsLimit));
    }
  );

  server.registerTool(
    "router_monitor",
    {
      title: "Router monitor",
      description:
        "[OBSERVE] Information monitor for agents: quality stats, cache health, shadow eval health, recommendations, and next directions without invoking Claude.",
      inputSchema: routerMonitorInput
    },
    async (input) => {
      const projectId = resolveProjectId(input.project_id, runtime.cwd);
      runtime.db.applyLifecycle(projectId);
      const recentHours = input.recent_hours ?? 24;
      const requestedSampleLimit = input.sample_limit ?? 10;
      return jsonToolResult(buildRouterMonitorPayload(runtime, projectId, recentHours, requestedSampleLimit));
    }
  );

  server.registerTool(
    "cluster_prepare",
    {
      title: "Prepare cluster factsheet",
      description:
        "[MAINTAIN] Stores a static_verified factsheet, or runs no-tools LLM verification when verification_mode is llm. Maintenance path for creating/updating cache evidence.",
      inputSchema: clusterPrepareInput
    },
    async (input) => {
      const validation = validateClusterPrepareToolInput(input);
      if (validation) {
        return jsonToolResult(validation, true);
      }
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
    "cluster_reprepare",
    {
      title: "Re-prepare cluster from latest factsheet",
      description:
        "[MAINTAIN] Rebuilds a cluster from its latest stored factsheet without requiring the caller to pass factsheet JSON. Recalculates generated evidence hashes and may run no-tools LLM verification. Does not generate new facts.",
      inputSchema: clusterReprepareInput
    },
    async (input) => {
      const validation = validateClusterIdToolInput(input.cluster_id, "cluster_id");
      if (validation) {
        return jsonToolResult(validation, true);
      }
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
          errorPayload(ERROR_CODES.CLUSTER_PROJECT_MISMATCH, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_PROJECT_MISMATCH], {
            cluster_id: input.cluster_id
          }),
          true
        );
      }
      if ((input.verification_mode ?? "llm") === "llm" && runtime.degradedMode) {
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

      const sourceFactsheet = runtime.db.getLatestClusterFactsheet(input.cluster_id);
      if (!sourceFactsheet) {
        return jsonToolResult(
          errorPayload(ERROR_CODES.CLUSTER_FACTSHEET_INVALID, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_FACTSHEET_INVALID], {
            cluster_id: input.cluster_id,
            reason: "cluster has no factsheet to re-prepare"
          }),
          true
        );
      }

      const sourceFactCount = factsheetFactCount(sourceFactsheet);
      let profileSelection: ProfileSelection | null = null;
      try {
        if ((input.verification_mode ?? "llm") === "llm") {
          const availability = await runtime.getProfileAvailability();
          profileSelection = pickProfile(input.llm_verifier_profile ?? "focused", availability);
          if (profileSelection.selected === "agent") {
            throw new Error("LLM verifier cannot use agent profile");
          }
        }

        const result = await prepareCluster(runtime.db, runtime.cwd, runtime.claude, {
          projectId,
          clusterId: input.cluster_id,
          name: cluster.name,
          description: cluster.description,
          toolProfileDefault: cluster.tool_profile_default,
          staticFactsheetPolicy: cluster.static_factsheet_policy,
          factsheet: parseFactsheetContent(sourceFactsheet) as FactsheetInput,
          sourceSessionId: sourceFactsheet.source_session_id,
          gitRev: sourceFactsheet.git_rev,
          verificationMode: input.verification_mode ?? "llm",
          llmVerifierProfile: profileSelection?.selected === "bare" ? "bare" : "focused"
        });

        const coverageRetainedPercent =
          sourceFactCount > 0 ? round2((result.verified_facts / sourceFactCount) * 100) : 100;
        const coverageDropPercent = round2(100 - coverageRetainedPercent);

        runtime.db.logClusterEvent({
          clusterId: input.cluster_id,
          projectId,
          eventType: "cluster_reprepare",
          details: {
            source_factsheet_id: sourceFactsheet.id,
            source_factsheet_version: sourceFactsheet.version,
            source_fact_count: sourceFactCount,
            new_factsheet_id: result.factsheet_id,
            new_factsheet_version: result.factsheet_version,
            verified_facts: result.verified_facts,
            rejected_facts: result.rejected_facts,
            coverage_retained_percent: coverageRetainedPercent,
            coverage_drop_percent: coverageDropPercent,
            verification_mode: input.verification_mode ?? "llm"
          }
        });

        return jsonToolResult({
          project_id: projectId,
          source_factsheet_id: sourceFactsheet.id,
          source_factsheet_version: sourceFactsheet.version,
          coverage: {
            source_fact_count: sourceFactCount,
            verified_facts: result.verified_facts,
            rejected_facts: result.rejected_facts,
            retained_percent: coverageRetainedPercent,
            drop_percent: coverageDropPercent
          },
          ...(profileSelection ? { profile_selection: profileSelection } : {}),
          ...result
        });
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        const code = reason.includes("Claude") || reason.includes("Command failed")
          ? ERROR_CODES.CLAUDE_INVOCATION_FAILED
          : ERROR_CODES.CLUSTER_FACTSHEET_INVALID;
        if (code === ERROR_CODES.CLUSTER_FACTSHEET_INVALID && sourceFactCount > 0) {
          runtime.db.logClusterEvent({
            clusterId: input.cluster_id,
            projectId,
            eventType: "cluster_reprepare",
            details: {
              source_factsheet_id: sourceFactsheet.id,
              source_factsheet_version: sourceFactsheet.version,
              source_fact_count: sourceFactCount,
              new_factsheet_id: null,
              new_factsheet_version: null,
              verified_facts: 0,
              rejected_facts: sourceFactCount,
              coverage_retained_percent: 0,
              coverage_drop_percent: 100,
              verification_mode: input.verification_mode ?? "llm",
              failed: true,
              reason
            }
          });
        }
        return jsonToolResult(
          errorPayload(code, SPEC_ERROR_MESSAGES[code], {
            cluster_id: input.cluster_id,
            reason,
            details: {
              source_factsheet_id: sourceFactsheet.id,
              source_factsheet_version: sourceFactsheet.version
            }
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
      description:
        "[OBSERVE] Returns cluster metadata and the current static_verified or llm_verified factsheet without invoking Claude.",
      inputSchema: clusterGetInput
    },
    async (input) => {
      const validation = validateClusterIdToolInput(input.cluster_id, "cluster_id");
      if (validation) {
        return jsonToolResult(validation, true);
      }
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
      description:
        "[ANSWER EXPERT] Consults Claude with a verified cluster factsheet inline. Prefer router_consult unless the caller intentionally wants this exact cluster path. Revalidates/falls back internally so caller still receives an answer when Claude is available.",
      inputSchema: clusterConsultInput
    },
    async (input) => {
      const validation = validateClusterConsultToolInput(input);
      if (validation) {
        return jsonToolResult(validation, true);
      }
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
      }, clusterRecoveryState);
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
      description:
        "[OBSERVE] Returns shadow comparison win/loss/tie aggregates by cluster without invoking Claude.",
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
      description:
        "[OBSERVE] Lists recent shadow comparison records for a project. Include answers only when debugging quality cases.",
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
        "[EVAL DEBUG] Runs direct baseline and/or judge for pending or ok-unjudged shadow comparison rows. May invoke Claude. Evaluation maintenance path, not a normal answer path.",
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
        "[EVAL DEBUG] Re-runs the judge for already judged shadow comparison rows using current judge policy and current cluster factsheet ground truth. May invoke Claude; not a normal answer path.",
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
      description:
        "[MAINTAIN] Manually revalidates the latest cluster factsheet by checking scoped evidence file hashes and selectors. Normal cluster_consult/router_consult calls already revalidate/fallback internally.",
      inputSchema: clusterRefreshInput
    },
    async (input) => {
      const validation = validateClusterIdToolInput(input.cluster_id, "cluster_id");
      if (validation) {
        return jsonToolResult(validation, true);
      }
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
      description: "[OBSERVE] Lists cluster cache entries for a project without invoking Claude.",
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
      description:
        "[MAINTAIN] Archives a cluster cache entry so router_monitor stops treating it as active. Maintenance/debug path, not a normal answer path.",
      inputSchema: clusterArchiveInput
    },
    async (input) => {
      const validation = validateClusterIdToolInput(input.cluster_id, "cluster_id");
      if (validation) {
        return jsonToolResult(validation, true);
      }
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

function validateConsultToolInput(input: z.infer<typeof consultInput>): ReturnType<typeof inputValidationError> | null {
  return (
    validateRequiredTextField(input.question, "question", MAX_QUESTION_CHARS) ??
    validateOptionalIdentifier(input.session_id, "session_id") ??
    validateRequiredTextField(input.topic_hint, "topic_hint", MAX_TOPIC_HINT_CHARS) ??
    validateRequiredTextField(input.trigger, "trigger", MAX_TRIGGER_CHARS) ??
    validateRequiredTextField(input.task, "task", MAX_TASK_CHARS) ??
    validateRequiredTextField(input.relevant_code, "relevant_code", MAX_RELEVANT_CODE_CHARS) ??
    validateOptionalStringArray(input.related_files, "related_files", MAX_RELATED_FILES, MAX_RELATED_FILE_CHARS) ??
    validateOptionalStringArray(input.tags, "tags", MAX_TAGS, MAX_TAG_CHARS)
  );
}

function validateRouterConsultToolInput(input: z.infer<typeof routerConsultInput>): ReturnType<typeof inputValidationError> | null {
  return (
    validateRequiredTextField(input.question, "question", MAX_QUESTION_CHARS) ??
    validateOptionalIdentifier(input.cluster_id, "cluster_id") ??
    validateOptionalIdentifier(input.session_id, "session_id") ??
    validateOptionalTextField(input.topic_hint, "topic_hint", MAX_TOPIC_HINT_CHARS) ??
    validateOptionalTextField(input.trigger, "trigger", MAX_TRIGGER_CHARS) ??
    validateOptionalTextField(input.task, "task", MAX_TASK_CHARS) ??
    validateOptionalTextField(input.relevant_code, "relevant_code", MAX_RELEVANT_CODE_CHARS) ??
    validateOptionalStringArray(input.related_files, "related_files", MAX_RELATED_FILES, MAX_RELATED_FILE_CHARS) ??
    validateOptionalStringArray(input.tags, "tags", MAX_TAGS, MAX_TAG_CHARS)
  );
}

function validateClusterConsultToolInput(input: z.infer<typeof clusterConsultInput>): ReturnType<typeof inputValidationError> | null {
  return (
    validateClusterIdToolInput(input.cluster_id, "cluster_id") ??
    validateRequiredTextField(input.question, "question", MAX_QUESTION_CHARS)
  );
}

function validateClusterPrepareToolInput(input: z.infer<typeof clusterPrepareInput>): ReturnType<typeof inputValidationError> | null {
  return (
    validateClusterIdToolInput(input.cluster_id, "cluster_id") ??
    validateOptionalTextField(input.name, "name", MAX_TOPIC_HINT_CHARS) ??
    validateOptionalTextField(input.description, "description", MAX_TASK_CHARS)
  );
}

function validateClusterIdToolInput(value: unknown, field: string): ReturnType<typeof inputValidationError> | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return inputValidationError(`${field} must be a non-empty string`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_IDENTIFIER_CHARS || !SAFE_IDENTIFIER_RE.test(trimmed)) {
    return inputValidationError(`${field} contains unsupported characters or is too long`, {
      field,
      max_chars: MAX_IDENTIFIER_CHARS,
      allowed_pattern: SAFE_IDENTIFIER_RE.source
    });
  }
  return null;
}

function validateOptionalIdentifier(value: unknown, field: string): ReturnType<typeof inputValidationError> | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return validateClusterIdToolInput(value, field);
}

function validateRequiredTextField(value: unknown, field: string, maxChars: number): ReturnType<typeof inputValidationError> | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return inputValidationError(`${field} must be a non-empty string`, { field });
  }
  if (value.length > maxChars) {
    return inputValidationError(`${field} exceeds preflight character limit`, {
      field,
      max_chars: maxChars,
      actual_chars: value.length
    });
  }
  return null;
}

function validateOptionalTextField(value: unknown, field: string, maxChars: number): ReturnType<typeof inputValidationError> | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return inputValidationError(`${field} must be a string when provided`, { field });
  }
  if (value.length > maxChars) {
    return inputValidationError(`${field} exceeds preflight character limit`, {
      field,
      max_chars: maxChars,
      actual_chars: value.length
    });
  }
  return null;
}

function validateOptionalStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxItemChars: number
): ReturnType<typeof inputValidationError> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return inputValidationError(`${field} must be an array when provided`, { field });
  }
  if (value.length > maxItems) {
    return inputValidationError(`${field} has too many items`, {
      field,
      max_items: maxItems,
      actual_items: value.length
    });
  }
  for (const [index, item] of value.entries()) {
    if (item !== null && item !== undefined && typeof item !== "string") {
      return inputValidationError(`${field}[${index}] must be a string, null, or undefined`, { field, index });
    }
    if (typeof item === "string" && item.length > maxItemChars) {
      return inputValidationError(`${field}[${index}] exceeds preflight character limit`, {
        field,
        index,
        max_chars: maxItemChars,
        actual_chars: item.length
      });
    }
  }
  return null;
}

function inputValidationError(reason: string, details: Record<string, unknown>): ReturnType<typeof errorPayload> {
  return errorPayload(ERROR_CODES.INPUT_INVALID, SPEC_ERROR_MESSAGES[ERROR_CODES.INPUT_INVALID], {
    reason,
    details
  });
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

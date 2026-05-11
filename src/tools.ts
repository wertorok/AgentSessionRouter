import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ERROR_CODES } from "./constants.js";
import { ConsultService } from "./consult.js";
import { errorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";
import { resolveProjectId } from "./project.js";
import type { RouterRuntime } from "./runtime.js";
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

      runtime.db.archiveSession(input.session_id, input.reason);
      return jsonToolResult({
        ok: true,
        status: "archived"
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
        return jsonToolResult(
          errorPayload(ERROR_CODES.ROUTER_RESET_REJECTED, SPEC_ERROR_MESSAGES[ERROR_CODES.ROUTER_RESET_REJECTED]),
          true
        );
      }

      return jsonToolResult({
        ok: true,
        mode: "normal"
      });
    }
  );
}

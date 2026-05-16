import { ERROR_CODES, type ErrorCode } from "./constants.js";

export interface ErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    limit?: string;
    value?: number;
    detected_version?: string;
    tested_versions?: string[];
    reason?: string;
    category?: string;
    operator_action?: string;
    cluster_id?: string;
    details?: unknown;
  };
}

export function errorPayload(code: ErrorCode, message: string, extra: Omit<ErrorPayload["error"], "code" | "message"> = {}): ErrorPayload {
  return {
    error: {
      code,
      message,
      ...extra
    }
  };
}

export const SPEC_ERROR_MESSAGES = {
  [ERROR_CODES.PROJECT_MISMATCH]: "Session belongs to another project_id. Refusing to resume.",
  [ERROR_CODES.SESSION_NOT_FOUND]: "No session found for the provided session_id.",
  [ERROR_CODES.COST_LIMIT_EXCEEDED]: "Claude consult limit exceeded. Parent agent should continue without Claude escalation.",
  [ERROR_CODES.CLAUDE_INVOCATION_FAILED]: "Claude CLI failed. See session_events for raw error.",
  [ERROR_CODES.SESSION_UPDATE_PARSE_FAILED]:
    "Claude answered, but SESSION_UPDATE_JSON could not be parsed. Metadata was not updated.",
  [ERROR_CODES.CLAUDE_INCOMPATIBLE]: "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
  [ERROR_CODES.INPUT_INVALID]: "Tool input failed validation before any Claude invocation.",
  [ERROR_CODES.ROUTER_RESET_REJECTED]:
    "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
  [ERROR_CODES.CLUSTER_NOT_FOUND]: "No cluster found for the provided cluster_id.",
  [ERROR_CODES.CLUSTER_PROJECT_MISMATCH]: "Cluster belongs to another project_id. Refusing to use it.",
  [ERROR_CODES.CLUSTER_FACTSHEET_INVALID]:
    "Cluster factsheet failed static verification. Store only facts backed by local evidence.",
  [ERROR_CODES.CLUSTER_FACTSHEET_STALE]: "Cluster factsheet is stale. Run cluster_refresh before consulting.",
  [ERROR_CODES.CLUSTER_FACTSHEET_UNTRUSTED]:
    "Cluster factsheet is not LLM-verified. Run cluster_prepare with verification_mode=llm or explicitly allow static facts.",
  [ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE]:
    "Cluster factsheet evidence changed and automatic evidence revalidation could not prove the factsheet is still valid."
} as const;

export interface ClaudeFailureDiagnosis {
  reason?: string;
  category: string;
  operator_action: string;
}

export function diagnoseClaudeFailure(reason: string | undefined): ClaudeFailureDiagnosis {
  const normalized = (reason ?? "").toLowerCase();

  if (normalized.includes("credit balance is too low")) {
    return {
      reason,
      category: "claude_account_billing",
      operator_action:
        "Add Claude usage credit or switch the Claude CLI to an account with available usage, then verify with `claude -p --output-format json ping`."
    };
  }

  if (normalized.includes("you've hit your limit") || normalized.includes("you have hit your limit")) {
    return {
      reason,
      category: "claude_usage_limit",
      operator_action:
        "Wait until the Claude usage-limit reset time shown in the error, reduce live consult volume, or switch the Claude CLI to an account with available usage."
    };
  }

  if (normalized.includes("not logged in") || normalized.includes("/login")) {
    return {
      reason,
      category: "claude_auth",
      operator_action:
        "Log in to Claude CLI with `claude auth login` or complete Claude Code login, then verify with `claude auth status` and `claude -p --output-format json ping`."
    };
  }

  if (normalized.includes("sessionend hook") || normalized.includes("hook cancelled")) {
    return {
      reason,
      category: "claude_hook",
      operator_action:
        "Fix or disable the failing Claude SessionEnd hook, then verify with `claude -p --output-format json ping`."
    };
  }

  if (
    normalized.includes("enoent") ||
    normalized.includes("not recognized") ||
    normalized.includes("definitely-missing-claude-command")
  ) {
    return {
      reason,
      category: "claude_command_unavailable",
      operator_action:
        "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
    };
  }

  if (normalized.includes("json response missing") || normalized.includes("json response was not an object")) {
    return {
      reason,
      category: "claude_output_shape",
      operator_action:
        "Run `claude -p --output-format json ping`, compare the output with `src/claude.ts`, and update compatibility only after verifying the CLI output shape."
    };
  }

  return {
    reason,
    category: "claude_cli_unknown",
    operator_action:
      "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  };
}

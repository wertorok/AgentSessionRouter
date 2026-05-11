import { ERROR_CODES, type ErrorCode } from "./constants.js";

export interface ErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    limit?: string;
    value?: number;
    detected_version?: string;
    tested_versions?: string[];
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
  [ERROR_CODES.ROUTER_RESET_REJECTED]:
    "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again."
} as const;

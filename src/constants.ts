export const SESSION_STATUSES = ["active", "dormant", "archived", "orphaned"] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const EVENT_TYPES = [
  "consult",
  "new_session",
  "orphan_recovery",
  "archive",
  "dormant",
  "resume_failed",
  "parse_failed",
  "parse_failed_threshold_exceeded",
  "cost_limit_exceeded",
  "health_check_failed",
  "health_probe_passed",
  "health_probe_failed",
  "unknown_claude_version",
  "broad_cwd_warning",
  "token_anomaly",
  "resume_systematic_failure",
  "degraded_mode_entered",
  "router_reset"
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const ERROR_CODES = {
  PROJECT_MISMATCH: "PROJECT_MISMATCH",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  COST_LIMIT_EXCEEDED: "COST_LIMIT_EXCEEDED",
  CLAUDE_INVOCATION_FAILED: "CLAUDE_INVOCATION_FAILED",
  SESSION_UPDATE_PARSE_FAILED: "SESSION_UPDATE_PARSE_FAILED",
  CLAUDE_INCOMPATIBLE: "CLAUDE_INCOMPATIBLE",
  ROUTER_RESET_REJECTED: "ROUTER_RESET_REJECTED"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const CONSULT_LIKE_EVENT_TYPES: readonly EventType[] = ["consult", "new_session"];

export const DEFAULT_CONFIG = {
  storage: {
    dbPath: ".claude-session-router/sessions.sqlite",
    rawLogsDir: ".claude-session-router/raw"
  },
  limits: {
    maxConsultsPerHour: 30,
    maxConsultsPerDay: 200,
    maxTokensPerConsult: 8000,
    tokenAnomalyRatio: 4,
    tokenAnomalyMinDelta: 20_000
  },
  lifecycle: {
    defaultDormantAfterDays: 30,
    defaultArchiveAfterDays: 90
  },
  matching: {
    useAliases: true,
    useEmbeddings: false,
    thresholdUse: 0.7,
    thresholdLowConfidence: 0.55
  },
  claude: {
    command: "claude",
    outputFormat: "json",
    extraArgs: [],
    commandTimeoutMs: 90_000,
    resumeFailureWindowMinutes: 60,
    resumeFailureThreshold: 5,
    compatibilityFile: "COMPATIBILITY.md"
  }
} as const;

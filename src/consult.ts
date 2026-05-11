import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ERROR_CODES } from "./constants.js";
import { isoHoursAgo, isoMinutesAgo } from "./clock.js";
import type { SessionInspectView, SessionRecord, SessionUpdateData } from "./db.js";
import { diagnoseClaudeFailure, errorPayload, SPEC_ERROR_MESSAGES, type ErrorPayload } from "./errors.js";
import { createInternalSessionId } from "./ids.js";
import { type LockProvider } from "./locks.js";
import { findBestSessionMatch, normalizeTopicKey } from "./matching.js";
import { buildBootstrapContext, buildConsultPrompt, buildSessionContext } from "./prompt.js";
import type { RouterRuntime } from "./runtime.js";
import { parseSessionUpdate } from "./sessionUpdate.js";

export interface ClaudeConsultInput {
  projectId: string;
  sessionId?: string | null;
  topicHint: string;
  trigger: string;
  task: string;
  relevantCode: string;
  question: string;
}

export interface ConsultSuccess {
  session_id: string;
  claude_session_id: string;
  answer: string;
  routing: {
    match_score: number;
    match_reason: string;
    was_new_session: boolean;
    was_orphan_recovery: boolean;
  };
  session_update?: SessionUpdateData;
  warning?: {
    code: typeof ERROR_CODES.SESSION_UPDATE_PARSE_FAILED;
    message: string;
  };
}

export type ConsultResult = ConsultSuccess | ErrorPayload;

export class ConsultService {
  constructor(
    private readonly runtime: RouterRuntime,
    private readonly locks: LockProvider
  ) {}

  async consult(input: ClaudeConsultInput): Promise<ConsultResult> {
    if (this.runtime.degradedMode) {
      const diagnosis = diagnoseClaudeFailure(this.runtime.degradedReason);
      return errorPayload(ERROR_CODES.CLAUDE_INCOMPATIBLE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INCOMPATIBLE], {
        detected_version: this.runtime.detectedClaudeVersion,
        tested_versions: this.runtime.testedClaudeVersions,
        reason: diagnosis.reason,
        category: diagnosis.category,
        operator_action: diagnosis.operator_action
      });
    }

    return this.locks.withLock(`cost:${input.projectId}`, async () => this.consultWithCostLock(input));
  }

  private async consultWithCostLock(input: ClaudeConsultInput): Promise<ConsultResult> {
    if (!input.sessionId) {
      const topicLockKey = `${input.projectId}:${normalizeTopicKey(input.topicHint)}`;
      return this.locks.withLock(topicLockKey, async () => {
        const costLimit = this.checkAllConsultLimits(input.projectId);
        if (costLimit) {
          return costLimit;
        }
        const route = await this.resolveRoute(input);
        if ("error" in route) {
          return route;
        }
        if (route.selectedSession) {
          return this.locks.withLock(route.selectedSession.claude_session_id, async () => this.invokeClaude(input, route));
        }
        return this.invokeClaude(input, route);
      });
    }

    const explicitLockKey = `${input.projectId}:${normalizeTopicKey(input.topicHint)}`;
    return this.locks.withLock(explicitLockKey, async () => {
      const costLimit = this.checkAllConsultLimits(input.projectId);
      if (costLimit) {
        return costLimit;
      }
      const route = await this.resolveRoute(input);
      if ("error" in route) {
        return route;
      }
      const lockKey = route.selectedSession ? route.selectedSession.claude_session_id : explicitLockKey;
      if (lockKey === explicitLockKey) {
        return this.invokeClaude(input, route);
      }
      return this.locks.withLock(lockKey, async () => this.invokeClaude(input, route));
    });
  }

  private async invokeClaude(input: ClaudeConsultInput, route: RouteResolution): Promise<ConsultResult> {
    const context = route.bootstrapContext ?? buildSessionContext(route.selectedView);
    const prompt = buildConsultPrompt({
      projectId: input.projectId,
      topicHint: input.topicHint,
      trigger: input.trigger,
      task: input.task,
      relevantCode: input.relevantCode,
      question: input.question,
      context
    });

    const estimatedTokens = estimateTokens(prompt);
    if (estimatedTokens > this.runtime.config.limits.maxTokensPerConsult) {
      this.runtime.db.logEvent({
        sessionId: route.selectedSession?.id ?? null,
        projectId: input.projectId,
        eventType: "cost_limit_exceeded",
        question: input.question,
        tokensIn: estimatedTokens,
        error: "max_tokens_per_consult"
      });
      return errorPayload(
        ERROR_CODES.COST_LIMIT_EXCEEDED,
        "Claude consult limit exceeded: max_tokens_per_consult. Parent agent should continue without Claude escalation or retry later.",
        { limit: "max_tokens_per_consult", value: this.runtime.config.limits.maxTokensPerConsult }
      );
    }

    const startMs = this.runtime.clock.nowMillis();
    try {
      const claudeResponse = await this.runtime.claude.runPrompt(prompt, route.selectedSession?.claude_session_id);
      const durationMs = this.runtime.clock.nowMillis() - startMs;
      const sessionId =
        route.selectedSession?.id ??
        createInternalSessionId();

      if (!route.selectedSession) {
        this.runtime.db.createSession({
          id: sessionId,
          projectId: input.projectId,
          claudeSessionId: claudeResponse.sessionId,
          topic: input.topicHint,
          dormantAfterDays: this.runtime.config.lifecycle.defaultDormantAfterDays,
          archiveAfterDays: this.runtime.config.lifecycle.defaultArchiveAfterDays
        });
      } else {
        this.runtime.db.updateSessionLastUsed(route.selectedSession.id);
      }

      const rawResponsePath = this.writeRawResponse(sessionId, claudeResponse.result);
      const parsedUpdate = this.tryParseUpdate(sessionId, input.projectId, claudeResponse.result);
      if (parsedUpdate.update) {
        this.runtime.db.applySessionUpdate(sessionId, parsedUpdate.update);
      }

      this.runtime.db.logEvent({
        sessionId,
        projectId: input.projectId,
        eventType: route.selectedSession ? "consult" : "new_session",
        question: input.question,
        answerSummary: parsedUpdate.answer.slice(0, 300),
        rawResponsePath,
        matchScore: route.matchScore,
        matchReason: route.matchReason,
        wasNewSession: !route.selectedSession,
        wasOrphanRecovery: route.wasOrphanRecovery,
        tokensIn: claudeResponse.tokensIn ?? estimatedTokens,
        tokensOut: claudeResponse.tokensOut ?? estimateTokens(parsedUpdate.answer),
        durationMs
      });

      this.applyParseFailureThreshold(sessionId);

      return {
        session_id: sessionId,
        claude_session_id: route.selectedSession?.claude_session_id ?? claudeResponse.sessionId,
        answer: parsedUpdate.answer,
        routing: {
          match_score: route.matchScore,
          match_reason: route.matchReason,
          was_new_session: !route.selectedSession,
          was_orphan_recovery: route.wasOrphanRecovery
        },
        ...(parsedUpdate.update ? { session_update: parsedUpdate.update } : {}),
        ...(parsedUpdate.warning ? { warning: parsedUpdate.warning } : {})
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (route.selectedSession) {
        this.runtime.db.logEvent({
          sessionId: route.selectedSession.id,
          projectId: input.projectId,
          eventType: "resume_failed",
          question: input.question,
          error: message
        });
        this.applyResumeFailureThreshold();
      }

      this.runtime.db.logEvent({
        sessionId: route.selectedSession?.id ?? null,
        projectId: input.projectId,
        eventType: "health_check_failed",
        question: input.question,
        error: message
      });
      const diagnosis = diagnoseClaudeFailure(message);
      return errorPayload(ERROR_CODES.CLAUDE_INVOCATION_FAILED, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INVOCATION_FAILED], {
        reason: diagnosis.reason,
        category: diagnosis.category,
        operator_action: diagnosis.operator_action
      });
    }
  }

  private async resolveRoute(input: ClaudeConsultInput): Promise<RouteResolution | ErrorPayload> {
    if (input.sessionId) {
      const session = this.runtime.db.getSession(input.sessionId);
      if (!session) {
        return errorPayload(ERROR_CODES.SESSION_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.SESSION_NOT_FOUND]);
      }
      if (session.project_id !== input.projectId) {
        return errorPayload(ERROR_CODES.PROJECT_MISMATCH, SPEC_ERROR_MESSAGES[ERROR_CODES.PROJECT_MISMATCH]);
      }
      if (session.status === "orphaned" || session.status === "archived") {
        const oldView = this.runtime.db.getSessionView(session.id);
        const reason = session.status === "archived" ? "archived_resume" : "orphaned";
        return {
          selectedSession: null,
          selectedView: null,
          bootstrapContext: oldView ? buildBootstrapContext(oldView, reason) : undefined,
          matchScore: 0,
          matchReason: `Selected session was ${session.status}; creating replacement from registry context.`,
          wasOrphanRecovery: session.status === "orphaned"
        };
      }

      const exists = await this.runtime.claude.sessionFileExists(session.claude_session_id);
      if (!exists) {
        const oldView = this.runtime.db.getSessionView(session.id);
        this.runtime.db.markSessionOrphaned(session.id);
        return {
          selectedSession: null,
          selectedView: null,
          bootstrapContext: oldView ? buildBootstrapContext(oldView, "orphaned") : undefined,
          matchScore: 0,
          matchReason: "Selected session was orphaned; creating replacement from registry context.",
          wasOrphanRecovery: true
        };
      }

      return {
        selectedSession: session,
        selectedView: this.runtime.db.getSessionView(session.id),
        matchScore: 1,
        matchReason: "Direct session_id provided and project/Claude session health checks passed.",
        wasOrphanRecovery: false
      };
    }

    this.runtime.db.applyLifecycle(input.projectId);
    const sessions = this.runtime.db.listMatchCandidates(input.projectId, false);
    const match = findBestSessionMatch(
      sessions,
      {
        topicHint: input.topicHint,
        task: input.task,
        relevantCode: input.relevantCode,
        question: input.question
      },
      this.runtime.config.matching.thresholdUse,
      this.runtime.config.matching.thresholdLowConfidence
    );

    if (!match.session) {
      const archivedBootstrap = this.findArchivedBootstrap(input);
      if (archivedBootstrap) {
        return archivedBootstrap;
      }
      return {
        selectedSession: null,
        selectedView: null,
        matchScore: match.score,
        matchReason: match.reason,
        wasOrphanRecovery: false
      };
    }

    const selectedSession = this.runtime.db.getSession(match.session.id);
    if (selectedSession) {
      const exists = await this.runtime.claude.sessionFileExists(selectedSession.claude_session_id);
      if (!exists) {
        const oldView = this.runtime.db.getSessionView(selectedSession.id);
        this.runtime.db.markSessionOrphaned(selectedSession.id);
        return {
          selectedSession: null,
          selectedView: null,
          bootstrapContext: oldView ? buildBootstrapContext(oldView, "orphaned") : undefined,
          matchScore: match.score,
          matchReason: "Auto-routed session was orphaned; creating replacement from registry context.",
          wasOrphanRecovery: true
        };
      }
    }
    return {
      selectedSession,
      selectedView: selectedSession ? this.runtime.db.getSessionView(selectedSession.id) : null,
      matchScore: match.score,
      matchReason: match.lowConfidence ? `Low confidence auto-route. ${match.reason}` : match.reason,
      wasOrphanRecovery: false
    };
  }

  private findArchivedBootstrap(input: ClaudeConsultInput): RouteResolution | null {
    const archivedSessions = this.runtime.db
      .listMatchCandidates(input.projectId, true)
      .filter((session) => session.status === "archived");
    const match = findBestSessionMatch(
      archivedSessions,
      {
        topicHint: input.topicHint,
        task: input.task,
        relevantCode: input.relevantCode,
        question: input.question
      },
      this.runtime.config.matching.thresholdUse,
      this.runtime.config.matching.thresholdLowConfidence
    );
    if (!match.session) {
      return null;
    }

    const view = this.runtime.db.getSessionView(match.session.id);
    if (!view) {
      return null;
    }

    const archiveReason =
      this.runtime.db.getLastArchiveReason(match.session.id) === "parse_failure_threshold"
        ? "parse_failure_threshold"
        : "archived_resume";

    return {
      selectedSession: null,
      selectedView: null,
      bootstrapContext: buildBootstrapContext(view, archiveReason),
      matchScore: match.score,
      matchReason: `Archived session used as bootstrap; creating replacement. ${match.reason}`,
      wasOrphanRecovery: false
    };
  }

  private checkAllConsultLimits(projectId: string): ErrorPayload | null {
    return (
      this.checkConsultLimit(projectId, "max_consults_per_hour") ??
      this.checkConsultLimit(projectId, "max_consults_per_day")
    );
  }

  private checkConsultLimit(projectId: string, limitName: "max_consults_per_hour" | "max_consults_per_day"): ErrorPayload | null {
    const limit =
      limitName === "max_consults_per_hour"
        ? this.runtime.config.limits.maxConsultsPerHour
        : this.runtime.config.limits.maxConsultsPerDay;
    const since =
      limitName === "max_consults_per_hour"
        ? isoHoursAgo(this.runtime.clock, 1)
        : isoHoursAgo(this.runtime.clock, 24);
    const count = this.runtime.db.countConsultLikeEvents(projectId, since);
    if (count < limit) {
      return null;
    }

    this.runtime.db.logEvent({
      projectId,
      eventType: "cost_limit_exceeded",
      error: limitName
    });
    return errorPayload(
      ERROR_CODES.COST_LIMIT_EXCEEDED,
      `Claude consult limit exceeded: ${limitName}=${limit}. Parent agent should continue without Claude escalation or retry later.`,
      { limit: limitName, value: limit }
    );
  }

  private tryParseUpdate(sessionId: string, projectId: string, rawResponse: string): ParsedUpdateResult {
    try {
      const parsed = parseSessionUpdate(rawResponse);
      if (!parsed) {
        throw new Error("SESSION_UPDATE_JSON block missing");
      }
      return {
        answer: parsed.answer,
        update: parsed.update
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.runtime.db.logEvent({
        sessionId,
        projectId,
        eventType: "parse_failed",
        error: message
      });
      return {
        answer: rawResponse,
        warning: {
          code: ERROR_CODES.SESSION_UPDATE_PARSE_FAILED,
          message: SPEC_ERROR_MESSAGES[ERROR_CODES.SESSION_UPDATE_PARSE_FAILED]
        }
      };
    }
  }

  private applyParseFailureThreshold(sessionId: string): void {
    const oldestRecentConsult = this.runtime.db.oldestRecentConsultLikeEventIso(sessionId, 10);
    if (!oldestRecentConsult) {
      return;
    }

    const failures = this.runtime.db.countParseFailuresSince(sessionId, oldestRecentConsult);
    if (failures / 10 <= 0.2) {
      return;
    }

    const session = this.runtime.db.getSession(sessionId);
    if (!session || session.status === "archived") {
      return;
    }

    this.runtime.db.logEvent({
      sessionId,
      projectId: session.project_id,
      eventType: "parse_failed_threshold_exceeded",
      error: "parse_failure_threshold"
    });
    this.runtime.db.archiveSession(sessionId, "parse_failure_threshold");
  }

  private applyResumeFailureThreshold(): void {
    const since = isoMinutesAgo(this.runtime.clock, this.runtime.config.claude.resumeFailureWindowMinutes);
    const failures = this.runtime.db.countDistinctResumeFailuresSince(since);
    if (failures < this.runtime.config.claude.resumeFailureThreshold) {
      return;
    }

    this.runtime.degradedMode = true;
    this.runtime.db.logEvent({
      projectId: "router",
      eventType: "resume_systematic_failure",
      error: "resume_failure_threshold"
    });
    this.runtime.db.logEvent({
      projectId: "router",
      eventType: "degraded_mode_entered",
      error: "resume_systematic_failure"
    });
  }

  private writeRawResponse(sessionId: string, rawResponse: string): string {
    mkdirSync(this.runtime.config.storage.rawLogsDir, { recursive: true });
    const filePath = path.join(
      this.runtime.config.storage.rawLogsDir,
      `${sessionId}-${this.runtime.clock.nowMillis()}.txt`
    );
    writeFileSync(filePath, rawResponse, "utf8");
    return filePath;
  }
}

interface RouteResolution {
  selectedSession: SessionRecord | null;
  selectedView: SessionInspectView | null;
  bootstrapContext?: string;
  matchScore: number;
  matchReason: string;
  wasOrphanRecovery: boolean;
}

interface ParsedUpdateResult {
  answer: string;
  update?: SessionUpdateData;
  warning?: {
    code: typeof ERROR_CODES.SESSION_UPDATE_PARSE_FAILED;
    message: string;
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

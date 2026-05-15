import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ClaudeAdapter, ClaudeJsonResponse, HealthProbeResult } from "../src/claude.js";
import type { Clock } from "../src/clock.js";
import { loadConfig } from "../src/config.js";
import { ConsultService } from "../src/consult.js";
import { ERROR_CODES } from "../src/constants.js";
import { RouterDatabase } from "../src/db.js";
import { MemoryLockProvider } from "../src/locks.js";
import type { Logger } from "../src/logger.js";
import { RouterRuntime } from "../src/runtime.js";

describe("claude_consult service", () => {
  it("creates a new session and stores parsed metadata", async () => {
    const fixture = createRuntimeFixture();
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.routing.was_new_session).toBe(true);
    expect(result.session_update?.decisions).toEqual(["Use passport strategy"]);
    expect(fixture.runtime.db.inspectSession(result.session_id, 10)?.session.decisions).toEqual(["Use passport strategy"]);
    fixture.cleanup();
  });

  it("applies the full SESSION_UPDATE_JSON metadata payload to a new session", async () => {
    const fixture = createRuntimeFixture();
    fixture.claude.result = `Use passport and document the route.

SESSION_UPDATE_JSON:
{
  "summary": "Use passport strategy for OAuth routes.",
  "decisions": ["Use passport strategy", "Use passport strategy", "Keep refresh handling separate"],
  "open_questions": ["Confirm provider list", "Confirm callback domain"],
  "files_discussed": ["src/auth/routes.ts", "src/auth/session.ts"],
  "tags": ["Auth", "OAuth"],
  "aliases": ["Social Login", "Passport Auth"]
}`;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.answer).toBe("Use passport and document the route.");
    expect(result.session_update).toEqual({
      summary: "Use passport strategy for OAuth routes.",
      decisions: ["Use passport strategy", "Keep refresh handling separate"],
      open_questions: ["Confirm provider list", "Confirm callback domain"],
      files_discussed: ["src/auth/routes.ts", "src/auth/session.ts"],
      tags: ["auth", "oauth"],
      aliases: ["social login", "passport auth"]
    });
    expect(fixture.runtime.db.inspectSession(result.session_id, 10)?.session).toMatchObject({
      summary: "Use passport strategy for OAuth routes.",
      decisions: ["Use passport strategy", "Keep refresh handling separate"],
      open_questions: ["Confirm provider list", "Confirm callback domain"],
      files_discussed: ["src/auth/routes.ts", "src/auth/session.ts"],
      tags: ["auth", "oauth"],
      aliases: ["social login", "passport auth"]
    });
    fixture.cleanup();
  });

  it("updates resumed SESSION_UPDATE_JSON metadata with append-only registry semantics", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "existing",
      projectId: "project",
      claudeSessionId: "existing-claude",
      topic: "auth system refactor",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.applySessionUpdate("existing", {
      summary: "Initial auth summary",
      decisions: ["Use JWT"],
      open_questions: ["Old question"],
      files_discussed: ["src/auth/routes.ts"],
      tags: ["auth"],
      aliases: ["login flow"]
    });
    fixture.claude.existingSessions.add("existing-claude");
    fixture.claude.result = `Update the auth route.

SESSION_UPDATE_JSON:
{
  "summary": "Updated auth summary",
  "decisions": ["Use JWT", "Use passport strategy"],
  "open_questions": ["Confirm provider list"],
  "files_discussed": ["src/auth/routes.ts", "src/auth/passport.ts"],
  "tags": ["auth", "oauth"],
  "aliases": ["login flow", "passport auth"]
}`;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult({ ...baseInput(), sessionId: "existing" });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.session_id).toBe("existing");
    expect(result.session_update?.summary).toBe("Updated auth summary");
    expect(fixture.runtime.db.inspectSession("existing", 10)?.session).toMatchObject({
      summary: "Updated auth summary",
      decisions: ["Use JWT", "Use passport strategy"],
      open_questions: ["Confirm provider list"],
      files_discussed: ["src/auth/routes.ts", "src/auth/passport.ts"],
      tags: ["auth", "oauth"],
      aliases: ["login flow", "passport auth"]
    });
    fixture.cleanup();
  });

  it("does not corrupt existing metadata when SESSION_UPDATE_JSON is malformed", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "existing",
      projectId: "project",
      claudeSessionId: "existing-claude",
      topic: "auth system refactor",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.applySessionUpdate("existing", {
      summary: "Stable summary",
      decisions: ["Keep existing decision"],
      open_questions: ["Keep existing question"],
      files_discussed: ["src/auth/stable.ts"],
      tags: ["stable"],
      aliases: ["stable auth"]
    });
    fixture.claude.existingSessions.add("existing-claude");
    fixture.claude.result = `Answer with a broken update.

SESSION_UPDATE_JSON:
{
  "summary": "Broken replacement",
  "decisions": ["Should not persist"]
`;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult({ ...baseInput(), sessionId: "existing" });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.warning?.code).toBe(ERROR_CODES.SESSION_UPDATE_PARSE_FAILED);
    expect(result.session_update).toBeUndefined();
    expect(fixture.runtime.db.inspectSession("existing", 10)?.session).toMatchObject({
      summary: "Stable summary",
      decisions: ["Keep existing decision"],
      open_questions: ["Keep existing question"],
      files_discussed: ["src/auth/stable.ts"],
      tags: ["stable"],
      aliases: ["stable auth"]
    });
    const parseFailed = fixture.runtime.db.db
      .prepare("SELECT raw_response_path, error FROM session_events WHERE event_type = 'parse_failed'")
      .get() as { raw_response_path: string | null; error: string } | undefined;
    expect(parseFailed?.error).toContain("Expected");
    expect(parseFailed?.raw_response_path).toBeTruthy();
    fixture.cleanup();
  });

  it("auto-routes null session_id to a matching active session", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "existing",
      projectId: "project",
      claudeSessionId: "existing-claude",
      topic: "auth system refactor",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.applySessionUpdate("existing", {
      summary: "Auth decisions",
      decisions: ["Use JWT"],
      open_questions: [],
      files_discussed: ["src/auth/"],
      tags: ["auth"],
      aliases: ["login flow"]
    });
    fixture.claude.existingSessions.add("existing-claude");
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.session_id).toBe("existing");
    expect(fixture.claude.lastResumeSessionId).toBe("existing-claude");
    fixture.cleanup();
  });

  it("reuses an exact normalized topic even before metadata makes the score high", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "same-topic",
      projectId: "project",
      claudeSessionId: "same-topic-claude",
      topic: "same normalized topic",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.claude.existingSessions.add("same-topic-claude");
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult({
      ...baseInput(),
      topicHint: "same normalized topic",
      task: "Ask a second question before metadata exists",
      relevantCode: "",
      question: "Should this reuse the exact topic session?"
    });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.session_id).toBe("same-topic");
    expect(result.routing.match_reason).toContain("Exact normalized topic match");
    fixture.cleanup();
  });

  it("recovers orphaned direct sessions into a replacement session", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "old",
      projectId: "project",
      claudeSessionId: "missing-claude",
      topic: "auth system",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult({ ...baseInput(), sessionId: "old" });

    expect("error" in result).toBe(false);
    expect(fixture.runtime.db.getSession("old")?.status).toBe("orphaned");
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.routing.was_orphan_recovery).toBe(true);
    expect(result.session_id).not.toBe("old");
    fixture.cleanup();
  });

  it("recovers orphaned auto-routed sessions before resume", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "stale",
      projectId: "project",
      claudeSessionId: "missing-claude",
      topic: "auth system refactor",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.applySessionUpdate("stale", {
      summary: "Auth decisions",
      decisions: ["Use JWT"],
      open_questions: [],
      files_discussed: ["src/auth/"],
      tags: ["auth"],
      aliases: ["login flow"]
    });
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    expect(fixture.runtime.db.getSession("stale")?.status).toBe("orphaned");
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.routing.was_orphan_recovery).toBe(true);
    expect(fixture.claude.lastResumeSessionId).toBeUndefined();
    fixture.cleanup();
  });

  it("revalidates a selected session after waiting for its lock", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "existing",
      projectId: "project",
      claudeSessionId: "existing-claude",
      topic: "auth system refactor",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.claude.existingSessions.add("existing-claude");
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);
    let releaseLock!: () => void;
    const heldLock = fixture.runtime.locks.withLock(
      "existing-claude",
      async () =>
        new Promise<void>((resolve) => {
          releaseLock = resolve;
        })
    );

    const consultPromise = service.consult({ ...baseInput(), sessionId: "existing" });
    await Promise.resolve();
    await Promise.resolve();
    fixture.runtime.db.archiveSession("existing", "race archive before consult lock");
    releaseLock();
    await heldLock;
    const result = await consultPromise;

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.session_id).not.toBe("existing");
    expect(result.routing.was_new_session).toBe(true);
    expect(fixture.runtime.db.getSession("existing")?.status).toBe("archived");
    fixture.cleanup();
  });

  it("fails closed when cost limit is exceeded", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.config.limits.maxConsultsPerHour = 0;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("expected error");
    }
    expect(result.error.code).toBe(ERROR_CODES.COST_LIMIT_EXCEEDED);
    fixture.cleanup();
  });

  it("serializes cost checks for concurrent consults", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.config.limits.maxConsultsPerHour = 1;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const results = await Promise.all([service.consult(baseInput()), service.consult({ ...baseInput(), question: "Second?" })]);

    expect(results.filter((result) => "error" in result)).toHaveLength(1);
    const error = results.find((result) => "error" in result);
    if (!error || !("error" in error)) {
      throw new Error("expected one error");
    }
    expect(error.error.code).toBe(ERROR_CODES.COST_LIMIT_EXCEEDED);
    fixture.cleanup();
  });

  it("logs and returns diagnostics for suspicious Claude input token inflation", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.config.limits.tokenAnomalyRatio = 1.1;
    fixture.claude.tokensIn = 100_000;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.diagnostics?.token_anomaly?.actual_tokens_in).toBe(100_000);
    expect(result.diagnostics?.token_anomaly?.min_delta).toBe(20_000);
    const eventTypes = fixture.runtime.db.inspectSession(result.session_id, 10)?.recentEvents.map((event) => event.event_type);
    expect(eventTypes).toContain("token_anomaly");
    fixture.cleanup();
  });

  it("stores raw response path on SESSION_UPDATE_JSON parse failures", async () => {
    const fixture = createRuntimeFixture();
    fixture.claude.result = "Plain answer without the required session update block.";
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.warning?.code).toBe(ERROR_CODES.SESSION_UPDATE_PARSE_FAILED);
    const parseFailed = fixture.runtime.db.db
      .prepare("SELECT raw_response_path, error FROM session_events WHERE event_type = 'parse_failed'")
      .get() as { raw_response_path: string | null; error: string } | undefined;
    expect(parseFailed?.error).toBe("SESSION_UPDATE_JSON block missing");
    expect(parseFailed?.raw_response_path).toBeTruthy();
    fixture.cleanup();
  });

  it("returns cleaned caller answer when SESSION_UPDATE_JSON parse fails with pseudo tool calls", async () => {
    const fixture = createRuntimeFixture();
    fixture.claude.result = `I will inspect the project first.
<minimax:tool_call>
<invoke name="Grep">
<parameter name="query">router_monitor</parameter>
</invoke>
</minimax:tool_call>
Final answer from available registry context.`;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.warning?.code).toBe(ERROR_CODES.SESSION_UPDATE_PARSE_FAILED);
    expect(result.answer).toContain("I will inspect the project first.");
    expect(result.answer).toContain("Final answer from available registry context.");
    expect(result.answer).not.toContain("<minimax:tool_call>");
    expect(result.answer).not.toContain("<invoke");
    fixture.cleanup();
  });

  it("does not return raw pseudo tool-call markup when no caller answer remains", async () => {
    const fixture = createRuntimeFixture();
    fixture.claude.result = `<minimax:tool_call>
<invoke name="Grep">
<parameter name="query">router_monitor</parameter>
</invoke>
</minimax:tool_call>`;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.answer).toContain("Claude did not produce a caller-facing answer");
    expect(result.answer).not.toContain("<minimax:tool_call>");
    expect(result.answer).not.toContain("<invoke");
    fixture.cleanup();
  });

  it("archives sessions with recurring SESSION_UPDATE_JSON parse failures and bootstraps a replacement", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.db.createSession({
      id: "flaky",
      projectId: "project",
      claudeSessionId: "flaky-claude",
      topic: "auth system refactor",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.applySessionUpdate("flaky", {
      summary: "Stable summary before parser failures",
      decisions: ["Keep stable metadata"],
      open_questions: ["Keep stable open question"],
      files_discussed: ["src/auth/stable.ts"],
      tags: ["stable"],
      aliases: ["stable auth"]
    });
    fixture.claude.existingSessions.add("flaky-claude");
    fixture.claude.result = `Answer without valid metadata.

SESSION_UPDATE_JSON:
{
  "summary": "broken"
`;
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    for (let index = 0; index < 10; index += 1) {
      const result = await service.consult({ ...baseInput(), sessionId: "flaky" });
      expect("error" in result).toBe(false);
    }

    const archived = fixture.runtime.db.getSession("flaky");
    const archivedView = fixture.runtime.db.inspectSession("flaky", 20)?.session;
    expect(archived?.status).toBe("archived");
    expect(fixture.runtime.db.getLastArchiveReason("flaky")).toBe("parse_failure_threshold");
    expect(archivedView).toMatchObject({
      summary: "Stable summary before parser failures",
      decisions: ["Keep stable metadata"],
      open_questions: ["Keep stable open question"],
      files_discussed: ["src/auth/stable.ts"],
      tags: ["stable"],
      aliases: ["stable auth"]
    });
    const thresholdEvent = fixture.runtime.db.db
      .prepare("SELECT event_type, error FROM session_events WHERE session_id = ? AND event_type = ?")
      .get("flaky", "parse_failed_threshold_exceeded") as { event_type: string; error: string } | undefined;
    expect(thresholdEvent).toEqual({
      event_type: "parse_failed_threshold_exceeded",
      error: "parse_failure_threshold"
    });

    fixture.claude.result = `Replacement answer with clean metadata.

SESSION_UPDATE_JSON:
{
  "summary": "Replacement session is healthy.",
  "decisions": ["Use replacement after parse threshold"],
  "open_questions": [],
  "files_discussed": ["src/auth/replacement.ts"],
  "tags": ["auth"],
  "aliases": ["replacement auth"]
}`;
    const replacement = await service.consult(baseInput());

    expect("error" in replacement).toBe(false);
    if ("error" in replacement) {
      throw new Error("unexpected error");
    }
    expect(replacement.session_id).not.toBe("flaky");
    expect(replacement.routing.was_new_session).toBe(true);
    expect(replacement.routing.match_reason).toContain("Archived session used as bootstrap");
    expect(replacement.routing.match_reason).toContain("parse_failure_threshold");
    expect(fixture.runtime.db.inspectSession(replacement.session_id, 10)?.session).toMatchObject({
      summary: "Replacement session is healthy.",
      decisions: ["Use replacement after parse threshold"],
      files_discussed: ["src/auth/replacement.ts"],
      tags: ["auth"],
      aliases: ["replacement auth"]
    });
    fixture.cleanup();
  });

  it("logs broad cwd warnings during boot", async () => {
    const fixture = createRuntimeFixture(os.homedir());

    await fixture.runtime.boot();

    const warning = fixture.runtime.db.db
      .prepare("SELECT event_type, error FROM session_events WHERE event_type = 'broad_cwd_warning'")
      .get() as { event_type: string; error: string } | undefined;
    expect(warning?.error).toContain("home directory");
    fixture.cleanup();
  });

  it("returns incompatible when runtime is degraded", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.degradedMode = true;
    fixture.runtime.degradedReason = "Claude CLI returned error result: Not logged in · Please run /login";
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("expected error");
    }
    expect(result.error.code).toBe(ERROR_CODES.CLAUDE_INCOMPATIBLE);
    expect(result.error.category).toBe("claude_auth");
    expect(result.error.operator_action).toContain("claude auth status");
    fixture.cleanup();
  });

  it("returns an actionable usage-limit diagnostic when Claude quota is exhausted", async () => {
    const fixture = createRuntimeFixture();
    fixture.runtime.degradedMode = true;
    fixture.runtime.degradedReason = "Claude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)";
    const service = new ConsultService(fixture.runtime, fixture.runtime.locks);

    const result = await service.consult(baseInput());

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("expected error");
    }
    expect(result.error.code).toBe(ERROR_CODES.CLAUDE_INCOMPATIBLE);
    expect(result.error.category).toBe("claude_usage_limit");
    expect(result.error.operator_action).toContain("usage-limit reset time");
    fixture.cleanup();
  });
});

class FakeClaude implements ClaudeAdapter {
  existingSessions = new Set<string>();
  lastResumeSessionId: string | undefined;
  tokensIn = 100;
  tokensOut = 50;
  result = `Use the passport strategy.

SESSION_UPDATE_JSON:
{
  "summary": "Use passport strategy for OAuth.",
  "decisions": ["Use passport strategy"],
  "open_questions": ["Confirm providers"],
  "files_discussed": ["src/auth/routes.ts"],
  "tags": ["auth", "oauth"],
  "aliases": ["social login"]
}`;

  async getVersion(): Promise<string> {
    return "VERSION_A";
  }

  async runPrompt(_prompt: string, resumeSessionId?: string): Promise<ClaudeJsonResponse> {
    this.lastResumeSessionId = resumeSessionId;
    return {
      sessionId: resumeSessionId ?? "new-claude-session",
      result: this.result,
      tokensIn: this.tokensIn,
      tokensOut: this.tokensOut
    };
  }

  async healthProbe(): Promise<HealthProbeResult> {
    return {
      ok: true,
      degraded: false,
      detectedVersion: "VERSION_A",
      testedVersions: ["VERSION_A"],
      unknownVersion: false
    };
  }

  async sessionFileExists(claudeSessionId: string): Promise<boolean> {
    return this.existingSessions.has(claudeSessionId);
  }
}

class FakeClock implements Clock {
  now(): Date {
    throw new Error("FakeClock.now is not used by these tests");
  }

  nowIso(): string {
    return "2026-05-11T12:00:00.000Z";
  }

  nowMillis(): number {
    return 1_778_499_200_000;
  }
}

class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

function baseInput() {
  return {
    projectId: "project",
    sessionId: null,
    topicHint: "auth system refactor",
    trigger: "AGENTS.md auth escalation",
    task: "Add OAuth in src/auth/routes.ts",
    relevantCode: "src/auth/routes.ts",
    question: "Should we use passport strategy?"
  };
}

function createRuntimeFixture(runtimeCwd?: string): {
  runtime: RouterRuntime;
  claude: FakeClaude;
  cleanup: () => void;
} {
  const dir = path.join(os.tmpdir(), `router-consult-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const clock = new FakeClock();
  const config = loadConfig({ cwd: dir });
  const db = RouterDatabase.open(config.storage.dbPath, clock);
  const claude = new FakeClaude();
  const runtime = new RouterRuntime(runtimeCwd ?? dir, config, db, claude, new MemoryLockProvider(), clock, new NoopLogger());

  return {
    runtime,
    claude,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

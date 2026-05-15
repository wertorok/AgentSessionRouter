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

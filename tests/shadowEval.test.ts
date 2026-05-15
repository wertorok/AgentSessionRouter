import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ClaudeAdapter, ClaudeJsonResponse, ClaudePromptOptions, HealthProbeResult } from "../src/claude.js";
import type { Clock } from "../src/clock.js";
import type { ClusterConsultSuccess } from "../src/clusterConsult.js";
import { loadConfig } from "../src/config.js";
import { RouterDatabase } from "../src/db.js";
import { MemoryLockProvider } from "../src/locks.js";
import type { Logger } from "../src/logger.js";
import { RouterRuntime } from "../src/runtime.js";
import { parseJudgeResponse, runShadowComparison } from "../src/shadowEval.js";

describe("shadow comparison eval", () => {
  it("runs direct fresh, judges blind answers, and stores decoded scores", async () => {
    const claude = new FakeClaude();
    const fixture = createShadowFixture(claude);

    const comparison = await runShadowComparison(fixture.runtime, {
      projectId: "project",
      clusterId: "router-ops",
      question: "Which answer is better?",
      clusterResult: clusterResult("Cluster answer.", 7)
    });

    expect(comparison.shadow_status).toBe("ok");
    expect(comparison.direct_answer).toBe("Direct answer.");
    expect(comparison.cluster_cost_usd).toBe(0.007);
    expect(comparison.direct_cost_usd).toBe(0.011);
    expect(comparison.cluster_score).toBeGreaterThanOrEqual(2);
    expect(comparison.direct_score).toBeGreaterThanOrEqual(2);
    expect(["cluster", "direct", "tie"]).toContain(comparison.preferred);
    expect(comparison.judged_at).toBe("2026-05-13T00:00:00.000Z");
    expect(claude.judgeOptions?.extraArgs).toEqual(["--tools", ""]);
    expect(claude.judgeOptions?.includeConfiguredExtraArgs).toBe(false);
    fixture.cleanup();
  });

  it("records shadow failure without judging", async () => {
    const fixture = createShadowFixture(new FakeClaude({ failDirect: true }));

    const comparison = await runShadowComparison(fixture.runtime, {
      projectId: "project",
      clusterId: "router-ops",
      question: "What fails?",
      clusterResult: clusterResult("Cluster answer.", 7)
    });

    expect(comparison.shadow_status).toBe("failed_other");
    expect(comparison.shadow_error).toContain("direct failed");
    expect(comparison.judged_at).toBeNull();
    fixture.cleanup();
  });

  it("parses fenced judge JSON", () => {
    expect(
      parseJudgeResponse(`\`\`\`json
{
  "answer_a_score": 3,
  "answer_a_errors": [],
  "answer_b_score": 2,
  "answer_b_errors": ["missing detail"],
  "preferred": "a",
  "reasoning": "A is more complete."
}
\`\`\``)
    ).toMatchObject({
      answerAScore: 3,
      answerBScore: 2,
      answerBErrors: ["missing detail"],
      preferred: "a"
    });
  });
});

class FakeClaude implements ClaudeAdapter {
  judgeOptions: ClaudePromptOptions | undefined;

  constructor(private readonly options: { failDirect?: boolean } = {}) {}

  async getVersion(): Promise<string> {
    return "VERSION_A";
  }

  async runPrompt(): Promise<ClaudeJsonResponse> {
    if (this.options.failDirect) {
      throw new Error("direct failed");
    }
    return {
      sessionId: "direct-session",
      result: "Direct answer.",
      tokensIn: 10,
      tokensOut: 5,
      totalCostUsd: 0.011
    };
  }

  async runPromptWithOptions(_prompt: string, options: ClaudePromptOptions): Promise<ClaudeJsonResponse> {
    this.judgeOptions = options;
    return {
      sessionId: "judge-session",
      result: JSON.stringify({
        answer_a_score: 3,
        answer_a_errors: [],
        answer_b_score: 2,
        answer_b_errors: ["missing detail"],
        preferred: "a",
        reasoning: "A is more complete."
      }),
      tokensIn: 20,
      tokensOut: 10
    };
  }

  async healthProbe(): Promise<HealthProbeResult> {
    return {
      ok: true,
      degraded: false,
      testedVersions: ["VERSION_A"],
      unknownVersion: false
    };
  }

  async sessionFileExists(): Promise<boolean> {
    return true;
  }
}

class FakeClock implements Clock {
  now(): Date {
    return new Date("2026-05-13T00:00:00.000Z");
  }

  nowIso(): string {
    return "2026-05-13T00:00:00.000Z";
  }

  nowMillis(): number {
    return 1_778_630_400_000;
  }
}

class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

function clusterResult(answer: string, durationMs: number): ClusterConsultSuccess {
  return {
    cluster_id: "router-ops",
    factsheet_id: "factsheet-1",
    factsheet_version: 1,
    factsheet_status: "llm_verified",
    tool_profile: "bare",
    profile_selection: {
      requested: "bare",
      selected: "bare",
      downgraded: false
    },
    used_fork: false,
    claude_session_id: "cluster-session",
    answer,
    metrics: {
      duration_ms: durationMs,
      tokens_in: 1,
      tokens_out: 1,
      cost_usd: 0.007
    }
  };
}

function createShadowFixture(claude: FakeClaude): { runtime: RouterRuntime; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-shadow-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const config = loadConfig({ cwd: dir });
  const clock = new FakeClock();
  const db = RouterDatabase.open(path.join(dir, "sessions.sqlite"), clock);
  const runtime = new RouterRuntime(dir, config, db, claude, new MemoryLockProvider(), clock, new NoopLogger());
  return {
    runtime,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

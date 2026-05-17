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
    insertFactsheet(fixture.runtime.db);

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
    expect(claude.judgeOptions?.extraArgs).toEqual(["--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']);
    expect(claude.judgeOptions?.includeConfiguredExtraArgs).toBe(false);
    expect(claude.judgePrompt).toContain("Verified cluster factsheet ground truth");
    expect(claude.judgePrompt).toContain("The bare profile uses --bare --tools");
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

  it("retries judge responses that are not parseable JSON", async () => {
    const claude = new FakeClaude({ invalidJudgeResponses: 1 });
    const fixture = createShadowFixture(claude);

    const comparison = await runShadowComparison(fixture.runtime, {
      projectId: "project",
      clusterId: "router-ops",
      question: "Which answer is better?",
      clusterResult: clusterResult("Cluster answer.", 7)
    });

    expect(comparison.judged_at).toBe("2026-05-13T00:00:00.000Z");
    expect(claude.judgeAttempts).toBe(2);
    fixture.cleanup();
  });

  it("keeps unjudged comparison visible when judge retries never return JSON", async () => {
    const claude = new FakeClaude({ invalidJudgeResponses: 3 });
    const fixture = createShadowFixture(claude);

    await expect(
      runShadowComparison(fixture.runtime, {
        projectId: "project",
        clusterId: "router-ops",
        question: "Which answer is better?",
        clusterResult: clusterResult("Cluster answer.", 7)
      })
    ).rejects.toThrow("Judge response did not include a JSON object");

    expect(claude.judgeAttempts).toBe(3);
    const unjudged = fixture.runtime.db.listUnjudgedConsultComparisons({
      projectId: "project",
      limit: 10
    });
    expect(unjudged).toHaveLength(1);
    expect(unjudged[0].shadow_status).toBe("ok");
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
  judgePrompt = "";
  judgeAttempts = 0;

  constructor(private readonly options: { failDirect?: boolean; invalidJudgeResponses?: number } = {}) {}

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

  async runPromptWithOptions(prompt: string, options: ClaudePromptOptions): Promise<ClaudeJsonResponse> {
    this.judgeOptions = options;
    this.judgePrompt = prompt;
    this.judgeAttempts += 1;
    if (this.judgeAttempts <= (this.options.invalidJudgeResponses ?? 0)) {
      return {
        sessionId: "judge-session",
        result: "not json",
        tokensIn: 20,
        tokensOut: 10
      };
    }
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

function insertFactsheet(db: RouterDatabase): void {
  db.upsertCluster({
    id: "router-ops",
    projectId: "project",
    name: "Router ops",
    toolProfileDefault: "bare"
  });
  db.insertClusterFactsheet({
    id: "factsheet-1",
    clusterId: "router-ops",
    status: "llm_verified",
    trustState: "llm_verified",
    contentJson: JSON.stringify({
      facts: [
        {
          id: "bare-profile",
          claim: "The bare profile uses --bare --tools \"\"."
        }
      ]
    }),
    fileHashes: []
  });
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

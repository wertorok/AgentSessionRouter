import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import type { ClaudeAdapter, ClaudeJsonResponse, ClaudePromptOptions, HealthProbeResult } from "../src/claude.js";
import type { Clock } from "../src/clock.js";
import { loadConfig } from "../src/config.js";
import { ERROR_CODES } from "../src/constants.js";
import { RouterDatabase } from "../src/db.js";
import { MemoryLockProvider, type LockProvider } from "../src/locks.js";
import type { Logger } from "../src/logger.js";
import { RouterRuntime } from "../src/runtime.js";
import { registerTools } from "../src/tools.js";

describe("cluster MCP tools", () => {
  it("prepares, gets, and lists a static cluster factsheet", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = ['--tools', ''];\n");

    const prepare = await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "config-and-cwd-isolation",
      name: "Config and cwd isolation",
      tool_profile_default: "bare",
      factsheet: {
        summary: "Static config facts.",
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists in config.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    const prepared = parseToolJson(prepare);

    const get = parseToolJson(
      await server.call("cluster_get", {
        project_id: "project",
        cluster_id: "config-and-cwd-isolation",
        include_factsheet: true
      })
    );
    const list = parseToolJson(await server.call("cluster_list", { project_id: "project" }));

    expect(prepare.isError).toBeFalsy();
    expect(prepared.verification_stage).toBe("static");
    expect(prepared.trust_state).toBe("static_verified");
    expect(get.cluster.trust_state).toBe("static_verified");
    expect(get.current_factsheet.status).toBe("static_verified");
    expect(get.current_factsheet.content.facts).toHaveLength(1);
    expect(get.current_factsheet.content.facts[0].evidence[0].snippet_hash).toMatch(/^sha256:/);
    expect(get.file_hashes).toHaveLength(1);
    expect(list.clusters).toHaveLength(1);
    expect(list.clusters[0].current_factsheet.fact_count).toBe(1);
    fixture.cleanup();
  });

  it("returns project mismatch for cluster ownership conflicts", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    await server.call("cluster_prepare", {
      project_id: "project-a",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const result = await server.call("cluster_get", {
      project_id: "project-b",
      cluster_id: "router-ops"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBe(true);
    expect(payload.error.code).toBe(ERROR_CODES.CLUSTER_PROJECT_MISMATCH);
    fixture.cleanup();
  });

  it("runs LLM verification when requested by cluster_prepare", async () => {
    const claude = new FakeClaude({
      facts: [{ id: "extra-args", verdict: "VERIFIED", reason: "Evidence supports the claim." }]
    });
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    const result = await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      verification_mode: "llm",
      llm_verifier_profile: "focused",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.verification_stage).toBe("llm");
    expect(payload.trust_state).toBe("llm_verified");
    expect(payload.profile_selection).toEqual({
      requested: "focused",
      selected: "focused",
      downgraded: false
    });
    expect(payload.factsheet.facts[0].confidence).toBe("llm_verified");
    expect(claude.lastOptions?.extraArgs).toEqual(["--tools", ""]);
    fixture.cleanup();
  });

  it("downgrades LLM verifier from bare to focused when bare probe fails", async () => {
    const claude = new FakeClaude(
      {
        facts: [{ id: "extra-args", verdict: "VERIFIED", reason: "Evidence supports the claim." }]
      },
      { failBareProbe: true }
    );
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    const result = await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      verification_mode: "llm",
      llm_verifier_profile: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    const payload = parseToolJson(result);
    const events = fixture.runtime.db.db
      .prepare("SELECT event_type FROM cluster_events WHERE cluster_id = ? ORDER BY id")
      .all("router-ops") as Array<{ event_type: string }>;

    expect(result.isError).toBeFalsy();
    expect(payload.profile_selection).toMatchObject({
      requested: "bare",
      selected: "focused",
      downgraded: true
    });
    expect(payload.verifier_metrics.tool_profile).toBe("focused");
    expect(claude.lastOptions?.extraArgs).toEqual(["--tools", ""]);
    expect(events.map((event) => event.event_type)).toContain("tool_profile_downgraded");
    fixture.cleanup();
  });

  it("consults a cluster through the MCP tool", async () => {
    const claude = new FakeClaude({
      facts: [{ id: "extra-args", verdict: "VERIFIED", reason: "Evidence supports the claim." }]
    });
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      verification_mode: "llm",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });
    claude.verifierResult = "Cluster answer.";
    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer.");
    expect(payload.used_fork).toBe(false);
    expect(payload.tool_profile).toBe("bare");
    expect(claude.lastOptions?.appendSystemPrompt).toContain("extraArgs exists");
    fixture.cleanup();
  });

  it("uses the fast path when evidence files are unchanged", async () => {
    const claude = new FakeClaude("Cluster answer.");
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?",
      allow_static_factsheet: true
    });
    const payload = parseToolJson(result);
    const events = fixture.runtime.db.db
      .prepare("SELECT event_type FROM cluster_events WHERE cluster_id = ? ORDER BY id")
      .all("router-ops") as Array<{ event_type: string }>;

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer.");
    expect(events.map((event) => event.event_type)).not.toContain("evidence_revalidated");
    fixture.cleanup();
  });

  it("revalidates changed files when selectors and snippets still match", async () => {
    const claude = new FakeClaude("Cluster answer after revalidation.");
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ prefixLine: "const unrelatedChange = 1;" }));

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?",
      allow_static_factsheet: true
    });
    const payload = parseToolJson(result);
    const latest = fixture.runtime.db.getLatestClusterFactsheet("router-ops");
    const events = clusterEventTypes(fixture.runtime.db, "router-ops");

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer after revalidation.");
    expect(payload.auto_refresh).toBeUndefined();
    expect(latest?.version).toBe(2);
    expect(latest?.status).toBe("static_verified");
    expect(fixture.runtime.db.getCluster("project", "router-ops")?.status).toBe("active");
    expect(events).toContain("cluster_refresh_required");
    expect(events).toContain("evidence_revalidated");
    fixture.cleanup();
  });

  it("revalidates when a selector moves but its snippet stays the same", async () => {
    const claude = new FakeClaude("Cluster answer after move.");
    const fixture = createToolFixture(claude);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ leadingLines: ["// inserted line A", "// inserted line B"] }));

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?",
      allow_static_factsheet: true
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.answer).toBe("Cluster answer after move.");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("evidence_revalidated");
    fixture.cleanup();
  });

  it("does not consult from a factsheet when a selector is deleted", async () => {
    const fixture = createToolFixture(new FakeClaude("should not be used"));
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithoutExtraArgs());

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?",
      allow_static_factsheet: true
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBe(true);
    expect(payload.error.code).toBe(ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE);
    expect(JSON.stringify(payload.error.details)).toContain("selector not found");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("evidence_revalidation_failed");
    fixture.cleanup();
  });

  it("rejects partial evidence revalidation even if retained-ratio config is lowered", async () => {
    const fixture = createToolFixture(new FakeClaude("should not be used"));
    fixture.runtime.config.cluster.autoRefreshMinRetainedRatio = 0.5;
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, `${configWithExtraArgs()}\nexport const keptSelector = true;\n`);

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          },
          {
            id: "kept-selector",
            claim: "keptSelector exists.",
            evidence: [{ path: "src/config.ts", selector: "keptSelector" }]
          }
        ]
      }
    });
    writeFileSync(configPath, `${configWithoutExtraArgs()}\nexport const keptSelector = true;\n`);

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config fields exist?",
      allow_static_factsheet: true
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBe(true);
    expect(payload.error.code).toBe(ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE);
    expect(payload.error.details.revalidated_facts).toBe(1);
    expect(payload.error.details.original_facts).toBe(2);
    fixture.cleanup();
  });

  it("does not consult from a factsheet when selector snippet content changes", async () => {
    const fixture = createToolFixture(new FakeClaude("should not be used"));
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ nearbyLine: "const nearSelector = 42;" }));

    const result = await server.call("cluster_consult", {
      project_id: "project",
      cluster_id: "router-ops",
      question: "What config field exists?",
      allow_static_factsheet: true
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBe(true);
    expect(payload.error.code).toBe(ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE);
    expect(JSON.stringify(payload.error.details)).toContain("snippet changed");
    expect(clusterEventTypes(fixture.runtime.db, "router-ops")).toContain("evidence_revalidation_failed");
    fixture.cleanup();
  });

  it("serializes concurrent stale consult revalidation per cluster", async () => {
    const locks = new TrackingLockProvider();
    const claude = new FakeClaude("Cluster answer after locked revalidation.");
    const fixture = createToolFixture(claude, locks);
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, configWithExtraArgs());

    await prepareExtraArgsCluster(server);
    writeFileSync(configPath, configWithExtraArgs({ prefixLine: "const unrelatedChange = 1;" }));

    const [first, second] = await Promise.all([
      server.call("cluster_consult", {
        project_id: "project",
        cluster_id: "router-ops",
        question: "What config field exists?",
        allow_static_factsheet: true
      }),
      server.call("cluster_consult", {
        project_id: "project",
        cluster_id: "router-ops",
        question: "What config field exists?",
        allow_static_factsheet: true
      })
    ]);

    expect(first.isError).toBeFalsy();
    expect(second.isError).toBeFalsy();
    expect(locks.maxActiveFor("cluster-evidence-revalidation:project:router-ops")).toBe(1);
    expect(clusterEventTypes(fixture.runtime.db, "router-ops").filter((event) => event === "evidence_revalidated")).toHaveLength(1);
    fixture.cleanup();
  });

  it("refreshes a cluster factsheet through the MCP tool", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");

    await server.call("cluster_prepare", {
      project_id: "project",
      cluster_id: "router-ops",
      tool_profile_default: "bare",
      factsheet: {
        facts: [
          {
            id: "extra-args",
            claim: "extraArgs exists.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          }
        ]
      }
    });

    const result = await server.call("cluster_refresh", {
      project_id: "project",
      cluster_id: "router-ops",
      mode: "verify_only"
    });
    const payload = parseToolJson(result);

    expect(result.isError).toBeFalsy();
    expect(payload.fresh).toBe(true);
    expect(payload.mode).toBe("verify_only");
    expect(payload.changed_files).toEqual([]);
    fixture.cleanup();
  });

  it("returns comparison stats and list through MCP tools", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-1",
      projectId: "project",
      clusterId: "router-ops",
      question: "What config field exists?",
      clusterAnswer: "cluster",
      clusterDurationMs: 10
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-1",
      status: "ok",
      directAnswer: "direct",
      directDurationMs: 20
    });
    fixture.runtime.db.updateConsultComparisonJudge({
      id: "cmp-1",
      clusterScore: 3,
      directScore: 2,
      preferred: "cluster",
      clusterErrors: [],
      directErrors: ["missing detail"],
      judgeReasoning: "cluster wins"
    });

    const stats = parseToolJson(await server.call("comparison_stats", { project_id: "project" }));
    const list = parseToolJson(
      await server.call("comparison_list", {
        project_id: "project",
        include_answers: false
      })
    );

    expect(stats.stats).toEqual([
      {
        cluster_id: "router-ops",
        n: 1,
        cluster_q: 3,
        direct_q: 2,
        gap: -1,
        cluster_wins: 1,
        direct_wins: 0,
        ties: 0
      }
    ]);
    expect(list.comparisons).toHaveLength(1);
    expect(list.comparisons[0].cluster_answer).toBe("[omitted]");
    expect(list.comparisons[0].direct_answer).toBe("[omitted]");
    fixture.cleanup();
  });

  it("returns aggregate router status with stale cluster and shadow eval warnings", async () => {
    const fixture = createToolFixture();
    const server = new FakeServer();
    registerTools(server as unknown as McpServer, fixture.runtime);
    fixture.runtime.db.createSession({
      id: "session-1",
      projectId: "project",
      claudeSessionId: "claude-session-1",
      topic: "Router ops",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });
    fixture.runtime.db.logEvent({
      sessionId: "session-1",
      projectId: "project",
      eventType: "parse_failed",
      error: "bad SESSION_UPDATE_JSON"
    });
    fixture.runtime.db.upsertCluster({
      id: "router-ops",
      projectId: "project",
      name: "Router ops",
      toolProfileDefault: "bare"
    });
    const factsheet = fixture.runtime.db.insertClusterFactsheet({
      id: "factsheet-1",
      clusterId: "router-ops",
      status: "static_verified",
      trustState: "static_verified",
      contentJson: JSON.stringify({ facts: [] }),
      fileHashes: []
    });
    fixture.runtime.db.markClusterFactsheetStale(factsheet.id);
    fixture.runtime.db.logClusterEvent({
      clusterId: "router-ops",
      projectId: "project",
      eventType: "cluster_refresh_required"
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-pending",
      projectId: "project",
      clusterId: "router-ops",
      question: "What is stale?",
      clusterAnswer: "cluster",
      clusterDurationMs: 1
    });
    fixture.runtime.db.insertConsultComparison({
      id: "cmp-failed",
      projectId: "project",
      clusterId: "router-ops",
      question: "What failed?",
      clusterAnswer: "cluster",
      clusterDurationMs: 1
    });
    fixture.runtime.db.updateConsultComparisonDirect({
      id: "cmp-failed",
      status: "failed_auth",
      shadowError: "auth failed"
    });
    fixture.runtime.config.eval.shadowMode = true;

    const status = parseToolJson(
      await server.call("router_status", {
        project_id: "project",
        recent_hours: 24,
        warnings_limit: 10
      })
    );

    expect(status.mode).toBe("normal");
    expect(status.v1_sessions.active).toBe(1);
    expect(status.v2_clusters.stale).toBe(1);
    expect(status.v2_clusters.stale_clusters[0].id).toBe("router-ops");
    expect(status.recent_errors.session_events[0]).toMatchObject({ event_type: "parse_failed", count: 1 });
    expect(status.recent_errors.cluster_events[0]).toMatchObject({ event_type: "cluster_refresh_required", count: 1 });
    expect(status.shadow_eval).toMatchObject({
      enabled: true,
      total: 2,
      pending: 1,
      failed_auth: 1
    });
    expect(status.warnings.some((warning: string) => warning.includes("router-ops"))).toBe(true);
    expect(status.warnings.some((warning: string) => warning.includes("Shadow eval"))).toBe(true);
    fixture.cleanup();
  });
});

class FakeServer {
  private readonly handlers = new Map<string, (input: Record<string, unknown>) => Promise<CallToolResult>>();

  registerTool(
    name: string,
    _options: unknown,
    handler: (input: Record<string, unknown>) => Promise<CallToolResult>
  ): void {
    this.handlers.set(name, handler);
  }

  async call(name: string, input: Record<string, unknown>): Promise<CallToolResult> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`missing tool: ${name}`);
    }
    return handler(input);
  }
}

class FakeClaude implements ClaudeAdapter {
  lastOptions: ClaudePromptOptions | undefined;

  constructor(
    public verifierResult: unknown = { facts: [] },
    private readonly options: { failBareProbe?: boolean } = {}
  ) {}

  async getVersion(): Promise<string> {
    return "VERSION_A";
  }

  async runPrompt(_prompt: string, resumeSessionId?: string): Promise<ClaudeJsonResponse> {
    return {
      sessionId: resumeSessionId ?? "new-session",
      result: "ok",
      tokensIn: 1,
      tokensOut: 1
    };
  }

  async runPromptWithOptions(_prompt: string, options: ClaudePromptOptions): Promise<ClaudeJsonResponse> {
    if (this.options.failBareProbe && _prompt.includes("PROFILE_OK") && options.extraArgs?.includes("--bare")) {
      throw new Error("bare auth failed");
    }
    this.lastOptions = options;
    return {
      sessionId: "verifier-session",
      result: typeof this.verifierResult === "string" ? this.verifierResult : JSON.stringify(this.verifierResult),
      tokensIn: 10,
      tokensOut: 5
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

  async sessionFileExists(): Promise<boolean> {
    return true;
  }
}

class TrackingLockProvider implements LockProvider {
  private readonly inner = new MemoryLockProvider();
  private readonly active = new Map<string, number>();
  private readonly maxActive = new Map<string, number>();

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return this.inner.withLock(key, async () => {
      const active = (this.active.get(key) ?? 0) + 1;
      this.active.set(key, active);
      this.maxActive.set(key, Math.max(this.maxActive.get(key) ?? 0, active));
      await Promise.resolve();
      try {
        return await fn();
      } finally {
        this.active.set(key, (this.active.get(key) ?? 1) - 1);
      }
    });
  }

  maxActiveFor(key: string): number {
    return this.maxActive.get(key) ?? 0;
  }
}

class FakeClock implements Clock {
  now(): Date {
    return new Date("2026-05-11T12:00:00.000Z");
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

function parseToolJson(result: CallToolResult): any {
  const content = result.content[0];
  if (content?.type !== "text") {
    throw new Error("expected text result");
  }
  return JSON.parse(content.text);
}

function createToolFixture(
  claude = new FakeClaude(),
  locks: LockProvider = new MemoryLockProvider()
): { runtime: RouterRuntime; dir: string; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-tools-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const clock = new FakeClock();
  const config = loadConfig({ cwd: dir });
  const db = RouterDatabase.open(config.storage.dbPath, clock);
  const runtime = new RouterRuntime(dir, config, db, claude, locks, clock, new NoopLogger());

  return {
    runtime,
    dir,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

async function prepareExtraArgsCluster(server: FakeServer): Promise<void> {
  await server.call("cluster_prepare", {
    project_id: "project",
    cluster_id: "router-ops",
    tool_profile_default: "bare",
    factsheet: {
      facts: [
        {
          id: "extra-args",
          claim: "extraArgs exists.",
          evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
        }
      ]
    }
  });
}

function clusterEventTypes(db: RouterDatabase, clusterId: string): string[] {
  const events = db.db
    .prepare("SELECT event_type FROM cluster_events WHERE cluster_id = ? ORDER BY id")
    .all(clusterId) as Array<{ event_type: string }>;
  return events.map((event) => event.event_type);
}

function configWithExtraArgs(options: { leadingLines?: string[]; prefixLine?: string; nearbyLine?: string } = {}): string {
  return [
    ...(options.leadingLines ?? []),
    options.prefixLine ?? "const stableHeader = 1;",
    "const stableHeaderTwo = 2;",
    "const stableHeaderThree = 3;",
    "const stableHeaderFour = 4;",
    "const stableHeaderFive = 5;",
    "const stableHeaderSix = 6;",
    "const stableHeaderSeven = 7;",
    "const stableHeaderEight = 8;",
    "const stableHeaderNine = 9;",
    "const stableHeaderTen = 10;",
    "export const extraArgs = [];",
    options.nearbyLine ?? "const nearSelector = 1;",
    "const stableFooterOne = 1;",
    "const stableFooterTwo = 2;",
    "const stableFooterThree = 3;",
    "const stableFooterFour = 4;",
    "const stableFooterFive = 5;",
    "const stableFooterSix = 6;"
  ].join("\n");
}

function configWithoutExtraArgs(): string {
  return configWithExtraArgs().replace("export const extraArgs = [];", "export const renamedArgs = [];");
}

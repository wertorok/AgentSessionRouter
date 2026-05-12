import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import type { ClaudeAdapter, ClaudeJsonResponse, HealthProbeResult } from "../src/claude.js";
import type { Clock } from "../src/clock.js";
import { loadConfig } from "../src/config.js";
import { ERROR_CODES } from "../src/constants.js";
import { RouterDatabase } from "../src/db.js";
import { MemoryLockProvider } from "../src/locks.js";
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
    expect(prepared.trust_state).toBe("verified");
    expect(get.cluster.trust_state).toBe("verified");
    expect(get.current_factsheet.content.facts).toHaveLength(1);
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

function parseToolJson(result: CallToolResult): any {
  const content = result.content[0];
  if (content?.type !== "text") {
    throw new Error("expected text result");
  }
  return JSON.parse(content.text);
}

function createToolFixture(): { runtime: RouterRuntime; dir: string; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-tools-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const clock = new FakeClock();
  const config = loadConfig({ cwd: dir });
  const db = RouterDatabase.open(config.storage.dbPath, clock);
  const runtime = new RouterRuntime(dir, config, db, new FakeClaude(), new MemoryLockProvider(), clock, new NoopLogger());

  return {
    runtime,
    dir,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

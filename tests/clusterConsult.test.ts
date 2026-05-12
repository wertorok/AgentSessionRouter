import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ClaudeAdapter, ClaudeJsonResponse, ClaudePromptOptions, HealthProbeResult } from "../src/claude.js";
import type { Clock } from "../src/clock.js";
import { prepareCluster, prepareStaticCluster } from "../src/cluster.js";
import { consultCluster } from "../src/clusterConsult.js";
import { ERROR_CODES } from "../src/constants.js";
import { RouterDatabase } from "../src/db.js";
import type { ProfileAvailability } from "../src/profiles.js";

describe("cluster_consult service", () => {
  it("consults with an LLM-verified factsheet through append-system-prompt", async () => {
    const fixture = createClusterConsultFixture();
    const verifier = new FakeClaude({
      facts: [{ id: "extra-args", verdict: "VERIFIED", reason: "supported" }]
    });
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");
    await prepareCluster(fixture.db, fixture.dir, verifier, {
      projectId: "project",
      clusterId: "router-ops",
      toolProfileDefault: "bare",
      verificationMode: "llm",
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

    const claude = new FakeClaude("Cluster answer.");
    const result = await consultCluster(fixture.db, fixture.dir, claude, availability(), {
      projectId: "project",
      clusterId: "router-ops",
      question: "What config field exists?"
    });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.answer).toBe("Cluster answer.");
    expect(result.tool_profile).toBe("bare");
    expect(result.used_fork).toBe(false);
    expect(claude.lastOptions?.extraArgs).toEqual(["--bare", "--tools", ""]);
    expect(claude.lastOptions?.appendSystemPrompt).toContain("Factsheet JSON");
    expect(claude.lastOptions?.appendSystemPrompt).toContain("extraArgs exists");
    expect(claude.lastPrompt).toContain("Question:");
    expect(clusterEventTypes(fixture.db)).toContain("cluster_consult");
    fixture.cleanup();
  });

  it("rejects stale factsheets before invoking Claude", async () => {
    const fixture = createClusterConsultFixture();
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, "export const extraArgs = [];\n");
    prepareStaticCluster(fixture.db, fixture.dir, {
      projectId: "project",
      clusterId: "router-ops",
      toolProfileDefault: "bare",
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
    writeFileSync(configPath, "export const extraArgs = ['changed'];\n");
    const claude = new FakeClaude("should not run");

    const result = await consultCluster(fixture.db, fixture.dir, claude, availability(), {
      projectId: "project",
      clusterId: "router-ops",
      question: "What config field exists?",
      allowStaticFactsheet: true
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("expected error");
    }
    expect(result.error.code).toBe(ERROR_CODES.CLUSTER_FACTSHEET_STALE);
    expect(result.error.details).toEqual({ changed_files: ["src/config.ts"] });
    expect(claude.lastPrompt).toBeUndefined();
    expect(clusterEventTypes(fixture.db)).toContain("cluster_refresh_required");
    fixture.cleanup();
  });

  it("requires explicit opt-in for static factsheets", async () => {
    const fixture = createClusterConsultFixture();
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");
    prepareStaticCluster(fixture.db, fixture.dir, {
      projectId: "project",
      clusterId: "router-ops",
      toolProfileDefault: "bare",
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

    const result = await consultCluster(fixture.db, fixture.dir, new FakeClaude("should not run"), availability(), {
      projectId: "project",
      clusterId: "router-ops",
      question: "What config field exists?"
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("expected error");
    }
    expect(result.error.code).toBe(ERROR_CODES.CLUSTER_FACTSHEET_UNTRUSTED);
    fixture.cleanup();
  });
});

class FakeClaude implements ClaudeAdapter {
  lastPrompt: string | undefined;
  lastOptions: ClaudePromptOptions | undefined;

  constructor(private readonly result: unknown) {}

  async getVersion(): Promise<string> {
    return "VERSION_A";
  }

  async runPrompt(prompt: string): Promise<ClaudeJsonResponse> {
    this.lastPrompt = prompt;
    return this.response();
  }

  async runPromptWithOptions(prompt: string, options: ClaudePromptOptions): Promise<ClaudeJsonResponse> {
    this.lastPrompt = prompt;
    this.lastOptions = options;
    return this.response();
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

  private response(): ClaudeJsonResponse {
    return {
      sessionId: "cluster-consult-session",
      result: typeof this.result === "string" ? this.result : JSON.stringify(this.result),
      tokensIn: 10,
      tokensOut: 5
    };
  }
}

class FakeClock implements Clock {
  now(): Date {
    return new Date("2026-05-12T00:00:00.000Z");
  }

  nowIso(): string {
    return "2026-05-12T00:00:00.000Z";
  }

  nowMillis(): number {
    return 1_778_544_000_000;
  }
}

function availability(): ProfileAvailability {
  return {
    checked_at: "2026-05-12T00:00:00.000Z",
    bare: { available: true, duration_ms: 1 },
    focused: { available: true, duration_ms: 1 },
    agent: { available: true, duration_ms: 0 }
  };
}

function clusterEventTypes(db: RouterDatabase): string[] {
  return (
    db.db.prepare("SELECT event_type FROM cluster_events ORDER BY id").all() as Array<{ event_type: string }>
  ).map((event) => event.event_type);
}

function createClusterConsultFixture(): { db: RouterDatabase; dir: string; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-cluster-consult-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const db = RouterDatabase.open(path.join(dir, "sessions.sqlite"), new FakeClock());
  return {
    db,
    dir,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

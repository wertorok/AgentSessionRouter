import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Clock } from "../src/clock.js";
import { prepareStaticCluster, verifyFactsheetStatic } from "../src/cluster.js";
import { RouterDatabase } from "../src/db.js";

describe("cluster factsheet preparation", () => {
  it("stores only statically verified facts and marks partial trust", () => {
    const fixture = createClusterFixture();
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(
      path.join(fixture.dir, "src", "config.ts"),
      [
        "export const claude = {",
        "  extraArgs: ['--tools', ''],",
        "  commandTimeoutMs: 120000",
        "};"
      ].join("\n")
    );

    const result = prepareStaticCluster(fixture.db, fixture.dir, {
      projectId: "project",
      clusterId: "config-and-cwd-isolation",
      name: "Config and cwd isolation",
      toolProfileDefault: "bare",
      factsheet: {
        summary: "Config profile facts for router isolation.",
        facts: [
          {
            id: "config-extra-args",
            claim: "Claude extra args are part of the router config factsheet.",
            evidence: [{ path: "src/config.ts", selector: "extraArgs" }]
          },
          {
            id: "missing-policy-field",
            claim: "Router config has a claude.policy field.",
            evidence: [{ path: "src/config.ts", selector: "claude.policy" }]
          }
        ],
        pitfalls: [{ id: "no-infer", text: "Do not infer config fields that are not in cited files." }],
        forbidden_inferences: ["mcp.cwd", "claude.policy"]
      }
    });

    const stored = fixture.db.getCurrentClusterFactsheet("config-and-cwd-isolation");
    const content = JSON.parse(stored?.content_json ?? "{}") as { facts?: unknown[] };

    expect(result.verification_stage).toBe("static");
    expect(result.trust_state).toBe("partial_static");
    expect(result.verified_facts).toBe(1);
    expect(result.rejected_facts).toBe(1);
    expect(result.factsheet.facts[0]?.confidence).toBe("static_verified");
    expect(result.factsheet.facts[0]?.evidence[0]?.hash).toMatch(/^sha256:/);
    expect(content.facts).toHaveLength(1);
    expect(fixture.db.getCluster("project", "config-and-cwd-isolation")?.trust_state).toBe("partial_static");
    expect(stored?.status).toBe("static_verified");
    expect(stored?.version).toBe(1);
    expect(fixture.db.listClusterFileHashes(stored!.id)).toMatchObject([{ path: "src/config.ts" }]);
    fixture.cleanup();
  });

  it("rejects factsheets without local evidence", () => {
    const fixture = createClusterFixture();
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const config = {};\n");

    expect(() =>
      prepareStaticCluster(fixture.db, fixture.dir, {
        projectId: "project",
        clusterId: "router-ops",
        toolProfileDefault: "bare",
        factsheet: {
          facts: [
            {
              id: "escape",
              claim: "Escaped paths should not verify.",
              evidence: [{ path: "../outside.ts" }]
            }
          ]
        }
      })
    ).toThrow("factsheet has no statically verified facts");

    expect(fixture.db.getCurrentClusterFactsheet("router-ops")).toBeNull();
    fixture.cleanup();
  });

  it("rejects mismatched embedded cluster ids", () => {
    const fixture = createClusterFixture();
    expect(() =>
      verifyFactsheetStatic(fixture.dir, "router-ops", {
        cluster_id: "other-cluster",
        facts: []
      })
    ).toThrow("does not match");
    fixture.cleanup();
  });
});

class FakeClock implements Clock {
  now(): Date {
    throw new Error("FakeClock.now is not used by these tests");
  }

  nowIso(): string {
    return "2023-11-14T22:13:20.000Z";
  }

  nowMillis(): number {
    return 1_700_000_000_000;
  }
}

function createClusterFixture(): { db: RouterDatabase; dir: string; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-cluster-${process.pid}-${Math.random().toString(16).slice(2)}`);
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

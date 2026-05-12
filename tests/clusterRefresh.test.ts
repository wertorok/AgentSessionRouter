import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Clock } from "../src/clock.js";
import { prepareStaticCluster } from "../src/cluster.js";
import { refreshCluster } from "../src/clusterRefresh.js";
import { ERROR_CODES } from "../src/constants.js";
import { RouterDatabase } from "../src/db.js";

describe("cluster_refresh service", () => {
  it("verify_only refreshes a fresh factsheet without creating a new version", () => {
    const fixture = createClusterRefreshFixture();
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    writeFileSync(path.join(fixture.dir, "src", "config.ts"), "export const extraArgs = [];\n");
    const prepared = prepareStaticCluster(fixture.db, fixture.dir, {
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

    const result = refreshCluster(fixture.db, fixture.dir, {
      projectId: "project",
      clusterId: "router-ops"
    });

    expect("error" in result).toBe(false);
    if ("error" in result) {
      throw new Error("unexpected error");
    }
    expect(result.fresh).toBe(true);
    expect(result.factsheet_id).toBe(prepared.factsheet_id);
    expect(result.factsheet_version).toBe(1);
    expect(result.changed_files).toEqual([]);
    expect(result.verified_facts).toBe(1);
    expect(fixture.db.getCurrentClusterFactsheet("router-ops")?.id).toBe(prepared.factsheet_id);
    expect(clusterEventTypes(fixture.db)).toContain("cluster_refresh");
    fixture.cleanup();
  });

  it("marks the latest factsheet stale when scoped evidence changes", () => {
    const fixture = createClusterRefreshFixture();
    mkdirSync(path.join(fixture.dir, "src"), { recursive: true });
    const configPath = path.join(fixture.dir, "src", "config.ts");
    writeFileSync(configPath, "export const extraArgs = [];\n");
    const prepared = prepareStaticCluster(fixture.db, fixture.dir, {
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
    writeFileSync(configPath, "export const renamed = [];\n");

    const result = refreshCluster(fixture.db, fixture.dir, {
      projectId: "project",
      clusterId: "router-ops"
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("expected stale error");
    }
    expect(result.error.code).toBe(ERROR_CODES.CLUSTER_FACTSHEET_STALE);
    expect(result.error.details).toMatchObject({
      factsheet_id: prepared.factsheet_id,
      factsheet_version: 1,
      changed_files: ["src/config.ts"]
    });
    expect(fixture.db.getLatestClusterFactsheet("router-ops")?.status).toBe("stale");
    expect(fixture.db.getCluster("project", "router-ops")?.status).toBe("stale");
    expect(clusterEventTypes(fixture.db)).toContain("factsheet_stale");
    fixture.cleanup();
  });
});

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

function clusterEventTypes(db: RouterDatabase): string[] {
  return (
    db.db.prepare("SELECT event_type FROM cluster_events ORDER BY id").all() as Array<{ event_type: string }>
  ).map((event) => event.event_type);
}

function createClusterRefreshFixture(): { db: RouterDatabase; dir: string; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-cluster-refresh-${process.pid}-${Math.random().toString(16).slice(2)}`);
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

import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Clock } from "../src/clock.js";
import { RouterDatabase } from "../src/db.js";

describe("database registry", () => {
  it("stores append-only decisions and replaces open questions", () => {
    const fixture = createDbFixture();
    fixture.db.createSession({
      id: "s1",
      projectId: "project",
      claudeSessionId: "c1",
      topic: "auth system",
      dormantAfterDays: 30,
      archiveAfterDays: 90
    });

    fixture.db.applySessionUpdate("s1", {
      summary: "first",
      decisions: ["Use Redis"],
      open_questions: ["Question one"],
      files_discussed: ["src/auth/"],
      tags: ["auth"],
      aliases: ["login flow"]
    });
    fixture.db.applySessionUpdate("s1", {
      summary: "second",
      decisions: ["Use Redis", "Use JWT"],
      open_questions: ["Question two"],
      files_discussed: ["src/auth/routes.ts"],
      tags: ["jwt"],
      aliases: ["session storage"]
    });

    const session = fixture.db.inspectSession("s1", 10)?.session;
    expect(session?.summary).toBe("second");
    expect(session?.decisions).toEqual(["Use Redis", "Use JWT"]);
    expect(session?.open_questions).toEqual(["Question two"]);
    expect(session?.files_discussed).toEqual(["src/auth/", "src/auth/routes.ts"]);
    expect(session?.tags).toEqual(["auth", "jwt"]);
    fixture.cleanup();
  });

  it("counts consult-like events only for consult and new_session", () => {
    const fixture = createDbFixture();
    fixture.db.logEvent({ projectId: "project", eventType: "consult" });
    fixture.db.logEvent({ projectId: "project", eventType: "new_session" });
    fixture.db.logEvent({ projectId: "project", eventType: "parse_failed" });

    expect(fixture.db.countConsultLikeEvents("project", "2020-01-01T00:00:00.000Z")).toBe(2);
    fixture.cleanup();
  });

  it("applies lifecycle status transitions", () => {
    const fixture = createDbFixture();
    fixture.db.createSession({
      id: "s1",
      projectId: "project",
      claudeSessionId: "c1",
      topic: "old topic",
      dormantAfterDays: 1,
      archiveAfterDays: 2
    });
    fixture.clock.advance(3 * 86_400_000);

    fixture.db.applyLifecycle("project");

    expect(fixture.db.getSession("s1")?.status).toBe("archived");
    fixture.cleanup();
  });

  it("stores cluster factsheet versions and scoped file hashes", () => {
    const fixture = createDbFixture();
    fixture.db.upsertCluster({
      id: "router-ops",
      projectId: "project",
      name: "Router Ops",
      toolProfileDefault: "bare"
    });

    const first = fixture.db.insertClusterFactsheet({
      id: "factsheet-1",
      clusterId: "router-ops",
      contentJson: JSON.stringify({ facts: [{ id: "f1" }] }),
      status: "static_verified",
      trustState: "static_verified",
      fileHashes: [{ path: "src/config.ts", hash: "sha256:one", fileSize: 10 }]
    });
    const second = fixture.db.insertClusterFactsheet({
      id: "factsheet-2",
      clusterId: "router-ops",
      contentJson: JSON.stringify({ facts: [{ id: "f2" }] }),
      status: "static_verified",
      trustState: "partial_static",
      fileHashes: [{ path: "src/tools.ts", hash: "sha256:two", fileSize: 20 }]
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(fixture.db.getCurrentClusterFactsheet("router-ops")?.id).toBe("factsheet-2");
    expect(fixture.db.listClusterFileHashes("factsheet-2")).toMatchObject([
      { cluster_id: "router-ops", factsheet_id: "factsheet-2", path: "src/tools.ts", hash: "sha256:two" }
    ]);
    expect(fixture.db.getCluster("project", "router-ops")?.trust_state).toBe("partial_static");
    fixture.cleanup();
  });

  it("stores consult comparisons and aggregates judged stats", () => {
    const fixture = createDbFixture();
    fixture.db.insertConsultComparison({
      id: "cmp-1",
      projectId: "project",
      clusterId: "router-ops",
      question: "What happens?",
      clusterAnswer: "cluster",
      clusterDurationMs: 10,
      clusterWasNotInContext: false
    });
    fixture.db.updateConsultComparisonDirect({
      id: "cmp-1",
      status: "ok",
      directAnswer: "direct",
      directDurationMs: 20
    });
    fixture.db.updateConsultComparisonJudge({
      id: "cmp-1",
      clusterScore: 3,
      directScore: 2,
      preferred: "cluster",
      clusterErrors: [],
      directErrors: ["missing detail"],
      judgeReasoning: "cluster is more complete"
    });

    const comparison = fixture.db.getConsultComparison("cmp-1");
    const list = fixture.db.listConsultComparisons({ projectId: "project", limit: 10 });
    const stats = fixture.db.getConsultComparisonStats("project");

    expect(comparison?.shadow_status).toBe("ok");
    expect(comparison?.preferred).toBe("cluster");
    expect(comparison?.cluster_score).toBe(3);
    expect(comparison?.direct_score).toBe(2);
    expect(comparison?.direct_errors_json).toBe(JSON.stringify(["missing detail"]));
    expect(list).toHaveLength(1);
    expect(stats).toEqual([
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
    fixture.cleanup();
  });
});

class FakeClock implements Clock {
  private millis = 1_700_000_000_000;

  now(): Date {
    throw new Error("FakeClock.now is not used by these tests");
  }

  nowIso(): string {
    return this.millis === 1_700_000_000_000 ? "2023-11-14T22:13:20.000Z" : "2023-11-17T22:13:20.000Z";
  }

  nowMillis(): number {
    return this.millis;
  }

  advance(milliseconds: number): void {
    this.millis += milliseconds;
  }
}

function createDbFixture(): { db: RouterDatabase; clock: FakeClock; cleanup: () => void } {
  const dir = path.join(os.tmpdir(), `router-db-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const clock = new FakeClock();
  const db = RouterDatabase.open(path.join(dir, "sessions.sqlite"), clock);
  return {
    db,
    clock,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

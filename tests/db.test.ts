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


import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { MemoryLockProvider } from "../src/locks.js";
import { findBestSessionMatch, normalizeTokens } from "../src/matching.js";
import { resolveProjectId } from "../src/project.js";
import { parseSessionUpdate } from "../src/sessionUpdate.js";

describe("core utilities", () => {
  it("loads config paths relative to config file directory", () => {
    const dir = makeTempDir("config");
    const configDir = path.join(dir, "nested");
    mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, "router.config.toml");
    writeFileSync(
      configPath,
      [
        "[storage]",
        'db_path = "data/sessions.sqlite"',
        'raw_logs_dir = "raw"',
        "[claude]",
        'compatibility_file = "COMPATIBILITY.md"'
      ].join("\n")
    );

    const config = loadConfig({ cwd: dir, configPath: path.relative(dir, configPath) });

    expect(config.storage.dbPath).toBe(path.join(configDir, "data", "sessions.sqlite"));
    expect(config.storage.rawLogsDir).toBe(path.join(configDir, "raw"));
    expect(config.claude.compatibilityFile).toBe(path.join(configDir, "COMPATIBILITY.md"));
    rmSync(dir, { recursive: true, force: true });
  });

  it("derives project id from git root basename", () => {
    const dir = makeTempDir("project");
    const nested = path.join(dir, "a", "b");
    mkdirSync(path.join(dir, ".git"), { recursive: true });
    mkdirSync(nested, { recursive: true });

    expect(resolveProjectId(null, nested)).toBe(path.basename(dir));
    expect(resolveProjectId(" explicit ", nested)).toBe("explicit");
    rmSync(dir, { recursive: true, force: true });
  });

  it("normalizes tokens and matches aliases", () => {
    expect(normalizeTokens("Refactoring authentication systems")).toContain("system");

    const match = findBestSessionMatch(
      [
        {
          id: "s1",
          claude_session_id: "c1",
          topic: "auth system refactor",
          status: "active",
          recency_score: 1,
          last_used: "2026-01-01T00:00:00.000Z",
          summary: "",
          decisions: [],
          open_questions: [],
          files_discussed: ["src/auth/"],
          tags: ["auth", "jwt"],
          aliases: ["session storage"]
        }
      ],
      {
        topicHint: "authentication system",
        task: "add session storage for users in src/auth/routes.ts",
        relevantCode: "",
        question: "Should this use existing login flow?"
      },
      0.7,
      0.55
    );

    expect(match.session?.id).toBe("s1");
    expect(match.score).toBeGreaterThanOrEqual(0.55);
  });

  it("penalizes stale sessions through recency score", () => {
    const match = findBestSessionMatch(
      [
        {
          id: "stale",
          claude_session_id: "c1",
          topic: "auth system",
          status: "dormant",
          recency_score: 0,
          last_used: "2026-01-01T00:00:00.000Z",
          summary: "",
          decisions: [],
          open_questions: [],
          files_discussed: ["src/auth/"],
          tags: ["auth"],
          aliases: []
        },
        {
          id: "recent",
          claude_session_id: "c2",
          topic: "auth system",
          status: "active",
          recency_score: 1,
          last_used: "2026-05-01T00:00:00.000Z",
          summary: "",
          decisions: [],
          open_questions: [],
          files_discussed: ["src/auth/"],
          tags: ["auth"],
          aliases: []
        }
      ],
      {
        topicHint: "auth system",
        task: "change auth in src/auth/index.ts",
        relevantCode: "src/auth/index.ts",
        question: ""
      },
      0.7,
      0.55
    );

    expect(match.session?.id).toBe("recent");
  });

  it("parses and sanitizes SESSION_UPDATE_JSON", () => {
    const parsed = parseSessionUpdate(`Answer text.

SESSION_UPDATE_JSON:
{
  "summary": "Use passport strategy and reuse refresh flow.",
  "decisions": ["Use passport", "Use passport"],
  "open_questions": ["Confirm providers"],
  "files_discussed": ["src/auth/index.ts"],
  "tags": ["Auth"],
  "aliases": ["Social Login"]
}`);

    expect(parsed?.answer).toBe("Answer text.");
    expect(parsed?.update.decisions).toEqual(["Use passport"]);
    expect(parsed?.update.tags).toEqual(["auth"]);
    expect(parsed?.update.aliases).toEqual(["social login"]);
  });

  it("serializes memory locks per key", async () => {
    const locks = new MemoryLockProvider();
    const order: string[] = [];

    await Promise.all([
      locks.withLock("same", async () => {
        order.push("first-start");
        await Promise.resolve();
        order.push("first-end");
      }),
      locks.withLock("same", async () => {
        order.push("second");
      })
    ]);

    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});

function makeTempDir(prefix: string): string {
  return path.join(os.tmpdir(), `router-${prefix}-${process.pid}-${Math.random().toString(16).slice(2)}`);
}

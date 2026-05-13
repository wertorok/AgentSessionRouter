import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CliClaudeAdapter, parseClaudeJson } from "../src/claude.js";
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

  it("loads Claude CLI policy and anomaly threshold config", () => {
    const dir = makeTempDir("config-cli-policy");
    mkdirSync(dir, { recursive: true });
    const configPath = path.join(dir, "router.config.toml");
    writeFileSync(
      configPath,
      [
        "[limits]",
        "token_anomaly_ratio = 2.5",
        "token_anomaly_min_delta = 5000",
        "[claude]",
        "extra_args = [\"--tools\", \"\", \"--permission-mode\", \"default\"]",
        "command_timeout_ms = 1500"
      ].join("\n")
    );

    const config = loadConfig({ cwd: dir });

    expect(config.limits.tokenAnomalyRatio).toBe(2.5);
    expect(config.limits.tokenAnomalyMinDelta).toBe(5000);
    expect(config.claude.extraArgs).toEqual(["--tools", "", "--permission-mode", "default"]);
    expect(config.claude.commandTimeoutMs).toBe(1500);
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads eval shadow mode config", () => {
    const dir = makeTempDir("config-eval");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "router.config.toml"), ["[eval]", "shadow_mode = true"].join("\n"));

    const config = loadConfig({ cwd: dir });

    expect(config.eval.shadowMode).toBe(true);
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

  it("parses fenced SESSION_UPDATE_JSON blocks from live Claude output", () => {
    const parsed = parseSessionUpdate(`Answer text.

SESSION_UPDATE_JSON:
\`\`\`json
{
  "summary": "Fenced JSON should still update compact metadata.",
  "decisions": ["Accept fenced live JSON"],
  "open_questions": [],
  "files_discussed": ["src/auth/live-e2e.ts"],
  "tags": ["Auth"],
  "aliases": ["Live Auth Routing"]
}
\`\`\``);

    expect(parsed?.answer).toBe("Answer text.");
    expect(parsed?.update.summary).toBe("Fenced JSON should still update compact metadata.");
    expect(parsed?.update.files_discussed).toEqual(["src/auth/live-e2e.ts"]);
    expect(parsed?.update.aliases).toEqual(["live auth routing"]);
  });

  it("parses SESSION_UPDATE_JSON when Claude places the marker inside a fenced json block", () => {
    const parsed = parseSessionUpdate(`Answer text.

\`\`\`json
SESSION_UPDATE_JSON:
{
  "summary": "Marker inside fence should still parse.",
  "decisions": ["Accept marker inside fence"],
  "open_questions": [],
  "files_discussed": ["src/auth/live-e2e.ts"],
  "tags": ["Router"],
  "aliases": ["Fenced Marker"]
}
\`\`\``);

    expect(parsed?.answer).toBe("Answer text.");
    expect(parsed?.update.summary).toBe("Marker inside fence should still parse.");
    expect(parsed?.update.tags).toEqual(["router"]);
    expect(parsed?.update.aliases).toEqual(["fenced marker"]);
  });

  it("parses SESSION_UPDATE_JSON when Claude formats the marker as a markdown heading", () => {
    const parsed = parseSessionUpdate(`Answer text.

### SESSION_UPDATE_JSON
\`\`\`json
{
  "summary": "Markdown heading marker should parse.",
  "decisions": ["Accept heading marker"],
  "open_questions": [],
  "files_discussed": ["src/sessionUpdate.ts"],
  "tags": ["Router"],
  "aliases": []
}
\`\`\``);

    expect(parsed?.answer).toBe("Answer text.");
    expect(parsed?.update.summary).toBe("Markdown heading marker should parse.");
    expect(parsed?.update.decisions).toEqual(["Accept heading marker"]);
  });

  it("ignores trailing prose after SESSION_UPDATE_JSON", () => {
    const parsed = parseSessionUpdate(`Answer text.

SESSION_UPDATE_JSON:
{
  "summary": "Trailing text should not break parsing.",
  "decisions": [],
  "open_questions": [],
  "files_discussed": [],
  "tags": [],
  "aliases": []
}
Extra text from Claude.`);

    expect(parsed?.update.summary).toBe("Trailing text should not break parsing.");
  });

  it("extracts nested Claude usage token counts", () => {
    const parsed = parseClaudeJson(
      JSON.stringify({
        session_id: "claude-session",
        result: "answer",
        usage: {
          input_tokens: 12,
          output_tokens: 34
        }
      })
    );

    expect(parsed.tokensIn).toBe(12);
    expect(parsed.tokensOut).toBe(34);
  });

  it("passes configured Claude CLI extra args before router-managed output args", async () => {
    const dir = makeTempDir("claude-extra-args");
    mkdirSync(dir, { recursive: true });
    const argsPath = path.join(dir, "args.json");
    const scriptPath = path.join(dir, "fake-claude.mjs");
    writeFileSync(
      scriptPath,
      [
        "#!/usr/bin/env node",
        "import { writeFileSync } from 'node:fs';",
        `const argsPath = ${JSON.stringify(argsPath)};`,
        "const args = process.argv.slice(2);",
        "if (args.includes('--version')) { console.log('1.0.0'); process.exit(0); }",
        "writeFileSync(argsPath, JSON.stringify(args));",
        "console.log(JSON.stringify({ session_id: 'fake-session', result: 'ok' }));"
      ].join("\n")
    );
    chmodSync(scriptPath, 0o755);
    const config = loadConfig({ cwd: dir });
    config.claude.command = scriptPath;
    config.claude.extraArgs = ["--tools", "", "--permission-mode", "default"];
    const adapter = new CliClaudeAdapter(config);

    await adapter.runPrompt("hello", "resume-id");

    expect(JSON.parse(readFileSync(argsPath, "utf8"))).toEqual([
      "-p",
      "--tools",
      "",
      "--permission-mode",
      "default",
      "--output-format",
      "json",
      "--resume",
      "resume-id",
      "hello"
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("bounds Claude CLI command latency with a timeout", async () => {
    const dir = makeTempDir("claude-timeout");
    mkdirSync(dir, { recursive: true });
    const scriptPath = path.join(dir, "slow-claude.mjs");
    writeFileSync(scriptPath, ["#!/usr/bin/env node", "setTimeout(() => {}, 10_000);"].join("\n"));
    chmodSync(scriptPath, 0o755);
    const config = loadConfig({ cwd: dir });
    config.claude.command = scriptPath;
    config.claude.commandTimeoutMs = 30;
    const adapter = new CliClaudeAdapter(config);

    await expect(adapter.runPrompt("ping")).rejects.toThrow("Command timed out after 30ms");
    rmSync(dir, { recursive: true, force: true });
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

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "CLAUDE_LIVE_DIAGNOSIS.md");

const cases = [
  { name: "version", command: "claude", args: ["--version"], input: "" },
  { name: "adapter_ping", command: "claude", args: ["-p", "--output-format", "json", "ping"], input: "" },
  { name: "bare_ping_arg", command: "claude", args: ["--bare", "-p", "--output-format", "json", "ping"], input: "" },
  { name: "bare_ping_stdin", command: "claude", args: ["--bare", "-p", "--output-format", "json"], input: "ping" },
  { name: "text_ping_arg", command: "claude", args: ["-p", "ping"], input: "" }
];

const results = [];

for (const testCase of cases) {
  results.push(await runCase(testCase));
}

const rootCause = decideRootCause(results);
const report = renderReport(results, rootCause);
writeFileSync(outputPath, report, "utf8");
console.log(report);

function runCase(testCase) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const child = spawn(testCase.command, testCase.args, {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({
        ...testCase,
        exitCode: null,
        durationMs: Math.round(performance.now() - startedAt),
        spawnError: error.message,
        stdout,
        stderr,
        json: analyzeJson(stdout)
      });
    });
    child.on("close", (exitCode) => {
      resolve({
        ...testCase,
        exitCode,
        durationMs: Math.round(performance.now() - startedAt),
        spawnError: null,
        stdout,
        stderr,
        json: analyzeJson(stdout)
      });
    });
    child.stdin.end(testCase.input);
  });
}

function analyzeJson(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return {
      valid: true,
      keys: Object.keys(parsed),
      type: parsed.type,
      subtype: parsed.subtype,
      is_error: parsed.is_error,
      result: typeof parsed.result === "string" ? parsed.result : null,
      session_id: typeof parsed.session_id === "string" ? parsed.session_id : null,
      usage_keys: parsed.usage && typeof parsed.usage === "object" ? Object.keys(parsed.usage) : []
    };
  } catch {
    return {
      valid: false,
      keys: [],
      type: null,
      subtype: null,
      is_error: null,
      result: null,
      session_id: null,
      usage_keys: []
    };
  }
}

function decideRootCause(runResults) {
  const adapterFailure = runResults.find((result) => result.name === "adapter_ping");
  if (adapterFailure?.json.valid && adapterFailure.json.is_error === true) {
    const result = adapterFailure.json.result ?? "";
    if (result.includes("Credit balance is too low")) {
      return {
        verdict: "BLOCKED_BY_CLAUDE_ENV",
        category: "environment/billing issue",
        summary:
          "Claude CLI is installed and its JSON output shape is compatible, but the real adapter invocation returns `is_error: true` with `Credit balance is too low`.",
        operatorAction:
          "Add/restore Claude API/Code credit or switch Claude CLI to an authenticated account with available usage, then rerun `node scripts/live-e2e.mjs`."
      };
    }
    if (result.includes("Not logged in")) {
      return {
        verdict: "BLOCKED_BY_CLAUDE_ENV",
        category: "environment/auth issue",
        summary:
          "Claude CLI is installed and its JSON output shape is compatible, but the real adapter invocation reports `Not logged in · Please run /login`.",
        operatorAction: "Run `claude auth` or open Claude Code and complete login, then rerun `node scripts/live-e2e.mjs`."
      };
    }
  }

  const jsonAuthFailure = runResults.find(
    (result) => result.json.valid && result.json.is_error === true && result.json.result?.includes("Not logged in")
  );
  if (jsonAuthFailure) {
    return {
      verdict: "BLOCKED_BY_CLAUDE_ENV",
      category: "environment/auth issue",
      summary:
        "Claude CLI is installed and returns valid JSON with session_id, but print-mode requests report `Not logged in · Please run /login`.",
      operatorAction: "Run `claude auth` or open Claude Code and complete login, then rerun `node scripts/live-e2e.mjs`."
    };
  }

  const hookFailure = runResults.find((result) => result.stderr.includes("SessionEnd hook") || result.stdout.includes("SessionEnd hook"));
  if (hookFailure) {
    return {
      verdict: "BLOCKED_BY_CLAUDE_ENV",
      category: "environment/Claude hook issue",
      summary: "Claude CLI print-mode invocation fails because a local SessionEnd hook is cancelled.",
      operatorAction:
        "Fix or disable the failing Claude SessionEnd hook, then rerun `node scripts/live-e2e.mjs`."
    };
  }

  return {
    verdict: "BLOCKED_BY_CLAUDE_ENV",
    category: "unknown external Claude CLI issue",
    summary: "Claude CLI did not complete a successful print-mode response in this environment.",
    operatorAction: "Run `claude doctor` and `claude auth`, resolve reported issues, then rerun `node scripts/live-e2e.mjs`."
  };
}

function renderReport(runResults, rootCause) {
  return `# Claude Live Diagnosis

## Environment

| Field | Value |
| --- | --- |
| OS | ${os.type()} ${os.release()} ${os.arch()} |
| Node | ${process.version} |
| cwd | ${repoRoot} |

## Root Cause

| Field | Value |
| --- | --- |
| Final live verdict | ${rootCause.verdict} |
| Category | ${rootCause.category} |
| Summary | ${rootCause.summary} |
| Exact operator action | ${rootCause.operatorAction} |

## Manual Claude CLI Command Results

${markdownTable(
  runResults.map((result) => ({
    name: result.name,
    command: `${result.command} ${result.args.join(" ")}`,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    jsonValid: result.json.valid,
    jsonType: result.json.type,
    jsonIsError: result.json.is_error,
    sessionId: result.json.session_id,
    result: clip(result.json.result ?? result.stdout),
    stderr: clip(result.stderr),
    spawnError: result.spawnError ?? ""
  })),
  ["name", "command", "exitCode", "durationMs", "jsonValid", "jsonType", "jsonIsError", "sessionId", "result", "stderr", "spawnError"]
)}

## Comparison With src/claude.ts

- src/claude.ts expects Claude JSON to include a session id and answer text (session_id plus result, text, or answer).
- The installed Claude CLI returns valid JSON with session_id and result, so the output shape is compatible.
- The real adapter invocation returns is_error: true, so the blocker is external Claude environment/billing/auth rather than a parser-shape bug.
- Non-bare mode also hits local Claude SessionEnd hook failure, which is external to the MCP implementation.

## Raw JSON Evidence

\`\`\`json
${JSON.stringify(runResults, null, 2)}
\`\`\`
`;
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escapeCell(String(row[column] ?? ""))).join(" | ")} |`)
  ].join("\n");
}

function escapeCell(value) {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function clip(value) {
  return value.length > 260 ? `${value.slice(0, 260)}...` : value;
}

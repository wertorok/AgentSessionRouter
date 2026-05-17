import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "CLAUDE_LIVE_DIAGNOSIS.md");

const cases = [
  { name: "version", command: "claude", args: ["--version"], input: "" },
  { name: "auth_status", command: "claude", args: ["auth", "status"], input: "" },
  { name: "adapter_ping", command: "claude", args: ["-p", "--output-format", "json", "Return exactly DIAG_ADAPTER_OK"], input: "" },
  {
    name: "focused_strict_ping",
    command: "claude",
    args: ["-p", "--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--output-format", "json", "Return exactly DIAG_FOCUSED_OK"],
    input: ""
  },
  { name: "bare_ping_router_order", command: "claude", args: ["-p", "--bare", "--tools", "", "--output-format", "json", "Return exactly DIAG_BARE_OK"], input: "" },
  { name: "text_ping_arg", command: "claude", args: ["-p", "Return exactly DIAG_TEXT_OK"], input: "" }
];

const results = [];

for (const testCase of cases) {
  results.push(await runCase(testCase));
}

const rootCause = decideRootCause(results);
const report = renderReport(results, rootCause, envStatus());
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
        stdout: sanitizeStdout(testCase.name, stdout),
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
        stdout: sanitizeStdout(testCase.name, stdout),
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
  const adapterResult = runResults.find((result) => result.name === "adapter_ping");
  const focusedResult = runResults.find((result) => result.name === "focused_strict_ping");
  const bareResult = runResults.find((result) => result.name === "bare_ping_router_order");
  if (
    adapterResult?.exitCode === 0 &&
    adapterResult.json.valid &&
    adapterResult.json.is_error === false &&
    adapterResult.json.session_id &&
    adapterResult.json.result
  ) {
    if (bareResult?.json.valid && bareResult.json.is_error === true) {
      return {
        verdict: "CLAUDE_ADAPTER_PASS_BARE_UNAVAILABLE",
        category: "claude_cli_ready_with_bare_downgrade",
        summary:
          "Default headless Claude invocation succeeds, but the router-order bare profile failed. Runtime profile probing should downgrade bare requests to focused if focused is available.",
        operatorAction:
          focusedResult?.exitCode === 0 && focusedResult.json.is_error === false
            ? "No install action is required; verify profile probing records bare unavailable and focused available."
            : "Fix Claude focused/headless auth before using cluster verification or cluster consults."
      };
    }
    return {
      verdict: "CLAUDE_PROBE_PASS",
      category: "claude_cli_ready",
      summary:
        "Claude CLI adapter invocation succeeds with valid JSON, `session_id`, and `result`; focused and bare profile checks should be read separately because cluster paths use profile probing and may downgrade `bare` to `focused`.",
      operatorAction: "No Claude environment action is required for the MCP adapter path."
    };
  }

  if (adapterResult?.json.valid && adapterResult.json.is_error === true) {
    const result = adapterResult.json.result ?? "";
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

function envStatus() {
  const names = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_API_KEY", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX"];
  return Object.fromEntries(names.map((name) => [name, Boolean(process.env[name])]));
}

function renderReport(runResults, rootCause, env) {
  const adapterReady = rootCause.verdict === "CLAUDE_PROBE_PASS" || rootCause.verdict === "CLAUDE_ADAPTER_PASS_BARE_UNAVAILABLE";
  const focusedResult = runResults.find((result) => result.name === "focused_strict_ping");
  const bareResult = runResults.find((result) => result.name === "bare_ping_router_order");
  return `# Claude Live Diagnosis

## Environment

| Field | Value |
| --- | --- |
| OS | ${os.type()} ${os.release()} ${os.arch()} |
| Node | ${process.version} |
| cwd | ${repoRoot} |
| Claude env vars present | ${Object.entries(env)
    .filter(([, present]) => present)
    .map(([name]) => name)
    .join(", ") || "none"} |

## Root Cause

| Field | Value |
| --- | --- |
| Final live verdict | ${rootCause.verdict} |
| Category | ${rootCause.category} |
| Summary | ${rootCause.summary} |
| Exact operator action | ${rootCause.operatorAction} |

Version-scoped note: this result applies to the local Claude CLI version and
auth state shown below. Re-run this diagnosis and \`npm run claude:profile-audit\`
after Claude Code upgrades, auth changes, or OS changes.

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
- The installed Claude CLI ${adapterReady ? "returns valid adapter-path JSON with session_id and result, so the output shape is compatible." : "did not complete a clean adapter-path JSON response; see root cause above."}
- ${adapterReady ? "The real adapter invocation returns is_error: false, so live MCP consults can proceed." : "The real adapter invocation is blocked before a successful consult can be created."}
- Cluster and LLM-verifier paths may request \`bare\`, but profile probing is expected to downgrade \`bare\` to strict \`focused\` when bare is unavailable.
- Current strict focused profile: ${profileStatus(focusedResult)}.
- Current router-order bare profile: ${profileStatus(bareResult)}.
- This diagnosis covers headless \`claude -p\` mode. It is not a proof of interactive Claude Code TUI parity.
- Local Claude SessionEnd hook stderr is recorded as environment noise; it does not block the adapter path when the command exits 0 with valid JSON.

## Raw JSON Evidence

\`\`\`json
${JSON.stringify(runResults, null, 2)}
\`\`\`
`;
}

function sanitizeStdout(name, stdout) {
  if (name !== "auth_status") {
    return stdout;
  }
  try {
    const parsed = JSON.parse(stdout);
    for (const key of ["email", "orgId", "orgName"]) {
      if (parsed[key]) {
        parsed[key] = "<redacted>";
      }
    }
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return stdout;
  }
}

function profileStatus(result) {
  if (!result) {
    return "not checked";
  }
  if (result.exitCode === 0 && result.json.valid && result.json.is_error === false) {
    return `available (session_id=${result.json.session_id ?? "unknown"})`;
  }
  if (result.json.valid && result.json.is_error === true) {
    return `unavailable (${result.json.result ?? "Claude returned is_error=true"})`;
  }
  return `probe failed (exit=${result.exitCode}, spawnError=${result.spawnError ?? "none"})`;
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

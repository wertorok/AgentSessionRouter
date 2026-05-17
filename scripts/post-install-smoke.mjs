import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as toml from "@iarna/toml";
import Database from "better-sqlite3";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const useLiveClaude = process.argv.includes("--live");
const keepTemp = process.argv.includes("--keep-temp");
const codexConfigArg = valueAfter("--codex-config");
const codexConfigPath = codexConfigArg ?? path.join(os.homedir(), ".codex", "config.toml");
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "claude-router-smoke-"));
const projectDir = path.join(tempRoot, "isolated-project");
mkdirSync(projectDir, { recursive: true });

const dbPath = path.join(projectDir, ".claude-session-router", "sessions.sqlite");
const rawLogsDir = path.join(projectDir, ".claude-session-router", "raw");
const fakeCallsPath = path.join(projectDir, "fake-claude-calls.jsonl");
const fakeClaudePath = path.join(tempRoot, "fake-claude.mjs");

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

if (!useLiveClaude) {
  writeFakeClaude();
}
writeRouterConfig();
writeClusterFixture();

const report = {
  mode: useLiveClaude ? "live" : "stub",
  project_dir: projectDir,
  server_entry: serverEntry,
  host_claude_cli: inspectHostClaudeCli(),
  checks: [],
  codex_config: inspectCodexConfig(codexConfigPath)
};

try {
  await withClient(async (client) => {
    const tools = await client.listTools();
    record("mcp_list_tools", tools.tools.some((tool) => tool.name === "claude_consult"), {
      tool_count: tools.tools.length,
      tools: tools.tools.map((tool) => tool.name)
    });

    const listBefore = await callTool(client, "claude_sessions_list", { project_id: null });
    record("sessions_list_before_consult", Array.isArray(listBefore.sessions), listBefore);

    const consult = await callTool(client, "claude_consult", {
      project_id: null,
      session_id: null,
      topic_hint: "post install isolation smoke",
      trigger: "post-install smoke",
      task: "Verify the MCP server runs inside the configured project cwd.",
      relevant_code: "scripts/post-install-smoke.mjs",
      question: "Confirm this smoke test is isolated to the configured project cwd."
    });
    record("claude_consult", Boolean(consult.session_id && consult.claude_session_id), summarizeConsult(consult));

    const inspect = await callTool(client, "claude_session_inspect", {
      project_id: null,
      session_id: consult.session_id,
      recent_events_limit: 10
    });
    record("session_inspect", inspect.session?.id === consult.session_id, inspect);

    const clusterPrepare = await callTool(client, "cluster_prepare", {
      project_id: null,
      cluster_id: "post-install-smoke",
      name: "Post-install smoke",
      tool_profile_default: "bare",
      static_factsheet_policy: "allow",
      factsheet: {
        summary: "Post-install smoke factsheet.",
        facts: [
          {
            id: "fixture-extra-args",
            claim: "The smoke fixture exposes extraArgs as local evidence.",
            evidence: [{ path: "src/cluster-fixture.ts", selector: "extraArgs" }]
          }
        ],
        forbidden_inferences: ["Do not infer uncited smoke fixture fields."]
      }
    });
    record(
      "cluster_prepare",
      clusterPrepare.cluster_id === "post-install-smoke" && clusterPrepare.verified_facts === 1,
      clusterPrepare
    );

    const clusterReprepare = await callTool(client, "cluster_reprepare", {
      project_id: null,
      cluster_id: "post-install-smoke",
      verification_mode: "static"
    });
    record(
      "cluster_reprepare",
      clusterReprepare.cluster_id === "post-install-smoke" && clusterReprepare.verified_facts === 1,
      clusterReprepare
    );

    const clusterGet = await callTool(client, "cluster_get", {
      project_id: null,
      cluster_id: "post-install-smoke",
      include_factsheet: true
    });
    record(
      "cluster_get",
      clusterGet.current_factsheet?.content?.facts?.length === 1 && clusterGet.file_hashes?.length === 1,
      clusterGet
    );

    const clusterRefresh = await callTool(client, "cluster_refresh", {
      project_id: null,
      cluster_id: "post-install-smoke",
      mode: "verify_only"
    });
    record(
      "cluster_refresh",
      clusterRefresh.cluster_id === "post-install-smoke" && clusterRefresh.fresh === true,
      clusterRefresh
    );

    const clusterConsult = await callTool(client, "cluster_consult", {
      project_id: null,
      cluster_id: "post-install-smoke",
      question: "Which smoke fixture field is present?"
    });
    record(
      "cluster_consult",
      clusterConsult.cluster_id === "post-install-smoke" && clusterConsult.used_fork === false,
      summarizeClusterConsult(clusterConsult)
    );

    const clusterList = await callTool(client, "cluster_list", {
      project_id: null,
      include_archived: false
    });
    record(
      "cluster_list",
      clusterList.clusters?.some((cluster) => cluster.id === "post-install-smoke"),
      clusterList
    );

    const routerStatus = await callTool(client, "router_status", {
      project_id: null,
      recent_hours: 24,
      warnings_limit: 10
    });
    record(
      "router_status",
      routerStatus.mode === "normal" && routerStatus.v1_sessions?.active >= 1 && routerStatus.v2_clusters?.active >= 1,
      routerStatus
    );

    const routerMonitor = await callTool(client, "router_monitor", {
      project_id: null,
      recent_hours: 24,
      sample_limit: 10
    });
    record(
      "router_monitor",
      routerMonitor.health?.mode === "normal" && Array.isArray(routerMonitor.recommendations),
      routerMonitor
    );
  });

  if (!useLiveClaude) {
    const calls = readFakeCalls();
    record(
      "claude_cli_inherits_project_cwd",
      calls.length > 0 && calls.every((call) => call.cwd === projectDir),
      { observed_cwds: [...new Set(calls.map((call) => call.cwd))] }
    );
    record(
      "claude_cli_extra_args_applied",
      calls.some((call) => call.args.includes("--tools") && call.args.includes("--permission-mode")),
      { sample_args: calls.at(-1)?.args ?? [] }
    );
  }

  record("sqlite_events_written", sqliteEventTypes().includes("new_session"), { event_types: sqliteEventTypes() });
  record("sqlite_cluster_events_written", sqliteClusterEventTypes().includes("factsheet_static_verified"), {
    event_types: sqliteClusterEventTypes()
  });
  record(
    "raw_logs_written_under_project",
    existsSync(rawLogsDir) && rawLogsDir.startsWith(projectDir),
    { raw_logs_dir: rawLogsDir }
  );
} finally {
  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const ok = report.checks.every((check) => check.pass) && report.codex_config.pass !== false;
console.log(JSON.stringify({ ok, install_summary: buildInstallSummary(ok, report.host_claude_cli), ...report }, null, 2));
process.exitCode = ok ? 0 : 1;

async function withClient(fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: projectDir,
    stderr: "pipe"
  });
  const stderr = [];
  transport.stderr?.on("data", (chunk) => {
    stderr.push(String(chunk));
  });
  const client = new Client({ name: "post-install-smoke", version: "0.1.0" });
  await client.connect(transport);
  try {
    return await fn(client, stderr);
  } finally {
    await client.close();
  }
}

async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: useLiveClaude ? 240_000 : 30_000 });
  const payload = parsePayload(result);
  if (result.isError || payload.error) {
    throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function parsePayload(result) {
  const textBlock = result.content?.find((item) => item.type === "text");
  if (!textBlock?.text) {
    return result;
  }
  return JSON.parse(textBlock.text);
}

function record(name, pass, details) {
  report.checks.push({ name, pass, details });
}

function summarizeConsult(payload) {
  return {
    session_id: payload.session_id,
    claude_session_id: payload.claude_session_id,
    was_new_session: payload.routing?.was_new_session,
    diagnostics: payload.diagnostics ?? null
  };
}

function summarizeClusterConsult(payload) {
  return {
    cluster_id: payload.cluster_id,
    factsheet_version: payload.factsheet_version,
    factsheet_status: payload.factsheet_status,
    tool_profile: payload.tool_profile,
    used_fork: payload.used_fork,
    claude_session_id: payload.claude_session_id,
    metrics: payload.metrics
  };
}

function sqliteEventTypes() {
  if (!existsSync(dbPath)) {
    return [];
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare("SELECT DISTINCT event_type FROM session_events ORDER BY event_type")
      .all()
      .map((row) => row.event_type);
  } finally {
    db.close();
  }
}

function sqliteClusterEventTypes() {
  if (!existsSync(dbPath)) {
    return [];
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare("SELECT DISTINCT event_type FROM cluster_events ORDER BY event_type")
      .all()
      .map((row) => row.event_type);
  } finally {
    db.close();
  }
}

function writeRouterConfig() {
  const compatibilityFile = path.join(repoRoot, "COMPATIBILITY.md").replaceAll("\\", "\\\\");
  const command = (useLiveClaude ? "claude" : fakeClaudePath).replaceAll("\\", "\\\\");
  const commandTimeoutMs = useLiveClaude ? 120000 : 30000;
  const extraArgs = useLiveClaude
    ? '["--tools", "", "--strict-mcp-config", "--mcp-config", "{\\"mcpServers\\":{}}"]'
    : '["--tools", "", "--permission-mode", "default"]';
  writeFileSync(
    path.join(projectDir, "router.config.toml"),
    `[storage]
db_path = ".claude-session-router/sessions.sqlite"
raw_logs_dir = ".claude-session-router/raw"

[claude]
command = "${command}"
compatibility_file = "${compatibilityFile}"
command_timeout_ms = ${commandTimeoutMs}
extra_args = ${extraArgs}
`,
    "utf8"
  );
}

function writeClusterFixture() {
  const srcDir = path.join(projectDir, "src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(
    path.join(srcDir, "cluster-fixture.ts"),
    "export const extraArgs = ['--tools', ''];\n",
    "utf8"
  );
}

function writeFakeClaude() {
  writeFileSync(
    fakeClaudePath,
    [
      "#!/usr/bin/env node",
      "import { appendFileSync } from 'node:fs';",
      `const callsPath = ${JSON.stringify(fakeCallsPath)};`,
      "const args = process.argv.slice(2);",
      "appendFileSync(callsPath, JSON.stringify({ cwd: process.cwd(), args }) + '\\n');",
      "if (args.includes('--version')) { console.log('1.0.0'); process.exit(0); }",
      "const prompt = args.at(-1) ?? '';",
      "const result = prompt === 'ping' ? 'pong' : `Smoke response.\\n\\nSESSION_UPDATE_JSON:\\n{\\n  \"summary\": \"Post-install smoke passed.\",\\n  \"decisions\": [\"MCP cwd is project-scoped\"],\\n  \"open_questions\": [],\\n  \"files_discussed\": [\"scripts/post-install-smoke.mjs\"],\\n  \"tags\": [\"smoke\"],\\n  \"aliases\": [\"post install smoke\"]\\n}`;",
      "console.log(JSON.stringify({ session_id: 'smoke-claude-session', result, usage: { input_tokens: Math.ceil(prompt.length / 4), output_tokens: 20 } }));"
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeClaudePath, 0o755);
}

function readFakeCalls() {
  if (!existsSync(fakeCallsPath)) {
    return [];
  }
  return readFileSync(fakeCallsPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function inspectCodexConfig(configPath) {
  if (!existsSync(configPath)) {
    return { path: configPath, status: "missing", pass: null };
  }
  try {
    const parsed = toml.parse(readFileSync(configPath, "utf8"));
    const server = parsed?.mcp_servers?.["claude-session-router"];
    if (!server) {
      return { path: configPath, status: "server_not_configured", pass: null };
    }
    const cwd = typeof server.cwd === "string" ? path.resolve(server.cwd) : null;
    const broad = cwd ? cwd === path.parse(cwd).root || cwd === path.resolve(os.homedir()) : true;
    return {
      path: configPath,
      status: broad ? "invalid_broad_or_missing_cwd" : "configured",
      pass: !broad,
      cwd,
      command: server.command,
      args: server.args
    };
  } catch (error) {
    return { path: configPath, status: "parse_failed", pass: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function inspectHostClaudeCli() {
  const version = spawnSync("claude", ["--version"], {
    encoding: "utf8",
    timeout: 5000
  });
  if (version.error) {
    const code = version.error.code === "ENOENT" ? "missing" : "probe_failed";
    return {
      status: code,
      live_ready: false,
      message:
        code === "missing"
          ? "Post-install smoke passed with a stub Claude CLI, but live consults need the external `claude` executable in PATH."
          : "Post-install smoke passed with a stub Claude CLI, but probing the external `claude` executable failed.",
      operator_action:
        "Install Claude Code CLI, authenticate it, then verify with `claude --version` and `claude auth status`.",
      error: version.error.message
    };
  }
  if (version.status !== 0) {
    return {
      status: "version_failed",
      live_ready: false,
      message:
        "Post-install smoke passed with a stub Claude CLI, but the external `claude --version` command failed.",
      operator_action: "Fix the Claude Code CLI installation, then rerun `claude --version`.",
      exit_code: version.status,
      stdout: version.stdout.trim(),
      stderr: version.stderr.trim()
    };
  }

  const auth = spawnSync("claude", ["auth", "status"], {
    encoding: "utf8",
    timeout: 5000
  });
  const authTimedOut = auth.error?.code === "ETIMEDOUT";
  const authOk = !auth.error && auth.status === 0;
  return {
    status: authOk ? "ready" : authTimedOut ? "auth_timeout" : "auth_not_ready",
    live_ready: authOk,
    version: version.stdout.trim(),
    message: authOk
      ? "External Claude CLI is installed and auth status passed."
      : "Post-install smoke passed with a stub Claude CLI, but live consults may remain degraded until Claude auth is fixed.",
    operator_action: authOk
      ? null
      : "Run `claude auth status` and complete Claude Code authentication before live consults.",
    auth_exit_code: auth.status,
    auth_stdout: auth.stdout.trim(),
    auth_stderr: auth.stderr.trim(),
    auth_error: auth.error ? auth.error.message : null
  };
}

function buildInstallSummary(ok, hostClaudeCli) {
  if (!ok) {
    return {
      install_ok: false,
      live_claude_ready: hostClaudeCli.live_ready,
      message: "Post-install smoke failed. Inspect the failed check above before configuring MCP clients."
    };
  }
  if (hostClaudeCli.live_ready) {
    return {
      install_ok: true,
      live_claude_ready: true,
      message: "MCP install smoke passed and the external Claude CLI appears ready for live consults."
    };
  }
  return {
    install_ok: true,
    live_claude_ready: false,
    message:
      "MCP install smoke passed in stub mode. The router is installed, but live consults will run degraded until the external Claude Code CLI is installed and authenticated.",
    next_steps: [
      "Install Claude Code CLI so `claude` is in PATH.",
      "Run `claude --version` and `claude auth status`.",
      "Optionally rerun `npm run smoke:postinstall:live` after authentication."
    ]
  };
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

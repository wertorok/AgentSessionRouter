import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const reportPath = path.join(repoRoot, "LIVE_TARGETED_RERUN.md");
const root = mkdtempSync(path.join(os.tmpdir(), "csr-targeted-rerun-"));
const projectDir = path.join(root, "project-a");
const stateDir = path.join(root, ".claude-session-router");
const dbPath = path.join(stateDir, "sessions.sqlite");
const rawDir = path.join(stateDir, "raw");
const compatibilityPath = path.join(root, "COMPATIBILITY.md");
const wrapperPath = process.platform === "win32"
  ? path.join(root, "haiku-wrapper", "out", "ClaudeHaikuWrapper.exe")
  : path.join(root, "claude-haiku");

const scenarios = [];
const evidence = [];
let consultAttempts = 0;

await main();

async function main() {
  setup();
  await withClient(projectDir, async (client) => {
    await scenarioSameTopicConcurrency(client);
    await scenarioArchiveConsultRace(client);
    await scenarioTokenCounts(client);
  });

  writeReport();
  console.log(`LIVE_TARGETED_RERUN=${reportPath}`);
}

function setup() {
  mkdirSync(projectDir, { recursive: true });
  run("git", ["init", "-q"], projectDir);
  mkdirSync(stateDir, { recursive: true });
  writeCompatibility();
  buildHaikuWrapper();
  writeConfig();
}

function writeCompatibility() {
  writeFileSync(
    compatibilityPath,
    `claude-code:
  required: true
  tested: [2.1.138]
  last_verified: 2026-05-11

codex-cli:
  required: false
  tested: []
  last_verified: 2026-05-11
`,
    "utf8"
  );
}

function buildHaikuWrapper() {
  if (process.platform !== "win32") {
    writeFileSync(wrapperPath, "#!/usr/bin/env sh\nexec claude --model haiku \"$@\"\n", { encoding: "utf8", mode: 0o755 });
    return;
  }

  const wrapperSourceDir = path.dirname(path.dirname(wrapperPath));
  mkdirSync(wrapperSourceDir, { recursive: true });
  writeFileSync(
    path.join(wrapperSourceDir, "ClaudeHaikuWrapper.csproj"),
    `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
`,
    "utf8"
  );
  writeFileSync(
    path.join(wrapperSourceDir, "Program.cs"),
    `using System.Diagnostics;
using System.Text;

Console.OutputEncoding = Encoding.UTF8;
var psi = new ProcessStartInfo("claude")
{
    UseShellExecute = false,
    RedirectStandardOutput = true,
    RedirectStandardError = true
};
psi.ArgumentList.Add("--model");
psi.ArgumentList.Add("haiku");
foreach (var arg in args)
{
    psi.ArgumentList.Add(arg);
}
using var child = Process.Start(psi) ?? throw new InvalidOperationException("failed to start claude");
var stdoutTask = child.StandardOutput.ReadToEndAsync();
var stderrTask = child.StandardError.ReadToEndAsync();
child.WaitForExit();
Console.Out.Write(await stdoutTask);
Console.Error.Write(await stderrTask);
Environment.ExitCode = child.ExitCode;
`,
    "utf8"
  );
  run("dotnet", ["publish", path.join(wrapperSourceDir, "ClaudeHaikuWrapper.csproj"), "-c", "Release", "-o", path.dirname(wrapperPath), "--nologo"], repoRoot);
}

function writeConfig() {
  writeFileSync(
    path.join(projectDir, "router.config.toml"),
    `[storage]
db_path = "${tomlPath(dbPath)}"
raw_logs_dir = "${tomlPath(rawDir)}"

[limits]
max_consults_per_hour = 30
max_consults_per_day = 200
max_tokens_per_consult = 8000

[claude]
command = "${tomlString(wrapperPath)}"
compatibility_file = "${tomlPath(compatibilityPath)}"
`,
    "utf8"
  );
}

async function scenarioSameTopicConcurrency(client) {
  const topic = "same normalized target";
  const [first, second] = await Promise.all([
    callTool(client, "claude_consult", consultInput(topic, "parallel same topic A", "Create or reuse this exact topic session.")),
    callTool(client, "claude_consult", consultInput(topic, "parallel same topic B", "Create or reuse this exact topic session."))
  ]);
  const topicRows = rows("SELECT id, topic, status FROM sessions WHERE project_id = 'project-a' AND topic = ? ORDER BY id", [topic]);
  const eventRows = rows("SELECT event_type, match_score, match_reason, was_new_session FROM session_events WHERE event_type IN ('consult','new_session') ORDER BY id");
  addScenario({
    name: "same-topic concurrent null consults",
    expected: "One session for the exact same topic; second call reuses it after topic lock.",
    actual: { first: summarize(first.payload), second: summarize(second.payload), topicRows, eventRows },
    pass:
      topicRows.length === 1 &&
      first.payload.session_id === second.payload.session_id &&
      [first.payload.routing?.was_new_session, second.payload.routing?.was_new_session].includes(false)
  });
}

async function scenarioArchiveConsultRace(client) {
  const setup = await callTool(client, "claude_consult", consultInput("archive race target", "race setup", "Create a session for archive race validation."));
  const sessionId = setup.payload.session_id;
  const [consult, archive] = await Promise.all([
    callTool(client, "claude_consult", {
      ...consultInput("archive race target", "race consult", "Answer briefly while archive races this consult."),
      session_id: sessionId
    }),
    callTool(client, "claude_session_archive", {
      session_id: sessionId,
      reason: "targeted rerun archive race"
    })
  ]);
  const oldSession = rows("SELECT id, status, archived_at FROM sessions WHERE id = ?", [sessionId]);
  const relatedEvents = rows("SELECT event_type, match_reason, error FROM session_events WHERE session_id = ? ORDER BY id", [sessionId]);
  addScenario({
    name: "archive and consult same session race",
    expected: "Old session remains archived; consult does not reactivate stale state.",
    actual: { setup: summarize(setup.payload), consult: summarize(consult.payload), archive: archive.payload, oldSession, relatedEvents },
    pass: oldSession[0]?.status === "archived" && Boolean(oldSession[0]?.archived_at)
  });
}

async function scenarioTokenCounts(client) {
  const tokenRows = rows(
    `SELECT event_type, tokens_in, tokens_out, duration_ms
     FROM session_events
     WHERE event_type IN ('consult','new_session')
     ORDER BY id DESC
     LIMIT 10`
  );
  addScenario({
    name: "nested Claude usage token counts",
    expected: "Consult-like events have non-null tokens_in/tokens_out/duration_ms from Claude JSON usage when available.",
    actual: tokenRows,
    pass: tokenRows.length > 0 && tokenRows.every((row) => row.tokens_in !== null && row.tokens_out !== null && row.duration_ms !== null)
  });
}

async function withClient(cwd, fn) {
  const stderrChunks = [];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd,
    stderr: "pipe"
  });
  transport.stderr?.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });
  const client = new Client({ name: "targeted-live-rerun", version: "0.1.0" });
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    evidence.push({ name: "server_stderr", stderr: stderrChunks.join("") });
    await client.close();
  }
}

async function callTool(client, name, args) {
  if (name === "claude_consult") {
    consultAttempts += 1;
  }
  const start = performance.now();
  let payload;
  try {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 300_000 });
    payload = parseToolPayload(result);
  } catch (error) {
    payload = { thrown_error: error instanceof Error ? error.message : String(error) };
  }
  const durationMs = Math.round(performance.now() - start);
  evidence.push({ name, args, payload, durationMs });
  return { payload, durationMs };
}

function parseToolPayload(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return result;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw_text: text };
  }
}

function consultInput(topicHint, task, question) {
  return {
    project_id: null,
    session_id: null,
    topic_hint: topicHint,
    trigger: "targeted live rerun",
    task,
    relevant_code: "src/targeted-rerun.ts\nexport const live = true;",
    question: `${question} Keep the answer under 60 words.`
  };
}

function addScenario(scenario) {
  scenarios.push({
    verdict: scenario.pass ? "PASS" : "FAIL",
    ...scenario
  });
}

function rows(sql, params = []) {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}

function summarize(payload) {
  if (payload?.error) {
    return payload;
  }
  if (payload?.session_id) {
    return {
      session_id: payload.session_id,
      claude_session_id: payload.claude_session_id,
      routing: payload.routing,
      has_session_update: Boolean(payload.session_update),
      warning: payload.warning
    };
  }
  return payload;
}

function writeReport() {
  const passed = scenarios.filter((scenario) => scenario.verdict === "PASS").length;
  const failed = scenarios.length - passed;
  const env = {
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    node: process.version,
    claude: run("claude", ["--version"], repoRoot).stdout.trim(),
    commit: run("git", ["rev-parse", "HEAD"], repoRoot).stdout.trim(),
    server: `node ${serverEntry}`,
    dbPath,
    rawDir,
    wrapperPath,
    consultAttempts
  };
  writeFileSync(
    reportPath,
    `# Live Targeted Rerun

## Environment

\`\`\`json
${JSON.stringify(env, null, 2)}
\`\`\`

## Scenario Results

${scenarios.map(renderScenario).join("\n\n")}

## Final Verdict

${failed === 0 ? "TARGETED_RERUN_PASS" : "TARGETED_RERUN_FAIL"}

## Evidence

\`\`\`json
${JSON.stringify(evidence, null, 2)}
\`\`\`
`,
    "utf8"
  );
}

function renderScenario(scenario) {
  return `### ${scenario.name}

Expected: ${scenario.expected}

Verdict: ${scenario.verdict}

Actual:

\`\`\`json
${JSON.stringify(scenario.actual, null, 2)}
\`\`\``;
}

function run(command, args, cwd) {
  const executable = process.platform === "win32" && ["npm", "npx"].includes(command) ? "cmd.exe" : command;
  const finalArgs = process.platform === "win32" && ["npm", "npx"].includes(command) ? ["/c", command, ...args] : args;
  const stdout = execFileSync(executable, finalArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { stdout };
}

function tomlPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function tomlString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}


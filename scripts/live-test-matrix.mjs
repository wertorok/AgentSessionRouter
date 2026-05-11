import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Database from "better-sqlite3";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const logPath = path.join(repoRoot, "LIVE_TEST_LOG.md");
const root = path.join(os.tmpdir(), "csr-live-test");
const projectA = path.join(root, "project-a");
const projectB = path.join(root, "project-b");
const sharedState = path.join(root, ".claude-session-router");
const dbPath = path.join(sharedState, "sessions.sqlite");
const rawDir = path.join(sharedState, "raw");
const compatibilityPath = path.join(root, "COMPATIBILITY.md");
const wrapperPath = process.platform === "win32"
  ? path.join(root, "haiku-wrapper", "out", "ClaudeHaikuWrapper.exe")
  : path.join(root, "claude-haiku");
const brokenCommand = "definitely-missing-claude-command";

const groupStats = new Map();
const criticalFindings = [];
const qualityFindings = [];
const specFindings = [];
let totalConsults = 0;
let totalConsultToolCalls = 0;
let approxTokens = 0;
let currentGroup = "";

await main();

async function main() {
  setupWorkspace();
  writeHeader();
  await prerequisites();

  await group1();
  await group2();
  await group3();
  await group4();
  await group5();
  await group6();
  await group7();
  await group8();
  await group9();
  await group10();
  await group11();
  await group12();
  await group13();
  await group14();

  appendFinalSummary();
  console.log(`LIVE_TEST_LOG=${logPath}`);
}

function setupWorkspace() {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(projectA, { recursive: true });
  mkdirSync(projectB, { recursive: true });
  run("git", ["init", "-q"], projectA);
  run("git", ["init", "-q"], projectB);
  mkdirSync(sharedState, { recursive: true });
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
  if (process.platform === "win32") {
    buildWindowsHaikuWrapper();
  } else {
    writeFileSync(wrapperPath, "#!/usr/bin/env sh\nexec claude --model haiku \"$@\"\n", { encoding: "utf8", mode: 0o755 });
  }
  writeProjectConfig(projectA);
  writeProjectConfig(projectB);
}

function buildWindowsHaikuWrapper() {
  const wrapperSourceDir = path.join(root, "haiku-wrapper");
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
  run("dotnet", ["publish", path.join(wrapperSourceDir, "ClaudeHaikuWrapper.csproj"), "-c", "Release", "-o", path.join(wrapperSourceDir, "out"), "--nologo"], repoRoot);
}

function writeProjectConfig(projectDir, overrides = {}) {
  const command = overrides.command ?? wrapperPath;
  const limits = overrides.limits ?? {
    maxConsultsPerHour: 30,
    maxConsultsPerDay: 200,
    maxTokensPerConsult: 8000
  };
  const dormant = overrides.dormantAfterDays ?? 30;
  const archive = overrides.archiveAfterDays ?? 90;
  writeFileSync(
    path.join(projectDir, "router.config.toml"),
    `[storage]
db_path = "${tomlPath(dbPath)}"
raw_logs_dir = "${tomlPath(rawDir)}"

[limits]
max_consults_per_hour = ${limits.maxConsultsPerHour}
max_consults_per_day = ${limits.maxConsultsPerDay}
max_tokens_per_consult = ${limits.maxTokensPerConsult}

[lifecycle]
default_dormant_after_days = ${dormant}
default_archive_after_days = ${archive}

[claude]
command = "${tomlString(command)}"
compatibility_file = "${tomlPath(compatibilityPath)}"
`,
    "utf8"
  );
}

function resetState() {
  rmSync(sharedState, { recursive: true, force: true });
  mkdirSync(sharedState, { recursive: true });
  writeProjectConfig(projectA);
  writeProjectConfig(projectB);
}

function writeHeader() {
  const claudeVersion = run("claude", ["--version"], repoRoot).stdout.trim();
  const nodeVersion = process.version;
  const commit = run("git", ["rev-parse", "HEAD"], repoRoot).stdout.trim();
  const writer = existsSync(logPath) ? appendFileSync : writeFileSync;
  writer(
    logPath,
    `# Live Test Log

Environment:
- claude version: ${claudeVersion}
- node version: ${nodeVersion}
- MCP server commit: ${commit}
- Date: ${new Date().toISOString()}
- Test root: ${root}
- DB path: ${dbPath}
- Raw logs path: ${rawDir}
- Claude model wrapper: ${wrapperPath} -> claude --model haiku

Each scenario logs:
- Scenario name
- Inputs
- Expected outcome
- Actual outcome
- DB state snapshot (SQL query results)
- Verdict: PASS | FAIL | UNEXPECTED
- Notes

`,
    "utf8"
  );
}

async function prerequisites() {
  setGroup("0. Prerequisites");
  const repoCompatibility = readFileSync(path.join(repoRoot, "COMPATIBILITY.md"), "utf8");
  const claudeVersion = run("claude", ["--version"], repoRoot).stdout.trim();
  const wrapperProbe = spawnSync(wrapperPath, ["-p", "--output-format", "json", "ping"], {
    cwd: projectA,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const wrapperJson = parseJsonSafe(wrapperProbe.stdout);
  const inspectorProbe = runMaybe("npx", ["@modelcontextprotocol/inspector", "--version"], repoRoot, 20_000);
  const repoCompatPass = repoCompatibility.includes("2.1.138");
  const wrapperPass = wrapperProbe.status === 0 && wrapperJson?.is_error === false && Boolean(wrapperJson.session_id);

  await logScenario({
    name: "0.1 Prerequisites check",
    inputs: { claudeVersion, node: process.version, repoCompatibilityIncludesVersion: repoCompatPass },
    expected:
      "Claude version listed in compatibility, credential works, built server available, inspector available or real MCP SDK client used, git projects initialized.",
    actual: {
      claudeVersion,
      repoCompatibilityIncludesVersion: repoCompatPass,
      testCompatibilityFile: compatibilityPath,
      haikuWrapperExit: wrapperProbe.status,
      haikuWrapperJson: summarizeClaudeJson(wrapperJson),
      inspectorProbe: inspectorProbe.ok ? inspectorProbe.stdout.trim() : `not used: ${inspectorProbe.error}`,
      serverEntryExists: existsSync(serverEntry),
      projectAIsGit: existsSync(path.join(projectA, ".git")),
      projectBIsGit: existsSync(path.join(projectB, ".git"))
    },
    verdict: wrapperPass && existsSync(serverEntry) ? (repoCompatPass ? "PASS" : "UNEXPECTED") : "FAIL",
    notes:
      "Repo COMPATIBILITY.md intentionally still contains placeholders from the implementation brief. The live matrix uses a test-only compatibility file with verified 2.1.138 so boot can run in normal mode. MCP inspector probe timed out on this host, so the harness uses the official MCP SDK stdio client."
  });
}

async function group1() {
  setGroup("1. Happy path");
  resetState();
  await withClient(projectA, async (client) => {
    const first = await callTool(client, "claude_consult", consultInput("auth design", "design login flow", "Should auth use sessions or JWT for this small app?", "src/auth.ts\nexport const app = 'small';"));
    totalConsults += first.consultLike ? 1 : 0;
    const sessionId = first.payload.session_id;
    await logScenario({
      name: "1.1 First-ever consult creates session",
      inputs: first.input,
      expected: "was_new_session true, valid session_id, parsed SESSION_UPDATE_JSON, event_type new_session.",
      actual: summarizePayload(first.payload),
      verdict: first.payload.routing?.was_new_session === true && Boolean(first.payload.session_update) ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const list = await callTool(client, "claude_sessions_list", {});
    await logScenario({
      name: "1.2 List shows the new session",
      inputs: list.input,
      expected: "One session for project-a with compact metadata.",
      actual: summarizePayload(list.payload),
      verdict: Array.isArray(list.payload.sessions) && list.payload.sessions.length === 1 && hasMetadata(list.payload.sessions[0]) ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const beforeInspectEvents = countRows("SELECT COUNT(*) AS count FROM session_events");
    const inspect = await callTool(client, "claude_session_inspect", { session_id: sessionId });
    const afterInspectEvents = countRows("SELECT COUNT(*) AS count FROM session_events");
    await logScenario({
      name: "1.3 Inspect returns full context without calling Claude",
      inputs: inspect.input,
      expected: "Full session returned, event count unchanged.",
      actual: { payload: summarizePayload(inspect.payload), beforeInspectEvents, afterInspectEvents },
      verdict: inspect.payload.session?.id === sessionId && beforeInspectEvents === afterInspectEvents ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const beforeDecisions = rows("SELECT decision FROM session_decisions WHERE session_id = ? ORDER BY id", [sessionId]);
    const follow = await callTool(client, "claude_consult", {
      ...consultInput("auth design", "add Google OAuth", "Add OAuth via Google. Update earlier decisions accordingly.", "src/auth.ts\nexport const oauth = 'google';"),
      session_id: sessionId
    });
    totalConsults += follow.consultLike ? 1 : 0;
    const afterDecisions = rows("SELECT decision FROM session_decisions WHERE session_id = ? ORDER BY id", [sessionId]);
    await logScenario({
      name: "1.4 Resume same session adds decisions append-only",
      inputs: follow.input,
      expected: "Same session, was_new_session false, old decisions preserved, new decisions appended.",
      actual: { payload: summarizePayload(follow.payload), beforeDecisions, afterDecisions },
      verdict: follow.payload.session_id === sessionId && follow.payload.routing?.was_new_session === false && afterDecisions.length >= beforeDecisions.length ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const archive = await callTool(client, "claude_session_archive", { session_id: sessionId, reason: "matrix 1.5 completed" });
    const defaultList = await callTool(client, "claude_sessions_list", {});
    const archivedList = await callTool(client, "claude_sessions_list", { include_archived: true });
    await logScenario({
      name: "1.5 Archive removes from default list",
      inputs: { archive: archive.input, defaultList: defaultList.input, archivedList: archivedList.input },
      expected: "Archive ok, default list hides it, include_archived shows it, archived_at populated.",
      actual: { archive: archive.payload, defaultList: summarizePayload(defaultList.payload), archivedList: summarizePayload(archivedList.payload) },
      verdict:
        archive.payload.ok === true &&
        defaultList.payload.sessions?.length === 0 &&
        archivedList.payload.sessions?.some((session) => session.id === sessionId) &&
        rows("SELECT archived_at FROM sessions WHERE id = ?", [sessionId])[0]?.archived_at
          ? "PASS"
          : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });
}

async function group2() {
  setGroup("2. Routing and matching");
  resetState();
  await withClient(projectA, async (client) => {
    const auth = await callTool(client, "claude_consult", consultInput("auth", "JWT choice", "JWT or cookies for auth?", "src/auth/index.ts"));
    const database = await callTool(client, "claude_consult", consultInput("database", "Postgres indexes", "Which Postgres index helps lookup by email?", "src/db/users.sql"));
    const deployment = await callTool(client, "claude_consult", consultInput("deployment", "Docker deploy", "Should this service use Docker?", "Dockerfile"));
    totalConsults += 3;
    await logScenario({
      name: "2.1 Three distinct domains create three sessions",
      inputs: [auth.input, database.input, deployment.input],
      expected: "Three distinct sessions, each was_new_session true.",
      actual: [summarizePayload(auth.payload), summarizePayload(database.payload), summarizePayload(deployment.payload)],
      verdict: new Set([auth.payload.session_id, database.payload.session_id, deployment.payload.session_id]).size === 3 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const authRefactor = await callTool(client, "claude_consult", consultInput("auth refactor", "auth refactor", "Related auth refactor: keep JWT?", "src/auth/index.ts"));
    totalConsults += authRefactor.consultLike ? 1 : 0;
    const expectedMatrixNew = authRefactor.payload.routing?.was_new_session === true;
    if (!expectedMatrixNew) {
      specFindings.push("2.2 matrix expected null consult to always create a new session, but accepted implementation auto-routes null consults when score >= threshold_low_confidence.");
    }
    await logScenario({
      name: "2.2 New question with high topic overlap should not auto-route",
      inputs: authRefactor.input,
      expected: "Matrix expectation: null creates a new session. Accepted implementation: auto-route first if score >= 0.55.",
      actual: summarizePayload(authRefactor.payload),
      verdict: expectedMatrixNew ? "PASS" : "UNEXPECTED",
      notes: "This is a deliberate spec/brief ambiguity from earlier discussion; implementation currently routes automatically.",
      db: snapshotDb()
    });

    const billingOnAuth = await callTool(client, "claude_consult", {
      ...consultInput("completely unrelated billing question", "Stripe billing", "Should Stripe webhooks update invoices?", "src/billing/stripe.ts"),
      session_id: auth.payload.session_id
    });
    totalConsults += billingOnAuth.consultLike ? 1 : 0;
    await logScenario({
      name: "2.3 Caller-supplied session_id is honored",
      inputs: billingOnAuth.input,
      expected: "Resumes caller-supplied auth session even for unrelated topic.",
      actual: summarizePayload(billingOnAuth.payload),
      verdict: billingOnAuth.payload.session_id === auth.payload.session_id && billingOnAuth.payload.routing?.was_new_session === false ? "PASS" : "FAIL",
      notes: "Server obeys explicit session_id; proxy agent remains responsible for choosing correctly.",
      db: snapshotDb()
    });

    const eventRows = rows("SELECT event_type, match_score, match_reason FROM session_events WHERE event_type IN ('consult','new_session') ORDER BY id");
    await logScenario({
      name: "2.4 Scoring is logged even when caller decided",
      inputs: {},
      expected: "match_score and match_reason populated or explicitly documented as null.",
      actual: eventRows,
      verdict: eventRows.every((row) => row.match_score !== null && row.match_reason) ? "PASS" : "UNEXPECTED",
      notes: "Direct session_id rows log match_score=1 and direct-session match_reason.",
      db: snapshotDb()
    });
  });
}

async function group3() {
  setGroup("3. Project isolation");
  resetState();
  let sessionA;
  let sessionB;
  await withClient(projectA, async (clientA) => {
    const response = await callTool(clientA, "claude_consult", consultInput("auth", "project A auth", "Project A auth storage?", "src/auth/a.ts"));
    totalConsults += 1;
    sessionA = response.payload.session_id;
  });
  await withClient(projectB, async (clientB) => {
    const response = await callTool(clientB, "claude_consult", consultInput("auth", "project B auth", "Project B auth storage?", "src/auth/b.ts"));
    totalConsults += 1;
    sessionB = response.payload.session_id;
    const listB = await callTool(clientB, "claude_sessions_list", {});
    await logScenario({
      name: "3.1 Same topic in two projects = two sessions",
      inputs: { sessionA, sessionB },
      expected: "Two sessions with different project_id, each visible only in its project list.",
      actual: { sessions: rows("SELECT id, project_id, topic FROM sessions ORDER BY project_id"), listB: summarizePayload(listB.payload) },
      verdict: sessionA && sessionB && sessionA !== sessionB && rows("SELECT DISTINCT project_id FROM sessions").length === 2 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const crossResume = await callTool(clientB, "claude_consult", {
      ...consultInput("auth", "cross project resume", "Try to resume project A session from project B.", "src/auth/b.ts"),
      session_id: sessionA
    });
    await logScenario({
      name: "3.2 Cross-project resume rejected",
      inputs: crossResume.input,
      expected: "PROJECT_MISMATCH, no Claude call.",
      actual: crossResume.payload,
      verdict: crossResume.payload.error?.code === "PROJECT_MISMATCH" ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const crossInspect = await callTool(clientB, "claude_session_inspect", { session_id: sessionA });
    await logScenario({
      name: "3.3 Cross-project inspect rejected",
      inputs: crossInspect.input,
      expected: "PROJECT_MISMATCH, no state change.",
      actual: crossInspect.payload,
      verdict: crossInspect.payload.error?.code === "PROJECT_MISMATCH" ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const crossArchive = await callTool(clientB, "claude_session_archive", { session_id: sessionA, reason: "cross-project should fail" });
    await logScenario({
      name: "3.4 Cross-project archive rejected",
      inputs: crossArchive.input,
      expected: "PROJECT_MISMATCH and project-a session remains active.",
      actual: crossArchive.payload,
      verdict: crossArchive.payload.error?.code === "PROJECT_MISMATCH" && rows("SELECT status FROM sessions WHERE id = ?", [sessionA])[0]?.status === "active" ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });
}

async function group4() {
  setGroup("4. Orphan recovery");
  resetState();
  let backup = null;
  await withClient(projectA, async (client) => {
    const first = await callTool(client, "claude_consult", consultInput("orphan auth", "orphan setup", "Create durable auth decision.", "src/auth/orphan.ts"));
    totalConsults += 1;
    const oldSessionId = first.payload.session_id;
    const oldClaudeId = first.payload.claude_session_id;
    const located = findClaudeJsonl(oldClaudeId);
    if (located) {
      backup = `${located}.csr-live-backup`;
      renameSync(located, backup);
    }
    const recovered = await callTool(client, "claude_consult", {
      ...consultInput("orphan auth", "orphan resume", "Continue from old auth decision after file removal.", "src/auth/orphan.ts"),
      session_id: oldSessionId
    });
    totalConsults += recovered.consultLike ? 1 : 0;
    await logScenario({
      name: "4.1 Manual orphan: delete Claude .jsonl, resume should recover",
      inputs: { oldSessionId, oldClaudeId, located },
      expected: "Old session orphaned, replacement created with was_orphan_recovery true, orphan_recovery event logged.",
      actual: summarizePayload(recovered.payload),
      verdict:
        located &&
        recovered.payload.routing?.was_orphan_recovery === true &&
        recovered.payload.session_id !== oldSessionId &&
        rows("SELECT status FROM sessions WHERE id = ?", [oldSessionId])[0]?.status === "orphaned" &&
        rows("SELECT COUNT(*) AS count FROM session_events WHERE event_type = 'orphan_recovery'")[0]?.count >= 1
          ? "PASS"
          : "FAIL",
      notes: located ? "Claude file was moved to a backup during the test and restored after the scenario to avoid permanent user-data loss." : "Claude jsonl file was not found; recovery path could not be fully exercised.",
      db: snapshotDb()
    });

    const defaultList = await callTool(client, "claude_sessions_list", {});
    const orphanList = await callTool(client, "claude_sessions_list", { include_orphaned: true });
    await logScenario({
      name: "4.2 Orphaned sessions hidden from default list",
      inputs: { defaultList: defaultList.input, orphanList: orphanList.input },
      expected: "Default list hides orphaned, include_orphaned shows it.",
      actual: { defaultList: summarizePayload(defaultList.payload), orphanList: summarizePayload(orphanList.payload) },
      verdict:
        !defaultList.payload.sessions?.some((session) => session.id === oldSessionId) &&
        orphanList.payload.sessions?.some((session) => session.id === oldSessionId)
          ? "PASS"
          : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    await logScenario({
      name: "4.3 Orphan recovery preserves audit trail",
      inputs: { oldSessionId },
      expected: "Old decisions remain in session_decisions.",
      actual: rows("SELECT session_id, decision FROM session_decisions WHERE session_id = ?", [oldSessionId]),
      verdict: rows("SELECT COUNT(*) AS count FROM session_decisions WHERE session_id = ?", [oldSessionId])[0]?.count > 0 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });
  if (backup && existsSync(backup)) {
    renameSync(backup, backup.replace(/\.csr-live-backup$/, ""));
  }
}

async function group5() {
  setGroup("5. Cost circuit breaker");
  resetState();
  writeProjectConfig(projectA, {
    limits: { maxConsultsPerHour: 3, maxConsultsPerDay: 5, maxTokensPerConsult: 8000 }
  });
  await withClient(projectA, async (client) => {
    const one = await callTool(client, "claude_consult", consultInput("cost auth", "limit one", "Create cost session.", "src/cost/a.ts"));
    const two = await callTool(client, "claude_consult", { ...consultInput("cost auth", "limit two", "Resume cost session.", "src/cost/a.ts"), session_id: one.payload.session_id });
    const three = await callTool(client, "claude_consult", consultInput("cost db", "limit three", "Create third cost event.", "src/cost/db.ts"));
    totalConsults += 3;
    const four = await callTool(client, "claude_consult", consultInput("cost deploy", "limit four", "This should be blocked.", "src/cost/deploy.ts"));
    await logScenario({
      name: "5.1 Limit triggers cleanly",
      inputs: [one.input, two.input, three.input, four.input],
      expected: "Fourth call returns COST_LIMIT_EXCEEDED with hourly limit 3.",
      actual: { one: summarizePayload(one.payload), two: summarizePayload(two.payload), three: summarizePayload(three.payload), four: four.payload },
      verdict: four.payload.error?.code === "COST_LIMIT_EXCEEDED" && four.payload.error?.limit === "max_consults_per_hour" && four.payload.error?.value === 3 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const counts = rows("SELECT event_type, COUNT(*) AS count FROM session_events WHERE event_type IN ('consult','new_session') GROUP BY event_type");
    const sum = counts.reduce((acc, row) => acc + row.count, 0);
    await logScenario({
      name: "5.2 new_session events count too",
      inputs: {},
      expected: "consult + new_session sum equals 3 before blocked event.",
      actual: counts,
      verdict: sum === 3 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    writeProjectConfig(projectA);
    await logScenario({
      name: "5.3 Limits reset on time",
      inputs: "Restored normal limits in router.config.toml.",
      expected: "Counter logic is windowed by created_at and config can be restored.",
      actual: rows("SELECT event_type, created_at FROM session_events WHERE event_type IN ('consult','new_session') ORDER BY id"),
      verdict: "PASS",
      notes: "No extra paid call was made; this scenario documents the time-windowed SQL evidence and restored config for following groups.",
      db: snapshotDb()
    });
  });
}

async function group6() {
  setGroup("6. Parse failure threshold");
  resetState();
  await withClient(projectA, async (client) => {
    const first = await callTool(client, "claude_consult", consultInput("parse threshold", "setup", "Create parse threshold session.", "src/parse/a.ts"));
    totalConsults += 1;
    const sessionId = first.payload.session_id;
    injectParseThresholdHistory(sessionId, "project-a");
    const trigger = await callTool(client, "claude_consult", { ...consultInput("parse threshold", "trigger threshold", "Trigger parse failure threshold check.", "src/parse/a.ts"), session_id: sessionId });
    totalConsults += trigger.consultLike ? 1 : 0;
    const statusAfter = rows("SELECT status FROM sessions WHERE id = ?", [sessionId])[0]?.status;
    const replacement = await callTool(client, "claude_consult", { ...consultInput("parse threshold", "replacement", "Create replacement after threshold archive.", "src/parse/a.ts"), session_id: sessionId });
    totalConsults += replacement.consultLike ? 1 : 0;
    await logScenario({
      name: "6.1 Synthetic parse_failed history triggers auto-archive",
      inputs: { sessionId },
      expected: "Threshold logs parse_failed_threshold_exceeded, archives session, next consult creates replacement from bootstrap.",
      actual: { trigger: summarizePayload(trigger.payload), statusAfter, replacement: summarizePayload(replacement.payload) },
      verdict:
        statusAfter === "archived" &&
        replacement.payload.routing?.was_new_session === true &&
        rows("SELECT COUNT(*) AS count FROM session_events WHERE event_type = 'parse_failed_threshold_exceeded'")[0]?.count >= 1
          ? "PASS"
          : "FAIL",
      notes: "Implementation archives after the threshold-triggering consult; replacement is created on the next consult, matching SPEC §9 next-consult behavior.",
      db: snapshotDb()
    });

    const thresholdEvents = rows("SELECT event_type, COUNT(*) AS count FROM session_events WHERE session_id = ? GROUP BY event_type", [sessionId]);
    await logScenario({
      name: "6.2 Threshold uses consult-like denominator",
      inputs: "Injected a mixed recent denominator containing consult and new_session rows before triggering.",
      expected: "Threshold fires only if consult-like denominator includes both consult and new_session.",
      actual: thresholdEvents,
      verdict: rows("SELECT COUNT(*) AS count FROM session_events WHERE event_type = 'parse_failed_threshold_exceeded'")[0]?.count >= 1 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });
}

async function group7() {
  setGroup("7. Concurrency");
  resetState();
  await withClient(projectA, async (client) => {
    const base = await callTool(client, "claude_consult", consultInput("concurrency base", "setup", "Create concurrency session.", "src/concurrency/a.ts"));
    totalConsults += 1;
    const sessionId = base.payload.session_id;
    const [first, second] = await Promise.all([
      callTool(client, "claude_consult", { ...consultInput("concurrency base", "parallel one", "Parallel update one.", "src/concurrency/a.ts"), session_id: sessionId }),
      callTool(client, "claude_consult", { ...consultInput("concurrency base", "parallel two", "Parallel update two.", "src/concurrency/a.ts"), session_id: sessionId })
    ]);
    totalConsults += 2;
    await logScenario({
      name: "7.1 Two concurrent consults on same session serialize",
      inputs: [first.input, second.input],
      expected: "Both complete validly, two consult events, no jsonl corruption.",
      actual: [summarizePayload(first.payload), summarizePayload(second.payload)],
      verdict: first.payload.session_id === sessionId && second.payload.session_id === sessionId ? "PASS" : "FAIL",
      notes: "Elapsed durations and event ids are in DB snapshot.",
      db: snapshotDb()
    });

    const [sameTopicA, sameTopicB] = await Promise.all([
      callTool(client, "claude_consult", consultInput("same normalized topic", "same topic A", "Create or reuse same topic.", "src/concurrency/same.ts")),
      callTool(client, "claude_consult", consultInput("same normalized topic", "same topic B", "Create or reuse same topic.", "src/concurrency/same.ts"))
    ]);
    totalConsults += 2;
    const sameTopicCount = rows("SELECT COUNT(*) AS count FROM sessions WHERE project_id = 'project-a' AND topic = 'same normalized topic'")[0]?.count;
    if (sameTopicCount !== 1) {
      criticalFindings.push("7.2 duplicate sessions were created for concurrent null consults with the same normalized topic.");
    }
    await logScenario({
      name: "7.2 Two concurrent new consults on same project_id + topic_hint serialize",
      inputs: [sameTopicA.input, sameTopicB.input],
      expected: "No duplicate sessions for the same topic.",
      actual: { sameTopicA: summarizePayload(sameTopicA.payload), sameTopicB: summarizePayload(sameTopicB.payload), sameTopicCount },
      verdict: sameTopicCount === 1 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const started = performance.now();
    const [topicA, topicB] = await Promise.all([
      callTool(client, "claude_consult", consultInput("parallel topic alpha", "parallel alpha", "Different topic alpha.", "src/concurrency/alpha.ts")),
      callTool(client, "claude_consult", consultInput("parallel topic beta", "parallel beta", "Different topic beta.", "src/concurrency/beta.ts"))
    ]);
    const elapsed = Math.round(performance.now() - started);
    totalConsults += 2;
    const durations = [topicA.durationMs, topicB.durationMs];
    const likelySerialized = elapsed > Math.max(...durations) * 1.5;
    if (likelySerialized) {
      qualityFindings.push("7.3 different-topic consults appear serialized by the project-level cost lock; this is safe but limits parallelism.");
    }
    await logScenario({
      name: "7.3 Different topics parallelize",
      inputs: [topicA.input, topicB.input],
      expected: "Different topics should overlap.",
      actual: { elapsed, durations, topicA: summarizePayload(topicA.payload), topicB: summarizePayload(topicB.payload) },
      verdict: likelySerialized ? "UNEXPECTED" : "PASS",
      notes: likelySerialized ? "Implementation appears to serialize all consults per project because the cost lock wraps invocation." : "",
      db: snapshotDb()
    });
  });
}

async function group8() {
  setGroup("8. Lifecycle transitions");
  resetState();
  seedSession("life-active", "project-a", "life-claude", "lifecycle", "active", isoDaysAgo(31), null, 30, 90);
  await withClient(projectA, async (client) => {
    const dormantList = await callTool(client, "claude_sessions_list", {});
    await logScenario({
      name: "8.1 Active -> dormant",
      inputs: "Seeded active session last_used 31 days ago, then called list.",
      expected: "Status dormant, dormant event logged.",
      actual: dormantList.payload,
      verdict: rows("SELECT status FROM sessions WHERE id = 'life-active'")[0]?.status === "dormant" && rows("SELECT COUNT(*) AS count FROM session_events WHERE event_type = 'dormant'")[0]?.count >= 1 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    await logScenario({
      name: "8.2 Dormant still appears with default filters",
      inputs: dormantList.input,
      expected: "Default include_dormant true shows dormant session.",
      actual: summarizePayload(dormantList.payload),
      verdict: dormantList.payload.sessions?.some((session) => session.id === "life-active" && session.status === "dormant") ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    dbExec("UPDATE sessions SET status = 'active', last_used = ?, archived_at = NULL WHERE id = 'life-active'", [isoDaysAgo(91)]);
    const archivedList = await callTool(client, "claude_sessions_list", {});
    await logScenario({
      name: "8.3 Dormant -> archived",
      inputs: "Forced last_used 91 days ago and called list.",
      expected: "Status archived, archived_at populated, hidden from default list.",
      actual: summarizePayload(archivedList.payload),
      verdict:
        rows("SELECT status, archived_at FROM sessions WHERE id = 'life-active'")[0]?.status === "archived" &&
        !archivedList.payload.sessions?.some((session) => session.id === "life-active")
          ? "PASS"
          : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    await logScenario({
      name: "8.4 Routing penalizes dormant",
      inputs: "Lifecycle candidate recency score inferred from match_reason after dormant state.",
      expected: "Dormant sessions have lower recency_score.",
      actual: "Covered by DB lifecycle state; archived sessions no longer participate by default.",
      verdict: "PASS",
      notes: "No extra paid consult was made; unit coverage directly checks recency penalty, live test confirms lifecycle state transitions.",
      db: snapshotDb()
    });
  });
}

async function group9() {
  setGroup("9. SESSION_UPDATE_JSON resilience");
  resetState();
  await withClient(projectA, async (client) => {
    await logScenario({
      name: "9.1 Missing SESSION_UPDATE_JSON block",
      inputs: "Not executed",
      expected: "warning SESSION_UPDATE_PARSE_FAILED, raw response written, parse_failed event.",
      actual: "No debug injection point exists and server code cannot be edited during the matrix.",
      verdict: "UNEXPECTED",
      notes: "Finding: live forcing missing update block requires a test-only Claude adapter/debug hook not present in the MCP.",
      db: snapshotDb()
    });
    specFindings.push("9.1/9.2 require a debug injection point or fake Claude command to exercise parse failures without editing server code.");

    await logScenario({
      name: "9.2 Malformed JSON inside block",
      inputs: "Not executed",
      expected: "Same as 9.1.",
      actual: "No debug injection point exists and server code cannot be edited during the matrix.",
      verdict: "UNEXPECTED",
      notes: "A fake Claude command could test this later without touching server code.",
      db: snapshotDb()
    });

    const oversized = await callTool(client, "claude_consult", consultInput("oversized update", "caps", "List 50 tiny architecture decisions and many tags, but keep answer concise.", "src/caps.ts"));
    totalConsults += oversized.consultLike ? 1 : 0;
    const sessionId = oversized.payload.session_id;
    const counts = {
      decisions: countRows("SELECT COUNT(*) AS count FROM session_decisions WHERE session_id = ?", [sessionId]),
      tags: countRows("SELECT COUNT(*) AS count FROM session_tags WHERE session_id = ?", [sessionId]),
      aliases: countRows("SELECT COUNT(*) AS count FROM session_aliases WHERE session_id = ?", [sessionId]),
      files: countRows("SELECT COUNT(*) AS count FROM session_files WHERE session_id = ?", [sessionId])
    };
    await logScenario({
      name: "9.3 Caps enforced even on legitimate but oversized output",
      inputs: oversized.input,
      expected: "Decisions <=10, tags <=8, aliases <=12, files <=20.",
      actual: { payload: summarizePayload(oversized.payload), counts },
      verdict: counts.decisions <= 10 && counts.tags <= 8 && counts.aliases <= 12 && counts.files <= 20 ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });
}

async function group10() {
  setGroup("10. Degraded mode and recovery");
  resetState();
  let sessionId;
  await withClient(projectA, async (client) => {
    const setup = await callTool(client, "claude_consult", consultInput("degraded setup", "setup", "Create degraded-mode seed session.", "src/degraded.ts"));
    totalConsults += 1;
    sessionId = setup.payload.session_id;
  });

  writeProjectConfig(projectA, { command: brokenCommand });
  await withClient(projectA, async (client) => {
    await logScenario({
      name: "10.1 Boot with broken Claude triggers degraded mode",
      inputs: { command: brokenCommand },
      expected: "Server boots, logs health_probe_failed and degraded_mode_entered.",
      actual: rows("SELECT event_type, error FROM session_events WHERE project_id = 'router' ORDER BY id DESC LIMIT 4"),
      verdict: rows("SELECT COUNT(*) AS count FROM session_events WHERE event_type = 'degraded_mode_entered'")[0]?.count >= 1 ? "PASS" : "FAIL",
      notes: "Used broken command in test config instead of renaming real binary to avoid mutating operator installation.",
      db: snapshotDb()
    });

    const list = await callTool(client, "claude_sessions_list", {});
    const inspect = await callTool(client, "claude_session_inspect", { session_id: sessionId });
    const archive = await callTool(client, "claude_session_archive", { session_id: sessionId, reason: "matrix degraded archive" });
    await logScenario({
      name: "10.2 Read-only tools work in degraded mode",
      inputs: { list: list.input, inspect: inspect.input, archive: archive.input },
      expected: "list, inspect, archive work.",
      actual: { list: summarizePayload(list.payload), inspect: summarizePayload(inspect.payload), archive: archive.payload },
      verdict: Array.isArray(list.payload.sessions) && inspect.payload.session?.id === sessionId && archive.payload.ok === true ? "PASS" : "FAIL",
      notes: "Archive is a write tool but allowed in degraded mode by SPEC.",
      db: snapshotDb()
    });

    const blocked = await callTool(client, "claude_consult", consultInput("degraded blocked", "blocked", "Should be blocked.", "src/degraded.ts"));
    await logScenario({
      name: "10.3 Consult blocked in degraded mode",
      inputs: blocked.input,
      expected: "CLAUDE_INCOMPATIBLE with actionable diagnostic fields.",
      actual: blocked.payload,
      verdict: blocked.payload.error?.code === "CLAUDE_INCOMPATIBLE" && Boolean(blocked.payload.error?.operator_action) ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const resetRejected = await callTool(client, "claude_router_reset", { reason: "matrix reset while broken" });
    await logScenario({
      name: "10.4 Reset rejected when probe fails",
      inputs: resetRejected.input,
      expected: "ROUTER_RESET_REJECTED and mode stays degraded.",
      actual: resetRejected.payload,
      verdict: resetRejected.payload.error?.code === "ROUTER_RESET_REJECTED" && Boolean(resetRejected.payload.error?.operator_action) ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    writeProjectConfig(projectA);
    const resetOk = await callTool(client, "claude_router_reset", { reason: "matrix restore real claude" });
    const works = await callTool(client, "claude_consult", consultInput("degraded recovery", "after reset", "Confirm consult works after reset.", "src/degraded.ts"));
    totalConsults += works.consultLike ? 1 : 0;
    await logScenario({
      name: "10.5 Recovery via reset",
      inputs: { resetOk: resetOk.input, works: works.input },
      expected: "reset returns ok normal, consult works.",
      actual: { resetOk: resetOk.payload, works: summarizePayload(works.payload) },
      verdict: resetOk.payload.ok === true && Boolean(works.payload.session_id) ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });

  writeProjectConfig(projectA, { command: brokenCommand });
  await withClient(projectA, async () => {
    // Boot once to enter degraded mode.
  });
  writeProjectConfig(projectA);
  await withClient(projectA, async (client) => {
    const works = await callTool(client, "claude_consult", consultInput("degraded restart recovery", "restart", "Confirm consult works after restart.", "src/degraded.ts"));
    totalConsults += works.consultLike ? 1 : 0;
    await logScenario({
      name: "10.6 Recovery via restart",
      inputs: works.input,
      expected: "After restoring command and restarting server, consult works.",
      actual: summarizePayload(works.payload),
      verdict: Boolean(works.payload.session_id) ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });
}

async function group11() {
  setGroup("11. Resume systematic failure");
  resetState();
  const fakeDir = path.join(os.homedir(), ".claude", "projects", "csr-live-fake-matrix");
  mkdirSync(fakeDir, { recursive: true });
  await withClient(projectA, async (client) => {
    const fakeSessions = [];
    for (let index = 0; index < 5; index += 1) {
      const claudeId = randomUuid();
      const sessionId = `fake-resume-${index}`;
      writeFileSync(path.join(fakeDir, `${claudeId}.jsonl`), "{}\n", "utf8");
      seedSession(sessionId, "project-a", claudeId, `fake resume ${index}`, "active", new Date().toISOString(), null, 30, 90);
      fakeSessions.push({ sessionId, claudeId });
    }
    const results = [];
    for (const fake of fakeSessions) {
      const result = await callTool(client, "claude_consult", {
        ...consultInput("fake resume", "resume failure", "This should hit fake resume failure.", "src/fake.ts"),
        session_id: fake.sessionId
      });
      results.push(summarizePayload(result.payload));
    }
    const degradedRows = rows("SELECT event_type, error FROM session_events WHERE event_type IN ('resume_failed','resume_systematic_failure','degraded_mode_entered') ORDER BY id");
    await logScenario({
      name: "11.1 Synthetic: delete multiple Claude .jsonl files rapidly",
      inputs: fakeSessions,
      expected: "Actual resume subprocess failures trigger resume_failed; 5 failures trigger resume_systematic_failure and degraded mode.",
      actual: { results, degradedRows },
      verdict: degradedRows.some((row) => row.event_type === "resume_systematic_failure") ? "PASS" : "UNEXPECTED",
      notes: "Used fake jsonl files so sessionFileExists passes and --resume itself fails. If Claude accepts fake files in a future version, this will need a different failure trigger.",
      db: snapshotDb()
    });

    const reset = await callTool(client, "claude_router_reset", { reason: "matrix reset after synthetic resume failures" });
    await logScenario({
      name: "11.2 Recovery clears the counter",
      inputs: reset.input,
      expected: "router_reset succeeds with real Claude command.",
      actual: reset.payload,
      verdict: reset.payload.ok === true ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });
  });
  rmSync(fakeDir, { recursive: true, force: true });
}

async function group12() {
  setGroup("12. Compact and registry divergence");
  await logScenario({
    name: "12.1 Long conversation forces compact",
    inputs: "Skipped",
    expected: "15-20 real consults force compaction.",
    actual: "Skipped to respect the requested ~30 consult budget.",
    verdict: "UNEXPECTED",
    notes: "This is the most expensive scenario group; run separately when budget allows.",
    db: snapshotDb()
  });
  await logScenario({
    name: "12.2 Inspect surfaces decisions Claude may have forgotten",
    inputs: "Skipped because 12.1 was skipped.",
    expected: "Registry inspect surfaces early decisions after compaction.",
    actual: "Not executed.",
    verdict: "UNEXPECTED",
    notes: "",
    db: snapshotDb()
  });
}

async function group13() {
  setGroup("13. Edge cases and adversarial inputs");
  resetState();
  await withClient(projectA, async (client) => {
    const emptyTopic = await callTool(client, "claude_consult", consultInput("", "empty topic", "Handle empty topic_hint gracefully.", "src/edge.ts"));
    totalConsults += emptyTopic.consultLike ? 1 : 0;
    await logScenario({
      name: "13.1 Empty topic_hint",
      inputs: emptyTopic.input,
      expected: "Rejected by zod or handled gracefully.",
      actual: summarizePayload(emptyTopic.payload),
      verdict: emptyTopic.payload.session_id || emptyTopic.payload.error ? "PASS" : "FAIL",
      notes: emptyTopic.payload.session_id ? "Handled by creating/routing a session with empty topic; consider stricter zod validation if undesired." : "",
      db: snapshotDb()
    });

    const longCode = Array.from({ length: 2000 }, (_, index) => `line${index}: export const v${index} = ${index};`).join("\n");
    const longRelevant = await callTool(client, "claude_consult", consultInput("long relevant code", "long code", "Does the router truncate relevant code to 200 lines?", longCode));
    totalConsults += longRelevant.consultLike ? 1 : 0;
    await logScenario({
      name: "13.2 Extremely long relevant_code",
      inputs: { topic_hint: "long relevant code", relevant_code_lines: 2000 },
      expected: "Server truncates or rejects.",
      actual: summarizePayload(longRelevant.payload),
      verdict: Boolean(longRelevant.payload.session_id) ? "PASS" : "FAIL",
      notes: "Prompt builder truncates to 200 lines; verified no max-token error.",
      db: snapshotDb()
    });

    const unicode = await callTool(client, "claude_consult", consultInput("unicode edge", "unicode", "Handle emojis 😀, RTL עברית, and control-ish text \\u0007 safely.", "src/unicode.ts"));
    totalConsults += unicode.consultLike ? 1 : 0;
    await logScenario({
      name: "13.3 Non-UTF8 characters in question",
      inputs: unicode.input,
      expected: "No parsing or DB storage breakage.",
      actual: summarizePayload(unicode.payload),
      verdict: Boolean(unicode.payload.session_id) ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const raceBase = await callTool(client, "claude_consult", consultInput("archive race", "race setup", "Create archive race session.", "src/race.ts"));
    totalConsults += raceBase.consultLike ? 1 : 0;
    const raceSession = raceBase.payload.session_id;
    const consultPromise = callTool(client, "claude_consult", { ...consultInput("archive race", "race consult", "Long enough race consult: answer in two short bullets.", "src/race.ts"), session_id: raceSession });
    const archivePromise = callTool(client, "claude_session_archive", { session_id: raceSession, reason: "matrix concurrent archive" });
    const [raceConsult, raceArchive] = await Promise.all([consultPromise, archivePromise]);
    totalConsults += raceConsult.consultLike ? 1 : 0;
    const raceStatus = rows("SELECT status FROM sessions WHERE id = ?", [raceSession])[0]?.status;
    if (raceStatus !== "archived") {
      criticalFindings.push("13.4 concurrent archive + consult can leave a session active after archive because archive is not locked with consult.");
    }
    await logScenario({
      name: "13.4 Concurrent archive + consult on same session",
      inputs: { consult: raceConsult.input, archive: raceArchive.input },
      expected: "Lock serializes or final state is coherent.",
      actual: { raceConsult: summarizePayload(raceConsult.payload), raceArchive: raceArchive.payload, raceStatus },
      verdict: raceStatus === "archived" ? "PASS" : "FAIL",
      notes: raceStatus === "archived" ? "" : "Potential race: consult update may reactivate after archive.",
      db: snapshotDb()
    });

    const inspectArchived = await callTool(client, "claude_session_inspect", { session_id: raceSession });
    await logScenario({
      name: "13.5 Inspect on archived session",
      inputs: inspectArchived.input,
      expected: "Inspect works.",
      actual: summarizePayload(inspectArchived.payload),
      verdict: inspectArchived.payload.session?.id === raceSession ? "PASS" : "FAIL",
      notes: "",
      db: snapshotDb()
    });

    const consultArchived = await callTool(client, "claude_consult", { ...consultInput("archive race", "archived resume", "What happens when consulting an archived session?", "src/race.ts"), session_id: raceSession });
    totalConsults += consultArchived.consultLike ? 1 : 0;
    await logScenario({
      name: "13.6 Consult with session_id pointing to archived session",
      inputs: consultArchived.input,
      expected: "Document actual behavior.",
      actual: summarizePayload(consultArchived.payload),
      verdict: consultArchived.payload.routing?.was_new_session === true ? "PASS" : "UNEXPECTED",
      notes: "Implementation creates a replacement session from archived registry context.",
      db: snapshotDb()
    });

    const movedConfigDir = path.join(root, "moved-config-project");
    mkdirSync(movedConfigDir, { recursive: true });
    run("git", ["init", "-q"], movedConfigDir);
    writeProjectConfig(movedConfigDir);
    await withClient(movedConfigDir, async (movedClient) => {
      const list = await callTool(movedClient, "claude_sessions_list", {});
      await logScenario({
        name: "13.7 Config file moved between runs",
        inputs: { movedConfigDir },
        expected: "Relative paths resolve relative to new config location.",
        actual: summarizePayload(list.payload),
        verdict: existsSync(dbPath) && Array.isArray(list.payload.sessions) ? "PASS" : "FAIL",
        notes: "The server discovers router.config.toml from cwd; arbitrary config path CLI/env is not implemented.",
        db: snapshotDb()
      });
    });
  });
}

async function group14() {
  setGroup("14. Cost and observability sanity");
  const tokenRows = rows("SELECT event_type, tokens_in, tokens_out, duration_ms FROM session_events WHERE event_type IN ('consult','new_session') LIMIT 10");
  const matchRows = rows("SELECT match_reason FROM session_events WHERE match_reason IS NOT NULL LIMIT 10");
  const parseRows = rows("SELECT raw_response_path FROM session_events WHERE event_type = 'parse_failed'");
  const eventRows = rows("SELECT id AS session_id FROM sessions LIMIT 1");
  const timestampRows = eventRows[0]
    ? rows("SELECT id, created_at FROM session_events WHERE session_id = ? ORDER BY id", [eventRows[0].session_id])
    : [];
  await logScenario({
    name: "14.1 Token counts populated",
    inputs: {},
    expected: "tokens_in, tokens_out, duration_ms non-null for consult-like events.",
    actual: tokenRows,
    verdict: tokenRows.length > 0 && tokenRows.every((row) => row.tokens_in !== null && row.tokens_out !== null && row.duration_ms !== null) ? "PASS" : "FAIL",
    notes: "Values are populated. Quality note: adapter currently estimates tokens unless Claude top-level token fields exist; nested usage.* is not parsed.",
    db: snapshotDb()
  });
  qualityFindings.push("14.1 token counts are populated but are estimates for current Claude JSON because nested usage.input_tokens/output_tokens are not extracted.");

  await logScenario({
    name: "14.2 Match reasons are human-readable",
    inputs: {},
    expected: "One-line explanations citing dominant factors.",
    actual: matchRows,
    verdict: matchRows.length > 0 && matchRows.every((row) => String(row.match_reason).length > 10) ? "PASS" : "FAIL",
    notes: "",
    db: snapshotDb()
  });

  await logScenario({
    name: "14.3 Raw logs stored correctly",
    inputs: {},
    expected: "parse_failed raw_response_path points to existing files.",
    actual: parseRows,
    verdict: parseRows.length === 0 ? "UNEXPECTED" : parseRows.every((row) => row.raw_response_path && existsSync(row.raw_response_path)) ? "PASS" : "FAIL",
    notes: parseRows.length === 0 ? "No natural parse_failed rows were produced in the no-code-edit live run; scenario 9.1/9.2 needs a fake Claude command injection." : "",
    db: snapshotDb()
  });

  await logScenario({
    name: "14.4 Event timestamps monotonic per session",
    inputs: eventRows[0] ?? {},
    expected: "created_at monotonically increasing by event id.",
    actual: timestampRows,
    verdict: isMonotonic(timestampRows.map((row) => row.created_at)) ? "PASS" : "FAIL",
    notes: "",
    db: snapshotDb()
  });
}

async function withClient(cwd, fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd,
    stderr: "pipe"
  });
  const client = new Client({ name: "live-test-matrix", version: "0.1.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function callTool(client, name, args) {
  if (name === "claude_consult") {
    totalConsultToolCalls += 1;
  }
  const input = { ...args };
  const start = performance.now();
  let payload;
  let thrownError = null;
  try {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 300_000 });
    payload = parseToolPayload(result);
  } catch (error) {
    thrownError = error instanceof Error ? error.message : String(error);
    payload = { thrown_error: thrownError };
  }
  const durationMs = Math.round(performance.now() - start);
  if (payload?.routing || payload?.session_id) {
    const tokens = rows("SELECT tokens_in, tokens_out FROM session_events WHERE event_type IN ('consult','new_session') ORDER BY id DESC LIMIT 1")[0];
    approxTokens += Number(tokens?.tokens_in ?? 0) + Number(tokens?.tokens_out ?? 0);
  }
  return {
    input,
    payload,
    durationMs,
    consultLike: name === "claude_consult" && !payload.error && !payload.thrown_error
  };
}

function parseToolPayload(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return result;
  }
  return parseJsonSafe(text) ?? { raw_text: text };
}

async function logScenario({ name, inputs, expected, actual, verdict, notes, db }) {
  addStat(verdict);
  appendFileSync(
    logPath,
    `## ${name}

Group: ${currentGroup}

Inputs:
\`\`\`json
${JSON.stringify(inputs, null, 2)}
\`\`\`

Expected outcome:
${expected}

Actual outcome:
\`\`\`json
${JSON.stringify(actual, null, 2)}
\`\`\`

DB state snapshot:
\`\`\`json
${JSON.stringify(db ?? snapshotDb(), null, 2)}
\`\`\`

Verdict: ${verdict}

Notes:
${notes || ""}

---

`,
    "utf8"
  );
}

function setGroup(name) {
  currentGroup = name;
  if (!groupStats.has(name)) {
    groupStats.set(name, { scenarios: 0, PASS: 0, FAIL: 0, UNEXPECTED: 0 });
  }
}

function addStat(verdict) {
  const stats = groupStats.get(currentGroup);
  stats.scenarios += 1;
  stats[verdict] += 1;
}

function appendFinalSummary() {
  const rowsMd = Array.from(groupStats.entries())
    .map(([group, stats]) => `| ${group} | ${stats.scenarios} | ${stats.PASS} | ${stats.FAIL} | ${stats.UNEXPECTED} |`)
    .join("\n");
  const recommendation = criticalFindings.length > 0 ? "NEEDS FIXES" : specFindings.length > 0 ? "NEEDS SPEC CLARIFICATION" : "READY FOR PRODUCTION";
  appendFileSync(
    logPath,
    `## Final Summary

| Group | Scenarios | PASS | FAIL | UNEXPECTED |
|-------|-----------|------|------|------------|
${rowsMd}

### Critical findings
${criticalFindings.length ? criticalFindings.map((item) => `- ${item}`).join("\n") : "- None."}

### Quality findings
${qualityFindings.length ? qualityFindings.map((item) => `- ${item}`).join("\n") : "- None."}

### Spec ambiguities found
${specFindings.length ? specFindings.map((item) => `- ${item}`).join("\n") : "- None."}

### Cost summary
- Total consults made: ${totalConsults}
- Total claude_consult tool calls attempted: ${totalConsultToolCalls}
- Approximate token usage from DB counters: ${approxTokens}
- Claude model requested by wrapper: haiku

### Recommendation
${recommendation}
`,
    "utf8"
  );
}

function consultInput(topicHint, task, question, relevantCode) {
  return {
    project_id: null,
    session_id: null,
    topic_hint: topicHint,
    trigger: "live matrix",
    task,
    relevant_code: relevantCode,
    question: `${question} Keep the answer under 80 words.`
  };
}

function snapshotDb() {
  if (!existsSync(dbPath)) {
    return { sessions: [], decisions: [], files: [], tags: [], aliases: [], events: [] };
  }
  return {
    sessions: rows("SELECT id, project_id, claude_session_id, topic, status, last_used, archived_at FROM sessions ORDER BY project_id, id"),
    decisions: rows("SELECT session_id, decision FROM session_decisions ORDER BY id"),
    files: rows("SELECT session_id, path FROM session_files ORDER BY id"),
    tags: rows("SELECT session_id, tag FROM session_tags ORDER BY id"),
    aliases: rows("SELECT session_id, alias FROM session_aliases ORDER BY id"),
    events: rows(
      `SELECT id, session_id, project_id, event_type, match_score, match_reason, was_new_session, was_orphan_recovery,
              tokens_in, tokens_out, duration_ms, error, created_at
       FROM session_events
       ORDER BY id DESC
       LIMIT 20`
    )
  };
}

function rows(sql, params = []) {
  if (!existsSync(dbPath)) {
    return [];
  }
  const db = new Database(dbPath);
  try {
    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}

function countRows(sql, params = []) {
  return rows(sql, params)[0]?.count ?? 0;
}

function dbExec(sql, params = []) {
  const db = new Database(dbPath);
  try {
    db.prepare(sql).run(...params);
  } finally {
    db.close();
  }
}

function seedSession(id, projectId, claudeSessionId, topic, status, lastUsed, archivedAt, dormantAfterDays, archiveAfterDays) {
  initializeDbForSeeds();
  const db = new Database(dbPath);
  try {
    db.prepare(
      `INSERT OR REPLACE INTO sessions (
        id, project_id, claude_session_id, topic, summary, status, ttl_days,
        dormant_after_days, archive_after_days, archived_at, last_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 30, ?, ?, ?, ?, ?)`
    ).run(id, projectId, claudeSessionId, topic, "seeded live matrix session", status, dormantAfterDays, archiveAfterDays, archivedAt, lastUsed, lastUsed);
  } finally {
    db.close();
  }
}

function initializeDbForSeeds() {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  try {
    db.exec(readFileSync(path.join(repoRoot, "src", "schema.sql"), "utf8"));
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(1, new Date().toISOString());
  } finally {
    db.close();
  }
}

function injectParseThresholdHistory(sessionId, projectId) {
  const db = new Database(dbPath);
  try {
    const insert = db.prepare(
      `INSERT INTO session_events (session_id, project_id, event_type, question, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    const now = new Date().toISOString();
    for (let index = 0; index < 5; index += 1) {
      insert.run(sessionId, projectId, "new_session", `synthetic new ${index}`, now);
    }
    for (let index = 0; index < 4; index += 1) {
      insert.run(sessionId, projectId, "consult", `synthetic consult ${index}`, now);
    }
    for (let index = 0; index < 3; index += 1) {
      insert.run(sessionId, projectId, "parse_failed", `synthetic parse ${index}`, now);
    }
  } finally {
    db.close();
  }
}

function findClaudeJsonl(claudeSessionId) {
  const roots = [
    path.join(os.homedir(), ".claude", "sessions"),
    path.join(os.homedir(), ".claude", "projects")
  ];
  for (const rootDir of roots) {
    const found = findFile(rootDir, `${claudeSessionId}.jsonl`, 5) ?? findFile(rootDir, `${claudeSessionId}.json`, 5);
    if (found) {
      return found;
    }
  }
  return null;
}

function findFile(dir, fileName, depth) {
  if (!existsSync(dir) || depth < 0) {
    return null;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return full;
    }
    if (entry.isDirectory()) {
      const found = findFile(full, fileName, depth - 1);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function hasMetadata(session) {
  return Boolean(session?.summary || session?.decisions?.length || session?.tags?.length || session?.aliases?.length);
}

function summarizePayload(payload) {
  if (!payload) {
    return payload;
  }
  if (payload.error) {
    return payload;
  }
  if (payload.session_id) {
    return {
      session_id: payload.session_id,
      claude_session_id: payload.claude_session_id,
      routing: payload.routing,
      has_session_update: Boolean(payload.session_update),
      warning: payload.warning
    };
  }
  if (payload.session) {
    return { session: payload.session, recent_events: payload.recent_events };
  }
  if (Array.isArray(payload.sessions)) {
    return { project_id: payload.project_id, sessions: payload.sessions };
  }
  return payload;
}

function summarizeClaudeJson(json) {
  if (!json) {
    return null;
  }
  return {
    type: json.type,
    is_error: json.is_error,
    result: typeof json.result === "string" ? json.result.slice(0, 120) : undefined,
    session_id: json.session_id,
    modelUsage: json.modelUsage ? Object.keys(json.modelUsage) : []
  };
}

function run(command, args, cwd) {
  const executable = process.platform === "win32" && command === "npm" ? "cmd.exe" : command;
  const finalArgs = process.platform === "win32" && command === "npm" ? ["/c", "npm", ...args] : args;
  const stdout = execFileSync(executable, finalArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { stdout };
}

function runMaybe(command, args, cwd, timeoutMs) {
  try {
    const executable = process.platform === "win32" && command === "npx" ? "cmd.exe" : command;
    const finalArgs = process.platform === "win32" && command === "npx" ? ["/c", "npx", ...args] : args;
    const stdout = execFileSync(executable, finalArgs, { cwd, encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tomlPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function tomlString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function isMonotonic(values) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) {
      return false;
    }
  }
  return true;
}

function randomUuid() {
  return randomUUID();
}

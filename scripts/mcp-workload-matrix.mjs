import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Database from "better-sqlite3";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = args.live ? "live" : "stub";
const date = args.date ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `mcp-workload-${date}`));
const keepTemp = Boolean(args.keepTemp);
const projectRoot = mkdtempSync(path.join(os.tmpdir(), `asr-mcp-matrix-${mode}-`));
const projectDir = path.join(projectRoot, "project");
const homeDir = path.join(projectRoot, "home");
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const fakeClaudePath = path.join(projectRoot, "fake-claude.mjs");
const fakeCallsPath = path.join(projectRoot, "fake-claude-calls.jsonl");
const dbPath = path.join(projectDir, ".claude-session-router", "sessions.sqlite");
const rawLogsDir = path.join(projectDir, ".claude-session-router", "raw");
const matrixPath = path.join(outDir, `${mode}-matrix.json`);
const summaryPath = path.join(outDir, `${mode}-summary.md`);

mkdirSync(projectDir, { recursive: true });
mkdirSync(homeDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

writeProjectFiles();
if (mode === "stub") {
  writeFakeClaude();
}
writeRouterConfig();

const report = {
  mode,
  started_at: new Date().toISOString(),
  project_dir: projectDir,
  output_dir: outDir,
  checks: [],
  db_snapshot: null,
  fake_calls: []
};

try {
  await withClient(async (client) => {
    const tools = await client.listTools();
    record("tool_discovery_all_modes", hasTools(tools.tools.map((tool) => tool.name)), {
      tool_count: tools.tools.length,
      tools: tools.tools.map((tool) => tool.name)
    });

    await scenario("router_status_baseline", async () => {
      const status = await callTool(client, "router_status", { project_id: null, recent_hours: 24 });
      return {
        pass: status.mode === "normal",
        details: status
      };
    });

    await scenario("router_monitor_baseline", async () => {
      const monitor = await callTool(client, "router_monitor", { project_id: null, recent_hours: 24, sample_limit: 10 });
      return {
        pass: monitor.health?.mode === "normal" && Array.isArray(monitor.recommendations),
        details: monitor
      };
    });

    let sessionId = null;
    await scenario("v1_claude_consult_new_session", async () => {
      const consult = await callTool(client, "claude_consult", consultInput("mcp workload v1", null));
      sessionId = consult.session_id;
      const rawLogs = rawLogCount();
      return {
        pass: Boolean(consult.session_id && consult.claude_session_id && consult.routing?.was_new_session === true && rawLogs > 0),
        details: { ...summarizeConsult(consult), raw_log_count: rawLogs }
      };
    });

    await scenario("v1_claude_consult_explicit_resume_or_orphan_recovery", async () => {
      const consult = await callTool(client, "claude_consult", consultInput("mcp workload v1 follow-up", sessionId));
      return {
        pass: Boolean(
          (consult.session_id === sessionId && consult.routing?.was_new_session === false) ||
            (consult.routing?.was_orphan_recovery === true && consult.session_id !== sessionId)
        ),
        details: summarizeConsult(consult)
      };
    });

    await scenario("v1_session_inspect", async () => {
      const inspect = await callTool(client, "claude_session_inspect", {
        project_id: null,
        session_id: sessionId,
        recent_events_limit: 20
      });
      return {
        pass: inspect.session?.id === sessionId && Array.isArray(inspect.recent_events),
        details: inspect
      };
    });

    await scenario("router_dry_run_observe_only", async () => {
      const beforeRouteEvents = sessionEventTypeCount("router_route_decision");
      const dryRun = await callTool(client, "router_dry_run", {
        project_id: null,
        topic_hint: "mcp workload v1",
        related_files: ["README.md", "src/tools.ts"],
        tags: ["mcp-workload"],
        task_type: "planning",
        question: "Where would the router send a follow-up about the MCP workload v1 session?",
        candidate_limit: 3
      });
      const afterRouteEvents = sessionEventTypeCount("router_route_decision");
      return {
        pass: Boolean(
          dryRun.dry_run === true &&
            dryRun.invokes_claude === false &&
            dryRun.writes_route_event === false &&
            dryRun.lifecycle_applied === false &&
            dryRun.route_decision?.selected_path === "claude_consult_existing_session" &&
            Array.isArray(dryRun.top_session_candidates) &&
            afterRouteEvents === beforeRouteEvents
        ),
        details: {
          route_decision: dryRun.route_decision,
          top_session_candidates: dryRun.top_session_candidates,
          before_route_events: beforeRouteEvents,
          after_route_events: afterRouteEvents
        }
      };
    });

    if (mode === "stub") {
      let flakySessionId = null;
      const sessionUpdateSuccessTopic = "session update success workload";
      const sessionUpdateThresholdTopic = "session update threshold workload";
      const thresholdOverrides = {
        task: "Exercise SESSION_UPDATE_JSON parse-failure threshold and archived-bootstrap recovery.",
        relevant_code: "src/sessionUpdate.ts\nsrc/consult.ts"
      };

      await scenario("session_update_success_metadata_path", async () => {
        const consult = await callTool(
          client,
          "claude_consult",
          consultInput(sessionUpdateSuccessTopic, null, {
            question: "[MATRIX_CLEAN_SESSION_UPDATE] Create a session with clean metadata."
          })
        );
        const successSessionId = consult.session_id;
        const inspect = await callTool(client, "claude_session_inspect", {
          project_id: null,
          session_id: successSessionId,
          recent_events_limit: 20
        });
        return {
          pass: Boolean(
            consult.session_update?.summary === "MCP workload consult completed." &&
              inspect.session?.summary === "MCP workload consult completed." &&
              inspect.session?.decisions?.includes("Use router_monitor before deciding what to fix next")
          ),
          details: { consult: summarizeConsult(consult), session: inspect.session }
        };
      });

      await scenario("session_update_parse_failure_threshold_archives", async () => {
        const firstFailure = await callTool(
          client,
          "claude_consult",
          consultInput(sessionUpdateThresholdTopic, null, {
            ...thresholdOverrides,
            question: "[MATRIX_MALFORMED_SESSION_UPDATE] start malformed metadata threshold session"
          })
        );
        flakySessionId = firstFailure.session_id;
        for (let index = 0; index < 12; index += 1) {
          if (sessionById(flakySessionId)?.status === "archived") {
            break;
          }
          await callTool(
            client,
            "claude_consult",
            consultInput(sessionUpdateThresholdTopic, flakySessionId, {
              ...thresholdOverrides,
              question: `[MATRIX_MALFORMED_SESSION_UPDATE] malformed metadata run ${index}`
            })
          );
        }
        const session = sessionById(flakySessionId);
        const events = sessionEvents(flakySessionId);
        return {
          pass: Boolean(
            session?.status === "archived" &&
              events.some((event) => event.event_type === "parse_failed_threshold_exceeded") &&
              events.filter((event) => event.event_type === "parse_failed").length >= 10
          ),
          details: { session, events }
        };
      });

      await scenario("session_update_archived_bootstrap_replacement", async () => {
        const replacement = await callTool(
          client,
          "claude_consult",
          consultInput(sessionUpdateThresholdTopic, null, {
            ...thresholdOverrides,
            question: "[MATRIX_CLEAN_SESSION_UPDATE] Continue after parse threshold archive."
          })
        );
        const replacementSession = sessionById(replacement.session_id);
        return {
          pass: Boolean(
            replacement.session_id &&
              replacement.session_id !== flakySessionId &&
              replacement.routing?.was_new_session === true &&
              replacement.routing?.match_reason?.includes("Archived session used as bootstrap") &&
              replacement.routing?.match_reason?.includes("parse_failure_threshold") &&
              replacementSession?.status === "active"
          ),
          details: { replacement: summarizeConsult(replacement), replacement_session: replacementSession }
        };
      });
    }

    await prepareMonitorCluster(client, "monitor-static", "allow", "static");

    await scenario("router_consult_explicit_cluster_route", async () => {
      const consult = await callTool(client, "router_consult", {
        project_id: null,
        cluster_id: "monitor-static",
        question: "What is router_monitor for through the conservative router?"
      });
      return {
        pass: consult.route_decision?.selected_path === "cluster_consult_explicit" && consult.cluster_id === "monitor-static",
        details: summarizeRouterConsult(consult)
      };
    });

    await scenario("v2_cluster_consult_fast_path_with_shadow", async () => {
      const consult = await callTool(client, "cluster_consult", {
        project_id: null,
        cluster_id: "monitor-static",
        question: "What is router_monitor for?"
      });
      await sleep(500);
      return {
        pass: consult.cluster_id === "monitor-static" && consult.used_fork === false,
        details: summarizeClusterConsult(consult)
      };
    });

    await scenario("shadow_comparison_judged_after_cluster_consult", async () => {
      const { stats, list } = await waitForJudgedComparison(client, "monitor-static");
      const stat = stats.stats.find((item) => item.cluster_id === "monitor-static");
      const judgedRows = list.comparisons.filter((item) => item.cluster_id === "monitor-static" && item.judged_at);
      return {
        pass: Boolean((stat?.judged ?? 0) >= 1 || judgedRows.length >= 1),
        details: { stats, list }
      };
    });

    await scenario("cluster_refresh_verify_only", async () => {
      const refresh = await callTool(client, "cluster_refresh", {
        project_id: null,
        cluster_id: "monitor-static",
        mode: "verify_only"
      });
      return {
        pass: refresh.fresh === true,
        details: refresh
      };
    });

    await scenario("cluster_reprepare_from_latest_factsheet", async () => {
      const reprepared = await callTool(client, "cluster_reprepare", {
        project_id: null,
        cluster_id: "monitor-static",
        verification_mode: "static"
      });
      return {
        pass: reprepared.cluster_id === "monitor-static" && reprepared.source_factsheet_version >= 1 && reprepared.factsheet_version > reprepared.source_factsheet_version,
        details: reprepared
      };
    });

    writeMonitorSource();
    await prepareMonitorCluster(client, "monitor-reprepare-drop", "allow", "static");
    writeMonitorSource({ selectorLine: "export const routerMonitorRenamed = true;" });
    await scenario("cluster_reprepare_coverage_drop_visible_in_monitor", async () => {
      const reprepared = await callTool(client, "cluster_reprepare", {
        project_id: null,
        cluster_id: "monitor-reprepare-drop",
        verification_mode: "static"
      });
      const monitor = await callTool(client, "router_monitor", { project_id: null, recent_hours: 24, sample_limit: 20 });
      const coverageDrop = monitor.cache_health?.reprepare_coverage_drops?.find(
        (item) => item.cluster_id === "monitor-reprepare-drop"
      );
      const recommendation = monitor.recommendations?.find(
        (item) => item.area === "coverage" && item.cluster_id === "monitor-reprepare-drop"
      );
      return {
        pass: Boolean(
          reprepared.coverage?.source_fact_count === 2 &&
            reprepared.coverage?.verified_facts === 1 &&
            reprepared.coverage?.rejected_facts === 1 &&
            reprepared.coverage?.drop_percent === 50 &&
            coverageDrop?.rejected_facts === 1 &&
            coverageDrop?.coverage_drop_percent === 50 &&
            recommendation?.action?.includes("cluster_prepare")
        ),
        details: {
          reprepare: reprepared,
          coverage_drop: coverageDrop,
          recommendation
        }
      };
    });

    writeMonitorSource({ leading: ["// moved selector but stable snippet remains"] });
    await scenario("evidence_revalidation_success_selector_moved", async () => {
      const consult = await callTool(client, "cluster_consult", {
        project_id: null,
        cluster_id: "monitor-static",
        question: "What is router_monitor for after a file moved?"
      });
      const events = clusterEvents("monitor-static");
      return {
        pass: consult.cluster_id === "monitor-static" && hasEvent(events, "evidence_revalidated"),
        details: {
          consult: summarizeClusterConsult(consult),
          events
        }
      };
    });

    writeMonitorSource();
    await prepareMonitorCluster(client, "monitor-decay", "allow", "static");
    writeMonitorSource({ selectorLine: "export const routerMonitorRenamed = true;" });
    await scenario("evidence_revalidation_failure_falls_back", async () => {
      const consult = await callTool(client, "cluster_consult", {
        project_id: null,
        cluster_id: "monitor-decay",
        question: "What happens after selector evidence disappears?"
      });
      const cluster = clusterById("monitor-decay");
      const events = clusterEvents("monitor-decay");
      return {
        pass: Boolean(
          consult.session_id &&
            consult.routing &&
            !consult.cluster_id &&
            cluster?.status === "needs_prepare" &&
            hasEvent(events, "evidence_revalidation_failed") &&
            hasEvent(events, "cluster_fallback_to_claude_consult")
        ),
        details: {
          fallback: summarizeConsult(consult),
          cluster,
          events
        }
      };
    });

    writeMonitorSource();
    await prepareMonitorCluster(client, "monitor-snippet-decay", "allow", "static");
    writeMonitorSource({ stableHeaderThree: "const stableHeaderThree = 300;" });
    await scenario("evidence_revalidation_failure_snippet_changed_falls_back", async () => {
      const consult = await callTool(client, "cluster_consult", {
        project_id: null,
        cluster_id: "monitor-snippet-decay",
        question: "What happens after selector evidence still exists but snippet content changes?"
      });
      const cluster = clusterById("monitor-snippet-decay");
      const events = clusterEvents("monitor-snippet-decay");
      return {
        pass: Boolean(
          consult.session_id &&
            consult.routing &&
            !consult.cluster_id &&
            cluster?.status === "needs_prepare" &&
            hasEvent(events, "evidence_revalidation_failed") &&
            hasEvent(events, "cluster_fallback_to_claude_consult")
        ),
        details: {
          fallback: summarizeConsult(consult),
          cluster,
          events
        }
      };
    });

    writeMonitorSource();
    await prepareMonitorCluster(client, "monitor-static-deny", "deny", "static");
    await scenario("static_policy_deny_falls_back", async () => {
      const consult = await callTool(client, "cluster_consult", {
        project_id: null,
        cluster_id: "monitor-static-deny",
        question: "Should static-deny cluster answer through cache?"
      });
      const cluster = clusterById("monitor-static-deny");
      const events = clusterEvents("monitor-static-deny");
      return {
        pass: Boolean(
          consult.session_id &&
            consult.routing &&
            !consult.cluster_id &&
            cluster?.status === "needs_prepare" &&
            hasEvent(events, "cluster_fallback_to_claude_consult")
        ),
        details: {
          fallback: summarizeConsult(consult),
          cluster,
          events
        }
      };
    });

    await scenario("missing_cluster_falls_back", async () => {
      const consult = await callTool(client, "cluster_consult", {
        project_id: null,
        cluster_id: "missing-workload-cluster",
        question: "Can the router still answer when the requested cluster is missing?"
      });
      const events = clusterEvents("missing-workload-cluster");
      return {
        pass: Boolean(consult.session_id && consult.routing && !consult.cluster_id && hasEvent(events, "cluster_fallback_to_claude_consult")),
        details: {
          fallback: summarizeConsult(consult),
          events
        }
      };
    });

    writeMonitorSource();
    await scenario("cluster_prepare_llm_verifier_promotes_or_rejects_semantically", async () => {
      const prepared = await prepareMonitorCluster(client, "monitor-llm", "deny", "llm");
      return {
        pass: (prepared.trust_state === "llm_verified" || prepared.trust_state === "partial_llm") && prepared.verified_facts >= 1,
        details: prepared
      };
    });

    await scenario("v2_llm_trusted_cluster_consult_with_deny_policy", async () => {
      const consult = await callTool(client, "cluster_consult", {
        project_id: null,
        cluster_id: "monitor-llm",
        question: "What is router_monitor documented as?"
      });
      const shadow = await waitForJudgedComparison(client, "monitor-llm");
      return {
        pass: consult.cluster_id === "monitor-llm" && consult.factsheet_status === "llm_verified",
        details: {
          consult: summarizeClusterConsult(consult),
          shadow
        }
      };
    });

    await scenario("comparison_list_drilldown", async () => {
      const list = await callTool(client, "comparison_list", {
        project_id: null,
        cluster_id: null,
        preferred: null,
        include_answers: false,
        limit: 20
      });
      return {
        pass: Array.isArray(list.comparisons),
        details: list
      };
    });

    await scenario("router_monitor_after_workload", async () => {
      const monitor = await callTool(client, "router_monitor", { project_id: null, recent_hours: 24, sample_limit: 20 });
      return {
        pass:
          monitor.health?.v2_clusters?.total >= 1 &&
          Array.isArray(monitor.next_directions) &&
          (mode !== "stub" || monitor.metadata_health?.event_counts?.some((event) => event.event_type === "parse_failed")) &&
          monitor.route_health?.decision_counts?.some((event) => event.selected_path === "cluster_consult_explicit"),
        details: monitor
      };
    });
  });
} finally {
  report.db_snapshot = snapshotDb();
  report.fake_calls = readFakeCalls();
  report.finished_at = new Date().toISOString();
  writeFileSync(matrixPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(summaryPath, renderSummary(report), "utf8");
  if (!keepTemp) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

const failed = report.checks.filter((check) => !check.pass);
console.log(JSON.stringify({ ok: failed.length === 0, mode, out_dir: outDir, failed: failed.map((check) => check.name) }, null, 2));
process.exitCode = failed.length === 0 ? 0 : 1;

async function scenario(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    record(name, result.pass, result.details, Date.now() - started);
  } catch (error) {
    record(name, false, { error: error instanceof Error ? error.message : String(error) }, Date.now() - started);
  }
}

function record(name, pass, details, durationMs = null) {
  report.checks.push({ name, pass, duration_ms: durationMs, details });
}

async function withClient(fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: projectDir,
    ...(mode === "stub" ? { env: { ...process.env, HOME: homeDir } } : {}),
    stderr: "pipe"
  });
  const stderr = [];
  transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
  const client = new Client({ name: "mcp-workload-matrix", version: "0.1.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    report.server_stderr = stderr.join("");
    await client.close();
  }
}

async function callTool(client, name, input, timeout = mode === "live" ? 300_000 : 60_000) {
  const result = await client.callTool({ name, arguments: input }, undefined, { timeout });
  const payload = parseToolPayload(result);
  if (result.isError || payload.error) {
    throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function parseToolPayload(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  return text ? JSON.parse(text) : result;
}

async function prepareMonitorCluster(client, clusterId, staticPolicy, verificationMode) {
  return callTool(client, "cluster_prepare", {
    project_id: null,
    cluster_id: clusterId,
    name: clusterId,
    tool_profile_default: "bare",
    static_factsheet_policy: staticPolicy,
    verification_mode: verificationMode,
    llm_verifier_profile: "bare",
    factsheet: {
      summary: "Monitor workload facts.",
      facts: [
        {
          id: "router-monitor-readme",
          claim: "router_monitor is documented as an operator-facing information monitor.",
          evidence: [{ path: "README.md", selector: "router_monitor" }]
        },
        {
          id: "router-monitor-source",
          claim: "router_monitor is registered as an MCP tool in src/tools.ts.",
          evidence: [{ path: "src/tools.ts", selector: "router_monitor" }]
        }
      ],
      forbidden_inferences: ["Do not infer unmentioned tools."]
    }
  });
}

function consultInput(topic, sessionId, overrides = {}) {
  return {
    project_id: null,
    session_id: sessionId,
    topic_hint: topic,
    trigger: "mcp workload matrix",
    task: "Exercise AgentSessionRouter MCP modes.",
    relevant_code: "README.md\nsrc/tools.ts",
    question: "Summarize whether router_monitor helps a parent agent track this MCP.",
    ...overrides
  };
}

function writeRouterConfig() {
  const command = mode === "live" ? "claude" : fakeClaudePath;
  const noRecursiveMcp = mode === "live" ? ', "--strict-mcp-config", "--mcp-config", "{\\"mcpServers\\":{}}"' : "";
  writeFileSync(
    path.join(projectDir, "router.config.toml"),
    `[storage]
db_path = ".claude-session-router/sessions.sqlite"
raw_logs_dir = ".claude-session-router/raw"

[claude]
command = "${command.replaceAll("\\", "\\\\")}"
command_timeout_ms = ${mode === "live" ? 180000 : 30000}
extra_args = ["--tools", ""${noRecursiveMcp}]

[eval]
shadow_mode = true

[cluster]
auto_refresh = true
auto_refresh_min_retained_ratio = 1.0
static_factsheet_policy = "deny"
`,
    "utf8"
  );
}

function writeProjectFiles() {
  mkdirSync(path.join(projectDir, "src"), { recursive: true });
  writeMonitorSource();
  writeFileSync(
    path.join(projectDir, "README.md"),
    [
      "# Matrix Project",
      "",
      "router_monitor is the operator-facing information monitor for AgentSessionRouter.",
      "It combines health, cache events, shadow quality, recommendations, and next directions."
    ].join("\n"),
    "utf8"
  );
}

function writeMonitorSource(options = {}) {
  const leading = options.leading ?? [];
  const selectorLine = options.selectorLine ?? "export const router_monitor = true;";
  const stableHeaderThree = options.stableHeaderThree ?? "const stableHeaderThree = 3;";
  writeFileSync(
    path.join(projectDir, "src", "tools.ts"),
    [
      ...leading,
      "const stableHeaderOne = 1;",
      "const stableHeaderTwo = 2;",
      stableHeaderThree,
      "const stableHeaderFour = 4;",
      "const stableHeaderFive = 5;",
      "const stableHeaderSix = 6;",
      selectorLine,
      "const stableFooterOne = 1;",
      "const stableFooterTwo = 2;",
      "const stableFooterThree = 3;",
      "const stableFooterFour = 4;",
      "const stableFooterFive = 5;",
      "const stableFooterSix = 6;"
    ].join("\n"),
    "utf8"
  );
}

function writeFakeClaude() {
  writeFileSync(
    fakeClaudePath,
    [
      "#!/usr/bin/env node",
      "import { appendFileSync, mkdirSync } from 'node:fs';",
      "import os from 'node:os';",
      "import path from 'node:path';",
      `const callsPath = ${JSON.stringify(fakeCallsPath)};`,
      "const args = process.argv.slice(2);",
      "const prompt = args.at(-1) ?? '';",
      "appendFileSync(callsPath, JSON.stringify({ cwd: process.cwd(), args, prompt: prompt.slice(0, 200) }) + '\\n');",
      "if (args.includes('--version')) { console.log('2.1.92 (Claude Code)'); process.exit(0); }",
      "const resumeIndex = args.indexOf('--resume');",
      "const resumeSessionId = resumeIndex >= 0 ? args[resumeIndex + 1] : null;",
      "const sessionId = resumeSessionId || `fake-${Date.now()}-${Math.random().toString(16).slice(2)}`;",
      "const sessionDir = path.join(os.homedir(), '.claude', 'sessions');",
      "mkdirSync(sessionDir, { recursive: true });",
      "appendFileSync(path.join(sessionDir, `${sessionId}.jsonl`), '{}\\n');",
      "let result = 'ok';",
      "if (prompt === 'ping') result = 'pong';",
      "else if (prompt.includes('PROFILE_OK')) result = 'PROFILE_OK';",
      "else if (prompt.includes('You are verifying a cluster factsheet')) {",
      "  const ids = [...prompt.matchAll(/\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"/g)].map((m) => m[1]);",
      "  result = JSON.stringify({ facts: [...new Set(ids)].map((id) => ({ id, verdict: 'VERIFIED', reason: 'supported by supplied evidence' })) });",
      "} else if (prompt.includes('You are evaluating two answers')) {",
      "  result = JSON.stringify({ answer_a_score: 3, answer_a_errors: [], answer_b_score: 3, answer_b_errors: [], preferred: 'tie', reasoning: 'Both answers are sufficient for workload telemetry.' });",
      "} else if (prompt.includes('shadow evaluation baseline')) {",
      "  result = 'Direct baseline: router_monitor combines health, cache, shadow quality, recommendations, and next directions.';",
      "} else if (prompt.includes('[MATRIX_MALFORMED_SESSION_UPDATE]')) {",
      "  result = 'Malformed metadata response for workload.\\n\\nSESSION_UPDATE_JSON:\\n{ \"summary\": \"broken\", \"decisions\": [ }';",
      "} else if (prompt.includes('[MATRIX_CLEAN_SESSION_UPDATE]')) {",
      "  result = 'router_monitor is an operator-facing monitor for parent agents.\\n\\nSESSION_UPDATE_JSON:\\n{\\n  \"summary\": \"MCP workload consult completed.\",\\n  \"decisions\": [\"Use router_monitor before deciding what to fix next\"],\\n  \"open_questions\": [],\\n  \"files_discussed\": [\"README.md\", \"src/tools.ts\"],\\n  \"tags\": [\"mcp-workload\"],\\n  \"aliases\": [\"router monitor\"]\\n}';",
      "} else if (prompt.includes('Question:') || prompt.includes('Question')) {",
      "  result = 'router_monitor is an operator-facing monitor for parent agents. It shows health, cache decay, quality comparisons, recommendations, and next directions.\\n\\nSESSION_UPDATE_JSON:\\n{\\n  \"summary\": \"MCP workload consult completed.\",\\n  \"decisions\": [\"Use router_monitor before deciding what to fix next\"],\\n  \"open_questions\": [],\\n  \"files_discussed\": [\"README.md\", \"src/tools.ts\"],\\n  \"tags\": [\"mcp-workload\"],\\n  \"aliases\": [\"router monitor\"]\\n}';",
      "}",
      "console.log(JSON.stringify({ session_id: sessionId, result, usage: { input_tokens: Math.ceil(prompt.length / 4), output_tokens: Math.ceil(result.length / 4) } }));"
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeClaudePath, 0o755);
}

function hasTools(toolNames) {
  const expected = [
    "claude_sessions_list",
    "claude_session_inspect",
    "claude_consult",
    "router_consult",
    "router_dry_run",
    "claude_session_archive",
    "claude_router_reset",
    "router_status",
    "router_monitor",
    "cluster_prepare",
    "cluster_reprepare",
    "cluster_get",
    "cluster_consult",
    "comparison_stats",
    "comparison_list",
    "comparison_process_pending",
    "comparison_rejudge",
    "cluster_refresh",
    "cluster_list",
    "cluster_archive"
  ];
  return expected.every((tool) => toolNames.includes(tool));
}

function summarizeConsult(payload) {
  return {
    session_id: payload.session_id,
    claude_session_id: payload.claude_session_id,
    was_new_session: payload.routing?.was_new_session,
    was_orphan_recovery: payload.routing?.was_orphan_recovery,
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

function summarizeRouterConsult(payload) {
  return {
    route_decision: payload.route_decision,
    session_id: payload.session_id,
    cluster_id: payload.cluster_id,
    routing: payload.routing ?? null,
    metrics: payload.metrics ?? null
  };
}

function snapshotDb() {
  if (!existsSync(dbPath)) {
    return null;
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    return {
      session_events: db.prepare("SELECT event_type, COUNT(*) AS count FROM session_events GROUP BY event_type ORDER BY count DESC").all(),
      cluster_events: db.prepare("SELECT cluster_id, event_type, COUNT(*) AS count FROM cluster_events GROUP BY cluster_id, event_type ORDER BY cluster_id, event_type").all(),
      comparisons: db.prepare("SELECT cluster_id, shadow_status, preferred, cluster_score, direct_score, created_at FROM consult_comparisons ORDER BY created_at DESC LIMIT 20").all(),
      clusters: db.prepare("SELECT id, status, trust_state, static_factsheet_policy FROM clusters ORDER BY id").all()
    };
  } finally {
    db.close();
  }
}

function clusterEvents(clusterId = null) {
  const db = new Database(dbPath, { readonly: true });
  try {
    const sql = clusterId
      ? "SELECT event_type, details_json, created_at FROM cluster_events WHERE cluster_id = ? ORDER BY id"
      : "SELECT cluster_id, event_type, details_json, created_at FROM cluster_events ORDER BY id";
    return clusterId ? db.prepare(sql).all(clusterId) : db.prepare(sql).all();
  } finally {
    db.close();
  }
}

function hasEvent(events, eventType) {
  return events.some((event) => event.event_type === eventType);
}

function clusterById(clusterId) {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare("SELECT id, status, trust_state, static_factsheet_policy FROM clusters WHERE id = ?").get(clusterId) ?? null;
  } finally {
    db.close();
  }
}

function sessionById(sessionId) {
  if (!sessionId || !existsSync(dbPath)) {
    return null;
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    return (
      db
        .prepare("SELECT id, claude_session_id, topic, summary, status, archived_at FROM sessions WHERE id = ?")
        .get(sessionId) ?? null
    );
  } finally {
    db.close();
  }
}

function sessionEvents(sessionId) {
  if (!sessionId || !existsSync(dbPath)) {
    return [];
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(
        `SELECT event_type,
                error,
                raw_response_path,
                match_reason,
                was_new_session,
                was_orphan_recovery,
                created_at
         FROM session_events
         WHERE session_id = ?
         ORDER BY id`
      )
      .all(sessionId);
  } finally {
    db.close();
  }
}

function sessionEventTypeCount(eventType) {
  if (!existsSync(dbPath)) {
    return 0;
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db.prepare("SELECT COUNT(*) AS count FROM session_events WHERE event_type = ?").get(eventType);
    return row?.count ?? 0;
  } finally {
    db.close();
  }
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

function rawLogCount() {
  if (!existsSync(rawLogsDir)) {
    return 0;
  }
  const stack = [rawLogsDir];
  let count = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readDirSafe(current);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }
  return count;
}

function readDirSafe(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function waitForJudgedComparison(client, clusterId) {
  const timeoutMs = mode === "live" ? 180_000 : 10_000;
  const intervalMs = mode === "live" ? 2_000 : 200;
  const started = Date.now();
  let last = { stats: { stats: [] }, list: { comparisons: [] } };
  while (Date.now() - started < timeoutMs) {
    const stats = await callTool(client, "comparison_stats", { project_id: null, cluster_id: clusterId });
    const list = await callTool(client, "comparison_list", {
      project_id: null,
      cluster_id: clusterId,
      include_answers: false,
      limit: 10
    });
    last = { stats, list };
    const stat = stats.stats.find((item) => item.cluster_id === clusterId);
    const judgedRows = list.comparisons.filter((item) => item.cluster_id === clusterId && item.judged_at);
    const failedRows = list.comparisons.filter((item) => item.cluster_id === clusterId && /^failed_/.test(item.shadow_status ?? ""));
    if ((stat?.judged ?? 0) > 0 || judgedRows.length > 0 || failedRows.length > 0) {
      return last;
    }
    await sleep(intervalMs);
  }
  return last;
}

function renderSummary(data) {
  const passed = data.checks.filter((check) => check.pass).length;
  const failed = data.checks.length - passed;
  return [
    `# MCP Workload Matrix (${data.mode})`,
    "",
    `Started: ${data.started_at}`,
    `Finished: ${data.finished_at}`,
    `Project dir: ${data.project_dir}`,
    "",
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    "",
    "## Checks",
    "",
    ...data.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name} (${check.duration_ms ?? "n/a"}ms)`),
    "",
    "## DB Snapshot",
    "",
    "```json",
    JSON.stringify(data.db_snapshot, null, 2),
    "```"
  ].join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2).replaceAll("-", "_");
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

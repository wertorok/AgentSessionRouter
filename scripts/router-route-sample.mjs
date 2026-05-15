import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const date = args.date ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `router-route-sample-${date}`));
const reportPath = path.join(outDir, "sample-report.json");
const summaryPath = path.join(outDir, "summary.md");
const projectId = args.project_id === undefined ? null : args.project_id === "null" ? null : String(args.project_id);
const clusterLimit = Number(args.cluster_limit ?? 10);
const staleClusterLimit = Number(args.stale_cluster_limit ?? 3);
const explicitSessionLimit = Number(args.explicit_session_limit ?? 4);
const secondarySessionLimit = Number(args.secondary_session_limit ?? 2);
const exactTopicLimit = Number(args.exact_topic_limit ?? 3);
const autoLimit = Number(args.auto_limit ?? 2);
const timeoutMs = Number(args.timeout_ms ?? 300_000);

const QUESTIONS = [
  ["A1", "What are the exact field names in the clusters table?"],
  ["A2", "Which event types are written to cluster_events? List the important ones."],
  ["A3", "What happens in cluster_consult when the factsheet is stale?"],
  ["A4", "What Claude CLI args are used for the bare tool profile?"],
  ["A5", "What is the default value of dormant_after_days in the sessions schema?"],
  ["B1", "Why is the LLM verifier run without agent tools?"],
  ["B2", "If a Claude jsonl file is deleted, what should happen on the next claude_consult to that session?"],
  ["B3", "Explain static_verified, partial_llm, and llm_verified trust states."],
  ["C1", "Suggest three safe ways to improve cluster_refresh without changing caller semantics."],
  ["C2", "Name one likely bare/no-tools failure mode and how the router should detect it."]
];

const AUTO_TOPICS = [
  {
    topic_hint: "router consult route telemetry sample",
    question:
      "Route sample: explain in two concise bullets why route_health exists and what operator should inspect first."
  },
  {
    topic_hint: "router consult cache maintenance sample",
    question:
      "Route sample: explain in two concise bullets when a codebase cluster should be re-prepared."
  },
  {
    topic_hint: "router consult shadow eval sample",
    question:
      "Route sample: explain in two concise bullets what shadow eval measures and why it must not affect caller answers."
  }
];

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

mkdirSync(outDir, { recursive: true });

const report = {
  started_at: new Date().toISOString(),
  project_id: projectId,
  cwd: repoRoot,
  config: {
    cluster_limit: clusterLimit,
    stale_cluster_limit: staleClusterLimit,
    explicit_session_limit: explicitSessionLimit,
    secondary_session_limit: secondarySessionLimit,
    exact_topic_limit: exactTopicLimit,
    auto_limit: autoLimit
  },
  selected: {},
  preflight: [],
  calls: [],
  shadow_drain: [],
  final_status: null,
  final_monitor: null,
  final_comparison_stats: null,
  latest_comparisons: [],
  server_stderr: ""
};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  cwd: repoRoot,
  stderr: "pipe"
});
const stderr = [];
transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
const client = new Client({ name: "router-route-sample", version: "0.1.0" });

try {
  await client.connect(transport);

  const [clustersResult, sessionsResult] = await Promise.all([
    callTool("cluster_list", { project_id: projectId, include_archived: false }),
    callTool("claude_sessions_list", { project_id: projectId, include_dormant: false, include_archived: false, include_orphaned: false })
  ]);

  const clusters = clustersResult.payload?.clusters ?? [];
  const sessions = (sessionsResult.payload?.sessions ?? []).filter((session) => session.status === "active");
  const freshCluster = await chooseFreshCluster(clusters);
  const staleClusters = chooseStaleClusters(clusters, freshCluster);
  const primarySession = sessions[0] ?? null;
  const secondarySessions = sessions.slice(1);

  report.selected = {
    fresh_cluster: summarizeCluster(freshCluster),
    stale_clusters: staleClusters.map(summarizeCluster),
    primary_session: summarizeSession(primarySession),
    secondary_sessions: secondarySessions.map(summarizeSession)
  };

  await runClusterScenarios(freshCluster);
  await runStaleClusterScenarios(staleClusters);
  await runExplicitSessionScenarios(primarySession);
  await runSecondarySessionScenarios(secondarySessions);
  await runExactTopicScenarios(primarySession);
  await runAutoScenarios();

  await drainShadowComparisons();

  const [status, monitor] = await Promise.all([
    callTool("router_status", { project_id: projectId, recent_hours: 24, warnings_limit: 30 }),
    callTool("router_monitor", { project_id: projectId, recent_hours: 24, sample_limit: 40 })
  ]);
  report.final_status = status.payload ?? status;
  report.final_monitor = monitor.payload ?? monitor;
  const [comparisonStats, latestComparisons] = await Promise.all([
    callTool("comparison_stats", { project_id: projectId, recent_hours: 24 }),
    callTool("comparison_list", { project_id: projectId, limit: 20 })
  ]);
  report.final_comparison_stats = comparisonStats.payload ?? comparisonStats;
  report.latest_comparisons = latestComparisons.payload?.comparisons ?? [];
} finally {
  report.finished_at = new Date().toISOString();
  report.server_stderr = stderr.join("");
  await client.close();
}

writeOutputs();
const failed = report.calls.filter((call) => !call.ok);
console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      out_dir: outDir,
      calls: report.calls.length,
      failed: failed.map((call) => ({ name: call.name, error: call.error ?? call.payload?.error }))
    },
    null,
    2
  )
);
process.exitCode = failed.length === 0 ? 0 : 1;

async function runClusterScenarios(cluster) {
  if (!cluster?.id) {
    report.calls.push({
      name: "cluster_matrix_skipped",
      ok: true,
      skipped: true,
      reason: "No fresh active cluster found."
    });
    return;
  }
  for (const [id, question] of QUESTIONS.slice(0, clusterLimit)) {
    await scenario(`cluster_${id}`, "router_consult", {
      project_id: projectId,
      cluster_id: cluster.id,
      question: `Route sample ${id}. Answer from verified router facts. ${question}`
    });
  }
}

async function runStaleClusterScenarios(clusters) {
  if (clusters.length === 0) {
    report.calls.push({
      name: "stale_cluster_matrix_skipped",
      ok: true,
      skipped: true,
      reason: "No stale active clusters found."
    });
    return;
  }
  const questions = [
    "Route sample stale cluster. If this cluster cannot serve from verified facts, explain the fallback behavior in two bullets.",
    "Route sample stale cluster. Answer the caller-facing rule for unrecoverable factsheet evidence in one concise paragraph.",
    "Route sample stale cluster. Explain what operator signal should be checked after a stale cluster fallback."
  ];
  for (const [index, cluster] of clusters.slice(0, staleClusterLimit).entries()) {
    await scenario(`stale_cluster_${index + 1}`, "router_consult", {
      project_id: projectId,
      cluster_id: cluster.id,
      topic_hint: `stale cluster sample ${cluster.id}`,
      task: "Exercise stale cluster handling. Caller must still receive an answer if router can fallback.",
      question: questions[index] ?? questions.at(-1)
    });
  }
}

async function runExplicitSessionScenarios(session) {
  if (!session?.id) {
    report.calls.push({
      name: "explicit_session_matrix_skipped",
      ok: true,
      skipped: true,
      reason: "No active session found."
    });
    return;
  }
  const questions = [
    "Route sample session explicit. In two bullets, what should parent agents use as the default consult entry point?",
    "Route sample session explicit. In two bullets, what should monitor data decide before adding auto routing?",
    "Route sample session explicit. In two bullets, why should cluster health stay router-internal?",
    "Route sample session explicit. In two bullets, when should lower-level claude_consult be used directly?"
  ];
  for (const [index, question] of questions.slice(0, explicitSessionLimit).entries()) {
    await scenario(`explicit_session_${index + 1}`, "router_consult", {
      project_id: projectId,
      session_id: session.id,
      topic_hint: session.topic,
      task: "Answer from durable router session context. Do not emit XML/tool-call markup.",
      question
    });
  }
}

async function runSecondarySessionScenarios(sessions) {
  if (sessions.length === 0) {
    report.calls.push({
      name: "secondary_session_matrix_skipped",
      ok: true,
      skipped: true,
      reason: "No secondary active sessions found."
    });
    return;
  }
  const questions = [
    "Route sample secondary session. In two bullets, what stale or outdated assumption should this session avoid repeating?",
    "Route sample secondary session. In two bullets, what current router behavior should be preserved?"
  ];
  for (const [index, session] of sessions.slice(0, secondarySessionLimit).entries()) {
    await scenario(`secondary_session_${index + 1}`, "router_consult", {
      project_id: projectId,
      session_id: session.id,
      topic_hint: session.topic,
      task: "Exercise explicit routing into an older active session and surface stale-memory risk. Do not emit XML/tool-call markup.",
      question: questions[index] ?? questions.at(-1)
    });
  }
}

async function runExactTopicScenarios(session) {
  if (!session?.topic) {
    report.calls.push({
      name: "exact_topic_matrix_skipped",
      ok: true,
      skipped: true,
      reason: "No active session topic found."
    });
    return;
  }
  const questions = [
    "Route sample exact topic. Reuse the existing session if routing works; summarize the most important router maintenance invariant.",
    "Route sample exact topic. Reuse the existing session if routing works; explain what route_health tells us.",
    "Route sample exact topic. Reuse the existing session if routing works; explain when stale clusters need re-prepare."
  ];
  for (const [index, question] of questions.slice(0, exactTopicLimit).entries()) {
    await scenario(`exact_topic_${index + 1}`, "router_consult", {
      project_id: projectId,
      topic_hint: session.topic,
      task: "Exercise exact topic router_consult session reuse.",
      question
    });
  }
}

async function runAutoScenarios() {
  for (const [index, item] of AUTO_TOPICS.slice(0, autoLimit).entries()) {
    await scenario(`auto_${index + 1}`, "router_consult", {
      project_id: projectId,
      topic_hint: item.topic_hint,
      task: "Exercise router_consult fallback to claude_consult auto-routing with a precise topic.",
      question: item.question
    });
  }
}

async function drainShadowComparisons() {
  for (let pass = 1; pass <= 3; pass += 1) {
    const result = await callTool("comparison_process_pending", { project_id: projectId, limit: 20 }, 300_000);
    report.shadow_drain.push({
      pass,
      ok: result.ok,
      duration_ms: result.duration_ms,
      payload: result.payload ?? null,
      error: result.error ?? null
    });
    if (!result.ok || (result.payload?.processed_count ?? 0) === 0) {
      break;
    }
  }
}

async function chooseFreshCluster(clusters) {
  const active = clusters.filter((cluster) => cluster.status !== "archived");
  const candidates = [
    ...active.filter((cluster) => cluster.id === "agentsessionrouter-codebase"),
    ...active.filter((cluster) => cluster.id !== "agentsessionrouter-codebase" && cluster.current_factsheet?.status === "llm_verified"),
    ...active.filter((cluster) => cluster.current_factsheet?.status !== "llm_verified" && cluster.current_factsheet)
  ];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate?.id || seen.has(candidate.id)) {
      continue;
    }
    seen.add(candidate.id);
    const refresh = await callTool("cluster_refresh", {
      project_id: projectId,
      cluster_id: candidate.id,
      mode: "verify_only"
    });
    report.preflight.push({
      cluster_id: candidate.id,
      ok: refresh.ok,
      duration_ms: refresh.duration_ms,
      fresh: refresh.payload?.fresh ?? false,
      error: refresh.payload?.error ?? refresh.error ?? null
    });
    if (refresh.ok && refresh.payload?.fresh === true) {
      return candidate;
    }
  }
  return null;
}

function chooseStaleClusters(clusters, freshCluster) {
  const freshId = freshCluster?.id ?? null;
  return clusters
    .filter((cluster) => cluster?.id && cluster.id !== freshId)
    .filter((cluster) => cluster.status === "stale" || cluster.trust_state === "untrusted" || !cluster.current_factsheet)
    .slice(0, staleClusterLimit);
}

async function scenario(name, tool, input) {
  const result = await callTool(tool, input);
  const payload = result.payload ?? {};
  const answer = typeof payload.answer === "string" ? payload.answer : "";
  report.calls.push({
    name,
    tool,
    ok: result.ok && !payload.error,
    duration_ms: result.duration_ms,
    selected_path: payload.route_decision?.selected_path ?? null,
    route_decision: payload.route_decision ?? null,
    cluster_id: payload.cluster_id ?? input.cluster_id ?? null,
    session_id: payload.session_id ?? input.session_id ?? null,
    routing: payload.routing ?? null,
    metrics: payload.metrics ?? null,
    answer_chars: answer.length,
    answer_preview: answer ? answer.slice(0, 600) : null,
    diagnostics: diagnoseAnswer(answer),
    error: result.error ?? payload.error ?? null
  });
}

async function callTool(name, input, timeout = timeoutMs) {
  const startedAt = Date.now();
  try {
    const result = await client.callTool({ name, arguments: input }, undefined, { timeout });
    const payload = parseToolPayload(result);
    return {
      ok: !(result.isError || payload?.error),
      payload,
      duration_ms: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt
    };
  }
}

function parseToolPayload(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return result;
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: {
        code: "NON_JSON_TOOL_RESPONSE",
        message: text
      },
      raw_text: text
    };
  }
}

function writeOutputs() {
  const byPath = countBy(report.calls, (call) => call.selected_path ?? "none");
  const diagnostics = {
    total_calls: report.calls.filter((call) => !call.skipped).length,
    failed_calls: report.calls.filter((call) => !call.skipped && !call.ok).length,
    not_in_context_answers: report.calls.filter((call) => call.diagnostics?.has_not_in_context).length,
    tool_markup_answers: report.calls.filter((call) => call.diagnostics?.has_tool_markup).length,
    empty_answers: report.calls.filter((call) => !call.skipped && (call.answer_chars ?? 0) === 0).length,
    slow_over_60s: report.calls.filter((call) => (call.duration_ms ?? 0) > 60_000).length
  };
  const callsByName = report.calls
    .map((call) => `| ${call.name} | ${call.selected_path ?? ""} | ${call.ok ? "ok" : "fail"} | ${call.duration_ms ?? ""} | ${call.cluster_id ?? ""} | ${call.session_id ?? ""} | ${call.diagnostics?.has_not_in_context ? "yes" : ""} | ${call.diagnostics?.has_tool_markup ? "yes" : ""} |`)
    .join("\n");
  const monitorRouteCounts = report.final_monitor?.route_health?.decision_counts ?? [];
  const shadow = report.final_status?.shadow_eval ?? {};
  const comparisonStats = report.final_comparison_stats?.stats ?? [];
  const summary = [
    "# Router Route Sample",
    "",
    `Started: ${report.started_at}`,
    `Finished: ${report.finished_at}`,
    `Project: ${report.final_status?.project_id ?? projectId ?? "auto"}`,
    "",
    "## Selection",
    "",
    `- Fresh cluster: ${report.selected.fresh_cluster?.id ?? "none"}`,
    `- Stale clusters sampled: ${(report.selected.stale_clusters ?? []).map((cluster) => cluster.id).join(", ") || "none"}`,
    `- Primary session: ${report.selected.primary_session?.id ?? "none"} (${report.selected.primary_session?.topic ?? ""})`,
    "",
    "## Route Counts In This Script",
    "",
    "```json",
    JSON.stringify(byPath, null, 2),
    "```",
    "",
    "## Monitor Route Counts",
    "",
    "```json",
    JSON.stringify(monitorRouteCounts, null, 2),
    "```",
    "",
    "## Shadow Eval",
    "",
    "```json",
    JSON.stringify(shadow, null, 2),
    "```",
    "",
    "## Diagnostics",
    "",
    "```json",
    JSON.stringify(diagnostics, null, 2),
    "```",
    "",
    "## Comparison Stats",
    "",
    "```json",
    JSON.stringify(comparisonStats, null, 2),
    "```",
    "",
    "## Calls",
    "",
    "| Scenario | Selected path | Status | Duration ms | Cluster | Session | NOT IN CONTEXT | Tool markup |",
    "| --- | --- | --- | ---: | --- | --- | --- | --- |",
    callsByName || "No calls.",
    "",
    "## Current Recommendations",
    "",
    "```json",
    JSON.stringify(report.final_monitor?.recommendations ?? [], null, 2),
    "```",
    ""
  ].join("\n");

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(summaryPath, summary, "utf8");
}

function diagnoseAnswer(answer) {
  return {
    has_not_in_context: /NOT IN CONTEXT/i.test(answer),
    has_tool_markup: /<minimax:tool_call>|<invoke\b|<\/invoke>|\[TOOL_CALL\]|\[\/TOOL_CALL\]|<tool_call>|<tool-call\b/i.test(answer),
    starts_with_search_intent: /^\s*(let me|i'?ll|i will|looking at|i need to|first,? i)/i.test(answer)
  };
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summarizeCluster(cluster) {
  if (!cluster) {
    return null;
  }
  return {
    id: cluster.id,
    status: cluster.status,
    trust_state: cluster.trust_state,
    factsheet_status: cluster.current_factsheet?.status ?? null,
    factsheet_version: cluster.current_factsheet?.version ?? null
  };
}

function summarizeSession(session) {
  if (!session) {
    return null;
  }
  return {
    id: session.id,
    topic: session.topic,
    status: session.status,
    last_used: session.last_used
  };
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

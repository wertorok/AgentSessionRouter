import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const date = args.date ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `session-continuity-${date}`));
const responsesDir = path.join(outDir, "responses");
const timeoutMs = Number(args.timeout_ms ?? 240_000);
const projectId =
  args.project_id === undefined
    ? `AgentSessionRouter-continuity-${date}`
    : args.project_id === "null"
      ? null
      : String(args.project_id);
const methods = parseList(args.methods ?? "fresh_each_turn,same_claude_session,router_exact_topic,router_explicit_session");
const turnLimit = Number(args.turns ?? continuityTurns().length);

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

mkdirSync(responsesDir, { recursive: true });

let report = {
  started_at: new Date().toISOString(),
  project_id: projectId,
  cwd: repoRoot,
  methods,
  turns: continuityTurns().slice(0, turnLimit),
  calls: [],
  inspections: [],
  final_status: null,
  final_monitor: null,
  server_stderr: ""
};

if (args.rescore) {
  const reportPath = path.resolve(args.rescore === true ? path.join(outDir, "continuity-report.json") : String(args.rescore));
  report = JSON.parse(readFileSync(reportPath, "utf8"));
  rescoreReport();
  writeOutputs();
  console.log(JSON.stringify({ ok: true, rescored: reportPath, out_dir: outDir }, null, 2));
  process.exit(0);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  cwd: repoRoot,
  stderr: "pipe"
});
const stderr = [];
transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
const client = new Client({ name: "session-continuity-benchmark", version: "0.1.0" });

try {
  await client.connect(transport);
  for (const method of methods) {
    await runMethod(method);
  }
  await inspectUsedSessions();
  const [status, monitor] = await Promise.all([
    callTool("router_status", { project_id: projectId, recent_hours: 24, warnings_limit: 20 }),
    callTool("router_monitor", { project_id: projectId, recent_hours: 24, sample_limit: 20 })
  ]);
  report.final_status = status.payload ?? status;
  report.final_monitor = monitor.payload ?? monitor;
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
      project_id: projectId,
      calls: report.calls.length,
      failed: failed.map((call) => ({ method: call.method, turn: call.turn_id, error: call.error ?? call.payload?.error }))
    },
    null,
    2
  )
);
process.exitCode = failed.length === 0 ? 0 : 1;

async function runMethod(method) {
  const topic = `session continuity benchmark ${date} ${method}`;
  let sessionId = null;

  for (const turn of continuityTurns().slice(0, turnLimit)) {
    const input = inputForMethod(method, topic, sessionId, turn);
    const tool = method.startsWith("router_") ? "router_consult" : "claude_consult";
    const result = await callTool(tool, input);
    const payload = result.payload ?? {};
    const answer = typeof payload.answer === "string" ? payload.answer : "";
    const score = scoreTurn(answer, turn);
    const responsePath = path.join(responsesDir, `${method}_${turn.id}.txt`);
    writeFileSync(responsePath, answer || JSON.stringify(payload.error ?? result.error ?? payload, null, 2), "utf8");

    if (payload.session_id) {
      sessionId = payload.session_id;
    }

    report.calls.push({
      method,
      turn_id: turn.id,
      turn_kind: turn.kind,
      tool,
      ok: result.ok && !payload.error,
      duration_ms: result.duration_ms,
      session_id: payload.session_id ?? sessionId,
      selected_path: payload.route_decision?.selected_path ?? null,
      route_decision: payload.route_decision ?? null,
      routing: payload.routing ?? null,
      warning: payload.warning ?? null,
      answer_chars: answer.length,
      response_path: path.relative(repoRoot, responsePath),
      answer_preview: answer ? answer.slice(0, 500) : null,
      score: score.score,
      matched_requirements: score.matched,
      missing_requirements: score.missing,
      diagnostics: diagnoseAnswer(answer),
      error: result.error ?? payload.error ?? null
    });
  }
}

function inputForMethod(method, topic, sessionId, turn) {
  const base = {
    project_id: projectId,
    topic_hint: method === "fresh_each_turn" ? `${topic} ${turn.id} ${randomSuffix()}` : topic,
    trigger: "session_continuity_benchmark",
    task:
      "Answer as an AgentSessionRouter consultant. Preserve and use prior benchmark turns when this call is in the same session. Do not emit XML/bracketed pseudo tool calls.",
    relevant_code: "AgentSessionRouter session routing, router_consult, SESSION_UPDATE_JSON metadata, and monitor semantics.",
    question: turn.question
  };

  if (method === "same_claude_session" && sessionId) {
    return { ...base, session_id: sessionId };
  }
  if (method === "router_explicit_session" && sessionId) {
    return { ...base, session_id: sessionId };
  }
  return base;
}

async function inspectUsedSessions() {
  const seen = new Set(report.calls.map((call) => call.session_id).filter(Boolean));
  for (const sessionId of seen) {
    const inspected = await callTool("claude_session_inspect", {
      project_id: projectId,
      session_id: sessionId,
      recent_events_limit: 20
    });
    report.inspections.push({
      session_id: sessionId,
      ok: inspected.ok,
      duration_ms: inspected.duration_ms,
      payload: inspected.payload ?? null,
      error: inspected.error ?? null
    });
  }
}

async function callTool(name, input) {
  const startedAt = Date.now();
  try {
    const result = await client.callTool({ name, arguments: input }, undefined, { timeout: timeoutMs });
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

function scoreTurn(answer, turn) {
  const matched = [];
  const missing = [];
  for (const requirement of turn.requirements) {
    if (requirement.patterns.some((pattern) => pattern.test(answer))) {
      matched.push(requirement.id);
    } else {
      missing.push(requirement.id);
    }
  }
  if (turn.requirements.length === 0) {
    return { score: 3, matched, missing };
  }
  const ratio = matched.length / turn.requirements.length;
  const score = ratio === 1 ? 3 : ratio >= 0.67 ? 2 : ratio > 0 ? 1 : 0;
  return { score, matched, missing };
}

function diagnoseAnswer(answer) {
  return {
    has_not_in_context: /NOT IN CONTEXT/i.test(answer),
    has_tool_markup: /<minimax:tool_call>|<invoke\b|<\/invoke>|\[TOOL_CALL\]|\[\/TOOL_CALL\]|<tool_call>|<tool-call\b/i.test(answer),
    admits_missing_memory: /do not have|don't have|no access to.*previous|not in.*context|cannot see.*previous/i.test(answer)
  };
}

function writeOutputs() {
  const summary = buildSummary();
  writeFileSync(path.join(outDir, "continuity-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outDir, "summary.md"), summary, "utf8");
}

function buildSummary() {
  const byMethod = summarizeByMethod();
  const methodRows = byMethod
    .map(
      (item) =>
        `| ${item.method} | ${item.calls} | ${item.failed} | ${item.unique_sessions} | ${item.avg_score_all} | ${item.avg_score_memory_probes} | ${item.avg_score_non_seed} | ${item.tool_markup} | ${item.missing_memory_admits} | ${item.total_duration_ms} |`
    )
    .join("\n");
  const callRows = report.calls
    .map(
      (call) =>
        `| ${call.method} | ${call.turn_id} | ${call.turn_kind} | ${call.ok ? "ok" : "fail"} | ${call.score} | ${call.selected_path ?? ""} | ${call.session_id ?? ""} | ${call.missing_requirements.join(", ") || ""} |`
    )
    .join("\n");
  const routeCounts = countBy(report.calls, (call) => call.selected_path ?? call.tool);
  const findings = buildFindings(byMethod);

  return [
    "# Session Continuity Benchmark",
    "",
    `Started: ${report.started_at}`,
    `Finished: ${report.finished_at}`,
    `Project id: ${projectId}`,
    "",
    "## Purpose",
    "",
    "This benchmark measures the original v1 router value: whether multiple questions in one durable session preserve conversational decisions better than cold/fresh calls.",
    "",
    "Current cluster shadow eval still measures `cluster_consult` against `direct_fresh`; this benchmark is separate and should not be conflated with shadow eval.",
    "",
    "## Method Summary",
    "",
    "| Method | Calls | Failed | Unique sessions | Avg score all | Avg score memory probes | Avg score memory+synthesis | Tool markup | Missing-memory admissions | Total duration ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    methodRows || "No calls.",
    "",
    "## Route Counts",
    "",
    "```json",
    JSON.stringify(routeCounts, null, 2),
    "```",
    "",
    "## Calls",
    "",
    "| Method | Turn | Kind | Status | Score | Selected path | Session | Missing requirements |",
    "| --- | --- | --- | --- | ---: | --- | --- | --- |",
    callRows || "No calls.",
    "",
    "## Findings",
    "",
    ...findings.map((finding) => `- ${finding}`),
    "",
    "## Session Metadata",
    "",
    ...summarizeInspections().map((line) => `- ${line}`),
    "",
    "## Final Monitor Snapshot",
    "",
    "```json",
    JSON.stringify(
      {
        shadow_eval: report.final_status?.shadow_eval ?? null,
        route_counts: report.final_monitor?.route_health?.decision_counts ?? [],
        metadata_health: report.final_monitor?.metadata_health ?? null,
        recommendations: (report.final_monitor?.recommendations ?? []).slice(0, 8)
      },
      null,
      2
    ),
    "```",
    ""
  ].join("\n");
}

function summarizeByMethod() {
  return methods.map((method) => {
    const calls = report.calls.filter((call) => call.method === method);
    const memoryProbeCalls = calls.filter((call) => call.turn_kind === "memory_probe");
    const nonSeedCalls = calls.filter((call) => call.turn_kind === "memory_probe" || call.turn_kind === "synthesis");
    return {
      method,
      calls: calls.length,
      failed: calls.filter((call) => !call.ok).length,
      unique_sessions: new Set(calls.map((call) => call.session_id).filter(Boolean)).size,
      avg_score_all: average(calls.map((call) => call.score)),
      avg_score_memory_probes: average(memoryProbeCalls.map((call) => call.score)),
      avg_score_non_seed: average(nonSeedCalls.map((call) => call.score)),
      tool_markup: calls.filter((call) => call.diagnostics.has_tool_markup).length,
      missing_memory_admits: calls.filter((call) => call.diagnostics.admits_missing_memory).length,
      total_duration_ms: calls.reduce((sum, call) => sum + (call.duration_ms ?? 0), 0)
    };
  });
}

function summarizeInspections() {
  if (report.inspections.length === 0) {
    return ["No sessions inspected."];
  }
  return report.inspections.map((inspection) => {
    const session = inspection.payload?.session;
    return `${inspection.session_id}: ${inspection.ok ? "ok" : "failed"}, topic=${session?.topic ?? "unknown"}, status=${session?.status ?? "unknown"}, decisions=${session?.decisions?.length ?? 0}, events=${inspection.payload?.recent_events?.length ?? 0}`;
  });
}

function buildFindings(byMethod) {
  const byName = Object.fromEntries(byMethod.map((item) => [item.method, item]));
  const findings = [];
  const fresh = Number(byName.fresh_each_turn?.avg_score_memory_probes ?? 0);
  const same = Number(byName.same_claude_session?.avg_score_memory_probes ?? 0);
  const exact = Number(byName.router_exact_topic?.avg_score_memory_probes ?? 0);
  const explicit = Number(byName.router_explicit_session?.avg_score_memory_probes ?? 0);

  if (same > fresh) {
    findings.push(`Durable v1 session context beat fresh-each-turn on memory probes (${same} vs ${fresh}).`);
  } else {
    findings.push(`Durable v1 session context did not beat fresh-each-turn on memory probes (${same} vs ${fresh}); inspect responses.`);
  }
  if (exact >= same) {
    findings.push(`router_consult exact-topic reuse matched or exceeded direct same-session continuity (${exact} vs ${same}).`);
  } else {
    findings.push(`router_consult exact-topic reuse trailed direct same-session continuity (${exact} vs ${same}); inspect route decisions.`);
  }
  if (explicit >= same) {
    findings.push(`router_consult explicit-session continuity matched or exceeded direct same-session continuity (${explicit} vs ${same}).`);
  } else {
    findings.push(
      `router_consult explicit-session continuity trailed direct same-session continuity (${explicit} vs ${same}); inspect the synthesis answer and scoring rubric before treating this as a route failure.`
    );
  }
  const inspectedSessions = report.inspections?.filter((inspection) => inspection.ok) ?? [];
  const decisions = inspectedSessions.reduce(
    (sum, inspection) => sum + (inspection.payload?.session?.decisions?.length ?? 0),
    0
  );
  findings.push(`SESSION_UPDATE_JSON metadata parsed during the run: ${inspectedSessions.length} inspected session(s), ${decisions} stored decision(s).`);
  findings.push("Do not use direct_fresh shadow quality as proof about durable session memory; this benchmark measures that separately.");
  return findings;
}

function rescoreReport() {
  const turnById = Object.fromEntries(continuityTurns().map((turn) => [turn.id, turn]));
  for (const call of report.calls ?? []) {
    const turn = turnById[call.turn_id];
    if (!turn) {
      continue;
    }
    let answer = call.answer_preview ?? "";
    if (call.response_path) {
      const responsePath = path.isAbsolute(call.response_path)
        ? call.response_path
        : path.join(repoRoot, call.response_path);
      if (existsSync(responsePath)) {
        answer = readFileSync(responsePath, "utf8");
      }
    }
    const score = scoreTurn(answer, turn);
    call.score = score.score;
    call.matched_requirements = score.matched;
    call.missing_requirements = score.missing;
    call.diagnostics = diagnoseAnswer(answer);
  }
  report.turns = continuityTurns().slice(0, Number(args.turns ?? report.turns?.length ?? continuityTurns().length));
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (numeric.length === 0) {
    return 0;
  }
  return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(2));
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function parseList(source) {
  if (!source) {
    return [];
  }
  return String(source)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function continuityTurns() {
  return [
  {
    id: "T1",
    kind: "seed",
    question:
      "Session continuity benchmark turn 1. Establish and remember this benchmark decision: codeword ALPHA-17 means 'the router must answer the caller when Claude is available; monitor telemetry is for the operator, not for caller recovery'. Reply with the codeword and rule in two bullets.",
    requirements: [
      { id: "alpha", patterns: [/ALPHA-17/i] },
      { id: "caller-answer", patterns: [/answer(?:s)? the caller/i, /caller.*answer/i] },
      { id: "operator-monitor", patterns: [/monitor/i, /operator/i] }
    ]
  },
  {
    id: "T2",
    kind: "memory_probe",
    question:
      "Session continuity benchmark turn 2. Without inventing, what codeword and caller/operator rule did we establish in the previous turn? Do not search files; answer from session memory.",
    requirements: [
      { id: "alpha", patterns: [/ALPHA-17/i] },
      { id: "caller-answer", patterns: [/answer(?:s)? the caller/i, /caller.*answer/i] },
      { id: "operator-monitor", patterns: [/operator/i, /monitor telemetry/i] }
    ]
  },
  {
    id: "T3",
    kind: "seed",
    question:
      "Session continuity benchmark turn 3. Add and remember a second benchmark decision: codeword BETA-29 means 'factsheet evidence must be revalidated before use; if revalidation cannot prove current facts, the router falls back internally instead of asking the caller to recover'. Reply with both the new codeword and the operational meaning.",
    requirements: [
      { id: "beta", patterns: [/BETA-29/i] },
      { id: "revalidation", patterns: [/revalidat/i] },
      { id: "internal-fallback", patterns: [/fallback/i, /falls back/i] }
    ]
  },
  {
    id: "T4",
    kind: "memory_probe",
    question:
      "Session continuity benchmark turn 4. Summarize both benchmark codewords and their meanings from earlier turns. Do not infer from this prompt; use session memory.",
    requirements: [
      { id: "alpha", patterns: [/ALPHA-17/i] },
      { id: "beta", patterns: [/BETA-29/i] },
      { id: "caller-answer", patterns: [/answer(?:s)? the caller/i, /caller.*answer/i] },
      {
        id: "revalidation-fallback",
        patterns: [/revalidat[\s\S]*(?:fallback|falls back)/i, /(?:fallback|falls back)[\s\S]*revalidat/i]
      }
    ]
  },
  {
    id: "T5",
    kind: "synthesis",
    question:
      "Session continuity benchmark turn 5. Based on the two remembered benchmark decisions, explain why comparing cluster_consult only against direct_fresh is insufficient for this project. The answer must reference both codewords and say what extra benchmark is needed.",
    requirements: [
      { id: "alpha", patterns: [/ALPHA-17/i] },
      { id: "beta", patterns: [/BETA-29/i] },
      { id: "direct-fresh-insufficient", patterns: [/direct_fresh/i, /fresh/i] },
      { id: "session-benchmark", patterns: [/same session/i, /durable session/i, /multi[- ]turn/i, /continuity/i] }
    ]
  }
  ];
}

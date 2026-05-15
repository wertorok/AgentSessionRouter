import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outPath = path.resolve(args.out ?? path.join(repoRoot, "experiments", "router-consult-sanity", `${timestamp}.json`));
const projectId = args.project_id === undefined ? null : args.project_id === "null" ? null : String(args.project_id);
const requestedClusterId = optionalString(args.cluster_id);
const requestedSessionId = optionalString(args.session_id);
const requestedTopicHint = optionalString(args.topic_hint);
const timeoutMs = Number(args.timeout_ms ?? 300_000);

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  cwd: repoRoot,
  stderr: "pipe"
});
const stderr = [];
transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

const client = new Client({ name: "router-consult-sanity", version: "0.1.0" });
const report = {
  captured_at: new Date().toISOString(),
  project_id: projectId,
  cwd: repoRoot,
  checks: [],
  selected: {},
  server_stderr: ""
};

try {
  await client.connect(transport);

  const tools = await callTool("list_tools", null, async () => client.listTools());
  const toolNames = tools.payload?.tools?.map((tool) => tool.name) ?? [];
  record("tool_discovery_router_consult", toolNames.includes("router_consult"), { tool_count: toolNames.length, tools: toolNames });

  const [clustersResult, sessionsResult] = await Promise.all([
    callTool("cluster_list", { project_id: projectId, include_archived: false }),
    callTool("claude_sessions_list", { project_id: projectId, include_dormant: false, include_archived: false, include_orphaned: false })
  ]);

  const cluster = requestedClusterId
    ? { id: requestedClusterId, source: "requested" }
    : await chooseFreshCluster(clustersResult.payload?.clusters ?? []);
  const session = requestedSessionId
    ? { id: requestedSessionId, topic: requestedTopicHint ?? "explicit session", source: "requested" }
    : chooseSession(sessionsResult.payload?.sessions ?? [], requestedTopicHint);

  report.selected.cluster = cluster ?? null;
  report.selected.session = summarizeSession(session);

  if (cluster?.id) {
    const explicitCluster = await callTool("router_consult", {
      project_id: projectId,
      cluster_id: cluster.id,
      question:
        "Sanity check: answer briefly from the router cluster context. What operational purpose does router_monitor serve?"
    });
    record(
      "router_consult_explicit_cluster",
      explicitCluster.ok &&
        explicitCluster.payload?.route_decision?.selected_path === "cluster_consult_explicit" &&
        explicitCluster.payload?.route_decision?.cluster_id === cluster.id &&
        isUsefulAnswer(explicitCluster.payload),
      summarizeRouterConsult(explicitCluster)
    );
  } else {
    record("router_consult_explicit_cluster", false, {
      skipped: true,
      reason: "No active cluster found. Pass --cluster-id to force this scenario."
    });
  }

  if (session?.id) {
    const existingSession = await callTool("router_consult", {
      project_id: projectId,
      session_id: session.id,
      topic_hint: session.topic,
      question:
        "Sanity check: answer from durable session context only. Do not read files, do not emit XML/tool-call markup. In two sentences, which current AgentSessionRouter maintenance rule should a parent agent remember?"
    });
    record(
      "router_consult_existing_session",
      existingSession.ok &&
        existingSession.payload?.route_decision?.selected_path === "claude_consult_explicit_session" &&
        existingSession.payload?.route_decision?.session_id === session.id &&
        isUsefulAnswer(existingSession.payload),
      summarizeRouterConsult(existingSession)
    );
  } else if (requestedTopicHint) {
    const topicRoute = await callTool("router_consult", {
      project_id: projectId,
      topic_hint: requestedTopicHint,
      question:
        "Sanity check: answer from durable session context only. Do not read files, do not emit XML/tool-call markup. In two sentences, which current AgentSessionRouter maintenance rule should a parent agent remember?"
    });
    record(
      "router_consult_topic_hint",
      topicRoute.ok && typeof topicRoute.payload?.route_decision?.selected_path === "string" && isUsefulAnswer(topicRoute.payload),
      summarizeRouterConsult(topicRoute)
    );
  } else {
    record("router_consult_existing_session", false, {
      skipped: true,
      reason: "No active session found. Pass --session-id or --topic-hint to force this scenario."
    });
  }

  const [status, monitor] = await Promise.all([
    callTool("router_status", { project_id: projectId, recent_hours: 24, warnings_limit: 20 }),
    callTool("router_monitor", { project_id: projectId, recent_hours: 24, sample_limit: 20 })
  ]);
  record("router_status", status.ok && status.payload?.mode === "normal", status.payload ?? status);
  record(
    "router_monitor_route_health",
    monitor.ok && Array.isArray(monitor.payload?.route_health?.decision_counts),
    {
      route_health: monitor.payload?.route_health,
      latency: monitor.payload?.latency,
      recommendations: monitor.payload?.recommendations
    }
  );
} catch (error) {
  record("router_consult_sanity_unhandled_error", false, {
    error: error instanceof Error ? error.message : String(error)
  });
} finally {
  report.server_stderr = stderr.join("");
  await client.close();
}

report.ok = report.checks.every((check) => check.pass || check.skipped);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: report.ok, out: outPath, failed: report.checks.filter((check) => !check.pass && !check.skipped) }, null, 2));
process.exitCode = report.ok ? 0 : 1;

async function callTool(name, input, fn) {
  const startedAt = Date.now();
  try {
    const result = fn
      ? await fn()
      : await client.callTool({ name, arguments: input }, undefined, { timeout: timeoutMs });
    const payload = fn ? result : parseToolPayload(result);
    return {
      ok: !(result?.isError || payload?.error),
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

async function chooseFreshCluster(clusters) {
  const active = clusters.filter((cluster) => cluster.status !== "archived");
  const candidates = [
    ...active.filter((cluster) => cluster.current_factsheet?.status === "llm_verified"),
    ...active.filter((cluster) => cluster.current_factsheet?.status !== "llm_verified" && cluster.current_factsheet),
    ...active.filter((cluster) => !cluster.current_factsheet)
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
    if (refresh.ok && refresh.payload?.fresh === true) {
      return { ...candidate, source: "registry_fresh_preflight" };
    }
    report.checks.push({
      name: `cluster_preflight_${candidate.id}`,
      pass: false,
      skipped: true,
      details: {
        reason: "cluster_refresh verify_only did not return fresh=true; skipping this cluster for router sanity.",
        refresh
      }
    });
  }
  return null;
}

function chooseSession(sessions, topicHint) {
  const active = sessions.filter((session) => session.status === "active");
  if (topicHint) {
    const normalized = topicHint.toLowerCase();
    const exact = active.find((session) => session.topic?.toLowerCase() === normalized);
    if (exact) {
      return exact;
    }
    const partial = active.find((session) => session.topic?.toLowerCase().includes(normalized));
    if (partial) {
      return partial;
    }
  }
  return active.sort((a, b) => String(b.last_used ?? "").localeCompare(String(a.last_used ?? "")))[0] ?? null;
}

function summarizeSession(session) {
  if (!session) {
    return null;
  }
  return {
    id: session.id,
    topic: session.topic,
    status: session.status,
    last_used: session.last_used,
    source: session.source ?? "registry"
  };
}

function summarizeRouterConsult(result) {
  if (!result.ok) {
    return result;
  }
  const payload = result.payload ?? {};
  return {
    ok: true,
    duration_ms: result.duration_ms,
    route_decision: payload.route_decision,
    session_id: payload.session_id,
    cluster_id: payload.cluster_id,
    routing: payload.routing ?? null,
    metrics: payload.metrics ?? null,
    answer_preview: typeof payload.answer === "string" ? payload.answer.slice(0, 500) : null,
    error: payload.error ?? null
  };
}

function isUsefulAnswer(payload) {
  const answer = typeof payload?.answer === "string" ? payload.answer.trim() : "";
  if (!answer) {
    return false;
  }
  return !/<(?:minimax:)?tool_call\b|<invoke\b|<\/invoke>|<parameter\b/i.test(answer);
}

function record(name, pass, details) {
  report.checks.push({
    name,
    pass: Boolean(pass),
    skipped: Boolean(details?.skipped),
    details
  });
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

function optionalString(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

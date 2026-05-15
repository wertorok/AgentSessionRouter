import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const dbPath = path.resolve(args.db ?? path.join(repoRoot, ".claude-session-router", "sessions.sqlite"));
const matchingModulePath = path.join(repoRoot, "dist", "src", "matching.js");
const projectId = args.project_id ?? "AgentSessionRouter";
const date = args.date ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `route-calibration-${date}`));
const recentHours = Number(args.recent_hours ?? 168);
const gapThreshold = Number(args.gap_threshold ?? 0.15);
const nearTopicThreshold = Number(args.near_topic_threshold ?? 0.5);
const slowThresholdMs = Number(args.slow_threshold_ms ?? 120000);
const highTokenThreshold = Number(args.high_token_threshold ?? 50000);
const queueLimit = Number(args.queue_limit ?? 30);
const includeAll = Boolean(args.all);

if (!existsSync(matchingModulePath)) {
  fail(`Built matching module is missing at ${matchingModulePath}. Run npm run build first.`);
}
if (!existsSync(dbPath)) {
  fail(`Router DB not found at ${dbPath}`);
}

const { normalizeTokens, normalizeTopicKey } = await import(pathToFileURL(matchingModulePath).href);
const sinceIso = includeAll ? null : new Date(Date.now() - recentHours * 60 * 60 * 1000).toISOString();

mkdirSync(outDir, { recursive: true });

const db = new Database(dbPath, { readonly: true });
const sessions = loadSessions();
const routeRows = loadRouteDecisions();
const routeDecisions = routeRows.map((row) => enrichRouteDecision(row));
attachSameTopicReuseSignals(routeDecisions);

const summary = buildSummary(routeDecisions);
const report = {
  project_id: projectId,
  db_path: dbPath,
  generated_at: new Date().toISOString(),
  recent_hours: includeAll ? null : recentHours,
  since: sinceIso,
  thresholds: {
    low_gap: gapThreshold,
    near_topic: nearTopicThreshold,
    slow_ms: slowThresholdMs,
    high_tokens_in: highTokenThreshold
  },
  session_count: sessions.length,
  route_decision_count: routeDecisions.length,
  selected_path_counts: countBy(routeDecisions, "selected_path"),
  suspicious_counts: countSuspiciousFlags(routeDecisions),
  calibration_queue: buildCalibrationQueue(routeDecisions),
  route_decisions: routeDecisions,
  summary
};

writeFileSync(path.join(outDir, "calibration-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(path.join(outDir, "summary.md"), summary, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      out_dir: outDir,
      project_id: projectId,
      route_decisions: routeDecisions.length,
      selected_path_counts: report.selected_path_counts,
      suspicious_counts: report.suspicious_counts,
      calibration_queue: report.calibration_queue.length
    },
    null,
    2
  )
);

function loadSessions() {
  return db
    .prepare(
      `SELECT id, topic, summary, status, last_used
       FROM sessions
       WHERE project_id = ?
         AND status IN ('active', 'dormant')
       ORDER BY last_used DESC`
    )
    .all(projectId)
    .map((session) => ({
      ...session,
      topic_key: normalizeTopicKey(session.topic ?? ""),
      topic_tokens: normalizeTokens(session.topic ?? "")
    }));
}

function loadRouteDecisions() {
  const whereSince = sinceIso ? "AND e.created_at >= ?" : "";
  const params = sinceIso ? [projectId, sinceIso] : [projectId];
  return db
    .prepare(
      `SELECT e.id AS event_id,
              e.session_id,
              s.topic,
              e.answer_summary AS selected_path,
              e.question,
              e.match_score,
              e.match_reason,
              e.tokens_in,
              e.tokens_out,
              e.duration_ms,
              e.created_at
       FROM session_events e
       LEFT JOIN sessions s
         ON s.id = e.session_id
       WHERE e.project_id = ?
         ${whereSince}
         AND e.event_type = 'router_route_decision'
       ORDER BY e.id ASC`
    )
    .all(...params);
}

function enrichRouteDecision(row) {
  const parsedReason = parseMatchReason(row.match_reason ?? "");
  const topicHint = parsedReason.fields.topic_hint ?? "";
  const topicKey = normalizeTopicKey(topicHint || row.topic || row.question || "");
  const candidateGap = asNumber(parsedReason.fields.candidate_gap);
  const ambiguousForcedNew =
    row.selected_path === "claude_consult_new_session" &&
    (row.match_reason ?? "").includes("Ambiguous low-confidence session candidates");
  const outcome = inferOutcome(row);
  const followup = outcome.session_id ? inspectSessionAfter(row, outcome) : emptySessionOutcome();
  const nearDuplicates = findNearDuplicateSessions(row, topicHint, outcome.session_id).slice(0, 5);
  const suspicious = classifySuspicion(row, {
    candidateGap,
    ambiguousForcedNew,
    followup,
    nearDuplicates
  });

  return {
    event_id: row.event_id,
    created_at: row.created_at,
    selected_path: row.selected_path,
    session_id: row.session_id,
    topic: row.topic,
    question: row.question,
    match_score: round(row.match_score),
    match_reason: row.match_reason,
    parsed_reason: parsedReason,
    topic_hint: topicHint || null,
    topic_key: topicKey || null,
    cluster_id: parsedReason.fields.cluster_id ?? null,
    reason_session_id: parsedReason.fields.session_id ?? null,
    candidate_gap: candidateGap,
    force_new_session: parseBoolean(parsedReason.fields.force_new_session),
    auto_cluster_routing: parsedReason.fields.auto_cluster_routing ?? null,
    flags: {
      low_gap: candidateGap !== null && candidateGap < gapThreshold,
      ambiguous_forced_new: ambiguousForcedNew,
      new_session: row.selected_path === "claude_consult_new_session",
      explicit_cluster: row.selected_path === "cluster_consult_explicit",
      explicit_session: row.selected_path === "claude_consult_explicit_session",
      existing_session: row.selected_path === "claude_consult_existing_session",
      auto_fallback: row.selected_path === "claude_consult_auto",
      low_score_auto: row.selected_path === "claude_consult_auto" && Number(row.match_score ?? 0) < 0.55
    },
    outcome,
    followup,
    near_duplicate_sessions: nearDuplicates,
    same_topic_reuse_after: 0,
    suspicious
  };
}

function inferOutcome(routeRow) {
  if (routeRow.session_id) {
    const immediate = db
      .prepare(
        `SELECT id AS event_id,
                session_id,
                event_type,
                tokens_in,
                tokens_out,
                duration_ms,
                error,
                created_at
         FROM session_events
         WHERE project_id = ?
           AND id > ?
           AND session_id = ?
           AND event_type IN ('consult', 'new_session', 'cost_limit_exceeded', 'parse_failed')
         ORDER BY id ASC
         LIMIT 1`
      )
      .get(projectId, routeRow.event_id, routeRow.session_id);

    return normalizeOutcome(immediate, routeRow.session_id, "route_session");
  }

  const inferred = db
    .prepare(
      `SELECT id AS event_id,
              session_id,
              event_type,
              tokens_in,
              tokens_out,
              duration_ms,
              error,
              created_at
       FROM session_events
       WHERE project_id = ?
         AND id > ?
         AND question = ?
         AND event_type IN ('consult', 'new_session', 'cost_limit_exceeded', 'parse_failed')
       ORDER BY id ASC
       LIMIT 1`
    )
    .get(projectId, routeRow.event_id, routeRow.question);

  return normalizeOutcome(inferred, inferred?.session_id ?? null, inferred ? "same_question_after_route" : "none");
}

function normalizeOutcome(row, fallbackSessionId, source) {
  if (!row) {
    return {
      source,
      event_id: null,
      session_id: fallbackSessionId ?? null,
      event_type: null,
      tokens_in: null,
      tokens_out: null,
      duration_ms: null,
      error: null,
      created_at: null,
      slow: false,
      high_tokens: false,
      failed: false
    };
  }

  return {
    source,
    event_id: row.event_id,
    session_id: row.session_id ?? fallbackSessionId ?? null,
    event_type: row.event_type,
    tokens_in: row.tokens_in,
    tokens_out: row.tokens_out,
    duration_ms: row.duration_ms,
    error: row.error,
    created_at: row.created_at,
    slow: Number(row.duration_ms ?? 0) >= slowThresholdMs,
    high_tokens: Number(row.tokens_in ?? 0) >= highTokenThreshold,
    failed: Boolean(row.error)
  };
}

function inspectSessionAfter(routeRow, outcome) {
  const baseEventId = outcome.event_id ?? routeRow.event_id;
  const sessionId = outcome.session_id;
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN event_type IN ('consult', 'new_session') THEN 1 ELSE 0 END) AS consult_like_count,
         SUM(CASE WHEN duration_ms >= ? THEN 1 ELSE 0 END) AS slow_count,
         SUM(CASE WHEN tokens_in >= ? THEN 1 ELSE 0 END) AS high_token_count,
         SUM(CASE WHEN event_type = 'token_anomaly' THEN 1 ELSE 0 END) AS token_anomaly_count,
         SUM(CASE WHEN event_type IN ('parse_failed', 'parse_failed_threshold_exceeded') THEN 1 ELSE 0 END) AS parse_failed_count,
         SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS error_count
       FROM session_events
       WHERE project_id = ?
         AND session_id = ?
         AND id > ?`
    )
    .get(slowThresholdMs, highTokenThreshold, projectId, sessionId, baseEventId);
  const decisions = db
    .prepare(`SELECT COUNT(*) AS count FROM session_decisions WHERE session_id = ?`)
    .get(sessionId);

  return {
    followup_count_after: Number(row?.consult_like_count ?? 0),
    session_decision_count: Number(decisions?.count ?? 0),
    slow_count_after: Number(row?.slow_count ?? 0),
    high_token_count_after: Number(row?.high_token_count ?? 0),
    token_anomaly_count_after: Number(row?.token_anomaly_count ?? 0),
    parse_failed_count_after: Number(row?.parse_failed_count ?? 0),
    error_count_after: Number(row?.error_count ?? 0)
  };
}

function emptySessionOutcome() {
  return {
    followup_count_after: 0,
    session_decision_count: 0,
    slow_count_after: 0,
    high_token_count_after: 0,
    token_anomaly_count_after: 0,
    parse_failed_count_after: 0,
    error_count_after: 0
  };
}

function findNearDuplicateSessions(routeRow, topicHint, outcomeSessionId) {
  const sourceText = topicHint || routeRow.topic || routeRow.question || "";
  const sourceTokens = normalizeTokens(sourceText);
  if (sourceTokens.length === 0) {
    return [];
  }

  return sessions
    .filter((session) => session.id !== routeRow.session_id && session.id !== outcomeSessionId)
    .map((session) => ({
      session_id: session.id,
      topic: session.topic,
      status: session.status,
      topic_jaccard: round(jaccard(sourceTokens, session.topic_tokens))
    }))
    .filter((item) => item.topic_jaccard >= nearTopicThreshold)
    .sort((left, right) => right.topic_jaccard - left.topic_jaccard);
}

function classifySuspicion(row, context) {
  const flags = [];
  if (context.ambiguousForcedNew) {
    flags.push("ambiguous_forced_new");
  }
  if (context.candidateGap !== null && context.candidateGap < gapThreshold) {
    flags.push("low_candidate_gap");
  }
  if (row.selected_path === "claude_consult_new_session") {
    flags.push("new_session");
  }
  if (row.selected_path === "claude_consult_auto") {
    flags.push("auto_fallback");
  }
  if (context.followup.slow_count_after > 0 || context.followup.high_token_count_after > 0) {
    flags.push("expensive_session_after_route");
  }
  if (context.followup.token_anomaly_count_after > 0) {
    flags.push("token_anomaly_after_route");
  }
  if (context.followup.parse_failed_count_after > 0) {
    flags.push("metadata_parse_failure_after_route");
  }
  if (context.followup.error_count_after > 0) {
    flags.push("error_after_route");
  }
  if (context.nearDuplicates.length > 0) {
    flags.push("near_duplicate_topic");
  }
  return flags;
}

function attachSameTopicReuseSignals(decisions) {
  for (const decision of decisions) {
    if (!decision.topic_key) {
      continue;
    }
    decision.same_topic_reuse_after = decisions.filter((candidate) => {
      if (candidate.event_id <= decision.event_id || candidate.topic_key !== decision.topic_key) {
        return false;
      }
      if (decision.session_id && candidate.session_id === decision.session_id) {
        return true;
      }
      return Boolean(decision.cluster_id && candidate.cluster_id === decision.cluster_id);
    }).length;
  }
}

function buildCalibrationQueue(decisions) {
  return decisions
    .map((decision) => ({ ...decision, priority: calibrationPriority(decision) }))
    .filter((decision) => decision.priority > 0)
    .sort((left, right) => right.priority - left.priority || right.event_id - left.event_id)
    .slice(0, queueLimit)
    .map((decision) => ({
      event_id: decision.event_id,
      created_at: decision.created_at,
      selected_path: decision.selected_path,
      priority: decision.priority,
      match_score: decision.match_score,
      candidate_gap: decision.candidate_gap,
      topic_hint: decision.topic_hint,
      topic: decision.topic,
      session_id: decision.session_id,
      cluster_id: decision.cluster_id,
      suspicious: decision.suspicious,
      question: decision.question,
      outcome: decision.outcome,
      followup: decision.followup,
      near_duplicate_sessions: decision.near_duplicate_sessions.slice(0, 3)
    }));
}

function calibrationPriority(decision) {
  let priority = 0;
  if (decision.suspicious.includes("ambiguous_forced_new")) priority += 100;
  if (decision.suspicious.includes("low_candidate_gap")) priority += 80;
  if (decision.suspicious.includes("new_session")) priority += 60;
  if (decision.suspicious.includes("expensive_session_after_route")) priority += 50;
  if (decision.suspicious.includes("token_anomaly_after_route")) priority += 45;
  if (decision.suspicious.includes("metadata_parse_failure_after_route")) priority += 40;
  if (decision.suspicious.includes("near_duplicate_topic")) priority += 35;
  if (decision.suspicious.includes("auto_fallback")) priority += 20;
  return priority;
}

function buildSummary(decisions) {
  const selectedPathCounts = countBy(decisions, "selected_path");
  const suspiciousCounts = countSuspiciousFlags(decisions);
  const queue = buildCalibrationQueue(decisions);
  const gapRows = decisions.filter((decision) => decision.candidate_gap !== null);
  const lowGapRows = decisions.filter((decision) => decision.flags.low_gap);
  const newSessionRows = decisions.filter((decision) => decision.flags.new_session);
  const expensiveRows = decisions.filter(
    (decision) => decision.outcome.slow || decision.outcome.high_tokens || decision.followup.slow_count_after > 0
  );
  const nearDuplicateRows = decisions.filter((decision) => decision.near_duplicate_sessions.length > 0);

  return [
    "# Route Calibration Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Project: \`${projectId}\``,
    `Window: ${includeAll ? "all route decisions" : `last ${recentHours}h since ${sinceIso}`}`,
    "",
    "This is an offline report. It does not invoke Claude and does not change routing behavior. It turns real `router_route_decision` telemetry into a calibration queue for future match-score tuning.",
    "",
    "## Executive Summary",
    "",
    `- Route decisions inspected: ${decisions.length}`,
    `- Active/dormant sessions considered for near-topic analysis: ${sessions.length}`,
    `- Decisions with candidate-gap telemetry: ${gapRows.length}`,
    `- Low-gap decisions (< ${gapThreshold}): ${lowGapRows.length}`,
    `- New-session route decisions: ${newSessionRows.length}`,
    `- Expensive/slow outcome signals: ${expensiveRows.length}`,
    `- Near-duplicate topic signals: ${nearDuplicateRows.length}`,
    `- Calibration queue items: ${queue.length}`,
    "",
    decisions.length < 30
      ? "> Sample is still small. Use this report for inspection, not threshold tuning."
      : "> Sample is large enough to inspect recurring patterns, but thresholds should still be tuned only after labeling correctness.",
    "",
    "## Selected Path Counts",
    "",
    table(["Selected path", "Count"], selectedPathCounts.map((row) => [row.value, row.count])),
    "",
    "## Suspicious Signal Counts",
    "",
    table(["Signal", "Count"], suspiciousCounts.map((row) => [row.signal, row.count])),
    "",
    "## Calibration Queue",
    "",
    queue.length === 0
      ? "No suspicious route decisions found in this window."
      : table(
          ["Event", "Path", "Score", "Gap", "Signals", "Topic hint / topic"],
          queue.map((item) => [
            item.event_id,
            item.selected_path,
            formatNullable(item.match_score),
            formatNullable(item.candidate_gap),
            item.suspicious.join(", "),
            truncate(item.topic_hint || item.topic || item.question || "", 80)
          ])
        ),
    "",
    "## How To Use This",
    "",
    "1. Inspect the calibration queue before changing score weights.",
    "2. Label each queued route as `correct_reuse`, `wrong_reuse`, `correct_new_session`, or `unnecessary_new_session`.",
    "3. Only after labels exist, compare alternative weights/thresholds against those labels.",
    "4. Treat explicit cluster/session routes as operator intent, not evidence that fuzzy matching worked.",
    "",
    "## Artifacts",
    "",
    "- `calibration-report.json`: full machine-readable route decisions, parsed reasons, outcome signals, and queue."
  ].join("\n");
}

function parseMatchReason(reason) {
  const fields = {};
  const notes = [];
  for (const part of reason.split(";").map((item) => item.trim()).filter(Boolean)) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      fields[match[1]] = match[2];
    } else {
      notes.push(part);
    }
  }
  return { fields, notes };
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] ?? "null";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || String(left.value).localeCompare(String(right.value)));
}

function countSuspiciousFlags(decisions) {
  const counts = new Map();
  for (const decision of decisions) {
    for (const flag of decision.suspicious) {
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([signal, count]) => ({ signal, count }))
    .sort((left, right) => right.count - left.count || left.signal.localeCompare(right.signal));
}

function table(headers, rows) {
  const safeRows = rows.length > 0 ? rows : headers.map(() => "");
  const body = rows.length > 0 ? rows : [headers.map(() => "-")];
  const widths = headers.map((header, index) =>
    Math.max(String(header).length, ...body.map((row) => String(row[index] ?? "").length))
  );
  const line = (items) => `| ${items.map((item, index) => String(item ?? "").padEnd(widths[index])).join(" | ")} |`;
  const separator = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;
  if (rows.length === 0) {
    return [line(headers), separator, line(safeRows)].join("\n");
  }
  return [line(headers), separator, ...rows.map(line)].join("\n");
}

function jaccard(left, right) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function asNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? round(number) : null;
}

function parseBoolean(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return value === "true";
}

function round(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  return Math.round(Number(value) * 10000) / 10000;
}

function formatNullable(value) {
  return value === null || value === undefined ? "-" : value;
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-/g, "_");
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      parsed[key] = argv[index + 1];
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

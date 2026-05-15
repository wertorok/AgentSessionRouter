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
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `session-routing-collision-${date}`));
const thresholdUse = Number(args.threshold_use ?? 0.7);
const thresholdLowConfidence = Number(args.threshold_low_confidence ?? 0.55);

if (!existsSync(matchingModulePath)) {
  fail(`Built matching module is missing at ${matchingModulePath}. Run npm run build first.`);
}
if (!existsSync(dbPath)) {
  fail(`Router DB not found at ${dbPath}`);
}

const { findBestSessionMatch, normalizeTokens, normalizeTopicKey } = await import(pathToFileURL(matchingModulePath).href);

mkdirSync(outDir, { recursive: true });

const db = new Database(dbPath, { readonly: true });
const candidates = loadCandidates();
const probes = buildProbes();
const pairwise = computePairwiseTopicSimilarity(candidates);
const probeResults = probes.map((probe) => analyzeProbe(probe));
const exactKeyCollisions = findExactKeyCollisions(candidates);
const summary = buildSummary();
const report = {
  project_id: projectId,
  db_path: dbPath,
  thresholds: {
    threshold_use: thresholdUse,
    threshold_low_confidence: thresholdLowConfidence
  },
  active_candidate_count: candidates.length,
  exact_key_collisions: exactKeyCollisions,
  pairwise_topic_similarity: pairwise,
  probes: probeResults,
  summary
};

writeFileSync(path.join(outDir, "collision-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(path.join(outDir, "summary.md"), summary, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      out_dir: outDir,
      project_id: projectId,
      active_candidate_count: candidates.length,
      exact_key_collisions: exactKeyCollisions.length,
      high_confidence_probe_routes: probeResults.filter((probe) => probe.router_consult_would_reuse).length,
      low_confidence_probe_routes: probeResults.filter((probe) => probe.claude_consult_would_reuse).length,
      ambiguous_low_confidence_probe_routes: probeResults.filter((probe) => probe.risk === "low_confidence_ambiguous").length,
      exact_topic_probe_routes: probeResults.filter((probe) => probe.exact_topic_matches.length > 0).length
    },
    null,
    2
  )
);

function loadCandidates() {
  const sessions = db
    .prepare(
      `SELECT id, topic, summary, status, last_used
       FROM sessions
       WHERE project_id = ?
         AND status = 'active'
       ORDER BY last_used DESC`
    )
    .all(projectId);

  return sessions.map((session, index) => ({
    id: session.id,
    topic: session.topic,
    topic_key: normalizeTopicKey(session.topic),
    topic_tokens: normalizeTokens(session.topic),
    summary: session.summary ?? "",
    decisions: listSessionValues("session_decisions", "decision", session.id),
    files_discussed: listSessionValues("session_files", "path", session.id),
    tags: listSessionValues("session_tags", "tag", session.id),
    aliases: listSessionValues("session_aliases", "alias", session.id),
    recency_score: Math.max(0, 1 - index / Math.max(1, sessions.length - 1))
  }));
}

function listSessionValues(tableName, columnName, sessionId) {
  return db
    .prepare(`SELECT ${columnName} AS value FROM ${tableName} WHERE session_id = ? ORDER BY id ASC`)
    .all(sessionId)
    .map((row) => row.value);
}

function buildProbes() {
  const staticProbes = [
    {
      id: "route-cache-overlap",
      expected_domain: "route telemetry or cache maintenance",
      topicHint: "router consult route cache telemetry sample",
      task: "Explain route_health and cache maintenance monitor signals.",
      relevantCode: "",
      question: "Which prior session should answer a mixed route/cache monitor question?"
    },
    {
      id: "cache-shadow-overlap",
      expected_domain: "cache maintenance or shadow eval",
      topicHint: "router consult cache shadow eval sample",
      task: "Explain cluster re-prepare and shadow eval quality.",
      relevantCode: "",
      question: "When should factsheet be rebuilt after shadow signals?"
    },
    {
      id: "shadow-route-overlap",
      expected_domain: "shadow eval or route telemetry",
      topicHint: "router consult shadow route telemetry sample",
      task: "Explain shadow eval and route_health.",
      relevantCode: "",
      question: "How should the operator interpret route and shadow data?"
    },
    {
      id: "cluster-fallback-generic",
      expected_domain: "cluster fallback",
      topicHint: "cluster fallback agentsessionrouter-codebase",
      task: "Explain stale factsheet fallback and route telemetry.",
      relevantCode: "",
      question: "What happens when a cluster cannot serve from verified facts?"
    },
    {
      id: "roadmap-monitor-overlap",
      expected_domain: "roadmap or monitor",
      topicHint: "router monitor roadmap after v2.3.1",
      task: "Plan the next router maintenance step.",
      relevantCode: "",
      question: "What should we do next?"
    }
  ];

  const syntheticNearTopics = candidates
    .filter((candidate) => candidate.topic_tokens.length >= 3)
    .slice(0, 8)
    .map((candidate, index) => ({
      id: `near-current-${index + 1}`,
      expected_domain: candidate.topic,
      topicHint: candidate.topic_tokens.slice(0, -1).join(" "),
      task: `Continue the work from ${candidate.topic}.`,
      relevantCode: candidate.files_discussed.slice(0, 3).join("\n"),
      question: `Should this route back to the session for ${candidate.topic}?`
    }));

  return [...staticProbes, ...syntheticNearTopics];
}

function analyzeProbe(probe) {
  const exactTopicMatches = candidates
    .filter((candidate) => candidate.topic_key === normalizeTopicKey(probe.topicHint))
    .map((candidate) => ({
      session_id: candidate.id,
      topic: candidate.topic
    }));
  const best = findBestSessionMatch(candidates, probe, thresholdUse, thresholdLowConfidence);
  const ranked = candidates
    .map((candidate) => {
      const match = findBestSessionMatch([candidate], probe, thresholdUse, thresholdLowConfidence);
      return {
        session_id: candidate.id,
        topic: candidate.topic,
        score: round(match.score),
        would_be_low_confidence: match.score >= thresholdLowConfidence && match.score < thresholdUse,
        would_be_high_confidence: match.score >= thresholdUse,
        reason: match.reason
      };
    })
    .sort((left, right) => right.score - left.score);
  const top = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  return {
    ...probe,
    best_session_id: best.session?.id ?? null,
    best_topic: best.session?.topic ?? null,
    best_score: round(best.score),
    best_low_confidence: best.lowConfidence,
    best_reason: best.reason,
    exact_topic_matches: exactTopicMatches,
    router_consult_would_reuse: exactTopicMatches.length > 0 || Boolean(best.session && !best.lowConfidence),
    claude_consult_would_reuse: exactTopicMatches.length > 0 || Boolean(best.session),
    ambiguity_gap: top && second ? round(top.score - second.score) : null,
    risk: classifyProbeRisk(top, second, exactTopicMatches),
    top_candidates: ranked.slice(0, 5)
  };
}

function computePairwiseTopicSimilarity(items) {
  const rows = [];
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex];
      const right = items[rightIndex];
      rows.push({
        left_id: left.id,
        left_topic: left.topic,
        right_id: right.id,
        right_topic: right.topic,
        topic_jaccard: round(jaccard(left.topic_tokens, right.topic_tokens))
      });
    }
  }
  return rows.sort((left, right) => right.topic_jaccard - left.topic_jaccard).slice(0, 20);
}

function findExactKeyCollisions(items) {
  const byKey = new Map();
  for (const item of items) {
    const bucket = byKey.get(item.topic_key) ?? [];
    bucket.push({ id: item.id, topic: item.topic });
    byKey.set(item.topic_key, bucket);
  }
  return [...byKey.entries()]
    .filter(([, bucket]) => bucket.length > 1)
    .map(([topic_key, sessions]) => ({ topic_key, sessions }));
}

function classifyProbeRisk(top, second, exactTopicMatches) {
  if (exactTopicMatches.length > 1) {
    return "exact_topic_collision";
  }
  if (exactTopicMatches.length === 1) {
    return "exact_topic_reuse";
  }
  if (!top) {
    return "no_candidate";
  }
  if (top.score >= thresholdUse && second && top.score - second.score < 0.1) {
    return "high_collision_risk";
  }
  if (top.score >= thresholdUse) {
    return "high_confidence_route";
  }
  if (top.score >= thresholdLowConfidence && second && top.score - second.score < 0.1) {
    return "low_confidence_ambiguous";
  }
  if (top.score >= thresholdLowConfidence) {
    return "low_confidence_reuse_possible";
  }
  return "conservative_no_reuse";
}

function buildSummary() {
  const exactRoutes = probeResults.filter((probe) => probe.exact_topic_matches.length === 1);
  const exactCollisionRoutes = probeResults.filter((probe) => probe.exact_topic_matches.length > 1);
  const highRisk = probeResults.filter((probe) => probe.risk === "high_collision_risk");
  const highRoutes = probeResults.filter((probe) => probe.risk === "high_confidence_route");
  const lowAmbiguous = probeResults.filter((probe) => probe.risk === "low_confidence_ambiguous");
  const lowRoutes = probeResults.filter((probe) => probe.risk === "low_confidence_reuse_possible");
  const noReuse = probeResults.filter((probe) => !probe.claude_consult_would_reuse);
  const pairRows = pairwise
    .slice(0, 10)
    .map((row) => `| ${row.topic_jaccard} | ${row.left_topic} | ${row.right_topic} |`)
    .join("\n");
  const probeRows = probeResults
    .map(
      (probe) =>
        `| ${probe.id} | ${probe.risk} | ${probe.best_score} | ${probe.ambiguity_gap ?? ""} | ${
          probe.exact_topic_matches.map((match) => match.topic).join("<br>") || probe.best_topic || ""
        } |`
    )
    .join("\n");

  return [
    "# Session Routing Collision Analysis",
    "",
    `Project id: ${projectId}`,
    `Active candidates: ${candidates.length}`,
    `Thresholds: use=${thresholdUse}, low_confidence=${thresholdLowConfidence}`,
    "",
    "## Executive Result",
    "",
    `- Exact normalized topic collisions: ${exactKeyCollisions.length}`,
    `- Probe exact-topic reuses: ${exactRoutes.length}`,
    `- Probe exact-topic collisions: ${exactCollisionRoutes.length}`,
    `- High collision risk probes: ${highRisk.length}`,
    `- router_consult high-confidence fuzzy reuses: ${highRoutes.length}`,
    `- lower-level claude_consult ambiguous low-confidence reuses: ${lowAmbiguous.length}`,
    `- lower-level claude_consult low-confidence possible reuses: ${lowRoutes.length}`,
    `- conservative no-reuse probes: ${noReuse.length}`,
    "",
    "Interpretation: exact-topic reuse is proven by the continuity benchmark, but it is the easy case. This report separates exact-topic reuse from fuzzy matching. With the current active sessions and thresholds, similar topic names mostly do not cross the router-consult fuzzy reuse threshold. The main router_consult risk is missed reuse/new sessions; the remaining confusion risk is lower-level low-confidence reuse when two candidates have close scores.",
    "",
    "## Closest Active Topic Pairs",
    "",
    "| Topic Jaccard | Left | Right |",
    "| ---: | --- | --- |",
    pairRows || "No pairs.",
    "",
    "## Probe Results",
    "",
    "| Probe | Risk | Best fuzzy score | Gap to second | Exact or best topic |",
    "| --- | --- | ---: | ---: | --- |",
    probeRows || "No probes.",
    "",
    "## Operational Conclusion",
    "",
    "- The previous `router_exact_topic` continuity score should be read as exact-topic reuse, not fuzzy semantic routing.",
    "- Current top-level fuzzy matching is safe but under-reuses sessions unless topic, tags, aliases, or file paths strongly overlap.",
    "- Ambiguous low-confidence cases should be inspected before relying on auto `claude_consult` reuse.",
    "- To improve non-exact reuse later, collect route-health samples first and then add ambiguity-aware matching rather than lowering thresholds blindly.",
    ""
  ].join("\n");
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

function round(value) {
  return Math.round(Number(value) * 100) / 100;
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

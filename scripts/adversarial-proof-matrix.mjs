import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Database from "better-sqlite3";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = args.date ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `adversarial-proof-${date}`));
const keepTemp = Boolean(args.keepTemp);
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const proofPath = path.join(outDir, "proof.json");
const summaryPath = path.join(outDir, "summary.md");

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

mkdirSync(outDir, { recursive: true });

const report = {
  started_at: new Date().toISOString(),
  server_entry: serverEntry,
  zones: [],
  suites: []
};

try {
  await runMainSuite();
  await runRateLimitSuite();
} finally {
  report.finished_at = new Date().toISOString();
  writeFileSync(proofPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(summaryPath, renderSummary(report), "utf8");
}

const broken = report.zones.flatMap((zone) => zone.checks.filter((check) => check.status === "BROKEN"));
console.log(JSON.stringify({ ok: broken.length === 0, proof: proofPath, summary: summaryPath, broken }, null, 2));
process.exitCode = broken.length === 0 ? 0 : 1;

async function runMainSuite() {
  const suite = createSuite("main", {
    shadowMode: true,
    maxConsultsPerHour: 1000,
    maxConsultsPerDay: 5000,
    maxTokensPerConsult: 20000
  });
  report.suites.push(suite.publicInfo);
  try {
    await withClient(suite, async (client) => {
      await zone1InputGarbage(client, suite);
      await zone2Concurrency(client, suite);
      await zone3Scale(client, suite);
      await zone4Revalidation(client, suite);
      await zone5TierContract(client, suite);
      await zone6CostLoop(client, suite);
    });
  } finally {
    suite.cleanup();
  }
}

async function runRateLimitSuite() {
  const suite = createSuite("rate-limit", {
    shadowMode: false,
    maxConsultsPerHour: 5,
    maxConsultsPerDay: 20,
    maxTokensPerConsult: 20000
  });
  report.suites.push(suite.publicInfo);
  try {
    await withClient(suite, async (client) => {
      const zone = zoneRecord("ZONE 6B", "Cost/rate limit proof");
      await prepareEvidenceCluster(client, "rate-limit-stale");
      mutateEvidence(suite, { selectorLine: "export const removedSelector = 'missing';" });
      const before = suite.calls();
      const results = [];
      for (let index = 0; index < 12; index += 1) {
        const result = await callToolRaw(client, "cluster_consult", {
          project_id: null,
          cluster_id: "rate-limit-stale",
          question: `Unique stale rate-limit question ${index}`
        });
        results.push(summarizeRawResult(result));
      }
      const after = suite.calls();
      const delta = summarizeCallDelta(before, after);
      const errors = results.filter((item) => item.error_code);
      zone.checks.push({
        id: "rate_limit_caps_unique_stale_fallback",
        status: errors.some((item) => item.error_code === "COST_LIMIT_EXCEEDED") ? "HELD" : "BROKEN",
        input: "12 unique cluster_consult calls against one stale cluster with max_consults_per_hour=5",
        expected_edge: "Fallback cost must be capped instead of unbounded Claude calls.",
        observed: {
          results,
          claude_call_delta: delta,
          cost_limit_errors: errors.filter((item) => item.error_code === "COST_LIMIT_EXCEEDED").length,
          cluster_events: clusterEvents(suite, "rate-limit-stale")
        }
      });
      report.zones.push(zone);
    });
  } finally {
    suite.cleanup();
  }
}

async function zone1InputGarbage(client, suite) {
  const zone = zoneRecord("ZONE 1", "Caller sends malformed or huge input");
  const beforeOversized = suite.calls();
  const oversized = await callToolRaw(client, "router_consult", {
    project_id: null,
    topic_hint: "oversized adversarial input",
    related_files: ["src/evidence.ts"],
    tags: ["adversarial"],
    question: "x".repeat(100_000)
  });
  const afterOversized = suite.calls();
  const oversizedDelta = summarizeCallDelta(beforeOversized, afterOversized);
  zone.checks.push({
    id: "oversized_router_consult_100k",
    status: oversized.payload?.error?.code === "INPUT_INVALID" && oversizedDelta.total === 0 ? "HELD" : "BROKEN",
    input: "router_consult question length = 100000",
    expected_edge: "Would previously enter route/prompt work; must reject before Claude.",
    observed: {
      result: summarizeRawResult(oversized),
      claude_call_delta: oversizedDelta
    }
  });

  const wrongSchema = await callToolRaw(client, "router_consult", {
    project_id: null,
    topic_hint: ["array-not-string"],
    related_files: "src/evidence.ts",
    tags: [null, "", { bad: true }],
    question: "Valid question text but intentionally malformed metadata schema."
  });
  zone.checks.push({
    id: "wrong_schema_metadata",
    status: wrongSchema.ok === false ? "HELD" : "BROKEN",
    input: "topic_hint=array, related_files=string, tags include object",
    expected_edge: "MCP schema/handler must return a structured validation failure, not stack trace or hang.",
    observed: summarizeRawResult(wrongSchema)
  });

  const beforePath = suite.calls();
  const unsafePath = await callToolRaw(client, "router_consult", {
    project_id: null,
    topic_hint: "path sanitization proof",
    related_files: ["../../../etc/passwd", "/etc/passwd", "src/evidence.ts"],
    tags: ["adversarial", "path"],
    task_type: "debug",
    question: "Create a session while dropping unsafe routing file hints and keeping the safe file hint."
  });
  const afterPath = suite.calls();
  const session = unsafePath.payload?.session_id ? sessionById(suite, unsafePath.payload.session_id) : null;
  zone.checks.push({
    id: "unsafe_related_files_sanitized",
    status:
      unsafePath.ok === true &&
      Array.isArray(session?.files_discussed) &&
      session.files_discussed.length === 1 &&
      session.files_discussed[0] === "src/evidence.ts"
        ? "HELD"
        : "BROKEN",
    input: "related_files includes ../../../etc/passwd, /etc/passwd, src/evidence.ts",
    expected_edge: "Path hints must not be read or stored if unsafe.",
    observed: {
      result: summarizeRawResult(unsafePath),
      session_files_discussed: session?.files_discussed ?? null,
      claude_call_delta: summarizeCallDelta(beforePath, afterPath)
    }
  });
  report.zones.push(zone);
}

async function zone2Concurrency(client, suite) {
  const zone = zoneRecord("ZONE 2", "Concurrency / stale race");
  await prepareEvidenceCluster(client, "race-stale");
  mutateEvidence(suite, { selectorLine: "export const staleSelectorDeleted = 'missing';" });
  const before = suite.calls();
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      callToolRaw(client, "cluster_consult", {
        project_id: null,
        cluster_id: "race-stale",
        question: "Same stale race question should coalesce fallback."
      })
    )
  );
  await sleep(200);
  const after = suite.calls();
  const events = clusterEvents(suite, "race-stale");
  const counts = countBy(events, "event_type");
  zone.checks.push({
    id: "ten_parallel_same_stale_cluster",
    status:
      results.every((result) => result.ok) &&
      counts.evidence_revalidation_failed === 1 &&
      counts.evidence_revalidation_suppressed === 9 &&
      counts.cluster_fallback_to_claude_consult === 1 &&
      counts.cluster_fallback_coalesced === 9
        ? "HELD"
        : "BROKEN",
    input: "10 parallel cluster_consult calls, same stale cluster, same question",
    expected_edge: "One revalidation failure and one fallback; no factsheet corruption and no N duplicate fallbacks.",
    observed: {
      result_summary: summarizeResultList(results),
      event_counts: counts,
      claude_call_delta: summarizeCallDelta(before, after),
      cluster: clusterById(suite, "race-stale")
    }
  });
  report.zones.push(zone);
}

async function zone3Scale(client, suite) {
  const zone = zoneRecord("ZONE 3", "SQLite/session scale and routing precision");
  const beforeDry = await timedCall(client, "router_dry_run", {
    project_id: null,
    topic_hint: "scale target before sessions",
    related_files: ["src/scale-target.ts"],
    tags: ["scale"],
    task_type: "planning",
    question: "Where would this scale target question route before any scale sessions exist?"
  });

  const createStarted = Date.now();
  seedScaleSessions(suite, 200);
  const createDurationMs = Date.now() - createStarted;

  const probes = [
    {
      name: "exact_topic_42",
      input: {
        topic_hint: "scale topic 42",
        related_files: ["src/domain-42.ts"],
        tags: ["scale", "topic-42"],
        task_type: "debug",
        question: "Follow up on exact scale topic 42 and the domain-42 file."
      }
    },
    {
      name: "exact_topic_123",
      input: {
        topic_hint: "scale topic 123",
        related_files: ["src/shared-3.ts"],
        tags: ["scale", "topic-123"],
        task_type: "planning",
        question: "Follow up on exact scale topic 123 and the shared-3 file."
      }
    },
    {
      name: "nearby_topic_4",
      input: {
        topic_hint: "scale topic 4",
        related_files: ["src/domain-4.ts"],
        tags: ["scale"],
        task_type: "planning",
        question: "This intentionally nearby topic could collide with 40, 41, or 42."
      }
    },
    {
      name: "shared_file_7",
      input: {
        topic_hint: "shared 7 scale routing",
        related_files: ["src/shared-7.ts"],
        tags: ["scale"],
        task_type: "debug",
        question: "Find a session that discussed shared file 7 in the scale setup."
      }
    },
    {
      name: "unrelated_new_domain",
      input: {
        topic_hint: "payments webhook signing",
        related_files: ["src/payments.ts"],
        tags: ["payments"],
        task_type: "architectural",
        question: "This should not reuse a scale session if the router is conservative."
      }
    }
  ];

  const decisions = [];
  for (const probe of probes) {
    const dry = await timedCall(client, "router_dry_run", {
      project_id: null,
      ...probe.input,
      candidate_limit: 5
    });
    decisions.push({
      name: probe.name,
      duration_ms: dry.duration_ms,
      selected_path: dry.payload.route_decision?.selected_path,
      selected_session_id: dry.payload.route_decision?.selected_session_id ?? null,
      score: dry.payload.route_decision?.score ?? null,
      reason: dry.payload.route_decision?.reason ?? null,
      top_candidates: dry.payload.top_session_candidates
    });
  }

  const afterConsult = await timedCall(client, "router_consult", {
    project_id: null,
    ...probes[0].input
  });

  zone.checks.push({
    id: "two_hundred_sessions_routing_scale",
    status:
      beforeDry.ok &&
      decisions.length === 5 &&
      decisions[0].selected_path === "claude_consult_existing_session" &&
      decisions[1].selected_path === "claude_consult_existing_session" &&
      decisions[4].selected_path === "claude_consult_new_session"
        ? "HELD"
        : "BROKEN",
    input: "Create 200 sessions through claude_consult, then run router_dry_run/router_consult probes.",
      expected_edge: "Routing should not catastrophically slow down or pick unrelated sessions only because N is large.",
      observed: {
      seeded_scale_sessions: 200,
      create_duration_ms: createDurationMs,
      latency_before_sessions_ms: beforeDry.duration_ms,
      latency_after_router_consult_ms: afterConsult.duration_ms,
      total_session_count: sessionCount(suite),
      decisions
    }
  });
  report.zones.push(zone);
}

async function zone4Revalidation(client, suite) {
  const zone = zoneRecord("ZONE 4", "Stale / revalidation / fallback");
  writeEvidence(suite);
  await prepareEvidenceCluster(client, "move-cluster");
  mutateEvidence(suite, { leading: ["// leading line 1", "// leading line 2", "// leading line 3"] });
  const moved = await callToolRaw(client, "cluster_consult", {
    project_id: null,
    cluster_id: "move-cluster",
    question: "What fact survives after the selector moved?"
  });
  const movedEvents = clusterEvents(suite, "move-cluster");

  writeEvidence(suite);
  await prepareEvidenceCluster(client, "delete-file-cluster");
  unlinkSync(path.join(suite.projectDir, "src", "evidence.ts"));
  const deleted = await callToolRaw(client, "cluster_consult", {
    project_id: null,
    cluster_id: "delete-file-cluster",
    question: "What happens when the evidence file is deleted?"
  });
  const deletedEvents = clusterEvents(suite, "delete-file-cluster");

  zone.checks.push({
    id: "selector_moved_same_content_revalidates",
    status: moved.ok === true && hasEvent(movedEvents, "evidence_revalidated") ? "HELD" : "BROKEN",
    input: "Same selector/content moved by adding leading lines before it.",
    expected_edge: "Line movement alone should revalidate and continue cluster answer.",
    observed: {
      result: summarizeRawResult(moved),
      event_counts: countBy(movedEvents, "event_type")
    }
  });
  zone.checks.push({
    id: "evidence_file_deleted_falls_back",
    status:
      deleted.ok === true &&
      Boolean(deleted.payload?.session_id) &&
      clusterById(suite, "delete-file-cluster")?.status === "needs_prepare" &&
      hasEvent(deletedEvents, "evidence_revalidation_failed") &&
      hasEvent(deletedEvents, "cluster_fallback_to_claude_consult")
        ? "HELD"
        : "BROKEN",
    input: "Delete evidence file, then cluster_consult.",
    expected_edge: "Must not answer from stale factsheet; must fallback internally and mark cluster needs_prepare.",
    observed: {
      result: summarizeRawResult(deleted),
      cluster: clusterById(suite, "delete-file-cluster"),
      event_counts: countBy(deletedEvents, "event_type")
    }
  });
  report.zones.push(zone);
}

async function zone5TierContract(client, suite) {
  const zone = zoneRecord("ZONE 5", "Tier/API contract misuse");
  writeEvidence(suite);
  await prepareEvidenceCluster(client, "maintain-direct");
  const reprepare = await callToolRaw(client, "cluster_reprepare", {
    project_id: null,
    cluster_id: "maintain-direct",
    verification_mode: "static"
  });

  const cluster = await callToolRaw(client, "cluster_consult", {
    project_id: null,
    cluster_id: "maintain-direct",
    question: "Create a comparison row for rejudge."
  });
  await waitForJudgedComparisons(client, "maintain-direct", 1);
  const beforeRejudge = suite.calls();
  const rejudge = await callToolRaw(client, "comparison_rejudge", {
    project_id: null,
    cluster_id: "maintain-direct",
    preferred: null,
    limit: 1
  });
  const afterRejudge = suite.calls();

  zone.checks.push({
    id: "caller_direct_cluster_reprepare",
    status: reprepare.ok === true && reprepare.payload?.cluster_id === "maintain-direct" ? "HELD" : "BROKEN",
    input: "Direct call to [MAINTAIN] cluster_reprepare.",
    expected_edge: "Should not corrupt cluster or pretend to be an answer path; returns maintenance payload.",
    observed: summarizeRawResult(reprepare)
  });
  zone.checks.push({
    id: "caller_direct_comparison_rejudge",
    status: rejudge.ok === true && Array.isArray(rejudge.payload?.processed) ? "HELD" : "BROKEN",
    input: "Direct call to [EVAL DEBUG] comparison_rejudge after creating one judged comparison.",
    expected_edge: "Should return eval-maintenance structure and may invoke judge once; not a caller answer.",
    observed: {
      cluster_consult: summarizeRawResult(cluster),
      rejudge: summarizeRawResult(rejudge),
      claude_call_delta: summarizeCallDelta(beforeRejudge, afterRejudge)
    }
  });
  report.zones.push(zone);
}

async function zone6CostLoop(client, suite) {
  const zone = zoneRecord("ZONE 6", "Cost / loop / shadow burst");

  writeEvidence(suite);
  await prepareEvidenceCluster(client, "loop-same");
  const beforeSame = suite.calls();
  const sameResults = [];
  for (let index = 0; index < 30; index += 1) {
    mutateEvidence(suite, { selectorLine: `export const staleSelectorDeleted${index} = 'missing';` });
    sameResults.push(
      await callToolRaw(client, "cluster_consult", {
        project_id: null,
        cluster_id: "loop-same",
        question: "Same always-stale question should not cause repeated fallback."
      })
    );
  }
  const afterSame = suite.calls();
  const sameEvents = clusterEvents(suite, "loop-same");
  const sameDelta = summarizeCallDelta(beforeSame, afterSame);

  writeEvidence(suite);
  await prepareEvidenceCluster(client, "loop-unique");
  const beforeUnique = suite.calls();
  const uniqueResults = [];
  for (let index = 0; index < 30; index += 1) {
    mutateEvidence(suite, { selectorLine: `export const staleSelectorDeletedUnique${index} = 'missing';` });
    uniqueResults.push(
      await callToolRaw(client, "cluster_consult", {
        project_id: null,
        cluster_id: "loop-unique",
        question: `Unique always-stale question ${index}`
      })
    );
  }
  const afterUnique = suite.calls();
  const uniqueEvents = clusterEvents(suite, "loop-unique");
  const uniqueDelta = summarizeCallDelta(beforeUnique, afterUnique);

  writeEvidence(suite);
  await prepareEvidenceCluster(client, "shadow-burst");
  const beforeShadow = suite.calls();
  const shadowResults = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      callToolRaw(client, "cluster_consult", {
        project_id: null,
        cluster_id: "shadow-burst",
        question: `Fresh shadow burst question ${index}`
      })
    )
  );
  await waitForJudgedComparisons(client, "shadow-burst", 20);
  const afterShadow = suite.calls();
  const shadowDelta = summarizeCallDelta(beforeShadow, afterShadow);
  const shadowStats = await callToolRaw(client, "comparison_stats", {
    project_id: null,
    cluster_id: "shadow-burst"
  });

  const beforeSingleRouter = suite.calls();
  const singleRouter = await callToolRaw(client, "router_consult", {
    project_id: null,
    cluster_id: "shadow-burst",
    question: "Single explicit cluster router consult for max call accounting."
  });
  await waitForJudgedComparisons(client, "shadow-burst", 21);
  const afterSingleRouter = suite.calls();

  zone.checks.push({
    id: "always_stale_same_question_30",
    status:
      sameResults.every((result) => result.ok) &&
      (sameDelta.by_type.consult ?? 0) === 1 &&
      (sameDelta.by_type.cluster_consult ?? 0) === 0 &&
      (countBy(sameEvents, "event_type").cluster_fallback_to_claude_consult ?? 0) === 1
        ? "HELD"
        : "BROKEN",
    input: "30 sequential cluster_consult calls; evidence file changed before every call; same question.",
    expected_edge: "Should not grow linearly or exponentially for identical fallback question inside cache TTL.",
    observed: {
      result_summary: summarizeResultList(sameResults),
      claude_call_delta: sameDelta,
      total_cost_usd: sameDelta.cost_usd,
      event_counts: countBy(sameEvents, "event_type")
    }
  });
  zone.checks.push({
    id: "always_stale_unique_questions_30",
    status:
      uniqueResults.every((result) => result.ok) &&
      (uniqueDelta.by_type.consult ?? 0) === 30 &&
      (countBy(uniqueEvents, "event_type").evidence_revalidation_failed ?? 0) === 1 &&
      (countBy(uniqueEvents, "event_type").evidence_revalidation_suppressed ?? 0) === 29
        ? "HELD"
        : "BROKEN",
    input: "30 sequential cluster_consult calls; evidence file changed before every call; unique questions.",
    expected_edge: "Should be linear at worst: one fallback per unique question, no repeated revalidation and no recursive loop.",
    observed: {
      result_summary: summarizeResultList(uniqueResults),
      claude_call_delta: uniqueDelta,
      total_cost_usd: uniqueDelta.cost_usd,
      event_counts: countBy(uniqueEvents, "event_type")
    }
  });
  zone.checks.push({
    id: "shadow_eval_burst_20",
    status:
      shadowResults.every((result) => result.ok) &&
      (shadowDelta.by_type.cluster_consult ?? 0) === 20 &&
      (shadowDelta.by_type.shadow_direct ?? 0) === 20 &&
      (shadowDelta.by_type.judge ?? 0) === 20
        ? "HELD"
        : "BROKEN",
    input: "20 fast cluster_consult calls against fresh cluster with shadow_mode=true.",
    expected_edge: "Shadow eval is bounded to cluster call + direct baseline + judge per successful cluster consult.",
    observed: {
      result_summary: summarizeResultList(shadowResults),
      claude_call_delta: shadowDelta,
      comparison_stats: summarizeRawResult(shadowStats)
    }
  });
  zone.checks.push({
    id: "single_router_consult_max_claude_calls",
    status:
      singleRouter.ok === true &&
      (summarizeCallDelta(beforeSingleRouter, afterSingleRouter).by_type.cluster_consult ?? 0) === 1 &&
      (summarizeCallDelta(beforeSingleRouter, afterSingleRouter).by_type.shadow_direct ?? 0) === 1 &&
      (summarizeCallDelta(beforeSingleRouter, afterSingleRouter).by_type.judge ?? 0) === 1
        ? "HELD"
        : "BROKEN",
    input: "One router_consult with explicit cluster_id and shadow_mode=true.",
    expected_edge: "Caller-path max should be one Claude call before answer; shadow adds two async telemetry calls after.",
    observed: {
      result: summarizeRawResult(singleRouter),
      claude_call_delta_including_shadow: summarizeCallDelta(beforeSingleRouter, afterSingleRouter),
      max_before_caller_answer: 1,
      max_total_with_shadow: 3
    }
  });
  report.zones.push(zone);
}

function createSuite(name, options) {
  const root = mkdtempSync(path.join(os.tmpdir(), `asr-adversarial-${name}-`));
  const projectDir = path.join(root, "project");
  const homeDir = path.join(root, "home");
  const fakeClaudePath = path.join(root, "fake-claude.mjs");
  const fakeCallsPath = path.join(root, "fake-claude-calls.jsonl");
  const dbPath = path.join(projectDir, ".claude-session-router", "sessions.sqlite");
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(homeDir, { recursive: true });
  mkdirSync(path.join(projectDir, "src"), { recursive: true });
  writeReadme(projectDir);
  writeEvidence({ projectDir });
  writeFakeClaude(fakeClaudePath, fakeCallsPath);
  writeRouterConfig(projectDir, fakeClaudePath, options);
  return {
    name,
    root,
    projectDir,
    homeDir,
    fakeClaudePath,
    fakeCallsPath,
    dbPath,
    publicInfo: {
      name,
      project_dir: projectDir,
      db_path: dbPath,
      shadow_mode: options.shadowMode,
      max_consults_per_hour: options.maxConsultsPerHour,
      max_consults_per_day: options.maxConsultsPerDay
    },
    calls: () => readFakeCalls(fakeCallsPath),
    cleanup: () => {
      if (!keepTemp) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  };
}

async function withClient(suite, fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: suite.projectDir,
    env: { ...process.env, HOME: suite.homeDir },
    stderr: "pipe"
  });
  const stderr = [];
  transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
  const client = new Client({ name: `adversarial-proof-${suite.name}`, version: "0.1.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    suite.publicInfo.server_stderr = stderr.join("");
    await client.close();
  }
}

async function timedCall(client, name, input, timeout = 120_000) {
  const started = Date.now();
  const result = await callToolRaw(client, name, input, timeout);
  return { ...result, duration_ms: Date.now() - started };
}

async function callToolRaw(client, name, input, timeout = 120_000) {
  try {
    const result = await client.callTool({ name, arguments: input }, undefined, { timeout });
    const payload = parseToolPayload(result);
    return {
      ok: !result.isError && !payload?.error,
      is_error: Boolean(result.isError),
      payload
    };
  } catch (error) {
    return {
      ok: false,
      thrown: true,
      error_message: error instanceof Error ? error.message : String(error)
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
    return { raw_text: text };
  }
}

async function prepareEvidenceCluster(client, clusterId) {
  const result = await callToolRaw(client, "cluster_prepare", {
    project_id: null,
    cluster_id: clusterId,
    name: clusterId,
    tool_profile_default: "bare",
    static_factsheet_policy: "allow",
    verification_mode: "static",
    factsheet: {
      summary: "Adversarial proof factsheet.",
      facts: [
        {
          id: "stable-selector-fact",
          claim: "The evidence file exposes stableSelector as local evidence.",
          evidence: [{ path: "src/evidence.ts", selector: "stableSelector" }]
        }
      ],
      forbidden_inferences: ["Do not infer deleted selectors."]
    }
  });
  if (!result.ok) {
    throw new Error(`cluster_prepare ${clusterId} failed: ${JSON.stringify(result)}`);
  }
  return result.payload;
}

function writeReadme(projectDir) {
  writeFileSync(
    path.join(projectDir, "README.md"),
    [
      "# Adversarial Proof Project",
      "",
      "This fixture exercises AgentSessionRouter through public MCP calls.",
      "The router must answer callers through cache or fallback and expose telemetry through monitor tools."
    ].join("\n"),
    "utf8"
  );
}

function writeEvidence(suiteOrProject, options = {}) {
  const projectDir = suiteOrProject.projectDir ?? suiteOrProject;
  const leading = options.leading ?? [];
  const selectorLine = options.selectorLine ?? "export const stableSelector = 'v1';";
  writeFileSync(
    path.join(projectDir, "src", "evidence.ts"),
    [
      ...leading,
      "const stableHeaderOne = 1;",
      "const stableHeaderTwo = 2;",
      "const stableHeaderThree = 3;",
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

function mutateEvidence(suite, options = {}) {
  writeEvidence(suite, options);
}

function writeRouterConfig(projectDir, fakeClaudePath, options) {
  writeFileSync(
    path.join(projectDir, "router.config.toml"),
    `[storage]
db_path = ".claude-session-router/sessions.sqlite"
raw_logs_dir = ".claude-session-router/raw"

[limits]
max_consults_per_hour = ${options.maxConsultsPerHour}
max_consults_per_day = ${options.maxConsultsPerDay}
max_tokens_per_consult = ${options.maxTokensPerConsult}

[claude]
command = "${fakeClaudePath.replaceAll("\\", "\\\\")}"
command_timeout_ms = 30000
extra_args = ["--tools", ""]

[eval]
shadow_mode = ${options.shadowMode ? "true" : "false"}

[cluster]
auto_refresh = true
auto_refresh_min_retained_ratio = 1.0
static_factsheet_policy = "deny"
`,
    "utf8"
  );
}

function writeFakeClaude(fakeClaudePath, fakeCallsPath) {
  writeFileSync(
    fakeClaudePath,
    [
      "#!/usr/bin/env node",
      "import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
      "import os from 'node:os';",
      "import path from 'node:path';",
      `const callsPath = ${JSON.stringify(fakeCallsPath)};`,
      "const seqPath = `${callsPath}.seq`;",
      "const args = process.argv.slice(2);",
      "const prompt = args.at(-1) ?? '';",
      "const all = args.join('\\n');",
      "const now = new Date().toISOString();",
      "let seq = 0;",
      "try { seq = Number(readFileSync(seqPath, 'utf8')) || 0; } catch {}",
      "seq += 1;",
      "writeFileSync(seqPath, String(seq));",
      "if (args.includes('--version')) {",
      "  appendFileSync(callsPath, JSON.stringify({ seq, at: now, type: 'version', args }) + '\\n');",
      "  console.log('2.1.92 (Claude Code)');",
      "  process.exit(0);",
      "}",
      "let type = 'consult';",
      "if (prompt === 'ping') type = 'health_ping';",
      "else if (prompt.includes('PROFILE_OK')) type = 'profile_probe';",
      "else if (prompt.includes('You are verifying a cluster factsheet')) type = 'verifier';",
      "else if (prompt.includes('You are evaluating two answers')) type = 'judge';",
      "else if (prompt.includes('shadow evaluation baseline')) type = 'shadow_direct';",
      "else if (all.includes('AgentSessionRouter cluster_consult')) type = 'cluster_consult';",
      "const resumeIndex = args.indexOf('--resume');",
      "const resumeSessionId = resumeIndex >= 0 ? args[resumeIndex + 1] : null;",
      "const sessionId = resumeSessionId || `fake-${seq}`;",
      "const sessionDir = path.join(os.homedir(), '.claude', 'sessions');",
      "mkdirSync(sessionDir, { recursive: true });",
      "appendFileSync(path.join(sessionDir, `${sessionId}.jsonl`), '{}\\n');",
      "let result = 'Generic consult answer.\\n\\nSESSION_UPDATE_JSON:\\n{\\n  \"summary\": \"Adversarial proof consult completed.\",\\n  \"decisions\": [\"Router returned a caller-facing answer\"],\\n  \"open_questions\": [],\\n  \"files_discussed\": [\"src/evidence.ts\"],\\n  \"tags\": [\"adversarial\"],\\n  \"aliases\": [\"proof\"]\\n}';",
      "if (type === 'health_ping') result = 'pong';",
      "else if (type === 'profile_probe') result = 'PROFILE_OK';",
      "else if (type === 'verifier') {",
      "  const ids = [...prompt.matchAll(/\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"/g)].map((m) => m[1]);",
      "  result = JSON.stringify({ facts: [...new Set(ids)].map((id) => ({ id, verdict: 'VERIFIED', reason: 'supported by supplied evidence' })) });",
      "} else if (type === 'judge') {",
      "  result = JSON.stringify({ answer_a_score: 3, answer_a_errors: [], answer_b_score: 3, answer_b_errors: [], preferred: 'tie', reasoning: 'Both answers are adequate for adversarial telemetry.' });",
      "} else if (type === 'shadow_direct') {",
      "  result = 'Direct fresh baseline answer for adversarial telemetry.';",
      "} else if (type === 'cluster_consult') {",
      "  result = 'Cluster factsheet answer for adversarial telemetry.';",
      "}",
      "const tokensIn = Math.ceil((prompt.length + all.length) / 4);",
      "const tokensOut = Math.ceil(result.length / 4);",
      "const cost = Number(((tokensIn * 0.000003) + (tokensOut * 0.000015)).toFixed(6));",
      "appendFileSync(callsPath, JSON.stringify({ seq, at: now, type, resumeSessionId, tokensIn, tokensOut, cost, prompt: prompt.slice(0, 160) }) + '\\n');",
      "console.log(JSON.stringify({ session_id: sessionId, result, input_tokens: tokensIn, output_tokens: tokensOut, total_cost_usd: cost, model: 'fake-proof', num_turns: 1 }));"
    ].join("\n"),
    "utf8"
  );
  chmodSync(fakeClaudePath, 0o755);
}

async function waitForJudgedComparisons(client, clusterId, expected, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const stats = await callToolRaw(client, "comparison_stats", { project_id: null, cluster_id: clusterId });
    const row = stats.payload?.stats?.find((item) => item.cluster_id === clusterId);
    if ((row?.judged ?? row?.n ?? 0) >= expected) {
      return row;
    }
    await sleep(100);
  }
  return null;
}

function readFakeCalls(fakeCallsPath) {
  if (!existsSync(fakeCallsPath)) {
    return [];
  }
  return readFileSync(fakeCallsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function summarizeCallDelta(before, after) {
  const delta = after.slice(before.length);
  const byType = {};
  let costUsd = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  for (const call of delta) {
    byType[call.type] = (byType[call.type] ?? 0) + 1;
    costUsd += call.cost ?? 0;
    tokensIn += call.tokensIn ?? 0;
    tokensOut += call.tokensOut ?? 0;
  }
  return {
    total: delta.length,
    by_type: byType,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: Number(costUsd.toFixed(6)),
    calls: delta.map((call) => ({
      seq: call.seq,
      type: call.type,
      resumeSessionId: call.resumeSessionId ?? null,
      tokensIn: call.tokensIn ?? null,
      tokensOut: call.tokensOut ?? null,
      cost: call.cost ?? null
    }))
  };
}

function summarizeRawResult(result) {
  if (result.thrown) {
    return { ok: false, thrown: true, error_message: result.error_message };
  }
  const payload = result.payload ?? {};
  return {
    ok: result.ok,
    is_error: result.is_error,
    error_code: payload.error?.code ?? null,
    keys: Object.keys(payload).slice(0, 20),
    selected_path: payload.route_decision?.selected_path ?? null,
    session_id: payload.session_id ?? null,
    cluster_id: payload.cluster_id ?? null,
    factsheet_status: payload.factsheet_status ?? null,
    trust_state: payload.trust_state ?? null,
    metrics: payload.metrics ?? null,
    rejudged_count: Array.isArray(payload.rejudged) ? payload.rejudged.length : null
  };
}

function summarizeResultList(results) {
  const byError = {};
  for (const result of results) {
    const code = result.payload?.error?.code ?? (result.ok ? "ok" : "thrown_or_unknown");
    byError[code] = (byError[code] ?? 0) + 1;
  }
  return {
    total: results.length,
    ok: results.filter((result) => result.ok).length,
    by_result: byError
  };
}

function zoneRecord(id, title) {
  return { id, title, checks: [] };
}

function clusterEvents(suite, clusterId) {
  if (!existsSync(suite.dbPath)) {
    return [];
  }
  const db = new Database(suite.dbPath, { readonly: true });
  try {
    return db
      .prepare("SELECT event_type, details_json, created_at FROM cluster_events WHERE cluster_id = ? ORDER BY id")
      .all(clusterId)
      .map((row) => ({
        event_type: row.event_type,
        details: safeJson(row.details_json),
        created_at: row.created_at
      }));
  } finally {
    db.close();
  }
}

function clusterById(suite, clusterId) {
  if (!existsSync(suite.dbPath)) {
    return null;
  }
  const db = new Database(suite.dbPath, { readonly: true });
  try {
    return db.prepare("SELECT id, status, trust_state, static_factsheet_policy FROM clusters WHERE id = ?").get(clusterId) ?? null;
  } finally {
    db.close();
  }
}

function sessionById(suite, sessionId) {
  if (!existsSync(suite.dbPath) || !sessionId) {
    return null;
  }
  const db = new Database(suite.dbPath, { readonly: true });
  try {
    const row = db
      .prepare("SELECT id, topic, summary, status FROM sessions WHERE id = ?")
      .get(sessionId);
    if (!row) {
      return null;
    }
    return {
      ...row,
      files_discussed: db.prepare("SELECT path FROM session_files WHERE session_id = ? ORDER BY path").all(sessionId).map((item) => item.path),
      tags: db.prepare("SELECT tag FROM session_tags WHERE session_id = ? ORDER BY tag").all(sessionId).map((item) => item.tag)
    };
  } finally {
    db.close();
  }
}

function sessionCount(suite) {
  const db = new Database(suite.dbPath, { readonly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n;
  } finally {
    db.close();
  }
}

function seedScaleSessions(suite, count) {
  const now = new Date().toISOString();
  const db = new Database(suite.dbPath);
  const sessionDir = path.join(suite.homeDir, ".claude", "sessions");
  mkdirSync(sessionDir, { recursive: true });
  const insertSession = db.prepare(
    `INSERT INTO sessions (
       id, project_id, claude_session_id, topic, summary, status, ttl_days,
       dormant_after_days, archive_after_days, archived_at, last_used, created_at
     ) VALUES (?, ?, ?, ?, ?, 'active', 30, 30, 90, NULL, ?, ?)`
  );
  const insertFile = db.prepare("INSERT OR IGNORE INTO session_files (session_id, path, created_at) VALUES (?, ?, ?)");
  const insertTag = db.prepare("INSERT OR IGNORE INTO session_tags (session_id, tag, created_at) VALUES (?, ?, ?)");
  const insertDecision = db.prepare("INSERT OR IGNORE INTO session_decisions (session_id, decision, created_at) VALUES (?, ?, ?)");
  const tx = db.transaction(() => {
    for (let index = 0; index < count; index += 1) {
      const id = `seed-scale-${index}`;
      const claudeSessionId = `seed-claude-scale-${index}`;
      const topic = `scale topic ${index}`;
      const file = index % 2 === 0 ? `src/domain-${index}.ts` : `src/shared-${index % 10}.ts`;
      insertSession.run(id, "project", claudeSessionId, topic, `Seeded scale session ${index}`, now, now);
      insertFile.run(id, file, now);
      insertTag.run(id, "scale", now);
      insertTag.run(id, `topic-${index}`, now);
      insertDecision.run(id, `Seeded routing decision for ${topic}`, now);
      writeFileSync(path.join(sessionDir, `${claudeSessionId}.jsonl`), "{}\n", "utf8");
    }
  });
  try {
    tx();
  } finally {
    db.close();
  }
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  }
  return counts;
}

function hasEvent(events, eventType) {
  return events.some((event) => event.event_type === eventType);
}

function safeJson(source) {
  try {
    return source ? JSON.parse(source) : null;
  } catch {
    return source;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderSummary(source) {
  const lines = [
    "# Adversarial Proof Matrix",
    "",
    `Started: ${source.started_at}`,
    `Finished: ${source.finished_at ?? ""}`,
    "",
    "## Findings",
    ""
  ];
  for (const zone of source.zones) {
    lines.push(`### ${zone.id}: ${zone.title}`, "");
    for (const check of zone.checks) {
      lines.push(`- ${check.status}: ${check.id}`);
      lines.push(`  - input: ${check.input}`);
      lines.push(`  - edge: ${check.expected_edge}`);
      if (check.observed?.claude_call_delta) {
        lines.push(
          `  - claude_delta: total=${check.observed.claude_call_delta.total}, by_type=${JSON.stringify(
            check.observed.claude_call_delta.by_type
          )}, cost=$${check.observed.claude_call_delta.cost_usd}`
        );
      }
      if (check.observed?.event_counts) {
        lines.push(`  - event_counts: ${JSON.stringify(check.observed.event_counts)}`);
      }
      if (check.observed?.latency_before_sessions_ms !== undefined) {
        lines.push(
          `  - latency: before=${check.observed.latency_before_sessions_ms}ms, after=${check.observed.latency_after_router_consult_ms}ms`
        );
        if (check.observed.seeded_scale_sessions !== undefined) {
          lines.push(
            `  - scale: seeded=${check.observed.seeded_scale_sessions}, total_sessions=${check.observed.total_session_count}`
          );
        }
      }
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
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

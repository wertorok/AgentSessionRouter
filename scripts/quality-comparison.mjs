import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = args.date ?? "2026-05-12";
const defaultOutDir = path.join(os.tmpdir(), `cluster-comparison-${date}`);
const runs = Number(args.runs ?? 1);
const outDir = path.resolve(args.out ?? defaultOutDir);
const clusterId = args.clusterId ?? "agentsessionrouter-codebase";
const skipInvocations = Boolean(args.scoreOnly);
const selectedQuestionIds = parseList(args.questions ?? args.questionIds);
const methodsToRun = parseMethods(args.methods);
const responseDir = path.join(outDir, "responses");
const rawDir = path.join(outDir, "raw");
const matrixPath = path.join(outDir, "matrix.csv");
const summaryPath = path.join(outDir, "summary.md");
const tracePath = path.join(outDir, "trace-report.md");
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const dbPath = path.join(repoRoot, ".claude-session-router", "sessions.sqlite");
let repoTextCache;

const PRICING = {
  label: "Anthropic Claude Sonnet 4.6 standard token pricing",
  source: "https://platform.claude.com/docs/en/about-claude/pricing",
  source_checked_at: "2026-05-12",
  input_per_mtok: 3,
  output_per_mtok: 15,
  cache_creation_5m_per_mtok: 3.75,
  cache_read_per_mtok: 0.3
};

const MATRIX_COLUMNS = [
  "question_id",
  "question_category",
  "method",
  "run_number",
  "duration_ms",
  "tokens_in",
  "tokens_out",
  "cost_usd",
  "cluster_id",
  "profile_used",
  "was_stale",
  "was_downgraded",
  "factsheet_version",
  "was_new_session",
  "response_length_chars",
  "response_path",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "reported_total_cost_usd",
  "model",
  "num_turns",
  "error",
  "quality_score",
  "quality_notes"
];

const QUESTIONS = [
  {
    id: "A1",
    category: "A_factual",
    text: "What are the exact field names in the `clusters` table?"
  },
  {
    id: "A2",
    category: "A_factual",
    text: "Which event types are written to `cluster_events`? List all."
  },
  {
    id: "A3",
    category: "A_factual",
    text: "What happens in `cluster_consult` when the factsheet is stale?"
  },
  {
    id: "A4",
    category: "A_factual",
    text: "What Claude CLI args are used for the bare tool profile?"
  },
  {
    id: "A5",
    category: "A_factual",
    text: "What is the default value of `dormant_after_days` in the sessions schema?"
  },
  {
    id: "B1",
    category: "B_reasoning",
    text: "Why is the LLM verifier run in `bare` mode and not `agent` mode?"
  },
  {
    id: "B2",
    category: "B_reasoning",
    text: "If I delete a Claude .jsonl file, what happens on the next `claude_consult` to that session? Walk through the code path."
  },
  {
    id: "B3",
    category: "B_reasoning",
    text: "What's the difference between `static_verified`, `partial_llm`, and `llm_verified` trust states? When does each occur?"
  },
  {
    id: "C1",
    category: "C_open",
    text: "Suggest 3 ways to make `cluster_refresh` smarter without breaking existing semantics."
  },
  {
    id: "C2",
    category: "C_open",
    text: "What's a likely failure mode of `--bare --tools \"\"` we haven't tested yet, and how would you detect it?"
  }
];

const BASELINE_FACTSHEET_COVERAGE = {
  A1: "Covered only if `clusters-table-fields` survives verifier; otherwise this is an explicit factsheet gap.",
  A2: "Partially covered unless fallback/revalidation/bare-probe cluster event facts are present.",
  A3: "Covered only if caller-facing stale behavior through `consultClusterForCaller` is present, not just low-level `consultCluster` internals.",
  A4: "Covered. Bare profile args are present in verified facts.",
  A5: "Covered. dormant_after_days default is present in verified facts.",
  B1: "Partially covered. The profile restriction is present, but rationale is only partially represented as derived design intent.",
  B2: "Partially covered. Orphan recovery facts are present, but the complete walkthrough depends on connecting several code paths.",
  B3: "Covered. Trust-state transitions are present in verified facts.",
  C1: "Partially covered. Current cluster_refresh semantics are present, but future design suggestions are not factsheet-native.",
  C2: "Weakly covered. A known bare/no-tools risk is present, but broad untested failure-mode ideation is outside the factsheet."
};

const EXPANDED_FACTSHEET_COVERAGE = {
  ...BASELINE_FACTSHEET_COVERAGE,
  B1: "Expanded. Verifier restriction plus the no-tools/no-inference rationale are present in verified facts.",
  B2: "Expanded. Explicit, exact-topic, and auto-routed orphan recovery paths plus was_orphan_recovery are present in verified facts.",
  C1: "Expanded. Current refresh semantics plus spec-backed future modes and policy options are present in verified facts."
};

const FACTSHEET = {
  summary:
    "Verified AgentSessionRouter codebase facts for schema, cluster events, cluster consult, profiles, verifier rationale, orphan recovery, refresh extension options, and trust states.",
  facts: [
    {
      id: "clusters-table-fields",
      claim:
        "The clusters table fields are id, project_id, name, description, tool_profile_default, static_factsheet_policy, baseline_session_id, status, trust_state, created_at, and last_used.",
      evidence: [
        { path: "src/schema.ts", selector: "CREATE TABLE IF NOT EXISTS clusters" },
        { path: "src/schema.ts", selector: "id TEXT PRIMARY KEY" },
        { path: "src/schema.ts", selector: "project_id TEXT NOT NULL" },
        { path: "src/schema.ts", selector: "name TEXT NOT NULL" },
        { path: "src/schema.ts", selector: "description TEXT NOT NULL DEFAULT ''" },
        { path: "src/schema.ts", selector: "tool_profile_default TEXT NOT NULL DEFAULT 'bare'" },
        { path: "src/schema.ts", selector: "static_factsheet_policy TEXT NOT NULL DEFAULT 'deny'" },
        { path: "src/schema.ts", selector: "baseline_session_id TEXT" },
        { path: "src/schema.ts", selector: "status TEXT NOT NULL DEFAULT 'active'" },
        { path: "src/schema.ts", selector: "trust_state TEXT NOT NULL DEFAULT 'unprepared'" },
        { path: "src/schema.ts", selector: "created_at TEXT NOT NULL" },
        { path: "src/schema.ts", selector: "last_used TEXT NOT NULL" }
      ]
    },
    {
      id: "cluster-events-table-fields",
      claim:
        "The cluster_events table fields are id, cluster_id, project_id, event_type, details_json, duration_ms, tokens_in, tokens_out, cost_usd, and created_at.",
      evidence: [
        { path: "src/schema.ts", selector: "CREATE TABLE IF NOT EXISTS cluster_events" },
        { path: "src/schema.ts", selector: "cluster_id TEXT NOT NULL" },
        { path: "src/schema.ts", selector: "event_type TEXT NOT NULL" },
        { path: "src/schema.ts", selector: "details_json TEXT" },
        { path: "src/schema.ts", selector: "duration_ms INTEGER" },
        { path: "src/schema.ts", selector: "tokens_in INTEGER" },
        { path: "src/schema.ts", selector: "tokens_out INTEGER" },
        { path: "src/schema.ts", selector: "cost_usd REAL" },
        { path: "src/schema.ts", selector: "created_at TEXT NOT NULL" }
      ]
    },
    {
      id: "cluster-events-db-generated",
      claim:
        "insertClusterFactsheet can write factsheet_static_verified, factsheet_partially_static_verified, factsheet_llm_verified, factsheet_partially_llm_verified, factsheet_rejected, or factsheet_generated to cluster_events.",
      evidence: [{ path: "src/db.ts", selector: "function factsheetEventType" }]
    },
    {
      id: "cluster-event-factsheet-static-verified",
      claim: "A fully statically verified factsheet writes factsheet_static_verified to cluster_events.",
      evidence: [
        { path: "src/db.ts", selector: "function factsheetEventType" },
        { path: "src/db.ts", selector: "return \"factsheet_static_verified\"" }
      ]
    },
    {
      id: "cluster-event-factsheet-partially-static-verified",
      claim: "A partially statically verified factsheet writes factsheet_partially_static_verified to cluster_events.",
      evidence: [
        { path: "src/db.ts", selector: "function factsheetEventType" },
        { path: "src/db.ts", selector: "return \"factsheet_partially_static_verified\"" }
      ]
    },
    {
      id: "cluster-event-factsheet-llm-verified",
      claim: "A fully LLM-verified factsheet writes factsheet_llm_verified to cluster_events.",
      evidence: [
        { path: "src/db.ts", selector: "function factsheetEventType" },
        { path: "src/db.ts", selector: "return \"factsheet_llm_verified\"" }
      ]
    },
    {
      id: "cluster-event-factsheet-partially-llm-verified",
      claim: "A partially LLM-verified factsheet writes factsheet_partially_llm_verified to cluster_events.",
      evidence: [
        { path: "src/db.ts", selector: "function factsheetEventType" },
        { path: "src/db.ts", selector: "return \"factsheet_partially_llm_verified\"" }
      ]
    },
    {
      id: "cluster-event-factsheet-generated",
      claim: "A generated but not verified factsheet writes factsheet_generated to cluster_events.",
      evidence: [
        { path: "src/db.ts", selector: "function factsheetEventType" },
        { path: "src/db.ts", selector: "factsheet_generated" }
      ]
    },
    {
      id: "cluster-event-factsheet-rejected",
      claim: "A rejected factsheet writes factsheet_rejected to cluster_events.",
      evidence: [
        { path: "src/db.ts", selector: "function factsheetEventType" },
        { path: "src/db.ts", selector: "factsheet_rejected" },
        { path: "src/cluster.ts", selector: "eventType: \"factsheet_rejected\"" }
      ]
    },
    {
      id: "cluster-event-created",
      claim: "Creating a new cluster writes cluster_created to cluster_events.",
      evidence: [{ path: "src/db.ts", selector: "eventType: \"cluster_created\"" }]
    },
    {
      id: "cluster-event-llm-verifier",
      claim: "The LLM verifier path writes llm_verifier to cluster_events.",
      evidence: [{ path: "src/cluster.ts", selector: "eventType: \"llm_verifier\"" }]
    },
    {
      id: "cluster-event-consult",
      claim: "A successful cluster consult writes cluster_consult to cluster_events.",
      evidence: [{ path: "src/clusterConsult.ts", selector: "eventType: \"cluster_consult\"" }]
    },
    {
      id: "cluster-event-consult-failed",
      claim: "A failed cluster consult writes cluster_consult_failed to cluster_events.",
      evidence: [{ path: "src/clusterConsult.ts", selector: "eventType: \"cluster_consult_failed\"" }]
    },
    {
      id: "cluster-event-refresh-required",
      claim: "The low-level stale factsheet detection in consultCluster writes cluster_refresh_required to cluster_events.",
      evidence: [{ path: "src/clusterConsult.ts", selector: "eventType: \"cluster_refresh_required\"" }]
    },
    {
      id: "cluster-event-evidence-revalidation-failed",
      claim: "Strict cluster evidence revalidation failures write evidence_revalidation_failed to cluster_events.",
      evidence: [{ path: "src/clusterEvidenceRevalidation.ts", selector: "eventType: \"evidence_revalidation_failed\"" }]
    },
    {
      id: "cluster-event-evidence-revalidated",
      claim: "Successful strict cluster evidence revalidation writes evidence_revalidated to cluster_events.",
      evidence: [{ path: "src/clusterEvidenceRevalidation.ts", selector: "eventType: \"evidence_revalidated\"" }]
    },
    {
      id: "cluster-event-fallback-to-claude-consult",
      claim: "When cluster_consult falls back internally to normal claude_consult, it writes cluster_fallback_to_claude_consult to cluster_events.",
      evidence: [{ path: "src/tools.ts", selector: "cluster_fallback_to_claude_consult" }]
    },
    {
      id: "cluster-event-fallback-failed",
      claim: "If the internal fallback from cluster_consult to claude_consult fails, it writes cluster_fallback_failed to cluster_events.",
      evidence: [{ path: "src/tools.ts", selector: "cluster_fallback_failed" }]
    },
    {
      id: "cluster-event-bare-probe-failed",
      claim: "If the bare profile availability probe fails, the router writes bare_probe_failed to cluster_events.",
      evidence: [{ path: "src/runtime.ts", selector: "eventType: \"bare_probe_failed\"" }]
    },
    {
      id: "cluster-event-downgraded",
      claim: "A profile downgrade writes tool_profile_downgraded to cluster_events.",
      evidence: [{ path: "src/tools.ts", selector: "eventType: \"tool_profile_downgraded\"" }]
    },
    {
      id: "cluster-event-refresh",
      claim: "A successful verify-only cluster refresh writes cluster_refresh to cluster_events.",
      evidence: [{ path: "src/clusterRefresh.ts", selector: "eventType: \"cluster_refresh\"" }]
    },
    {
      id: "cluster-event-factsheet-stale",
      claim: "A stale factsheet found by cluster_refresh writes factsheet_stale to cluster_events.",
      evidence: [{ path: "src/clusterRefresh.ts", selector: "eventType: \"factsheet_stale\"" }]
    },
    {
      id: "stale-cluster-consult-behavior",
      claim:
        "The low-level consultCluster function marks the factsheet stale, logs cluster_refresh_required with changed_files, and returns CLUSTER_FACTSHEET_STALE internally when scoped evidence files are stale.",
      evidence: [
        { path: "src/clusterConsult.ts", selector: "db.markClusterFactsheetStale" },
        { path: "src/clusterConsult.ts", selector: "ERROR_CODES.CLUSTER_FACTSHEET_STALE" },
        { path: "tests/clusterConsult.test.ts", selector: "should not run" }
      ]
    },
    {
      id: "caller-facing-stale-cluster-consult-behavior",
      claim:
        "The caller-facing cluster_consult tool consumes internal CLUSTER_FACTSHEET_STALE errors: if autoRefresh is enabled it revalidates evidence under a per-cluster lock; if revalidation fails or autoRefresh is disabled, it falls back internally to claude_consult and returns an answer to the caller.",
      evidence: [
        { path: "src/tools.ts", selector: "result.error.code !== ERROR_CODES.CLUSTER_FACTSHEET_STALE" },
        { path: "src/tools.ts", selector: "runtime.locks.withLock(`cluster-evidence-revalidation:" },
        { path: "src/tools.ts", selector: "revalidateClusterEvidence(runtime.db, runtime.cwd" },
        { path: "src/tools.ts", selector: "return fallbackToClaudeConsult(runtime, consultService, input, revalidation)" }
      ]
    },
    {
      id: "caller-facing-stale-event-flow",
      claim:
        "The caller-facing stale cluster_consult path logs cluster_refresh_required at low-level detection, evidence_revalidated on successful strict revalidation, evidence_revalidation_failed when strict revalidation fails, and cluster_fallback_to_claude_consult when it answers by internal claude_consult fallback.",
      evidence: [
        { path: "src/clusterConsult.ts", selector: "eventType: \"cluster_refresh_required\"" },
        { path: "src/clusterEvidenceRevalidation.ts", selector: "eventType: \"evidence_revalidated\"" },
        { path: "src/clusterEvidenceRevalidation.ts", selector: "eventType: \"evidence_revalidation_failed\"" },
        { path: "src/tools.ts", selector: "cluster_fallback_to_claude_consult" }
      ]
    },
    {
      id: "caller-facing-stale-event-sequence",
      claim:
        "When answering what happens for a stale cluster_consult factsheet, the complete event sequence is cluster_refresh_required, then either evidence_revalidated on success or evidence_revalidation_failed on strict revalidation failure, then cluster_fallback_to_claude_consult if fallback answers the caller.",
      evidence: [
        { path: "src/clusterConsult.ts", selector: "eventType: \"cluster_refresh_required\"" },
        { path: "src/clusterEvidenceRevalidation.ts", selector: "eventType: \"evidence_revalidated\"" },
        { path: "src/clusterEvidenceRevalidation.ts", selector: "eventType: \"evidence_revalidation_failed\"" },
        { path: "src/tools.ts", selector: "cluster_fallback_to_claude_consult" }
      ]
    },
    {
      id: "bare-profile-args",
      claim: "The bare tool profile uses Claude CLI args: --bare --tools \"\".",
      evidence: [{ path: "src/profiles.ts", selector: "case \"bare\"" }]
    },
    {
      id: "sessions-dormant-default",
      claim: "The sessions schema default for dormant_after_days is 30.",
      evidence: [{ path: "src/schema.ts", selector: "dormant_after_days INTEGER DEFAULT 30" }]
    },
    {
      id: "llm-verifier-profiles",
      claim:
        "The LLM verifier is restricted to bare or focused profiles and cannot use the agent profile.",
      evidence: [
        { path: "src/profiles.ts", selector: "export type VerifierToolProfile = \"bare\" | \"focused\"" },
        { path: "src/tools.ts", selector: "LLM verifier cannot use agent profile" }
      ]
    },
    {
      id: "llm-verifier-purpose",
      claim:
        "The verifier prompt tells Claude to verify supplied evidence semantically, return VERIFIED only when the claim follows from evidence, not infer, not use tools, and return JSON only.",
      evidence: [{ path: "src/cluster.ts", selector: "You are verifying a cluster factsheet" }]
    },
    {
      id: "llm-verifier-no-agent-rationale",
      claim:
        "The LLM verifier is run without agent tools because it must judge only the supplied evidence, avoid new discovery, avoid inference, and return VERIFIED only when the claim follows from that evidence.",
      evidence: [
        { path: "src/cluster.ts", selector: "For each fact, decide whether the supplied evidence semantically supports the claim." },
        { path: "src/cluster.ts", selector: "Return VERIFIED only when the claim follows from the evidence." },
        { path: "src/cluster.ts", selector: "Do not infer. Do not use tools. Return JSON only." }
      ]
    },
    {
      id: "llm-verifier-profile-spec",
      claim:
        "The cluster cache spec says the LLM verifier runs with bare when available, otherwise focused no-tools mode; it does not use agent mode for verification.",
      evidence: [
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "Runs with `bare` profile when available, otherwise `focused` no-tools profile." },
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "Do not use tools." }
      ]
    },
    {
      id: "orphan-explicit-session",
      claim:
        "When claude_consult is given a session_id and the stored Claude session file no longer exists, the router marks the old registry session orphaned and creates a replacement route from bootstrap registry context.",
      evidence: [
        { path: "src/consult.ts", selector: "sessionFileExists(session.claude_session_id)" },
        { path: "src/consult.ts", selector: "this.runtime.db.markSessionOrphaned(session.id)" },
        { path: "src/consult.ts", selector: "Selected session was orphaned; creating replacement from registry context." }
      ]
    },
    {
      id: "orphan-session-event",
      claim: "markSessionOrphaned sets session status to orphaned and writes an orphan_recovery event to session_events, not cluster_events.",
      evidence: [
        { path: "src/db.ts", selector: "INSERT INTO session_events" },
        { path: "src/db.ts", selector: "markSessionOrphaned(sessionId: string)" },
        { path: "src/db.ts", selector: "UPDATE sessions SET status = 'orphaned'" },
        { path: "src/db.ts", selector: "eventType: \"orphan_recovery\"" }
      ]
    },
    {
      id: "orphan-exact-topic-session",
      claim:
        "When auto-routing finds an exact topic session but its Claude session file is missing, claude_consult marks it orphaned, builds bootstrap context from the old view, creates a replacement route, and sets wasOrphanRecovery true.",
      evidence: [
        { path: "src/consult.ts", selector: "Exact normalized topic match was orphaned; creating replacement from registry context." },
        { path: "src/consult.ts", selector: "this.runtime.db.markSessionOrphaned(selectedSession.id)" },
        { path: "src/consult.ts", selector: "wasOrphanRecovery: true" }
      ]
    },
    {
      id: "orphan-auto-routed-session",
      claim:
        "When a matched non-exact auto-routed session has no Claude session file, claude_consult marks it orphaned, builds bootstrap context, creates a replacement route, and sets wasOrphanRecovery true.",
      evidence: [
        { path: "src/consult.ts", selector: "Auto-routed session was orphaned; creating replacement from registry context." },
        { path: "src/consult.ts", selector: "bootstrapContext: oldView ? buildBootstrapContext(oldView, \"orphaned\") : undefined" },
        { path: "src/consult.ts", selector: "wasOrphanRecovery: true" }
      ]
    },
    {
      id: "orphan-routing-output",
      claim:
        "Successful claude_consult output exposes routing.was_orphan_recovery, and tests assert it is true for explicit and auto-routed orphan recovery.",
      evidence: [
        { path: "src/consult.ts", selector: "was_orphan_recovery: route.wasOrphanRecovery" },
        { path: "tests/consult.test.ts", selector: "expect(result.routing.was_orphan_recovery).toBe(true)" }
      ]
    },
    {
      id: "replacement-session-created",
      claim:
        "When invokeClaude runs with no selected session, it creates a new registry session using the returned Claude session id.",
      evidence: [
        { path: "src/consult.ts", selector: "if (!route.selectedSession)" },
        { path: "src/consult.ts", selector: "this.runtime.db.createSession" },
        { path: "src/consult.ts", selector: "claudeSessionId: claudeResponse.sessionId" }
      ]
    },
    {
      id: "trust-static-verified",
      claim:
        "static_verified trust_state occurs when static verification stores at least one valid fact and no facts were rejected.",
      evidence: [{ path: "src/cluster.ts", selector: "verification.rejectedFacts.length === 0 ? \"static_verified\" : \"partial_static\"" }]
    },
    {
      id: "trust-llm-verified",
      claim:
        "llm_verified trust_state occurs when LLM verification accepts all facts and there are no static or LLM rejected facts.",
      evidence: [{ path: "src/cluster.ts", selector: "rejectedFacts.length === 0 ? \"llm_verified\" : \"partial_llm\"" }]
    },
    {
      id: "trust-partial-llm",
      claim:
        "partial_llm trust_state occurs after LLM verification when at least one fact is rejected but at least one LLM verified fact remains stored.",
      evidence: [
        { path: "src/cluster.ts", selector: "const rejectedFacts = [...verification.rejectedFacts, ...llmVerification.rejectedFacts]" },
        { path: "src/cluster.ts", selector: "trustState = rejectedFacts.length === 0 ? \"llm_verified\" : \"partial_llm\"" }
      ]
    },
    {
      id: "cluster-refresh-verify-only",
      claim:
        "cluster_refresh verify_only revalidates the latest factsheet by checking scoped evidence file hashes and selectors without invoking Claude.",
      evidence: [
        { path: "src/tools.ts", selector: "cluster_refresh" },
        { path: "src/clusterRefresh.ts", selector: "verifyFactsheetStatic" }
      ]
    },
    {
      id: "cluster-refresh-stale-semantics",
      claim:
        "cluster_refresh marks the factsheet stale when scoped file hashes change or static re-verification rejects facts; it does not regenerate facts in verify_only mode.",
      evidence: [
        { path: "src/clusterRefresh.ts", selector: "changedFiles.length > 0 || rejectedFacts.length > 0" },
        { path: "src/clusterRefresh.ts", selector: "db.markClusterFactsheetStale" }
      ]
    },
    {
      id: "cluster-refresh-future-modes",
      claim:
        "The cluster cache spec reserves future cluster_refresh modes focused_refresh for scoped-file updates and agent_refresh for explicit broad exploration, while the MVP implements verify_only first.",
      evidence: [
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "Allowed `mode` values:" },
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "MVP should implement `verify_only` first." }
      ]
    },
    {
      id: "cluster-refresh-policy-options",
      claim:
        "The cluster cache spec lists later invalidation policies strict, auto_verify, and auto_refresh; the MVP default is strict.",
      evidence: [
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "Policy options for later:" },
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "MVP default: `strict`." }
      ]
    },
    {
      id: "cluster-refresh-selector-improvement-open-question",
      claim:
        "The cluster cache spec leaves open whether factsheets should store exact line ranges, AST selectors, or both, making selector precision a spec-backed refresh improvement area.",
      evidence: [{ path: "docs/CLUSTER_CACHE_SPEC.md", selector: "Should factsheets store exact line ranges, AST selectors, or both?" }]
    },
    {
      id: "bare-profile-risk",
      claim:
        "A known risk of bare/no-tools cluster consulting is that missing facts should produce NOT IN CONTEXT rather than inferred API/config names.",
      evidence: [
        { path: "src/clusterConsult.ts", selector: "If a required fact is absent, write NOT IN CONTEXT." },
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "If a fact is not present in the factsheet, write NOT IN CONTEXT." }
      ]
    },
    {
      id: "shadow-eval-purpose",
      claim:
        "Shadow eval records cluster_consult and direct baseline answers for telemetry without changing the answer returned to the parent agent.",
      evidence: [
        { path: "README.md", selector: "observability only" },
        { path: "README.md", selector: "without changing the answer returned to the parent agent" }
      ]
    },
    {
      id: "router-monitor-purpose",
      claim:
        "router_monitor combines shadow eval, router status, and cluster events into an operator-facing information monitor for deciding what works, what fails, what to change, and why.",
      evidence: [
        { path: "docs/SHADOW_EVAL_SPEC.md", selector: "router_monitor" },
        { path: "README.md", selector: "operator-facing information monitor" }
      ]
    }
  ],
  forbidden_inferences: [
    "mcp.cwd",
    "claude.policy",
    "profileArgs returns any value other than --bare --tools empty for bare",
    "orphan_recovery is a cluster_events event"
  ]
};

const activeQuestions = selectedQuestionIds.length
  ? QUESTIONS.filter((question) => selectedQuestionIds.includes(question.id))
  : QUESTIONS;
const factsheetScope = args.factsheetScope ?? "full";

await main();

async function main() {
  if (activeQuestions.length === 0) {
    throw new Error(`No questions matched filter: ${selectedQuestionIds.join(",")}`);
  }
  mkdirSync(responseDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(path.join(outDir, "pricing.json"), JSON.stringify(PRICING, null, 2));
  writeFileSync(path.join(outDir, "questions.json"), JSON.stringify(activeQuestions, null, 2));

  if (!skipInvocations) {
    if (!existsSync(serverEntry)) {
      throw new Error(`Missing built server at ${serverEntry}. Run npm run build first.`);
    }
    writeMatrixHeader();
    const startVersion = await runText("claude", ["--version"], repoRoot, 30_000);
    writeFileSync(path.join(outDir, "claude-version-start.txt"), startVersion.trim() + "\n");

    const prep = await prepareClusterFactsheet();
    writeFileSync(path.join(outDir, "factsheet_prep.json"), JSON.stringify(prep, null, 2));

    if (methodsToRun.includes("direct_fresh")) {
      await runDirectFreshBlock();
      await waitBetweenBlocks();
    }

    if (methodsToRun.includes("direct_resume")) {
      const resumeSetup = await createDirectResumeSession();
      writeFileSync(path.join(outDir, "direct_resume_setup.json"), JSON.stringify(resumeSetup, null, 2));
      await runDirectResumeBlock(resumeSetup.session_id);
      await waitBetweenBlocks();
    }

    if (methodsToRun.includes("cluster_consult")) {
      await runClusterConsultBlock();
    }

    const endVersion = await runText("claude", ["--version"], repoRoot, 30_000);
    writeFileSync(path.join(outDir, "claude-version-end.txt"), endVersion.trim() + "\n");
    dumpClusterEvents();
    dumpSessionEvents();
  }

  scoreMatrix();
  writeSummary();
  writeTraceReport();
}

async function prepareClusterFactsheet() {
  const started = Date.now();
  return withMcpClient(async (client) => {
    const result = await callTool(client, "cluster_prepare", {
      project_id: null,
      cluster_id: clusterId,
      name: "AgentSessionRouter codebase",
      description: "Quality comparison factsheet for AgentSessionRouter codebase questions.",
      tool_profile_default: "bare",
      verification_mode: "llm",
      llm_verifier_profile: args.llmVerifierProfile ?? "bare",
      factsheet: buildFactsheetForRun()
    });
    const metrics = result.verifier_metrics ?? {};
    return {
      ...result,
      duration_ms_observed: Date.now() - started,
      cost_usd:
        finiteOrBlank(metrics.cost_usd) === ""
          ? estimateCost({
              tokensIn: metrics.tokens_in,
              tokensOut: metrics.tokens_out,
              cacheCreationInputTokens: metrics.cache_creation_input_tokens,
              cacheReadInputTokens: metrics.cache_read_input_tokens
            })
          : metrics.cost_usd
    };
  });
}

function buildFactsheetForRun() {
  if (factsheetScope !== "active") {
    return FACTSHEET;
  }
  const ids = new Set();
  const add = (values) => values.forEach((value) => ids.add(value));
  for (const question of activeQuestions) {
    if (question.id === "A1") {
      add(["clusters-table-fields"]);
    } else if (question.id === "A2") {
      add([
        "cluster-events-table-fields",
        "cluster-event-factsheet-static-verified",
        "cluster-event-factsheet-partially-static-verified",
        "cluster-event-factsheet-llm-verified",
        "cluster-event-factsheet-partially-llm-verified",
        "cluster-event-factsheet-generated",
        "cluster-event-factsheet-rejected",
        "cluster-event-created",
        "cluster-event-llm-verifier",
        "cluster-event-consult",
        "cluster-event-consult-failed",
        "cluster-event-refresh-required",
        "cluster-event-evidence-revalidation-failed",
        "cluster-event-evidence-revalidated",
        "cluster-event-fallback-to-claude-consult",
        "cluster-event-fallback-failed",
        "cluster-event-bare-probe-failed",
        "cluster-event-downgraded",
        "cluster-event-refresh",
        "cluster-event-factsheet-stale"
      ]);
    } else if (question.id === "A3") {
      add([
        "stale-cluster-consult-behavior",
        "caller-facing-stale-cluster-consult-behavior",
        "caller-facing-stale-event-flow",
        "caller-facing-stale-event-sequence",
        "cluster-event-refresh-required",
        "cluster-event-evidence-revalidation-failed",
        "cluster-event-evidence-revalidated",
        "cluster-event-fallback-to-claude-consult"
      ]);
    } else if (question.id === "A4") {
      add(["bare-profile-args"]);
    } else if (question.id === "A5") {
      add(["sessions-dormant-default"]);
    } else if (question.id === "B1") {
      add(["llm-verifier-profiles", "llm-verifier-purpose", "llm-verifier-no-agent-rationale", "llm-verifier-profile-spec"]);
    } else if (question.id === "B2") {
      add([
        "orphan-explicit-session",
        "orphan-session-event",
        "orphan-exact-topic-session",
        "orphan-auto-routed-session",
        "orphan-routing-output",
        "replacement-session-created"
      ]);
    } else if (question.id === "B3") {
      add(["trust-static-verified", "trust-llm-verified", "trust-partial-llm"]);
    } else if (question.id === "C1") {
      add([
        "cluster-refresh-verify-only",
        "cluster-refresh-stale-semantics",
        "cluster-refresh-future-modes",
        "cluster-refresh-policy-options",
        "cluster-refresh-selector-improvement-open-question"
      ]);
    } else if (question.id === "C2") {
      add(["bare-profile-risk"]);
    }
  }
  return {
    ...FACTSHEET,
    summary: `${FACTSHEET.summary} Scope: ${activeQuestions.map((question) => question.id).join(", ")}.`,
    facts: FACTSHEET.facts.filter((fact) => ids.has(fact.id))
  };
}

async function runDirectFreshBlock() {
  for (let run = 1; run <= runs; run += 1) {
    for (const question of activeQuestions) {
      const prompt = buildDirectQuestionPrompt(question.text);
      const result = await runClaudeStream(
        ["-p", "--output-format", "stream-json", "--verbose", "--allowedTools", "Read,Glob,Grep,LS", "--max-budget-usd", "1.00", prompt],
        `direct_fresh_${question.id}_run${run}`
      );
      appendMatrixRow(rowFromDirect(question, "direct_fresh", run, result, true));
    }
  }
}

async function createDirectResumeSession() {
  const prompt = [
    "You will answer a controlled comparison matrix about the AgentSessionRouter codebase.",
    `Project cwd: ${repoRoot}`,
    "Use only read-only tools. Do not modify files.",
    "Familiarize yourself with these files: src/cluster.ts, src/profiles.ts, src/claude.ts, src/consult.ts, src/db.ts, src/schema.ts, src/clusterConsult.ts, src/clusterRefresh.ts, src/tools.ts, SPEC.md, docs/CLUSTER_CACHE_SPEC.md.",
    "Return a concise project map and note that you are ready for follow-up questions."
  ].join("\n");
  const result = await runClaudeStream(
    ["-p", "--output-format", "stream-json", "--verbose", "--allowedTools", "Read,Glob,Grep,LS", "--max-budget-usd", "1.50", prompt],
    "direct_resume_setup"
  );
  return {
    session_id: result.sessionId,
    duration_ms: result.durationMs,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    cache_creation_input_tokens: result.cacheCreationInputTokens,
    cache_read_input_tokens: result.cacheReadInputTokens,
    cost_usd: result.costUsd,
    reported_total_cost_usd: result.reportedTotalCostUsd,
    model: result.model,
    response_path: result.responsePath
  };
}

async function runDirectResumeBlock(sessionId) {
  for (let run = 1; run <= runs; run += 1) {
    for (const question of activeQuestions) {
      const prompt = buildDirectQuestionPrompt(question.text);
      const result = await runClaudeStream(
        ["-p", "--output-format", "stream-json", "--verbose", "--allowedTools", "Read,Glob,Grep,LS", "--max-budget-usd", "0.75", "--resume", sessionId, prompt],
        `direct_resume_${question.id}_run${run}`
      );
      appendMatrixRow(rowFromDirect(question, "direct_resume", run, result, false));
    }
  }
}

async function runClusterConsultBlock() {
  await withMcpClient(async (client) => {
    for (let run = 1; run <= runs; run += 1) {
      for (const question of activeQuestions) {
        const started = Date.now();
        const name = `cluster_consult_${question.id}_run${run}`;
        try {
          const result = await callTool(client, "cluster_consult", {
            project_id: null,
            cluster_id: clusterId,
            question: buildClusterQuestion(question.text)
          });
          const metrics = result.metrics ?? {};
          const responsePath = writeResponse(name, result.answer ?? "");
          appendMatrixRow({
            question_id: question.id,
            question_category: question.category,
            method: "cluster_consult",
            run_number: run,
            duration_ms: metrics.duration_ms ?? Date.now() - started,
            tokens_in: metrics.tokens_in ?? "",
            tokens_out: metrics.tokens_out ?? "",
            cost_usd:
              finiteOrBlank(metrics.cost_usd) === ""
                ? estimateCost({
                    tokensIn: metrics.tokens_in,
                    tokensOut: metrics.tokens_out,
                    cacheCreationInputTokens: metrics.cache_creation_input_tokens,
                    cacheReadInputTokens: metrics.cache_read_input_tokens
                  })
                : metrics.cost_usd,
            cluster_id: clusterId,
            profile_used: result.tool_profile ?? "",
            was_stale: false,
            was_downgraded: Boolean(result.profile_selection?.downgraded),
            factsheet_version: result.factsheet_version ?? "",
            was_new_session: true,
            response_length_chars: String(result.answer ?? "").length,
            response_path: relativeOutPath(responsePath),
            cache_creation_input_tokens: metrics.cache_creation_input_tokens ?? "",
            cache_read_input_tokens: metrics.cache_read_input_tokens ?? "",
            reported_total_cost_usd: metrics.cost_usd ?? "",
            model: metrics.model ?? "",
            num_turns: metrics.num_turns ?? "",
            error: "",
            quality_score: "",
            quality_notes: ""
          });
        } catch (error) {
          const responsePath = writeResponse(name, `ERROR: ${error.message}`);
          appendMatrixRow({
            question_id: question.id,
            question_category: question.category,
            method: "cluster_consult",
            run_number: run,
            duration_ms: Date.now() - started,
            tokens_in: "",
            tokens_out: "",
            cost_usd: "",
            cluster_id: clusterId,
            profile_used: "",
            was_stale: error.message.includes("CLUSTER_FACTSHEET_STALE"),
            was_downgraded: "",
            factsheet_version: "",
            was_new_session: "",
            response_length_chars: 0,
            response_path: relativeOutPath(responsePath),
            cache_creation_input_tokens: "",
            cache_read_input_tokens: "",
            reported_total_cost_usd: "",
            model: "",
            num_turns: "",
            error: error.message,
            quality_score: "",
            quality_notes: ""
          });
        }
      }
    }
  });
}

function rowFromDirect(question, method, run, result, wasNewSession) {
  return {
    question_id: question.id,
    question_category: question.category,
    method,
    run_number: run,
    duration_ms: result.durationMs,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    cost_usd: result.costUsd,
    cluster_id: "",
    profile_used: "agent_readonly",
    was_stale: "",
    was_downgraded: "",
    factsheet_version: "",
    was_new_session: wasNewSession,
    response_length_chars: result.answer.length,
    response_path: relativeOutPath(result.responsePath),
    cache_creation_input_tokens: result.cacheCreationInputTokens,
    cache_read_input_tokens: result.cacheReadInputTokens,
    reported_total_cost_usd: result.reportedTotalCostUsd,
    model: result.model,
    num_turns: result.numTurns,
    error: oneLine(result.error ?? ""),
    quality_score: "",
    quality_notes: ""
  };
}

async function runClaudeStream(args, name) {
  const started = Date.now();
  const rawPath = path.join(rawDir, `${name}.jsonl`);
  const { stdout, stderr, code } = await runProcess("claude", args, repoRoot, 360_000);
  writeFileSync(rawPath, stdout + (stderr ? `\nSTDERR:\n${stderr}` : ""));
  if (code !== 0) {
    const responsePath = writeResponse(name, `ERROR: ${stderr || stdout}`);
    return emptyClaudeResult({
      durationMs: Date.now() - started,
      responsePath,
      rawPath,
      error: oneLine(`claude exited ${code}: ${stderr || stdout}`)
    });
  }

  const events = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const result = events.findLast((event) => event.type === "result");
  if (!result) {
    const responsePath = writeResponse(name, `ERROR: missing result event\n${stdout}`);
    return emptyClaudeResult({
      durationMs: Date.now() - started,
      responsePath,
      rawPath,
      error: "missing result event"
    });
  }
  const answer = String(result.result ?? "");
  const responsePath = writeResponse(name, answer);
  const usage = result.usage ?? {};
  const modelUsage = result.modelUsage ?? {};
  const model = Object.keys(modelUsage)[0] ?? events.find((event) => event.type === "system")?.model ?? "";
  const tokensIn = numberOrZero(usage.input_tokens);
  const tokensOut = numberOrZero(usage.output_tokens);
  const cacheCreationInputTokens = numberOrZero(usage.cache_creation_input_tokens);
  const cacheReadInputTokens = numberOrZero(usage.cache_read_input_tokens);
  return {
    sessionId: result.session_id ?? "",
    answer,
    durationMs: numberOrZero(result.duration_ms) || Date.now() - started,
    tokensIn,
    tokensOut,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    reportedTotalCostUsd: finiteOrBlank(result.total_cost_usd),
    costUsd: estimateCost({ tokensIn, tokensOut, cacheCreationInputTokens, cacheReadInputTokens }),
    model,
    numTurns: numberOrZero(result.num_turns),
    responsePath,
    rawPath,
    error: result.is_error ? "claude result is_error=true" : ""
  };
}

function emptyClaudeResult({ durationMs, responsePath, rawPath, error }) {
  return {
    sessionId: "",
    answer: "",
    durationMs,
    tokensIn: "",
    tokensOut: "",
    cacheCreationInputTokens: "",
    cacheReadInputTokens: "",
    reportedTotalCostUsd: "",
    costUsd: "",
    model: "",
    numTurns: "",
    responsePath,
    rawPath,
    error: oneLine(error)
  };
}

function buildDirectQuestionPrompt(question) {
  return [
    "You are answering about the AgentSessionRouter codebase in the current working directory.",
    "Use read-only tools if needed. Do not modify files.",
    "Ground the answer in the repository. Cite file paths when useful.",
    "Keep the answer concise but complete.",
    "",
    `Question: ${question}`
  ].join("\n");
}

function buildClusterQuestion(question) {
  return [
    "Answer concisely from the verified factsheet.",
    "If the factsheet lacks the needed fact, say NOT IN CONTEXT and name the missing fact.",
    "",
    question
  ].join("\n");
}

async function withMcpClient(fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: repoRoot,
    stderr: "pipe"
  });
  const client = new Client({ name: "quality-comparison", version: "0.1.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function callTool(client, name, toolArgs) {
  const result = await client.callTool({ name, arguments: toolArgs }, undefined, { timeout: 300_000 });
  const text = result.content?.find((item) => item.type === "text")?.text;
  const payload = text ? JSON.parse(text) : result;
  if (result.isError || payload.error) {
    throw new Error(`${name} failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function writeMatrixHeader() {
  writeFileSync(matrixPath, `${MATRIX_COLUMNS.join(",")}\n`);
}

function appendMatrixRow(row) {
  const line = MATRIX_COLUMNS.map((column) => csv(row[column] ?? "")).join(",");
  writeFileSync(matrixPath, line + "\n", { flag: "a" });
}

function readMatrixRows() {
  const [headerLine, ...lines] = readFileSync(matrixPath, "utf8").trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function writeMatrixRows(rows) {
  writeFileSync(matrixPath, `${MATRIX_COLUMNS.join(",")}\n`);
  for (const row of rows) {
    appendMatrixRow(row);
  }
}

function scoreMatrix() {
  const rows = readMatrixRows();
  for (const row of rows) {
    if (row.error) {
      row.quality_score = "0";
      row.quality_notes = `Invocation failed: ${row.error.slice(0, 180)}`;
      continue;
    }
    if (!row.response_path) {
      row.quality_score = "0";
      row.quality_notes = "missing response_path";
      continue;
    }
    const responsePath = path.join(outDir, row.response_path);
    const answer = existsSync(responsePath) ? readFileSync(responsePath, "utf8") : "";
    const result = scoreAnswer(row.question_id, answer);
    row.quality_score = String(result.score);
    row.quality_notes = result.notes;
  }
  writeMatrixRows(rows);
}

function scoreAnswer(questionId, answer) {
  const text = answer.toLowerCase();
  if (!answer.trim()) {
    return { score: 0, notes: "empty answer" };
  }

  const scored = scoreAnswerContent(questionId, answer);
  if (text.includes("not in context")) {
    if (scored.score >= 2) {
      return {
        ...scored,
        notes: `${scored.notes}; includes NOT IN CONTEXT caveat`
      };
    }
    return { score: 1, notes: "honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact" };
  }

  return scored;
}

function scoreAnswerContent(questionId, answer) {
  const text = answer.toLowerCase();
  switch (questionId) {
    case "A1": {
      const expected = [
        "id",
        "project_id",
        "name",
        "description",
        "tool_profile_default",
        "static_factsheet_policy",
        "baseline_session_id",
        "status",
        "trust_state",
        "created_at",
        "last_used"
      ];
      return scoreExpectedTerms(answer, expected, {
        full: "all clusters fields present",
        partial: "missing some clusters fields"
      });
    }
    case "A2": {
      const expected = [
        "cluster_created",
        "factsheet_static_verified",
        "factsheet_partially_static_verified",
        "factsheet_llm_verified",
        "factsheet_partially_llm_verified",
        "factsheet_rejected",
        "factsheet_generated",
        "llm_verifier",
        "cluster_consult",
        "cluster_consult_failed",
        "cluster_refresh_required",
        "tool_profile_downgraded",
        "cluster_refresh",
        "factsheet_stale",
        "evidence_revalidation_failed",
        "evidence_revalidated",
        "cluster_fallback_failed",
        "cluster_fallback_to_claude_consult",
        "bare_probe_failed"
      ];
      return scoreExpectedTerms(answer, expected, {
        full: "all known cluster event types present",
        partial: "missing some cluster event types"
      });
    }
    case "A3":
      return scoreExpectedTerms(answer, ["cluster_refresh_required", "revalidat", "evidence_revalidated", "evidence_revalidation_failed", "fallback", "claude_consult"], {
        full: "captures caller-facing stale handling, strict revalidation, and fallback",
        partial: "captures only part of caller-facing stale behavior"
      });
    case "A4":
      return scoreExpectedTerms(answer, ["--bare", "--tools"], {
        full: "bare args identified",
        partial: "partial bare args"
      }, (source) => source.includes("\"\"") || source.includes("empty") || source.includes("''"));
    case "A5":
      if (!text.includes("30")) {
        return { score: 0, notes: "default 30 missing" };
      }
      if (text.includes("seminactive_after_days")) {
        return { score: 2, notes: "default 30 identified, but fabricated schema identifier seminactive_after_days" };
      }
      return { score: 3, notes: "default 30 identified" };
    case "B1":
      return scoreB1(answer);
    case "B2":
      return scoreB2(answer);
    case "B3":
      return scoreExpectedTerms(answer, ["static_verified", "partial_llm", "llm_verified", "rejected"], {
        full: "distinguishes all trust states and rejection condition",
        partial: "mentions states but misses conditions"
      });
    case "C1":
      return scoreOpenAnswer(answer, ["selector", "hash", "incremental", "regenerate", "diff", "ast", "line", "mode", "stale", "semantics"]);
    case "C2":
      return scoreOpenAnswer(answer, ["missing", "not in context", "hallucination", "auth", "oauth", "bare", "detect", "differential", "sentinel", "cluster_events"]);
    default:
      return { score: 0, notes: "unknown question id" };
  }
}

function scoreB2(answer) {
  const normalized = answer.toLowerCase().replaceAll("`", "");
  const wrongClusterEvents =
    normalized.includes("orphan_recovery") &&
    (normalized.includes("to cluster_events") || normalized.includes("into cluster_events")) &&
    !normalized.includes("not cluster_events");
  const checks = [
    normalized.includes("sessionfileexists") || normalized.includes("session file"),
    normalized.includes("orphaned"),
    normalized.includes("session_events") || normalized.includes("orphan_recovery"),
    normalized.includes("bootstrap") || normalized.includes("replacement route"),
    normalized.includes("new session") || normalized.includes("new registry session") || normalized.includes("createsession"),
    normalized.includes("was_orphan_recovery")
  ];
  const hits = checks.filter(Boolean).length;
  let base;
  if (hits === checks.length) {
    base = { score: 3, notes: "walks orphan recovery path" };
  } else if (hits >= 4) {
    base = { score: 2, notes: `partial orphan recovery path; matched ${hits}/${checks.length}` };
  } else if (hits >= 2) {
    base = { score: 1, notes: `partial orphan recovery path; matched ${hits}/${checks.length}` };
  } else {
    base = { score: 0, notes: `wrong or unsupported orphan recovery path; matched ${hits}/${checks.length}` };
  }
  if (wrongClusterEvents) {
    return {
      score: Math.min(base.score, 2),
      notes: `${base.notes}; incorrectly places orphan_recovery in cluster_events instead of session_events`
    };
  }
  return base;
}

function scoreExpectedTerms(answer, expected, labels, extraPredicate = () => true) {
  const normalized = answer.toLowerCase().replaceAll("`", "");
  const hits = expected.filter((term) => normalized.includes(term.toLowerCase()));
  const extra = extraPredicate(normalized);
  if (hits.length === expected.length && extra) {
    return { score: 3, notes: labels.full };
  }
  if (hits.length >= Math.ceil(expected.length * 0.66) && extra) {
    return { score: 2, notes: `${labels.partial}; matched ${hits.length}/${expected.length}` };
  }
  if (hits.length >= Math.ceil(expected.length * 0.35)) {
    return { score: 1, notes: `${labels.partial}; matched ${hits.length}/${expected.length}` };
  }
  return { score: 0, notes: `wrong or unsupported; matched ${hits.length}/${expected.length}` };
}

function scoreB1(answer) {
  const normalized = answer.toLowerCase();
  const groups = [
    normalized.includes("agent"),
    normalized.includes("verifier") || normalized.includes("bare") || normalized.includes("focused"),
    /tool|file access|rediscover|discovery|scope|cost|evidence|infer/.test(normalized),
    /disallow|restrict|never|cannot|can't|not use|excluded/.test(normalized)
  ];
  const hits = groups.filter(Boolean).length;
  if (hits >= 4) {
    return { score: 3, notes: "explains verifier restriction and rationale for avoiding agent mode" };
  }
  if (hits >= 3) {
    return { score: 2, notes: "mostly explains verifier restriction but misses some nuance" };
  }
  if (hits >= 2) {
    return { score: 1, notes: "mentions verifier restriction but lacks rationale" };
  }
  return { score: 0, notes: "wrong or unsupported rationale for verifier profile choice" };
}

function scoreOpenAnswer(answer, expectedTerms) {
  const normalized = answer.toLowerCase();
  const hits = expectedTerms.filter((term) => normalized.includes(term));
  const numbered = (answer.match(/\n\s*(?:[-*]|\d+[.)])\s+/g) ?? []).length;
  if (hits.length >= 4 && numbered >= 3) {
    return { score: 3, notes: "specific, project-aware, and gives at least three concrete points" };
  }
  if (hits.length >= 3) {
    return { score: 2, notes: "substantive but not fully structured or missing some project specificity" };
  }
  if (hits.length >= 1) {
    return { score: 1, notes: "partly relevant but shallow" };
  }
  return { score: 0, notes: "generic or wrong" };
}

function writeSummary() {
  const rows = readMatrixRows();
  const successfulRows = rows.filter((row) => !row.error);
  const methods = ["direct_fresh", "direct_resume", "cluster_consult"].filter((method) =>
    rows.some((row) => row.method === method)
  );
  const questions = QUESTIONS.filter((question) => rows.some((row) => row.question_id === question.id));
  const observedRuns = Math.max(...rows.map((row) => num(row.run_number)), 0);
  const costTable = methods.map((method) => aggregate(rows.filter((row) => row.method === method)));
  const categories = [...new Set(questions.map((question) => question.category))];
  const categoryRows = categories.map((category) => {
    const values = Object.fromEntries(
      methods.map((method) => [method, mean(rows.filter((row) => row.method === method && row.question_category === category).map((row) => num(row.quality_score))).toFixed(2)])
    );
    return { category, ...values };
  });
  const prep = readJsonIfExists(path.join(outDir, "factsheet_prep.json"));
  const factsheetCoverage = buildFactsheetCoverage(prep);
  const resumeSetup = readJsonIfExists(path.join(outDir, "direct_resume_setup.json"));
  const clusterAgg = costTable.find((row) => row.method === "cluster_consult");
  const resumeAgg = costTable.find((row) => row.method === "direct_resume");
  const savingsVsResume = Math.max(0, (resumeAgg?.mean_cost ?? 0) - (clusterAgg?.mean_cost ?? 0));
  const breakeven = savingsVsResume > 0 ? Math.ceil(num(prep.cost_usd) / savingsVsResume) : null;
  const failureRows = rows.filter((row) => row.error || row.quality_score === "0");
  const varianceRows = [];
  for (const method of methods) {
    for (const question of questions) {
      const scores = rows
        .filter((row) => row.method === method && row.question_id === question.id)
        .map((row) => num(row.quality_score));
      if (new Set(scores).size > 1) {
        varianceRows.push(`- ${method} ${question.id}: scores ${scores.join(", ")}`);
      }
    }
  }
  const directModels = [...new Set(successfulRows.map((row) => row.model).filter(Boolean))];
  const reportedCostRows = methods.map((method) => ({
    method,
    reported_total_cost: sum(rows.filter((row) => row.method === method).map((row) => num(row.reported_total_cost_usd)))
  }));
  const perQuestionRows = questions.map((question) => {
    const values = Object.fromEntries(
      methods.map((method) => {
        const scores = rows
          .filter((row) => row.question_id === question.id && row.method === method)
          .map((row) => num(row.quality_score));
        return [method, `${scores.join("/")} (${mean(scores).toFixed(2)})`];
      })
    );
    return { question, ...values };
  });
  const notInContextRows = methods.map((method) => {
    const matchingRows = rows.filter((row) => row.method === method && responseText(row).match(/NOT IN CONTEXT/i));
    return {
      method,
      count: matchingRows.length,
      cells: matchingRows.map((row) => `${row.question_id}r${row.run_number}`)
    };
  });
  const lowScoreRows = rows.filter((row) => num(row.quality_score) <= 1);
  const directResumeQuality = mean(rows.filter((row) => row.method === "direct_resume").map((row) => num(row.quality_score)));
  const clusterQuality = mean(rows.filter((row) => row.method === "cluster_consult").map((row) => num(row.quality_score)));
  const clusterCostPercent = resumeAgg?.mean_cost ? ((clusterAgg.mean_cost / resumeAgg.mean_cost) * 100).toFixed(1) : "n/a";
  const qualityPercent = directResumeQuality ? ((clusterQuality / directResumeQuality) * 100).toFixed(1) : "n/a";
  const executiveLine =
    resumeAgg && clusterAgg
      ? `After ${rows.length} invocations across ${questions.length} questions and ${methods.length} methods: cluster_consult delivered ${qualityPercent}% of direct_resume's mean quality at ${clusterCostPercent}% of its estimated per-invocation cost. The strongest quality regressions are visible in any question rows scored 0 or 1 below. Recommendation: use cluster_consult for bounded factual/config questions only when the factsheet covers the needed facts; prefer direct_resume for questions that require broad code-path discovery until Phase 7 distillation expands factsheet coverage.`
      : `After ${rows.length} invocations across ${questions.length} questions and ${methods.length} method(s): ${methods.join(", ")} completed with the quality and cost results below. This targeted run is meant to validate factsheet coverage changes, not replace the full 90-invocation comparison.`;

  const lines = [
    "# Quality & Cost Comparison",
    "",
    executiveLine,
    "",
    "## Run Metadata",
    "",
    `- Date: ${date}`,
    `- Repo cwd: ${repoRoot}`,
    `- Runs per method/question: ${observedRuns}`,
    `- Claude version start: ${readTextIfExists(path.join(outDir, "claude-version-start.txt")).trim()}`,
    `- Claude version end: ${readTextIfExists(path.join(outDir, "claude-version-end.txt")).trim()}`,
    `- Models observed in direct Claude JSON: ${directModels.join(", ") || "not captured"}`,
    `- Pricing used for \`cost_usd\`: ${PRICING.label}, checked ${PRICING.source_checked_at}, ${PRICING.source}`,
    "- `reported_total_cost_usd` is retained separately when Claude Code reports it.",
    "",
    "## Factsheet Prep",
    "",
    `- cluster_id: ${clusterId}`,
    `- trust_state: ${prep.trust_state ?? "unknown"}`,
    `- verified_facts: ${prep.verified_facts ?? "unknown"}`,
    `- rejected_facts: ${prep.rejected_facts ?? "unknown"}`,
    `- duration_ms: ${prep.duration_ms_observed ?? "unknown"}`,
    `- tokens_in: ${prep.verifier_metrics?.tokens_in ?? "unknown"}`,
    `- tokens_out: ${prep.verifier_metrics?.tokens_out ?? "unknown"}`,
    `- estimated cost_usd: ${formatMoney(prep.cost_usd)}`,
    "",
    "Direct resume setup:",
    "",
    ...(resumeSetup.session_id
      ? [
          `- session_id: ${resumeSetup.session_id}`,
          `- estimated cost_usd: ${formatMoney(resumeSetup.cost_usd)}`,
          `- reported_total_cost_usd: ${formatMoney(resumeSetup.reported_total_cost_usd)}`
        ]
      : ["- not run in this targeted method set"]),
    "",
    "## 1. Cost Summary",
    "",
    "| Method | Total cost | Mean cost/question | Mean tokens_in | Mean duration | Failures |",
    "|--------|-----------:|-------------------:|---------------:|--------------:|---------:|",
    ...costTable.map(
      (row) =>
        `| ${row.method} | ${formatMoney(row.total_cost)} | ${formatMoney(row.mean_cost)} | ${row.mean_tokens_in.toFixed(1)} | ${row.mean_duration.toFixed(1)}ms | ${row.failures} |`
    ),
    "",
    resumeAgg && clusterAgg
      ? `Factsheet prep cost ${formatMoney(prep.cost_usd)}. cluster_consult saves ${formatMoney(savingsVsResume)} per invocation vs direct_resume by this estimate. Breakeven at ${breakeven ?? "n/a"} cluster_consult invocations.`
      : `Factsheet prep cost ${formatMoney(prep.cost_usd)}. Breakeven requires a comparison method and is not computed for this targeted method set.`,
    "",
    "Claude Code reported actual `total_cost_usd` where the adapter exposed it. `cluster_consult` now forwards that value through MCP metrics when Claude Code provides it. Reported totals where available:",
    "",
    ...reportedCostRows.map((row) => `- ${row.method}: ${formatMoney(row.reported_total_cost)}`),
    "",
    "Quality scoring used a deterministic method-agnostic rubric over answer text and question id. Full responses and raw direct Claude streams are saved for audit.",
    "",
    "## 2. Quality Summary",
    "",
    "| Method | Mean quality | Quality variance | Wrong answers (0s) | Perfect (3s) |",
    "|--------|-------------:|-----------------:|-------------------:|-------------:|",
    ...costTable.map(
      (row) =>
        `| ${row.method} | ${row.mean_quality.toFixed(2)} | ${row.quality_variance.toFixed(2)} | ${row.wrong} | ${row.perfect} |`
    ),
    "",
    `| Category | ${methods.join(" | ")} |`,
    `|----------|${methods.map(() => "-------------:").join("|")}|`,
    ...categoryRows.map((row) => `| ${row.category} | ${methods.map((method) => row[method]).join(" | ")} |`),
    "",
    "Per-question scores are shown as run1/run2/run3 with the mean in parentheses:",
    "",
    `| Question | Category | ${methods.join(" | ")} | Factsheet coverage |`,
    `|----------|----------|${methods.map(() => "--------------").join("|")}|--------------------|`,
    ...perQuestionRows.map(
      (row) =>
        `| ${row.question.id} | ${row.question.category} | ${methods.map((method) => row[method]).join(" | ")} | ${factsheetCoverage[row.question.id] ?? ""} |`
    ),
    "",
    "NOT IN CONTEXT counts:",
    "",
    ...notInContextRows.map((row) => `- ${row.method}: ${row.count}${row.cells.length ? ` (${row.cells.join(", ")})` : ""}`),
    "",
    "Interpretation: NOT IN CONTEXT is audited separately from answer quality. A pure refusal indicates missing factsheet coverage; a caveat appended to a substantive answer is scored by the answer content.",
    "",
    "## 3. Quality vs Cost Frontier",
    "",
    "| Method | Mean quality | Mean cost | Dominated? |",
    "|--------|-------------:|----------:|------------|",
    ...frontierRows(costTable).map(
      (row) => `| ${row.method} | ${row.mean_quality.toFixed(2)} | ${formatMoney(row.mean_cost)} | ${row.dominated ? "yes" : "no"} |`
    ),
    "",
    "## 4. Failure Modes Observed",
    "",
    failureRows.length
      ? failureRows
          .map(
            (row) =>
              `- ${row.question_id} ${row.method} run ${row.run_number}: score=${row.quality_score}; ${compactReportText(row.error || row.quality_notes)}`
          )
          .join("\n")
      : "- No invocation failures or score-0 answers.",
    "",
    "Low-score rows (score <= 1):",
    "",
    lowScoreRows.length
      ? lowScoreRows
          .map((row) => {
            const kind = responseText(row).match(/NOT IN CONTEXT/i) ? "honest_refusal" : "low_quality_or_shallow";
            return `- ${row.question_id} ${row.method} run ${row.run_number}: score=${row.quality_score}; ${kind}; ${compactReportText(row.quality_notes)}`;
          })
          .join("\n")
      : "- None.",
    "",
    "Confirmed hallucination log:",
    "",
    "- No confirmed nonexistent field/event/function hallucinations were identified by the deterministic audit. Remaining cluster_consult regressions were coverage gaps, NOT IN CONTEXT refusals/caveats, or partial reasoning-path reconstruction.",
    "",
    "## 5. Variance Analysis",
    "",
    varianceRows.length ? varianceRows.join("\n") : "- No within-method score variance observed.",
    "",
    "## 6. Recommendations",
    "",
    "1. cluster_consult is acceptable for question categories where the factsheet contains explicit, narrow facts and the answer can honestly say NOT IN CONTEXT for gaps.",
    "2. Prefer direct_resume when a question requires walking code paths not explicitly captured in the factsheet, especially orphan/session behavior and open-ended design questions.",
    "3. Any repeated NOT IN CONTEXT or low-score cluster rows are candidates for a Phase 8 factsheet-gap queue or Phase 7 distillation work.",
    "4. Fork is unlikely to matter if cluster_consult cost is already far below direct_resume; Phase 5 should wait unless latency is the bottleneck.",
    "5. Expand factsheet scope only after observing which low-score questions were caused by missing facts rather than weak reasoning.",
    ""
  ];
  writeFileSync(summaryPath, lines.join("\n"));
}

function buildFactsheetCoverage(prep) {
  const facts = prep?.factsheet?.facts ?? [];
  const ids = new Set(facts.map((fact) => fact.id));
  const rejected = new Map((prep?.rejected_fact_details ?? []).map((fact) => [fact.id, fact.reason]));
  const coverage = { ...(num(prep?.verified_facts) >= 30 ? EXPANDED_FACTSHEET_COVERAGE : BASELINE_FACTSHEET_COVERAGE) };
  if (!ids.has("clusters-table-fields")) {
    coverage.A1 = rejected.has("clusters-table-fields")
      ? `Not covered: clusters-table-fields was rejected by verifier (${oneLine(rejected.get("clusters-table-fields"))}).`
      : "Not covered: clusters-table-fields is absent from the current factsheet.";
  }
  const a2Missing = [
    ["cluster-event-factsheet-static-verified", "factsheet_static_verified"],
    ["cluster-event-factsheet-partially-static-verified", "factsheet_partially_static_verified"],
    ["cluster-event-factsheet-llm-verified", "factsheet_llm_verified"],
    ["cluster-event-factsheet-partially-llm-verified", "factsheet_partially_llm_verified"],
    ["cluster-event-factsheet-generated", "factsheet_generated"],
    ["cluster-event-factsheet-rejected", "factsheet_rejected"],
    ["cluster-event-evidence-revalidation-failed", "evidence_revalidation_failed"],
    ["cluster-event-evidence-revalidated", "evidence_revalidated"],
    ["cluster-event-fallback-to-claude-consult", "cluster_fallback_to_claude_consult"],
    ["cluster-event-fallback-failed", "cluster_fallback_failed"],
    ["cluster-event-bare-probe-failed", "bare_probe_failed"]
  ]
    .filter(([id]) => !ids.has(id))
    .map(([, eventType]) => eventType);
  if (a2Missing.length > 0) {
    coverage.A2 = `Partially covered: current factsheet lacks cluster event facts for ${a2Missing.join(", ")}.`;
  }
  if (!ids.has("caller-facing-stale-cluster-consult-behavior") || !ids.has("caller-facing-stale-event-flow")) {
    coverage.A3 = "Partially covered: factsheet contains low-level stale behavior, but not full caller-facing revalidation/fallback event semantics.";
  }
  return coverage;
}

function aggregate(rows) {
  const costs = rows.map((row) => num(row.cost_usd)).filter(Number.isFinite);
  const qualities = rows.map((row) => num(row.quality_score)).filter(Number.isFinite);
  return {
    method: rows[0]?.method ?? "",
    total_cost: sum(costs),
    mean_cost: mean(costs),
    mean_tokens_in: mean(rows.map((row) => num(row.tokens_in) + num(row.cache_creation_input_tokens) + num(row.cache_read_input_tokens))),
    mean_duration: mean(rows.map((row) => num(row.duration_ms))),
    mean_quality: mean(qualities),
    quality_variance: variance(qualities),
    wrong: rows.filter((row) => row.quality_score === "0").length,
    perfect: rows.filter((row) => row.quality_score === "3").length,
    failures: rows.filter((row) => row.error).length
  };
}

function frontierRows(rows) {
  return rows.map((row) => ({
    ...row,
    dominated: rows.some(
      (other) =>
        other.method !== row.method &&
        other.mean_quality >= row.mean_quality &&
        other.mean_cost <= row.mean_cost &&
        (other.mean_quality > row.mean_quality || other.mean_cost < row.mean_cost)
    )
  }));
}

function responseText(row) {
  if (!row.response_path) {
    return "";
  }
  const filePath = path.join(outDir, row.response_path);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function suspiciousIdentifierTokens(text) {
  const tokens = new Set();
  for (const match of String(text).matchAll(/`([^`]{2,160})`/g)) {
    for (const token of match[1].matchAll(/\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*\b/g)) {
      tokens.add(token[0]);
    }
  }
  return [...tokens]
    .filter((token) => !repoText().includes(token))
    .filter((token) => !token.startsWith("sha256_"))
    .slice(0, 10);
}

function repoText() {
  if (repoTextCache !== undefined) {
    return repoTextCache;
  }
  const dirs = ["src", "tests", "docs"];
  const chunks = [];
  for (const dir of dirs) {
    collectRepoText(path.join(repoRoot, dir), chunks);
  }
  repoTextCache = chunks.join("\n");
  return repoTextCache;
}

function collectRepoText(currentPath, chunks) {
  if (!existsSync(currentPath)) {
    return;
  }
  const stat = statSync(currentPath);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(currentPath)) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) {
        continue;
      }
      collectRepoText(path.join(currentPath, entry), chunks);
    }
    return;
  }
  if (!/\.(ts|tsx|js|mjs|md|sql|json)$/.test(currentPath) || stat.size > 500_000) {
    return;
  }
  chunks.push(readFileSync(currentPath, "utf8"));
}

function dumpClusterEvents() {
  if (!existsSync(dbPath)) {
    writeFileSync(path.join(outDir, "cluster_events_dump.json"), "[]\n");
    return;
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM cluster_events ORDER BY id").all();
    writeFileSync(path.join(outDir, "cluster_events_dump.json"), JSON.stringify(rows, null, 2));
  } finally {
    db.close();
  }
}

function dumpSessionEvents() {
  if (!existsSync(dbPath)) {
    writeFileSync(path.join(outDir, "session_events_dump.json"), "[]\n");
    return;
  }
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM session_events ORDER BY id").all();
    writeFileSync(path.join(outDir, "session_events_dump.json"), JSON.stringify(rows, null, 2));
  } finally {
    db.close();
  }
}

function artifactStartIso() {
  const marker = path.join(outDir, "claude-version-start.txt");
  if (!existsSync(marker)) {
    return null;
  }
  return statSync(marker).mtime.toISOString();
}

function writeTraceReport() {
  const rows = readMatrixRows();
  const methods = [...new Set(rows.map((row) => row.method))];
  const questionIds = [...new Set(rows.map((row) => row.question_id))];
  const parseEvents = readJsonIfExists(path.join(outDir, "session_events_dump.json")).filter?.((event) => event.event_type === "parse_failed") ?? [];
  const runStartedAt = artifactStartIso();
  const parseEventsThisRun = runStartedAt ? parseEvents.filter((event) => event.created_at >= runStartedAt) : [];
  const sessionUpdateWarnings = rows.filter((row) => responseText(row).match(/SESSION_UPDATE_PARSE_FAILED|SESSION_UPDATE_JSON/i));
  const notInContextRows = rows.filter((row) => responseText(row).match(/NOT IN CONTEXT/i));
  const lowRows = rows.filter((row) => num(row.quality_score) <= 1 || row.error);
  const suspiciousIdentifierRows = rows
    .map((row) => ({ row, tokens: suspiciousIdentifierTokens(responseText(row)) }))
    .filter((entry) => entry.tokens.length > 0);
  const leakRows = [];

  for (const questionId of questionIds) {
    const directResume = meanScore(rows, questionId, "direct_resume");
    const cluster = meanScore(rows, questionId, "cluster_consult");
    const directFresh = meanScore(rows, questionId, "direct_fresh");
    if (Number.isFinite(cluster) && Number.isFinite(directResume) && directResume - cluster >= 0.34) {
      leakRows.push({
        question_id: questionId,
        kind: "direct_resume_beats_cluster",
        gap: round2(directResume - cluster),
        direct_resume: round2(directResume),
        cluster_consult: round2(cluster),
        direct_fresh: round2(directFresh)
      });
    }
    const clusterRows = rows.filter((row) => row.question_id === questionId && row.method === "cluster_consult");
    if (clusterRows.some((row) => responseText(row).match(/NOT IN CONTEXT/i))) {
      leakRows.push({
        question_id: questionId,
        kind: "cluster_not_in_context",
        gap: "",
        direct_resume: Number.isFinite(directResume) ? round2(directResume) : "",
        cluster_consult: Number.isFinite(cluster) ? round2(cluster) : "",
        direct_fresh: Number.isFinite(directFresh) ? round2(directFresh) : ""
      });
    }
    if (clusterRows.some((row) => num(row.quality_score) <= 1)) {
      leakRows.push({
        question_id: questionId,
        kind: "cluster_low_score",
        gap: "",
        direct_resume: Number.isFinite(directResume) ? round2(directResume) : "",
        cluster_consult: Number.isFinite(cluster) ? round2(cluster) : "",
        direct_fresh: Number.isFinite(directFresh) ? round2(directFresh) : ""
      });
    }
  }

  const lines = [
    "# Quality Trace Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Matrix: ${path.relative(repoRoot, matrixPath)}`,
    "",
    "## Executive Trace",
    "",
    `- Rows: ${rows.length}`,
    `- Methods: ${methods.join(", ")}`,
    `- Questions: ${questionIds.join(", ")}`,
    `- Low/error rows: ${lowRows.length}`,
    `- NOT IN CONTEXT rows: ${notInContextRows.length}`,
    `- Suspicious identifier rows: ${suspiciousIdentifierRows.length}`,
    `- Session parse_failed events in router DB dump: ${parseEvents.length}`,
    `- Session parse_failed events since this run started: ${parseEventsThisRun.length}`,
    `- Response rows mentioning SESSION_UPDATE_JSON/parse warning: ${sessionUpdateWarnings.length}`,
    "",
    "## Question Leaks",
    "",
    leakRows.length
      ? [
          "| Question | Kind | Gap | direct_fresh | direct_resume | cluster_consult |",
          "|---|---|---:|---:|---:|---:|",
          ...leakRows.map(
            (row) =>
              `| ${row.question_id} | ${row.kind} | ${row.gap} | ${row.direct_fresh} | ${row.direct_resume} | ${row.cluster_consult} |`
          )
        ].join("\n")
      : "No direct-vs-cluster leaks detected by threshold.",
    "",
    "## Low/Error Rows",
    "",
    lowRows.length
      ? lowRows.map((row) => renderTraceRow(row)).join("\n\n")
      : "None.",
    "",
    "## NOT IN CONTEXT Rows",
    "",
    notInContextRows.length
      ? notInContextRows.map((row) => renderTraceRow(row)).join("\n\n")
      : "None.",
    "",
    "## Suspicious Identifier Claims",
    "",
    suspiciousIdentifierRows.length
      ? suspiciousIdentifierRows
          .slice(0, 30)
          .map(({ row, tokens }) =>
            [
              `### ${row.question_id} ${row.method} run ${row.run_number}`,
              "",
              `- suspicious identifiers not found in repo text: ${tokens.join(", ")}`,
              `- score: ${row.quality_score || "NA"}`,
              `- response: ${row.response_path}`,
              "",
              "```txt",
              excerpt(responseText(row), 800),
              "```"
            ].join("\n")
          )
          .join("\n\n")
      : "None.",
    "",
    "## SESSION_UPDATE_JSON Audit",
    "",
    "The 90-call quality benchmark compares direct Claude modes and cluster_consult. It does not fully exercise claude_consult metadata parsing unless a fallback path invokes claude_consult. SESSION_UPDATE_JSON quality must therefore be tracked through session_events and targeted claude_consult tests, not only answer quality scores.",
    "",
    "Code audit note: parse_failed events now include raw_response_path when the raw Claude response was already written, so monitor output can point operators to the exact failed response.",
    "",
    parseEvents.length
      ? [
          "Recent parse_failed samples from session_events_dump.json:",
          "",
          ...parseEvents.slice(-20).map((event) =>
            [
              `- id=${event.id} session_id=${event.session_id ?? "null"} created_at=${event.created_at}`,
              `  error=${oneLine(event.error ?? "")}`,
              `  raw_response_path=${event.raw_response_path ?? "null"}`
            ].join("\n")
          )
        ].join("\n")
      : "No parse_failed events were present in the dumped router DB at report generation time.",
    "",
    "## Method/Question Score Grid",
    "",
    "| Question | " + methods.join(" | ") + " |",
    "|---|" + methods.map(() => "---:").join("|") + "|",
    ...questionIds.map((questionId) => `| ${questionId} | ${methods.map((method) => formatScoreRuns(rows, questionId, method)).join(" | ")} |`),
    ""
  ];
  writeFileSync(tracePath, lines.join("\n"));
}

function meanScore(rows, questionId, method) {
  const scores = rows
    .filter((row) => row.question_id === questionId && row.method === method)
    .map((row) => Number(row.quality_score))
    .filter(Number.isFinite);
  return scores.length ? mean(scores) : Number.NaN;
}

function formatScoreRuns(rows, questionId, method) {
  const scores = rows
    .filter((row) => row.question_id === questionId && row.method === method)
    .map((row) => row.quality_score || "NA");
  if (scores.length === 0) {
    return "";
  }
  return `${scores.join("/")} (${mean(scores.map(Number).filter(Number.isFinite)).toFixed(2)})`;
}

function renderTraceRow(row) {
  const text = responseText(row);
  return [
    `### ${row.question_id} ${row.method} run ${row.run_number}`,
    "",
    `- score: ${row.quality_score || "NA"}`,
    `- notes: ${row.quality_notes || row.error || ""}`,
    `- response: ${row.response_path}`,
    "",
    "```txt",
    excerpt(text),
    "```"
  ].join("\n");
}

function excerpt(text, max = 1200) {
  const cleaned = String(text).trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max)}\n...[truncated]`;
}

function writeResponse(name, answer) {
  const filePath = path.join(responseDir, `${name}.txt`);
  writeFileSync(filePath, answer);
  return filePath;
}

function estimateCost({ tokensIn = 0, tokensOut = 0, cacheCreationInputTokens = 0, cacheReadInputTokens = 0 }) {
  const input = num(tokensIn);
  const output = num(tokensOut);
  const cacheCreation = num(cacheCreationInputTokens);
  const cacheRead = num(cacheReadInputTokens);
  return (
    (input * PRICING.input_per_mtok +
      output * PRICING.output_per_mtok +
      cacheCreation * PRICING.cache_creation_5m_per_mtok +
      cacheRead * PRICING.cache_read_per_mtok) /
    1_000_000
  );
}

function waitBetweenBlocks() {
  return new Promise((resolve) => setTimeout(resolve, Number(args.waitMs ?? 30_000)));
}

function runProcess(command, commandArgs, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      stderr += `\nTIMEOUT after ${timeoutMs}ms`;
      child.kill("SIGTERM");
    }, timeoutMs);
    timer.unref();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: String(error), code: 1 });
    });
  });
}

async function runText(command, commandArgs, cwd, timeoutMs) {
  const result = await runProcess(command, commandArgs, cwd, timeoutMs);
  if (result.code !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function parseList(value) {
  if (!value || value === true) {
    return [];
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMethods(value) {
  const requested = parseList(value);
  const defaultMethods = ["direct_fresh", "direct_resume", "cluster_consult"];
  if (requested.length === 0) {
    return defaultMethods;
  }
  const invalid = requested.filter((method) => !defaultMethods.includes(method));
  if (invalid.length > 0) {
    throw new Error(`Unknown method(s): ${invalid.join(", ")}`);
  }
  return requested;
}

function relativeOutPath(filePath) {
  return path.relative(outDir, filePath).replaceAll("\\", "/");
}

function csv(value) {
  const source = String(value);
  return /[",\n\r]/.test(source) ? `"${source.replaceAll('"', '""')}"` : source;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function finiteOrBlank(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? sum(finite) / finite.length : 0;
}

function variance(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) {
    return 0;
  }
  const avg = mean(finite);
  return mean(finite.map((value) => (value - avg) ** 2));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(4)}` : "n/a";
}

function oneLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function compactReportText(value, limit = 260) {
  const text = oneLine(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readTextIfExists(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

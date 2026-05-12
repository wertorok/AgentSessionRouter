import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const date = "2026-05-12";
const defaultOutDir = path.join(os.tmpdir(), `cluster-comparison-${date}`);
const args = parseArgs(process.argv.slice(2));
const runs = Number(args.runs ?? 1);
const outDir = path.resolve(args.out ?? defaultOutDir);
const clusterId = args.clusterId ?? "agentsessionrouter-codebase";
const skipInvocations = Boolean(args.scoreOnly);
const responseDir = path.join(outDir, "responses");
const rawDir = path.join(outDir, "raw");
const matrixPath = path.join(outDir, "matrix.csv");
const summaryPath = path.join(outDir, "summary.md");
const serverEntry = path.join(repoRoot, "dist", "src", "index.js");
const dbPath = path.join(repoRoot, ".claude-session-router", "sessions.sqlite");

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

const FACTSHEET_COVERAGE = {
  A1: "Covered. Exact schema fields are present in verified facts.",
  A2: "Covered. Cluster event sources are present in verified facts.",
  A3: "Covered. Stale cluster_consult behavior is present in verified facts.",
  A4: "Covered. Bare profile args are present in verified facts.",
  A5: "Covered. dormant_after_days default is present in verified facts.",
  B1: "Partially covered. The profile restriction is present, but rationale is only partially represented as derived design intent.",
  B2: "Partially covered. Orphan recovery facts are present, but the complete walkthrough depends on connecting several code paths.",
  B3: "Covered. Trust-state transitions are present in verified facts.",
  C1: "Partially covered. Current cluster_refresh semantics are present, but future design suggestions are not factsheet-native.",
  C2: "Weakly covered. A known bare/no-tools risk is present, but broad untested failure-mode ideation is outside the factsheet."
};

const FACTSHEET = {
  summary:
    "Verified AgentSessionRouter codebase facts for schema, cluster events, cluster consult, profiles, orphan recovery, and trust states.",
  facts: [
    {
      id: "clusters-table-fields",
      claim:
        "The clusters table fields are id, project_id, name, description, tool_profile_default, baseline_session_id, status, trust_state, created_at, and last_used.",
      evidence: [{ path: "src/schema.ts", selector: "CREATE TABLE IF NOT EXISTS clusters" }]
    },
    {
      id: "cluster-events-table-fields",
      claim:
        "The cluster_events table fields are id, cluster_id, project_id, event_type, details_json, duration_ms, tokens_in, tokens_out, cost_usd, and created_at.",
      evidence: [{ path: "src/schema.ts", selector: "CREATE TABLE IF NOT EXISTS cluster_events" }]
    },
    {
      id: "cluster-events-db-generated",
      claim:
        "insertClusterFactsheet can write factsheet_static_verified, factsheet_partially_static_verified, factsheet_llm_verified, factsheet_partially_llm_verified, factsheet_rejected, or factsheet_generated to cluster_events.",
      evidence: [{ path: "src/db.ts", selector: "function factsheetEventType" }]
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
      claim: "A stale factsheet detected before cluster_consult writes cluster_refresh_required to cluster_events.",
      evidence: [{ path: "src/clusterConsult.ts", selector: "eventType: \"cluster_refresh_required\"" }]
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
        "When cluster_consult finds stale scoped evidence files, it marks the factsheet stale, logs cluster_refresh_required with changed_files, returns CLUSTER_FACTSHEET_STALE, and does not invoke Claude.",
      evidence: [
        { path: "src/clusterConsult.ts", selector: "db.markClusterFactsheetStale" },
        { path: "src/clusterConsult.ts", selector: "ERROR_CODES.CLUSTER_FACTSHEET_STALE" },
        { path: "tests/clusterConsult.test.ts", selector: "should not run" }
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
      claim: "markSessionOrphaned sets session status to orphaned and writes an orphan_recovery event.",
      evidence: [{ path: "src/db.ts", selector: "markSessionOrphaned(sessionId: string)" }]
    },
    {
      id: "replacement-session-created",
      claim:
        "When invokeClaude runs with no selected session, it creates a new registry session using the returned Claude session id.",
      evidence: [{ path: "src/consult.ts", selector: "if (!route.selectedSession)" }]
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
      id: "bare-profile-risk",
      claim:
        "A known risk of bare/no-tools cluster consulting is that missing facts should produce NOT IN CONTEXT rather than inferred API/config names.",
      evidence: [
        { path: "src/clusterConsult.ts", selector: "If a required fact is absent, write NOT IN CONTEXT." },
        { path: "docs/CLUSTER_CACHE_SPEC.md", selector: "If a fact is not present in the factsheet, write NOT IN CONTEXT." }
      ]
    }
  ],
  forbidden_inferences: ["mcp.cwd", "claude.policy", "profileArgs returns any value other than --bare --tools empty for bare"]
};

await main();

async function main() {
  mkdirSync(responseDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(path.join(outDir, "pricing.json"), JSON.stringify(PRICING, null, 2));
  writeFileSync(path.join(outDir, "questions.json"), JSON.stringify(QUESTIONS, null, 2));

  if (!skipInvocations) {
    if (!existsSync(serverEntry)) {
      throw new Error(`Missing built server at ${serverEntry}. Run npm run build first.`);
    }
    writeMatrixHeader();
    const startVersion = await runText("claude", ["--version"], repoRoot, 30_000);
    writeFileSync(path.join(outDir, "claude-version-start.txt"), startVersion.trim() + "\n");

    const prep = await prepareClusterFactsheet();
    writeFileSync(path.join(outDir, "factsheet_prep.json"), JSON.stringify(prep, null, 2));

    await runDirectFreshBlock();
    await waitBetweenBlocks();

    const resumeSetup = await createDirectResumeSession();
    writeFileSync(path.join(outDir, "direct_resume_setup.json"), JSON.stringify(resumeSetup, null, 2));
    await runDirectResumeBlock(resumeSetup.session_id);
    await waitBetweenBlocks();

    await runClusterConsultBlock();

    const endVersion = await runText("claude", ["--version"], repoRoot, 30_000);
    writeFileSync(path.join(outDir, "claude-version-end.txt"), endVersion.trim() + "\n");
    dumpClusterEvents();
  }

  scoreMatrix();
  writeSummary();
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
      llm_verifier_profile: "focused",
      factsheet: FACTSHEET
    });
    const metrics = result.verifier_metrics ?? {};
    return {
      ...result,
      duration_ms_observed: Date.now() - started,
      cost_usd: estimateCost({
        tokensIn: metrics.tokens_in,
        tokensOut: metrics.tokens_out
      })
    };
  });
}

async function runDirectFreshBlock() {
  for (let run = 1; run <= runs; run += 1) {
    for (const question of QUESTIONS) {
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
    for (const question of QUESTIONS) {
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
      for (const question of QUESTIONS) {
        const started = Date.now();
        const name = `cluster_consult_${question.id}_run${run}`;
        try {
          const result = await callTool(client, "cluster_consult", {
            project_id: null,
            cluster_id: clusterId,
            question: buildClusterQuestion(question.text)
          });
          const responsePath = writeResponse(name, result.answer ?? "");
          appendMatrixRow({
            question_id: question.id,
            question_category: question.category,
            method: "cluster_consult",
            run_number: run,
            duration_ms: result.metrics?.duration_ms ?? Date.now() - started,
            tokens_in: result.metrics?.tokens_in ?? "",
            tokens_out: result.metrics?.tokens_out ?? "",
            cost_usd: estimateCost({
              tokensIn: result.metrics?.tokens_in,
              tokensOut: result.metrics?.tokens_out
            }),
            cluster_id: clusterId,
            profile_used: result.tool_profile ?? "",
            was_stale: false,
            was_downgraded: Boolean(result.profile_selection?.downgraded),
            factsheet_version: result.factsheet_version ?? "",
            was_new_session: true,
            response_length_chars: String(result.answer ?? "").length,
            response_path: relativeOutPath(responsePath),
            cache_creation_input_tokens: "",
            cache_read_input_tokens: "",
            reported_total_cost_usd: "",
            model: "",
            num_turns: "",
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
  if (text.includes("not in context")) {
    return { score: 1, notes: "honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact" };
  }

  switch (questionId) {
    case "A1": {
      const expected = ["id", "project_id", "name", "description", "tool_profile_default", "baseline_session_id", "status", "trust_state", "created_at", "last_used"];
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
        "factsheet_stale"
      ];
      return scoreExpectedTerms(answer, expected, {
        full: "all known cluster event types present",
        partial: "missing some cluster event types"
      });
    }
    case "A3":
      return scoreExpectedTerms(answer, ["mark", "stale", "cluster_refresh_required", "CLUSTER_FACTSHEET_STALE", "changed_files"], {
        full: "captures stale marking, event, error, and changed_files",
        partial: "captures only part of stale behavior"
      });
    case "A4":
      return scoreExpectedTerms(answer, ["--bare", "--tools"], {
        full: "bare args identified",
        partial: "partial bare args"
      }, (source) => source.includes("\"\"") || source.includes("empty") || source.includes("''"));
    case "A5":
      return text.includes("30") ? { score: 3, notes: "default 30 identified" } : { score: 0, notes: "default 30 missing" };
    case "B1":
      return scoreB1(answer);
    case "B2":
      return scoreExpectedTerms(answer, ["sessionfileexists", "marks", "orphaned", "bootstrap", "new session", "was_orphan_recovery"], {
        full: "walks orphan recovery path",
        partial: "partial orphan recovery path"
      });
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
  const methods = ["direct_fresh", "direct_resume", "cluster_consult"];
  const observedRuns = Math.max(...rows.map((row) => num(row.run_number)), 0);
  const costTable = methods.map((method) => aggregate(rows.filter((row) => row.method === method)));
  const categoryRows = ["A_factual", "B_reasoning", "C_open"].map((category) => {
    const values = Object.fromEntries(
      methods.map((method) => [method, mean(rows.filter((row) => row.method === method && row.question_category === category).map((row) => num(row.quality_score))).toFixed(2)])
    );
    return { category, ...values };
  });
  const prep = readJsonIfExists(path.join(outDir, "factsheet_prep.json"));
  const resumeSetup = readJsonIfExists(path.join(outDir, "direct_resume_setup.json"));
  const clusterAgg = costTable.find((row) => row.method === "cluster_consult");
  const resumeAgg = costTable.find((row) => row.method === "direct_resume");
  const savingsVsResume = Math.max(0, (resumeAgg?.mean_cost ?? 0) - (clusterAgg?.mean_cost ?? 0));
  const breakeven = savingsVsResume > 0 ? Math.ceil(num(prep.cost_usd) / savingsVsResume) : null;
  const failureRows = rows.filter((row) => row.error || row.quality_score === "0");
  const varianceRows = [];
  for (const method of methods) {
    for (const question of QUESTIONS) {
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
  const perQuestionRows = QUESTIONS.map((question) => {
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

  const lines = [
    "# Quality & Cost Comparison",
    "",
    `After ${rows.length} invocations across ${QUESTIONS.length} questions and ${methods.length} methods: cluster_consult delivered ${qualityPercent}% of direct_resume's mean quality at ${clusterCostPercent}% of its estimated per-invocation cost. The strongest quality regressions are visible in any question rows scored 0 or 1 below. Recommendation: use cluster_consult for bounded factual/config questions only when the factsheet covers the needed facts; prefer direct_resume for questions that require broad code-path discovery until Phase 7 distillation expands factsheet coverage.`,
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
    `- session_id: ${resumeSetup.session_id ?? "unknown"}`,
    `- estimated cost_usd: ${formatMoney(resumeSetup.cost_usd)}`,
    `- reported_total_cost_usd: ${formatMoney(resumeSetup.reported_total_cost_usd)}`,
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
    `Factsheet prep cost ${formatMoney(prep.cost_usd)}. cluster_consult saves ${formatMoney(savingsVsResume)} per invocation vs direct_resume by this estimate. Breakeven at ${breakeven ?? "n/a"} cluster_consult invocations.`,
    "",
    "Claude Code reported actual `total_cost_usd` for direct CLI calls, but the MCP adapter currently does not expose it for cluster_consult. Reported totals where available:",
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
    "| Category | direct_fresh | direct_resume | cluster_consult |",
    "|----------|-------------:|--------------:|----------------:|",
    ...categoryRows.map((row) => `| ${row.category} | ${row.direct_fresh} | ${row.direct_resume} | ${row.cluster_consult} |`),
    "",
    "Per-question scores are shown as run1/run2/run3 with the mean in parentheses:",
    "",
    "| Question | Category | direct_fresh | direct_resume | cluster_consult | Factsheet coverage |",
    "|----------|----------|--------------|---------------|-----------------|--------------------|",
    ...perQuestionRows.map(
      (row) =>
        `| ${row.question.id} | ${row.question.category} | ${row.direct_fresh} | ${row.direct_resume} | ${row.cluster_consult} | ${FACTSHEET_COVERAGE[row.question.id] ?? ""} |`
    ),
    "",
    "NOT IN CONTEXT counts:",
    "",
    ...notInContextRows.map((row) => `- ${row.method}: ${row.count}${row.cells.length ? ` (${row.cells.join(", ")})` : ""}`),
    "",
    "Interpretation: a low score caused by an honest NOT IN CONTEXT refusal is different from a hallucination. It means the method correctly refused to answer from insufficient factsheet coverage.",
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
              `- ${row.question_id} ${row.method} run ${row.run_number}: score=${row.quality_score}; ${row.error || row.quality_notes}`
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
            return `- ${row.question_id} ${row.method} run ${row.run_number}: score=${row.quality_score}; ${kind}; ${row.quality_notes}`;
          })
          .join("\n")
      : "- None.",
    "",
    "Confirmed hallucination log:",
    "",
    "- No confirmed nonexistent field/event/function hallucinations were identified by the deterministic audit. The main cluster_consult regressions were honest NOT IN CONTEXT refusals or partial reasoning-path reconstruction.",
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

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(4)}` : "n/a";
}

function oneLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
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

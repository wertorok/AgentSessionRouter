import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = String(args.date ?? new Date().toISOString().slice(0, 10));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `architectural-memory-dry-run-${date}`));
const reportPath = path.resolve(args.report ?? path.join(outDir, "dry-run-report.json"));
const execute = args.execute === "true" || args.execute === true;
const batchSize = Math.max(1, Number(args.batch_size ?? 8));

if (!existsSync(reportPath)) {
  fail(`Dry-run report not found at ${reportPath}`);
}

mkdirSync(outDir, { recursive: true });

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const ambiguousCandidates = report.ambiguous_candidates ?? [];
const reviewItems = ambiguousCandidates.map((candidate) => ({
  id: candidate.id,
  text: candidate.text,
  provenance_source_type: candidate.provenance_source_type,
  provenance_source_ref: candidate.provenance_source_ref,
  project_score: candidate.project_score,
  transferable_score: candidate.transferable_score,
  primary_signal: candidate.primary_signal,
  confidence: candidate.confidence,
  project_signals: candidate.project_signals ?? [],
  transferable_signals: candidate.transferable_signals ?? [],
  codex_proposed_resolution: proposeResolution(candidate)
}));

const requestMarkdown = renderRequestMarkdown(report, reviewItems);
const requestPath = path.join(outDir, "lead-session-review-request.md");
writeFileSync(requestPath, requestMarkdown, "utf8");

if (!execute) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        executed: false,
        request_path: requestPath,
        ambiguous_candidates: reviewItems.length
      },
      null,
      2
    )
  );
  process.exit(0);
}

const leadResults = [];
const combinedDecisions = [];
const rawAnswers = [];
for (let offset = 0; offset < reviewItems.length; offset += batchSize) {
  const batch = reviewItems.slice(offset, offset + batchSize);
  const batchNumber = Math.floor(offset / batchSize) + 1;
  const batchTotal = Math.ceil(reviewItems.length / batchSize);
  const batchRequest = renderRequestMarkdown(report, batch, {
    batchNumber,
    batchTotal,
    totalCandidates: reviewItems.length
  });
  const leadResult = await callLeadSession(batch, batchRequest, { batchNumber, batchTotal });
  leadResults.push(leadResult);
  rawAnswers.push(`## Batch ${batchNumber}/${batchTotal}\n\n${leadResult.answer}`);
  const batchReview = parseLeadReview(leadResult.answer);
  validateLeadReview(batchReview, batch);
  combinedDecisions.push(...batchReview.decisions);
}

const rawAnswerPath = path.join(outDir, "lead-session-review-raw.md");
writeFileSync(rawAnswerPath, `${rawAnswers.join("\n\n---\n\n")}\n`, "utf8");
const review = {
  gate: "phase-7-gate-4",
  decisions: combinedDecisions,
  remaining_ambiguous: []
};
validateLeadReview(review, reviewItems);

const reviewJsonPath = path.join(outDir, "lead-session-review.json");
const reviewMarkdownPath = path.join(outDir, "lead-session-review.md");
writeFileSync(
  reviewJsonPath,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      dry_run_report: path.relative(repoRoot, reportPath),
      request_path: path.relative(repoRoot, requestPath),
      raw_answer_path: path.relative(repoRoot, rawAnswerPath),
      route: summarizeRoutes(leadResults),
      session_id: summarizeSessions(leadResults),
      batches: leadResults.map((result, index) => ({
        batch: index + 1,
        route: result.route,
        session_id: result.session_id
      })),
      review
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(reviewMarkdownPath, renderReviewMarkdown(report, reviewItems, leadResults, review), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      executed: true,
      request_path: requestPath,
      review_json_path: reviewJsonPath,
      review_markdown_path: reviewMarkdownPath,
      ambiguous_candidates: reviewItems.length,
      reviewed_candidates: review.decisions.length,
      remaining_ambiguous: review.remaining_ambiguous?.length ?? 0,
      batches: leadResults.length,
      route: summarizeRoutes(leadResults),
      session_id: summarizeSessions(leadResults)
    },
    null,
    2
  )
);

function proposeResolution(candidate) {
  const text = String(candidate.text ?? "");
  const lower = text.toLowerCase();
  const hasProjectSignal = (candidate.project_signals ?? []).some((signal) =>
    ["project_file_path", "repo_feature_name", "project_identity"].includes(signal)
  );
  const hasTransferableSignal = (candidate.transferable_signals ?? []).some((signal) =>
    ["normative_language", "generic_agent_or_router_pattern", "generic_contract_language"].includes(signal)
  );

  if (/halt with signal|stale facts = halt|must not bypass sanity check/i.test(text)) {
    return {
      proposed_decision: "SUSPENDED",
      effective_classification: null,
      reason: "May encode an older router/fallback contract; require lead review before promotion.",
      scope_condition: "Only valid if current router semantics still match this statement."
    };
  }
  if (hasProjectSignal || /\b(MAINTENANCE\.md|cluster_|router_|session_|factsheet|shadow_)/i.test(text)) {
    return {
      proposed_decision: "APPROVED",
      effective_classification: "project-architecture",
      reason: "Mentions router-specific artifacts or implementation vocabulary.",
      scope_condition: "Applies inside AgentSessionRouter unless future review generalizes it."
    };
  }
  if (hasTransferableSignal || /\bmust|never|should|contract|boundary|fallback|agent\b/i.test(lower)) {
    return {
      proposed_decision: "APPROVED",
      effective_classification: "engineering-principles",
      reason: "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      scope_condition: "Apply as advisory guidance; verify against the target project's context."
    };
  }
  return {
    proposed_decision: "REJECTED",
    effective_classification: null,
    reason: "No clear project or transferable signal after Gate 3 scoring tie.",
    scope_condition: null
  };
}

async function callLeadSession(items, requestMarkdownText, batch) {
  const distIndex = path.join(repoRoot, "dist", "src", "index.js");
  if (!existsSync(distIndex)) {
    fail(`Built MCP entry not found at ${distIndex}. Run npm run build first.`);
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [distIndex],
    cwd: repoRoot,
    stderr: "pipe"
  });
  const client = new Client({ name: "codex-phase7-gate4-lead-review", version: "0.1.0" });
  await client.connect(transport);
  try {
    const prompt = [
      "Resolve Phase 7 Gate 4 ambiguous architectural-memory candidates.",
      `This is batch ${batch.batchNumber}/${batch.batchTotal}. Review only the allowed ids in this batch.`,
      "Return JSON only, with this exact shape:",
      '{"gate":"phase-7-gate-4","decisions":[{"id":"AMB-...","lead_decision":"APPROVED|REJECTED|SUSPENDED","effective_classification":"project-architecture|engineering-principles|null","scope_condition":"...","reason":"...","counter_evidence":"..."}],"remaining_ambiguous":[]}',
      "Every candidate id in relevant_code must appear exactly once in decisions.",
      `Allowed ids are exactly: ${items.map((item) => item.id).join(", ")}.`,
      "Do not include any id outside that allowed list, even if remembered from prior session context.",
      "Use Codex proposed resolution as input, but override it when it conflicts with current router architecture."
    ].join(" ");
    const result = await client.callTool(
      {
        name: "router_consult",
        arguments: {
          project_id: null,
          topic_hint: "claude lead operatorless engineering workflow",
          trigger: `Codex requests Phase 7 Gate 4 lead-session review batch ${batch.batchNumber}/${batch.batchTotal}.`,
          task: `Resolve ambiguous architectural memory candidates batch ${batch.batchNumber}/${batch.batchTotal}.`,
          task_type: "review",
          related_files: [
            "experiments/architectural-memory-dry-run-2026-05-16/dry-run-report.json",
            "experiments/architectural-memory-dry-run-2026-05-16/lead-session-review-request.md",
            "docs/CLUSTER_CACHE_SPEC.md"
          ],
          tags: ["architecture-memory", "phase-7", "gate-4", "staging", "lead-review"],
          relevant_code: requestMarkdownText,
          question: prompt
        }
      },
      undefined,
      { timeout: 300000 }
    );
    const payload = parseMcpText(result);
    return {
      route: payload?.route_decision?.selected_path ?? null,
      session_id: payload?.session_id ?? null,
      answer: payload?.answer ?? JSON.stringify(payload)
    };
  } finally {
    await client.close();
  }
}

function parseLeadReview(answer) {
  const text = String(answer ?? "").trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1].trim() : text;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    fail(`Lead review did not return parseable JSON: ${error.message}\n\nRaw answer:\n${text}`);
  }
}

function validateLeadReview(review, items) {
  if (review.gate !== "phase-7-gate-4") {
    fail(`Lead review gate mismatch: expected phase-7-gate-4, got ${review.gate}`);
  }
  if (!Array.isArray(review.decisions)) {
    fail("Lead review JSON missing decisions array");
  }
  const expected = new Set(items.map((item) => item.id));
  const seen = new Set();
  for (const decision of review.decisions) {
    if (!expected.has(decision.id)) {
      fail(`Lead review contains unknown candidate id ${decision.id}`);
    }
    if (seen.has(decision.id)) {
      fail(`Lead review contains duplicate candidate id ${decision.id}`);
    }
    seen.add(decision.id);
    if (!["APPROVED", "REJECTED", "SUSPENDED"].includes(decision.lead_decision)) {
      fail(`Invalid lead_decision for ${decision.id}: ${decision.lead_decision}`);
    }
    if (
      decision.lead_decision === "APPROVED" &&
      !["project-architecture", "engineering-principles"].includes(decision.effective_classification)
    ) {
      fail(`Approved candidate ${decision.id} lacks valid effective_classification`);
    }
    const explanation = [decision.reason, decision.scope_condition, decision.counter_evidence].join(" ");
    if (/no candidate text|text not visible|without content|requires full text/i.test(explanation)) {
      fail(`Lead review for ${decision.id} claims missing text even though the request included it`);
    }
  }
  const missing = [...expected].filter((id) => !seen.has(id));
  if (missing.length > 0) {
    fail(`Lead review missing decisions for: ${missing.join(", ")}`);
  }
}

function renderRequestMarkdown(reportPayload, items, batch = null) {
  const lines = [];
  lines.push("# Phase 7 Gate 4 Lead-Session Review Request");
  lines.push("");
  lines.push(`Generated from: \`${path.relative(repoRoot, reportPath)}\``);
  lines.push(`Dry-run generated_at: ${reportPayload.generated_at}`);
  lines.push(`Ambiguous candidates in this request: ${items.length}`);
  if (batch) {
    lines.push(`Batch: ${batch.batchNumber}/${batch.batchTotal}`);
    lines.push(`Total candidates across all batches: ${batch.totalCandidates}`);
  }
  lines.push("");
  lines.push("Gate 4 resolves ambiguous candidates only. It does not promote memory, write clusters, or mutate runtime state.");
  lines.push("");
  lines.push("For each candidate, lead session must return APPROVED, REJECTED, or SUSPENDED.");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(items.map(toLeadReviewPayload), null, 2));
  lines.push("```");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function toLeadReviewPayload(item) {
  return {
    id: item.id,
    text: item.text,
    project_score: item.project_score,
    transferable_score: item.transferable_score,
    project_signals: item.project_signals,
    transferable_signals: item.transferable_signals,
    codex_proposed_resolution: item.codex_proposed_resolution
  };
}

function renderReviewMarkdown(reportPayload, items, leadResults, review) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const lines = [];
  lines.push("# Phase 7 Gate 4 Lead-Session Review");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Source dry-run: \`${path.relative(repoRoot, reportPath)}\``);
  lines.push(`Dry-run generated_at: ${reportPayload.generated_at}`);
  lines.push(`Lead session: ${summarizeSessions(leadResults)}`);
  lines.push(`Route: ${summarizeRoutes(leadResults)}`);
  lines.push(`Batches: ${leadResults.length}`);
  lines.push(`Reviewed candidates: ${review.decisions.length}`);
  lines.push(`Remaining ambiguous: ${review.remaining_ambiguous?.length ?? 0}`);
  lines.push("");
  lines.push("This is a staging artifact only. No candidate is promoted to a durable principle or project-architecture store in Gate 4.");
  lines.push("");
  lines.push("| id | codex_proposal | lead_decision | effective_classification | reason | scope_condition | counter_evidence |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const decision of review.decisions) {
    const item = byId.get(decision.id);
    const proposal = item?.codex_proposed_resolution?.proposed_decision ?? "-";
    lines.push(
      `| ${escapeCell(decision.id)} | ${escapeCell(proposal)} | ${escapeCell(decision.lead_decision)} | ${escapeCell(decision.effective_classification)} | ${escapeCell(decision.reason)} | ${escapeCell(decision.scope_condition)} | ${escapeCell(decision.counter_evidence)} |`
    );
  }
  lines.push("");
  if ((review.remaining_ambiguous?.length ?? 0) > 0) {
    lines.push("## Remaining Ambiguous");
    lines.push("");
    for (const id of review.remaining_ambiguous) {
      lines.push(`- ${id}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function summarizeRoutes(results) {
  return [...new Set(results.map((result) => result.route).filter(Boolean))].join(", ") || null;
}

function summarizeSessions(results) {
  return [...new Set(results.map((result) => result.session_id).filter(Boolean))].join(", ") || null;
}

function parseMcpText(result) {
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { answer: text };
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("\\n", " ")
    .replaceAll(/\s+/g, " ")
    .replaceAll("|", "\\|")
    .trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

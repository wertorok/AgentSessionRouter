import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = String(args.date ?? new Date().toISOString().slice(0, 10));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `architectural-memory-dry-run-${date}`));
const draftPath = path.resolve(args.draft ?? path.join(outDir, "field-population-draft.json"));
const execute = args.execute === "true" || args.execute === true;
const batchSize = Math.max(1, Number(args.batch_size ?? 12));

if (!existsSync(draftPath)) {
  fail(`Field-population draft not found at ${draftPath}`);
}

mkdirSync(outDir, { recursive: true });

const draft = JSON.parse(readFileSync(draftPath, "utf8"));
const reviewItems = collectReviewItems(draft);
const requestMarkdown = renderRequestMarkdown(draft, reviewItems);
const requestPath = path.join(outDir, "field-review-request.md");
writeFileSync(requestPath, requestMarkdown, "utf8");

if (!execute) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        executed: false,
        request_path: requestPath,
        review_items: reviewItems.length,
        engineering_principles: reviewItems.filter((item) => item.memory_product === "engineering-principles").length,
        project_architecture: reviewItems.filter((item) => item.memory_product === "project-architecture").length
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
  const batchRequest = renderRequestMarkdown(draft, batch, {
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

const review = {
  gate: "phase-7-gate-9-field-review",
  decisions: combinedDecisions,
  remaining_unreviewed: []
};
validateLeadReview(review, reviewItems);

const rawAnswerPath = path.join(outDir, "field-review-raw.md");
const reviewJsonPath = path.join(outDir, "field-review.json");
const reviewMarkdownPath = path.join(outDir, "field-review.md");
writeFileSync(rawAnswerPath, `${rawAnswers.join("\n\n---\n\n")}\n`, "utf8");
writeFileSync(
  reviewJsonPath,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      source_draft: path.relative(repoRoot, draftPath),
      request_path: path.relative(repoRoot, requestPath),
      raw_answer_path: path.relative(repoRoot, rawAnswerPath),
      route: summarizeRoutes(leadResults),
      session_id: summarizeSessions(leadResults),
      batches: leadResults.map((result, index) => ({
        batch: index + 1,
        route: result.route,
        session_id: result.session_id
      })),
      summary: summarizeDecisions(review.decisions),
      review
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(reviewMarkdownPath, renderReviewMarkdown(draft, reviewItems, leadResults, review), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      executed: true,
      request_path: requestPath,
      review_json_path: reviewJsonPath,
      review_markdown_path: reviewMarkdownPath,
      review_items: reviewItems.length,
      reviewed_items: review.decisions.length,
      summary: summarizeDecisions(review.decisions),
      batches: leadResults.length,
      route: summarizeRoutes(leadResults),
      session_id: summarizeSessions(leadResults)
    },
    null,
    2
  )
);

function collectReviewItems(payload) {
  const principles = (payload.engineering_principles ?? []).map((entry) => ({
    id: entry.id,
    memory_product: "engineering-principles",
    status: entry.status,
    field_review_status: entry.field_review_status,
    statement: entry.statement,
    applies_when: entry.applies_when,
    revisit_when: entry.revisit_when,
    provenance_source_ref: entry.provenance?.source_ref ?? null,
    lead_reason: entry.provenance?.lead_reason ?? null,
    counter_evidence: entry.provenance?.counter_evidence ?? null
  }));
  const architecture = (payload.project_architecture ?? []).map((entry) => ({
    id: entry.id,
    memory_product: "project-architecture",
    status: entry.status,
    field_review_status: entry.field_review_status,
    decision: entry.decision,
    rationale: entry.rationale,
    rationale_note: entry.rationale_note,
    project_scope: entry.project_scope,
    provenance_source_ref: entry.provenance?.source_ref ?? null,
    deterministic_signals: entry.provenance?.deterministic_signals ?? null
  }));
  return [...principles, ...architecture];
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
  const client = new Client({ name: "codex-phase7-gate9-field-review", version: "0.1.0" });
  await client.connect(transport);
  try {
    const prompt = [
      "Review Phase 7 Gate 9 field-populated architectural-memory candidates.",
      `This is batch ${batch.batchNumber}/${batch.batchTotal}. Review only the allowed ids in this batch.`,
      "This is FIELD REVIEW ONLY. Do not promote entries, do not mark active, and do not invent runtime serving/import behavior.",
      "All candidate data needed for this batch is included in relevant_code. Do not load files, do not continue a prior review, do not ask for more context.",
      "Your entire answer must be exactly one JSON object. Do not include prose, markdown, or status narration.",
      "Return JSON only, with this exact shape:",
      '{"gate":"phase-7-gate-9-field-review","decisions":[{"id":"...","field_review_status":"APPROVED_FIELDS|REQUEST_CHANGES|SUSPEND","required_changes":["..."],"reason":"..."}],"remaining_unreviewed":[]}',
      "Every candidate id in relevant_code must appear exactly once in decisions.",
      `Allowed ids are exactly: ${items.map((item) => item.id).join(", ")}.`,
      "Do not include any id outside that allowed list, even if remembered from prior session context.",
      "Use APPROVED_FIELDS only when the populated fields are specific enough for future promotion consideration.",
      "Use REQUEST_CHANGES when the candidate is probably valid but fields are too vague, too broad, or need wording fixes.",
      "Use SUSPEND when the candidate should not advance without additional source context or current-code validation.",
      "If uncertain, still return JSON for every allowed id and use SUSPEND with a reason."
    ].join(" ");
    const result = await client.callTool(
      {
        name: "router_consult",
        arguments: {
          project_id: null,
          topic_hint: "claude lead operatorless engineering workflow",
          trigger: `Codex requests Phase 7 Gate 9 field review batch ${batch.batchNumber}/${batch.batchTotal}.`,
          task: `Review field-populated architectural memory candidates batch ${batch.batchNumber}/${batch.batchTotal}.`,
          task_type: "review",
          related_files: [
            "experiments/architectural-memory-dry-run-2026-05-16/field-population-draft.json",
            "experiments/architectural-memory-dry-run-2026-05-16/field-review-request.md",
            "docs/CLUSTER_CACHE_SPEC.md",
            "docs/ENGINEERING_PRINCIPLES.md",
            "docs/PROJECT_ARCHITECTURE.md"
          ],
          tags: ["architecture-memory", "phase-7", "gate-9", "field-review", "lead-review"],
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
  const candidate = fenced ? fenced[1].trim() : extractJsonObject(text);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    fail(`Lead field review did not return parseable JSON: ${error.message}\n\nRaw answer:\n${text}`);
  }
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) {
    return text;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return text.slice(start).replace(/```.*$/s, "").trim();
}

function validateLeadReview(review, items) {
  if (review.gate !== "phase-7-gate-9-field-review") {
    fail(`Lead review gate mismatch: expected phase-7-gate-9-field-review, got ${review.gate}`);
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
    if (!["APPROVED_FIELDS", "REQUEST_CHANGES", "SUSPEND"].includes(decision.field_review_status)) {
      fail(`Invalid field_review_status for ${decision.id}: ${decision.field_review_status}`);
    }
    if (!Array.isArray(decision.required_changes)) {
      fail(`Decision ${decision.id} missing required_changes array`);
    }
    if (!String(decision.reason ?? "").trim()) {
      fail(`Decision ${decision.id} missing reason`);
    }
    if (/\b(active|promote|promotion approved|serve at runtime|import into runtime)\b/i.test(decision.field_review_status)) {
      fail(`Decision ${decision.id} appears to cross promotion boundary`);
    }
  }
  const missing = [...expected].filter((id) => !seen.has(id));
  if (missing.length > 0) {
    fail(`Lead review missing decisions for: ${missing.join(", ")}`);
  }
}

function renderRequestMarkdown(payload, items, batch = null) {
  const lines = [];
  lines.push("# Phase 7 Gate 9 Field Review Request");
  lines.push("");
  lines.push(`Generated from: \`${path.relative(repoRoot, draftPath)}\``);
  lines.push(`Draft generated_at: ${payload.generated_at}`);
  lines.push(`Candidates in this request: ${items.length}`);
  if (batch) {
    lines.push(`Batch: ${batch.batchNumber}/${batch.batchTotal}`);
    lines.push(`Total candidates across all batches: ${batch.totalCandidates}`);
  }
  lines.push("");
  lines.push("Gate 9 reviews populated fields only. It does not promote memory, write clusters, import records, or add a serving path.");
  lines.push("");
  lines.push("For each candidate, lead session must return APPROVED_FIELDS, REQUEST_CHANGES, or SUSPEND.");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(items, null, 2));
  lines.push("```");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderReviewMarkdown(payload, items, leadResults, review) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const summary = summarizeDecisions(review.decisions);
  const lines = [];
  lines.push("# Phase 7 Gate 9 Field Review");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Source draft: \`${path.relative(repoRoot, draftPath)}\``);
  lines.push(`Draft generated_at: ${payload.generated_at}`);
  lines.push(`Lead session: ${summarizeSessions(leadResults)}`);
  lines.push(`Route: ${summarizeRoutes(leadResults)}`);
  lines.push(`Batches: ${leadResults.length}`);
  lines.push("");
  lines.push("This is a field-review artifact only. It does not promote memory, write active records, write clusters, import records, or add runtime serving.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| status | count |");
  lines.push("| --- | ---: |");
  for (const [status, count] of Object.entries(summary.by_status)) {
    lines.push(`| ${escapeCell(status)} | ${count} |`);
  }
  lines.push("");
  lines.push("## Decisions");
  lines.push("");
  lines.push("| id | product | field_review_status | required_changes | reason |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const decision of review.decisions) {
    const item = byId.get(decision.id);
    lines.push(
      `| ${escapeCell(decision.id)} | ${escapeCell(item?.memory_product)} | ${escapeCell(decision.field_review_status)} | ${escapeCell(decision.required_changes.join("; "))} | ${escapeCell(decision.reason)} |`
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summarizeDecisions(decisions) {
  const byStatus = {};
  for (const decision of decisions) {
    byStatus[decision.field_review_status] = (byStatus[decision.field_review_status] ?? 0) + 1;
  }
  return {
    total: decisions.length,
    by_status: byStatus
  };
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
    .replaceAll("\n", " ")
    .replaceAll(/\s+/g, " ")
    .replaceAll("|", "\\|")
    .trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

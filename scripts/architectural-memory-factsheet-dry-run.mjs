import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = String(args.date ?? new Date().toISOString().slice(0, 10));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `architectural-memory-dry-run-${date}`));
const reportPath = path.resolve(args.report ?? path.join(outDir, "dry-run-report.json"));
const reviewPath = path.resolve(args.review ?? path.join(outDir, "lead-session-review.json"));

if (!existsSync(reportPath)) {
  fail(`Dry-run report not found at ${reportPath}`);
}
if (!existsSync(reviewPath)) {
  fail(`Lead-session review not found at ${reviewPath}`);
}

mkdirSync(outDir, { recursive: true });

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const reviewPayload = JSON.parse(readFileSync(reviewPath, "utf8"));
const review = reviewPayload.review;
validateReview(review);

const ambiguousById = new Map((report.ambiguous_candidates ?? []).map((candidate) => [candidate.id, candidate]));
const gate4Rows = review.decisions.map((decision) => ({
  ...decision,
  candidate: ambiguousById.get(decision.id) ?? null
}));

const artifact = {
  generated_at: new Date().toISOString(),
  source_dry_run_report: path.relative(repoRoot, reportPath),
  source_lead_review: path.relative(repoRoot, reviewPath),
  status: "dry_run_only",
  non_authoritative: true,
  project_architecture_carry_forward: report.project_architecture_candidates ?? [],
  gate4_approved_project_architecture: gate4Rows.filter(
    (row) => row.lead_decision === "APPROVED" && row.effective_classification === "project-architecture"
  ),
  gate4_approved_engineering_principles: gate4Rows.filter(
    (row) => row.lead_decision === "APPROVED" && row.effective_classification === "engineering-principles"
  ),
  gate4_suspended: gate4Rows.filter((row) => row.lead_decision === "SUSPENDED"),
  gate4_rejected: gate4Rows.filter((row) => row.lead_decision === "REJECTED"),
  gate3_rejected: report.rejected_candidates ?? [],
  notes: [
    "This artifact compiles reviewed/staged candidates only.",
    "It is not a durable memory store and must not be served as authoritative factsheet evidence.",
    "No LLM verifier or factsheet verifier ran in Gate 5."
  ]
};

const jsonPath = path.join(outDir, "factsheet-dry-run.json");
const markdownPath = path.join(outDir, "factsheet-dry-run.md");
writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
writeFileSync(markdownPath, renderMarkdown(artifact), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      factsheet_json_path: jsonPath,
      factsheet_markdown_path: markdownPath,
      project_architecture_carry_forward: artifact.project_architecture_carry_forward.length,
      gate4_approved_project_architecture: artifact.gate4_approved_project_architecture.length,
      gate4_approved_engineering_principles: artifact.gate4_approved_engineering_principles.length,
      gate4_suspended: artifact.gate4_suspended.length,
      gate4_rejected: artifact.gate4_rejected.length,
      gate3_rejected: artifact.gate3_rejected.length
    },
    null,
    2
  )
);

function validateReview(value) {
  if (value?.gate !== "phase-7-gate-4") {
    fail(`Expected phase-7-gate-4 review, got ${value?.gate}`);
  }
  if (!Array.isArray(value.decisions)) {
    fail("Lead review missing decisions array");
  }
}

function renderMarkdown(artifactPayload) {
  const lines = [];
  lines.push("# Phase 7 Gate 5 Factsheet Dry-Run");
  lines.push("");
  lines.push(`Generated: ${artifactPayload.generated_at}`);
  lines.push(`Source dry-run: \`${artifactPayload.source_dry_run_report}\``);
  lines.push(`Source lead review: \`${artifactPayload.source_lead_review}\``);
  lines.push("");
  lines.push("> Dry-run only. This is not durable memory, not a cluster factsheet, and not verifier-approved evidence.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| bucket | count |");
  lines.push("| --- | ---: |");
  lines.push(`| Gate 3 project-architecture carry-forward | ${artifactPayload.project_architecture_carry_forward.length} |`);
  lines.push(`| Gate 4 approved project-architecture | ${artifactPayload.gate4_approved_project_architecture.length} |`);
  lines.push(`| Gate 4 approved engineering-principles | ${artifactPayload.gate4_approved_engineering_principles.length} |`);
  lines.push(`| Gate 4 suspended | ${artifactPayload.gate4_suspended.length} |`);
  lines.push(`| Gate 4 rejected | ${artifactPayload.gate4_rejected.length} |`);
  lines.push(`| Gate 3 rejected/non-distillable | ${artifactPayload.gate3_rejected.length} |`);
  lines.push("");
  lines.push("## Gate 3 Project-Architecture Carry-Forward");
  lines.push("");
  lines.push("These candidates passed deterministic Gate 3 scoring. They are carried forward for future verifier design, but are not promoted in Gate 5.");
  lines.push("");
  lines.push("| id | topic | decision | provenance | confidence |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const candidate of artifactPayload.project_architecture_carry_forward) {
    lines.push(
      `| ${escapeCell(candidate.id)} | ${escapeCell(candidate.topic)} | ${escapeCell(candidate.decision)} | ${escapeCell(candidate.provenance_source_ref)} | ${escapeCell(candidate.confidence)} |`
    );
  }
  lines.push("");
  lines.push("## Gate 4 Approved Project-Architecture");
  lines.push("");
  renderReviewedRows(lines, artifactPayload.gate4_approved_project_architecture);
  lines.push("");
  lines.push("## Gate 4 Approved Engineering-Principles");
  lines.push("");
  renderReviewedRows(lines, artifactPayload.gate4_approved_engineering_principles);
  lines.push("");
  lines.push("## Suspended");
  lines.push("");
  renderReviewedRows(lines, artifactPayload.gate4_suspended);
  lines.push("");
  lines.push("## Rejected Audit");
  lines.push("");
  renderReviewedRows(lines, artifactPayload.gate4_rejected);
  lines.push("");
  lines.push("## Gate 3 Non-Distillable Audit");
  lines.push("");
  lines.push("| id | source_ref | text | rejection_code | reason |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const candidate of artifactPayload.gate3_rejected) {
    lines.push(
      `| ${escapeCell(candidate.id)} | ${escapeCell(candidate.source_ref)} | ${escapeCell(candidate.text)} | ${escapeCell(candidate.rejection_code)} | ${escapeCell(candidate.reason)} |`
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  for (const note of artifactPayload.notes) {
    lines.push(`- ${note}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderReviewedRows(lines, rows) {
  lines.push("| id | candidate_text | lead_decision | effective_classification | reason | scope_condition | provenance |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  if (rows.length === 0) {
    lines.push("| - | - | - | - | - | - | - |");
    return;
  }
  for (const row of rows) {
    lines.push(
      `| ${escapeCell(row.id)} | ${escapeCell(row.candidate?.text)} | ${escapeCell(row.lead_decision)} | ${escapeCell(row.effective_classification)} | ${escapeCell(row.reason)} | ${escapeCell(row.scope_condition)} | ${escapeCell(row.candidate?.provenance_source_ref)} |`
    );
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

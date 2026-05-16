import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = String(args.date ?? new Date().toISOString().slice(0, 10));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `architectural-memory-dry-run-${date}`));
const factsheetPath = path.resolve(args.factsheet ?? path.join(outDir, "factsheet-dry-run.json"));
const reviewPath = path.resolve(args.review ?? path.join(outDir, "lead-session-review.json"));
const dbPath = path.resolve(args.db ?? path.join(repoRoot, ".claude-session-router", "sessions.sqlite"));
const targetDocPath = args.target_doc ? path.resolve(String(args.target_doc)) : null;

for (const requiredPath of [factsheetPath, reviewPath, dbPath]) {
  if (!existsSync(requiredPath)) {
    fail(`Required input not found: ${requiredPath}`);
  }
}

mkdirSync(outDir, { recursive: true });

const factsheet = JSON.parse(readFileSync(factsheetPath, "utf8"));
const reviewPayload = JSON.parse(readFileSync(reviewPath, "utf8"));
const targetDocText = targetDocPath && existsSync(targetDocPath) ? readFileSync(targetDocPath, "utf8") : "";
const db = new Database(dbPath, { readonly: true });

const candidates = collectCandidates(factsheet);
const candidateResults = candidates.map((candidate) => verifyCandidate(candidate));
const summary = summarize(candidateResults);
const report = {
  generated_at: new Date().toISOString(),
  source_factsheet: path.relative(repoRoot, factsheetPath),
  source_lead_review: path.relative(repoRoot, reviewPath),
  target_doc: targetDocPath ? path.relative(repoRoot, targetDocPath) : null,
  candidate_results: candidateResults,
  summary,
  notes: [
    "Static verifier only. No LLM calls, no cluster writes, and no durable promotion.",
    "promotion_eligible requires verified=true plus durable-record scope/rationale fields.",
    "Current Gate 5 dry-run artifacts are expected to verify provenance but usually fail promotion eligibility until applies_when/revisit_when/rationale are populated."
  ]
};

const jsonPath = path.join(outDir, "verification-report.json");
const markdownPath = path.join(outDir, "verification-report.md");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(markdownPath, renderMarkdown(report), "utf8");

db.close();

console.log(
  JSON.stringify(
    {
      ok: true,
      verification_json_path: jsonPath,
      verification_markdown_path: markdownPath,
      candidates: candidateResults.length,
      verified: summary.verified,
      promotion_eligible: summary.promotion_eligible,
      failed: summary.failed
    },
    null,
    2
  )
);

function collectCandidates(payload) {
  const rows = [];
  for (const candidate of payload.project_architecture_carry_forward ?? []) {
    rows.push({
      candidate_id: candidate.id,
      candidate_type: "project-architecture",
      status_bucket: "gate3_project_architecture",
      text: candidate.decision,
      topic: candidate.topic,
      source_ref: candidate.provenance_source_ref,
      lead_decision: null,
      effective_classification: candidate.classification,
      scope_condition: null,
      raw: candidate
    });
  }
  for (const row of payload.gate4_approved_project_architecture ?? []) {
    rows.push(fromGate4Row(row, "gate4_approved_project_architecture"));
  }
  for (const row of payload.gate4_approved_engineering_principles ?? []) {
    rows.push(fromGate4Row(row, "gate4_approved_engineering_principles"));
  }
  for (const row of payload.gate4_suspended ?? []) {
    rows.push(fromGate4Row(row, "gate4_suspended"));
  }
  for (const row of payload.gate4_rejected ?? []) {
    rows.push(fromGate4Row(row, "gate4_rejected"));
  }
  return rows;
}

function fromGate4Row(row, statusBucket) {
  return {
    candidate_id: row.id,
    candidate_type: row.effective_classification ?? "unknown",
    status_bucket: statusBucket,
    text: row.candidate?.text ?? "",
    topic: null,
    source_ref: row.candidate?.provenance_source_ref ?? null,
    lead_decision: row.lead_decision,
    effective_classification: row.effective_classification,
    scope_condition: row.scope_condition ?? null,
    reason: row.reason ?? null,
    counter_evidence: row.counter_evidence ?? null,
    raw: row
  };
}

function verifyCandidate(candidate) {
  const checksPassed = [];
  const checksFailed = [];
  const failureReasons = [];

  const provenance = resolveProvenance(candidate.source_ref);
  if (provenance.ok) {
    checksPassed.push("provenance_exists");
  } else {
    checksFailed.push("provenance_exists");
    failureReasons.push(provenance.reason);
  }

  if (provenance.ok && sourceTextMatches(candidate, provenance)) {
    checksPassed.push("source_text_matches");
  } else {
    checksFailed.push("source_text_matches");
    failureReasons.push("candidate text does not match the resolved source text");
  }

  const structure = hasCandidateStructure(candidate);
  if (structure.ok) {
    checksPassed.push("structure_complete");
  } else {
    checksFailed.push("structure_complete");
    failureReasons.push(structure.reason);
  }

  const leadReviewRequired = candidate.status_bucket.startsWith("gate4_");
  if (!leadReviewRequired || candidate.lead_decision) {
    checksPassed.push("lead_review_present");
  } else {
    checksFailed.push("lead_review_present");
    failureReasons.push("candidate came from Gate 4 but has no lead decision");
  }

  if (candidate.lead_decision !== "REJECTED" && candidate.lead_decision !== "SUSPENDED") {
    checksPassed.push("not_rejected_or_suspended");
  } else {
    checksFailed.push("not_rejected_or_suspended");
    failureReasons.push(`candidate lead_decision is ${candidate.lead_decision}`);
  }

  if (!hasDirectNegation(candidate.text, provenance.text ?? "")) {
    checksPassed.push("no_direct_negation");
  } else {
    checksFailed.push("no_direct_negation");
    failureReasons.push("candidate appears to mechanically negate source text");
  }

  if (!targetDocText || !targetDocText.includes(candidate.candidate_id)) {
    checksPassed.push("duplicate_id_absent");
  } else {
    checksFailed.push("duplicate_id_absent");
    failureReasons.push(`candidate id already appears in ${targetDocPath}`);
  }

  const promotionBlockers = getPromotionBlockers(candidate);
  const verified = checksFailed.length === 0;
  const promotionEligible =
    verified &&
    candidate.lead_decision === "APPROVED" &&
    candidate.effective_classification !== null &&
    promotionBlockers.length === 0;

  return {
    candidate_id: candidate.candidate_id,
    candidate_type: candidate.candidate_type,
    status_bucket: candidate.status_bucket,
    verified,
    promotion_eligible: promotionEligible,
    checks_passed: checksPassed,
    checks_failed: checksFailed,
    failure_reasons: [...new Set(failureReasons)],
    promotion_blockers: promotionBlockers,
    source_ref: candidate.source_ref,
    lead_decision: candidate.lead_decision,
    effective_classification: candidate.effective_classification,
    text: candidate.text
  };
}

function resolveProvenance(sourceRef) {
  if (!sourceRef) {
    return { ok: false, reason: "missing source_ref", text: null };
  }
  const sessionMatch = /^session:([^;]+);decision:(\d+)$/.exec(sourceRef);
  if (sessionMatch) {
    const row = db
      .prepare("SELECT id, session_id, decision FROM session_decisions WHERE session_id = ? AND id = ?")
      .get(sessionMatch[1], Number(sessionMatch[2]));
    if (!row) {
      return { ok: false, reason: `session decision not found: ${sourceRef}`, text: null };
    }
    return { ok: true, reason: null, text: String(row.decision ?? "") };
  }
  const docMatch = /^docs:([^#]+)#(.+)$/.exec(sourceRef);
  if (docMatch) {
    const docPath = path.resolve(repoRoot, docMatch[1]);
    if (!existsSync(docPath)) {
      return { ok: false, reason: `doc path not found: ${docMatch[1]}`, text: null };
    }
    const content = readFileSync(docPath, "utf8");
    const heading = findHeadingBySlug(content, docMatch[2]);
    if (!heading) {
      return { ok: false, reason: `doc section not found: ${sourceRef}`, text: null };
    }
    return { ok: true, reason: null, text: heading.sectionText };
  }
  return { ok: false, reason: `unsupported source_ref format: ${sourceRef}`, text: null };
}

function sourceTextMatches(candidate, provenance) {
  const candidateText = normalize(candidate.text);
  const sourceText = normalize(provenance.text);
  if (!candidateText || !sourceText) {
    return false;
  }
  const [title, rest] = candidateText.split(/:\s+(.+)/, 2);
  if (title && rest && sourceText.includes(title) && sourceText.includes(rest)) {
    return true;
  }
  return sourceText.includes(candidateText) || candidateText.includes(sourceText);
}

function hasCandidateStructure(candidate) {
  if (!candidate.candidate_id || !candidate.text || !candidate.source_ref) {
    return {
      ok: false,
      reason: "candidate artifact lacks id, text, or source_ref"
    };
  }
  if (candidate.effective_classification === "engineering-principles") {
    return {
      ok: Boolean(candidate.lead_decision),
      reason: "engineering-principle candidate lacks lead review"
    };
  }
  if (candidate.candidate_type === "project-architecture" || candidate.effective_classification === "project-architecture") {
    return {
      ok: true,
      reason: null
    };
  }
  return {
    ok: Boolean(candidate.lead_decision),
    reason: "candidate has no durable target classification"
  };
}

function getPromotionBlockers(candidate) {
  const blockers = [];
  if (candidate.effective_classification === "engineering-principles") {
    if (!candidate.scope_condition) {
      blockers.push("missing_applies_when");
    }
    blockers.push("missing_revisit_when");
  } else if (candidate.candidate_type === "project-architecture" || candidate.effective_classification === "project-architecture") {
    blockers.push("missing_rationale");
    blockers.push("missing_project_scope");
  } else {
    blockers.push("missing_effective_classification");
  }
  if (candidate.lead_decision !== "APPROVED") {
    blockers.push("missing_lead_approval");
  }
  return [...new Set(blockers)];
}

function hasDirectNegation(candidateText, sourceText) {
  const candidate = normalize(candidateText);
  const source = normalize(sourceText);
  if (!candidate || !source || source.includes(candidate) || candidate.includes(source)) {
    return false;
  }
  const pairs = [
    ["always", "never"],
    ["never", "always"],
    ["must", "must not"],
    ["must not", "must"],
    ["should", "should not"],
    ["should not", "should"]
  ];
  return pairs.some(([left, right]) => candidate.includes(left) && source.includes(right) && !source.includes(left));
}

function findHeadingBySlug(content, expectedSlug) {
  const lines = content.split(/\r?\n/);
  let current = null;
  const sections = [];
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      if (current) {
        sections.push(current);
      }
      current = { heading: match[2].trim(), body: "" };
      continue;
    }
    if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) {
    sections.push(current);
  }
  const section = sections.find((item) => slugify(item.heading) === expectedSlug);
  return section ? { heading: section.heading, sectionText: `${section.heading}\n${section.body}` } : null;
}

function summarize(results) {
  const summary = {
    total: results.length,
    verified: results.filter((result) => result.verified).length,
    promotion_eligible: results.filter((result) => result.promotion_eligible).length,
    failed: results.filter((result) => !result.verified).length,
    by_bucket: {},
    failed_checks: {}
  };
  for (const result of results) {
    summary.by_bucket[result.status_bucket] = (summary.by_bucket[result.status_bucket] ?? 0) + 1;
    for (const check of result.checks_failed) {
      summary.failed_checks[check] = (summary.failed_checks[check] ?? 0) + 1;
    }
  }
  return summary;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Phase 7 Gate 6 Static Verification Report");
  lines.push("");
  lines.push(`Generated: ${report.generated_at}`);
  lines.push(`Source factsheet: \`${report.source_factsheet}\``);
  lines.push(`Source lead review: \`${report.source_lead_review}\``);
  lines.push("");
  lines.push("> Static verifier only. This report does not promote memory, write clusters, or create a serving path.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| metric | value |");
  lines.push("| --- | ---: |");
  lines.push(`| total | ${report.summary.total} |`);
  lines.push(`| verified | ${report.summary.verified} |`);
  lines.push(`| promotion_eligible | ${report.summary.promotion_eligible} |`);
  lines.push(`| failed | ${report.summary.failed} |`);
  lines.push("");
  lines.push("## Failed Checks");
  lines.push("");
  lines.push("| check | count |");
  lines.push("| --- | ---: |");
  for (const [check, count] of Object.entries(report.summary.failed_checks)) {
    lines.push(`| ${check} | ${count} |`);
  }
  if (Object.keys(report.summary.failed_checks).length === 0) {
    lines.push("| - | 0 |");
  }
  lines.push("");
  lines.push("## Candidate Results");
  lines.push("");
  lines.push("| id | bucket | type | verified | promotion_eligible | failed_checks | promotion_blockers | reason |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const result of report.candidate_results) {
    lines.push(
      `| ${escapeCell(result.candidate_id)} | ${escapeCell(result.status_bucket)} | ${escapeCell(result.candidate_type)} | ${result.verified} | ${result.promotion_eligible} | ${escapeCell(result.checks_failed.join(", "))} | ${escapeCell(result.promotion_blockers.join(", "))} | ${escapeCell(result.failure_reasons.join("; "))} |`
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  for (const note of report.notes) {
    lines.push(`- ${note}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
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

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

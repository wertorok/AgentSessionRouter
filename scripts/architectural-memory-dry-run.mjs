import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const projectId = String(args.project_id ?? "AgentSessionRouter");
const date = String(args.date ?? new Date().toISOString().slice(0, 10));
const dbPath = path.resolve(args.db ?? path.join(repoRoot, ".claude-session-router", "sessions.sqlite"));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `architectural-memory-dry-run-${date}`));
const experimentsPath = path.resolve(args.experiments ?? path.join(repoRoot, "docs", "EXPERIMENTS.md"));
const writeDocs = args.write_docs !== "false";
const DRY_RUN_HEADING = "### Architectural Memory Dry-Run (Gate 2 + Gate 3 Scoring)";
const LEGACY_DRY_RUN_HEADING = "### Architectural Memory Dry-Run (Gate 2)";

const DOC_SOURCES = [
  "docs/CLUSTER_CACHE_SPEC.md",
  "docs/SHADOW_EVAL_SPEC.md",
  "docs/EXPERIMENTS.md",
  "MAINTENANCE.md"
];

const packageJson = readJsonIfExists(path.join(repoRoot, "package.json"));
const projectIdentityTerms = buildProjectIdentityTerms(packageJson);
const repoFeatureTerms = [
  "router_consult",
  "router_monitor",
  "router_status",
  "router_dry_run",
  "cluster_consult",
  "cluster_reprepare",
  "cluster_prepare",
  "claude_consult",
  "shadow_eval",
  "session_update_json",
  "session_decisions",
  "factsheet",
  "mcp",
  "sqlite"
];
const normativeTerms = ["invariant", "principle", "must", "should", "should not", "never", "always", "required"];
const genericPatternTerms = ["caller", "automated agent", "agent", "router", "fallback", "recovery", "observability"];
const genericContractTerms = ["contract", "interface", "boundary", "verification", "provenance", "review", "scope"];

if (!existsSync(dbPath)) {
  fail(`Router DB not found at ${dbPath}`);
}
if (!existsSync(experimentsPath)) {
  fail(`Experiments doc not found at ${experimentsPath}`);
}

mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const db = new Database(dbPath, { readonly: true });

const decisions = loadSessionDecisions();
const rawResponseStats = loadRawResponseStats();
const docInventory = loadDocInventory();
const docCandidates = buildDocSkeletonCandidates(docInventory);
const rawCandidates = [
  ...decisions.map((row) => ({
    id: `SD-${String(row.id).padStart(6, "0")}`,
    source_kind: "session_decision",
    topic: row.topic || "untitled session",
    text: row.decision,
    provenance_source_type: "session_decision",
    provenance_source_ref: `session:${row.session_id};decision:${row.id}`,
    source_row_id: row.id,
    created_at: row.created_at
  })),
  ...docCandidates.map((candidate, index) => ({
    id: `DOC-${String(index + 1).padStart(4, "0")}`,
    source_kind: "doc_section",
    topic: candidate.heading,
    text: candidate.statement,
    provenance_source_type: "spec",
    provenance_source_ref: `docs:${candidate.path}#${candidate.slug}`
  }))
];
const scoredCandidates = scoreCandidates(rawCandidates);

const report = {
  generated_at: generatedAt,
  project_id: projectId,
  db_path: dbPath,
  output_dir: outDir,
  source_inventory: {
    session_decisions: decisions.length,
    session_events_raw_response_path: rawResponseStats.total,
    session_events_raw_response_path_existing: rawResponseStats.existing,
    docs_reviewed: docInventory.length
  },
  project_architecture_candidates: scoredCandidates.projectArchitecture,
  engineering_principle_candidates: scoredCandidates.engineeringPrinciples,
  ambiguous_candidates: scoredCandidates.ambiguous,
  rejected_candidates: scoredCandidates.rejected,
  scoring_summary: scoredCandidates.summary,
  notes: {
    signal_quality: scoredCandidates.summary.accepted > 0 ? "medium" : "low",
    duplicate_candidates: scoredCandidates.summary.rejected_duplicate,
    classification_confidence: scoredCandidates.summary.confidence,
    signal_summary: scoredCandidates.summary.signals,
    reviewer_observations:
      "Gate 3 is deterministic and LLM-free. Scoring is mechanical signal counting only; no extraction, semantic quality review, applies_when population, or durable memory promotion occurred."
  }
};

const summary = renderMarkdown(report, docInventory, rawResponseStats);
writeFileSync(path.join(outDir, "dry-run-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(path.join(outDir, "summary.md"), summary, "utf8");

if (writeDocs) {
  upsertExperimentsSection(summary);
}

db.close();

console.log(
  JSON.stringify(
    {
      ok: true,
      project_id: projectId,
      out_dir: outDir,
      docs_updated: writeDocs,
      session_decisions: decisions.length,
      raw_response_paths: rawResponseStats.total,
      project_architecture_candidates: report.project_architecture_candidates.length,
      engineering_principle_candidates: report.engineering_principle_candidates.length,
      ambiguous_candidates: report.ambiguous_candidates.length,
      rejected_candidates: report.rejected_candidates.length
    },
    null,
    2
  )
);

function loadSessionDecisions() {
  return db
    .prepare(
      `SELECT d.id,
              d.session_id,
              d.decision,
              d.created_at,
              s.topic,
              s.project_id
       FROM session_decisions d
       JOIN sessions s
         ON s.id = d.session_id
       WHERE s.project_id = ?
       ORDER BY d.id ASC`
    )
    .all(projectId);
}

function loadRawResponseStats() {
  const rows = db
    .prepare(
      `SELECT raw_response_path
       FROM session_events
       WHERE project_id = ?
         AND raw_response_path IS NOT NULL
         AND raw_response_path <> ''
       ORDER BY id ASC`
    )
    .all(projectId);
  const existing = rows.filter((row) => existsSync(String(row.raw_response_path))).length;
  return {
    total: rows.length,
    existing,
    missing: rows.length - existing
  };
}

function loadDocInventory() {
  return DOC_SOURCES.map((relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath);
    const exists = existsSync(absolutePath);
    const content = exists ? readFileSync(absolutePath, "utf8") : "";
    const stats = exists ? statSync(absolutePath) : null;
    return {
      path: relativePath,
      exists,
      last_modified: stats ? stats.mtime.toISOString() : null,
      headings: extractHeadings(content),
      content
    };
  });
}

function buildDocSkeletonCandidates(docs) {
  const candidates = [];
  for (const doc of docs) {
    if (!doc.exists) {
      continue;
    }
    const sections = splitMarkdownSections(doc.content);
    for (const section of sections) {
      const haystack = `${section.heading}\n${section.body}`.toLowerCase();
      if (!haystack.includes("decision") && !haystack.includes("principle")) {
        continue;
      }
      const firstLine = section.body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith("|") && !line.startsWith("---"));
      const statement = firstLine ? `${section.heading}: ${firstLine}` : section.heading;
      candidates.push({
        path: doc.path,
        heading: section.heading,
        slug: slugify(section.heading),
        statement
      });
    }
  }
  return candidates;
}

function splitMarkdownSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let current = null;
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
  return sections;
}

function extractHeadings(content) {
  return content
    .split(/\r?\n/)
    .map((line) => /^(#{1,6})\s+(.+)$/.exec(line))
    .filter(Boolean)
    .map((match) => match[2].trim());
}

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function buildProjectIdentityTerms(pkg) {
  const terms = new Set([projectId.toLowerCase(), "agentsessionrouter"]);
  if (typeof pkg.name === "string") {
    terms.add(pkg.name.toLowerCase());
  }
  if (typeof pkg.homepage === "string") {
    for (const term of pkg.homepage.toLowerCase().split(/[^a-z0-9_.:-]+/)) {
      if (term.length >= 4) {
        terms.add(term);
      }
    }
  }
  if (pkg.repository && typeof pkg.repository.url === "string") {
    for (const term of pkg.repository.url.toLowerCase().split(/[^a-z0-9_.:-]+/)) {
      if (term.length >= 4) {
        terms.add(term);
      }
    }
  }
  return [...terms].filter(Boolean);
}

function scoreCandidates(candidates) {
  const seen = new Set();
  const output = {
    projectArchitecture: [],
    engineeringPrinciples: [],
    ambiguous: [],
    rejected: []
  };
  for (const candidate of candidates) {
    const scored = scoreCandidate(candidate);
    const normalizedText = normalizeDecisionText(candidate.text);
    const rejection = classifyRejection(scored, normalizedText, seen);
    if (rejection) {
      output.rejected.push({
        id: candidate.id,
        source_ref: candidate.provenance_source_ref,
        text: candidate.text,
        rejection_code: rejection.code,
        reason: rejection.reason,
        project_score: scored.project_score,
        transferable_score: scored.transferable_score,
        primary_signal: scored.primary_signal,
        confidence: scored.confidence
      });
      if (normalizedText) {
        seen.add(normalizedText);
      }
      continue;
    }
    seen.add(normalizedText);

    if (scored.classification === "project-architecture") {
      output.projectArchitecture.push({
        id: candidate.source_kind === "session_decision" ? `PA-SD-${String(candidate.source_row_id).padStart(6, "0")}` : `PA-${candidate.id}`,
        topic: candidate.topic,
        decision: candidate.text,
        provenance_source_type: candidate.provenance_source_type,
        provenance_source_ref: candidate.provenance_source_ref,
        status: "proposed",
        classification: scored.classification,
        project_score: scored.project_score,
        transferable_score: scored.transferable_score,
        primary_signal: scored.primary_signal,
        confidence: scored.confidence,
        project_signals: scored.project_signals,
        transferable_signals: scored.transferable_signals
      });
    } else if (scored.classification === "engineering-principles") {
      output.engineeringPrinciples.push({
        id: `EP-${candidate.id}`,
        statement: candidate.text,
        applies_when: "TBD by Gate 4 lead-session review",
        provenance_source_type: candidate.provenance_source_type,
        provenance_source_ref: candidate.provenance_source_ref,
        status: "proposed",
        classification: scored.classification,
        project_score: scored.project_score,
        transferable_score: scored.transferable_score,
        primary_signal: scored.primary_signal,
        confidence: scored.confidence,
        project_signals: scored.project_signals,
        transferable_signals: scored.transferable_signals
      });
    } else {
      output.ambiguous.push({
        id: `AMB-${candidate.id}`,
        text: candidate.text,
        provenance_source_type: candidate.provenance_source_type,
        provenance_source_ref: candidate.provenance_source_ref,
        status: "proposed",
        classification: scored.classification,
        project_score: scored.project_score,
        transferable_score: scored.transferable_score,
        primary_signal: scored.primary_signal,
        confidence: scored.confidence,
        project_signals: scored.project_signals,
        transferable_signals: scored.transferable_signals
      });
    }
  }
  return {
    ...output,
    summary: summarizeScoring(output)
  };
}

function scoreCandidate(candidate) {
  const text = String(candidate.text ?? "");
  const lower = text.toLowerCase();
  const projectSignals = [];
  const transferableSignals = [];

  if (/\b(src|docs|scripts|tests|dist)\/[A-Za-z0-9._/-]+/.test(text) || /\b[A-Za-z0-9_-]+\.(ts|js|mjs|md|json|sql)\b/.test(text)) {
    projectSignals.push("project_file_path");
  }
  if (projectIdentityTerms.some((term) => lower.includes(term))) {
    projectSignals.push("project_identity");
  }
  if (candidate.source_kind === "session_decision") {
    projectSignals.push("current_project_session");
  }
  if (repoFeatureTerms.some((term) => lower.includes(term))) {
    projectSignals.push("repo_feature_name");
  }
  if (/\b(v\d+(?:\.\d+)?|phase\s+\d+|gate\s+\d+|release|benchmark|matrix)\b/i.test(text)) {
    projectSignals.push("version_or_phase_marker");
  }

  if (normativeTerms.some((term) => lower.includes(term))) {
    transferableSignals.push("normative_language");
  }
  if (genericPatternTerms.some((term) => lower.includes(term))) {
    transferableSignals.push("generic_agent_or_router_pattern");
  }
  if (genericContractTerms.some((term) => lower.includes(term))) {
    transferableSignals.push("generic_contract_language");
  }
  if (candidate.provenance_source_type === "spec") {
    transferableSignals.push("spec_source");
  }
  if (projectSignals.length === 0 && transferableSignals.length > 0) {
    transferableSignals.push("no_project_specific_signal");
  }

  const projectScore = projectSignals.length;
  const transferableScore = transferableSignals.length;
  const diff = Math.abs(projectScore - transferableScore);
  const classification =
    projectScore > transferableScore
      ? "project-architecture"
      : transferableScore > projectScore
        ? "engineering-principles"
        : "ambiguous";

  return {
    classification,
    project_score: projectScore,
    transferable_score: transferableScore,
    primary_signal:
      classification === "project-architecture"
        ? projectSignals[0] ?? null
        : classification === "engineering-principles"
          ? transferableSignals[0] ?? null
          : projectSignals[0] ?? transferableSignals[0] ?? null,
    confidence: diff >= 2 ? "high" : diff === 1 ? "medium" : "low",
    project_signals: projectSignals,
    transferable_signals: transferableSignals
  };
}

function classifyRejection(scored, normalizedText, seen) {
  if (normalizedText.length < 20) {
    return {
      code: "rejected_too_short",
      reason: "candidate text is shorter than 20 characters"
    };
  }
  if (seen.has(normalizedText)) {
    return {
      code: "rejected_duplicate",
      reason: "candidate text exactly duplicates an earlier candidate in this dry run"
    };
  }
  if (scored.project_score === 0 && scored.transferable_score === 0) {
    return {
      code: "rejected_no_signal",
      reason: "candidate has zero project or transferable scoring signals"
    };
  }
  return null;
}

function summarizeScoring(output) {
  const allAccepted = [...output.projectArchitecture, ...output.engineeringPrinciples, ...output.ambiguous];
  const confidence = countBy(allAccepted, "confidence");
  const rejected = countBy(output.rejected, "rejection_code");
  const projectSignals = countSignals(allAccepted, "project_signals");
  const transferableSignals = countSignals(allAccepted, "transferable_signals");
  return {
    accepted: allAccepted.length,
    project_architecture: output.projectArchitecture.length,
    engineering_principles: output.engineeringPrinciples.length,
    ambiguous: output.ambiguous.length,
    rejected: output.rejected.length,
    rejected_too_short: rejected.rejected_too_short ?? 0,
    rejected_duplicate: rejected.rejected_duplicate ?? 0,
    rejected_no_signal: rejected.rejected_no_signal ?? 0,
    confidence,
    signals: {
      project: projectSignals,
      transferable: transferableSignals
    }
  };
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) {
    const value = row[field] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function countSignals(rows, field) {
  const counts = {};
  for (const row of rows) {
    for (const signal of row[field] ?? []) {
      counts[signal] = (counts[signal] ?? 0) + 1;
    }
  }
  return counts;
}

function normalizeDecisionText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function renderMarkdown(reportPayload, docs, rawStats) {
  const lines = [];
  lines.push(DRY_RUN_HEADING);
  lines.push("");
  lines.push("This is a deterministic, LLM-free dry run. It writes no cluster data, no principle store, and no durable architectural memory beyond this report artifact. Gate 3 scoring is mechanical signal counting only; it does not evaluate semantic quality or promote memory.");
  lines.push("");
  lines.push(`Full artifact: \`${path.relative(repoRoot, outDir)}/\``);
  lines.push("");
  lines.push(`Generated: ${reportPayload.generated_at}`);
  lines.push(`Project: ${reportPayload.project_id}`);
  lines.push(`Source rows reviewed: ${reportPayload.source_inventory.session_decisions}`);
  lines.push(`Source docs reviewed: ${reportPayload.source_inventory.docs_reviewed}`);
  lines.push(`Skipped as non-distillable: ${reportPayload.rejected_candidates.length}`);
  lines.push(`Ambiguous candidates for future lead review: ${reportPayload.ambiguous_candidates.length}`);
  lines.push("");
  lines.push("#### Source Inventory");
  lines.push("");
  lines.push("| source | type | record_count | last_modified |");
  lines.push("| --- | --- | ---: | --- |");
  lines.push(`| session_decisions | table | ${reportPayload.source_inventory.session_decisions} | - |`);
  lines.push(`| session_events.raw_response_path | column | ${rawStats.total} (${rawStats.existing} existing, ${rawStats.missing} missing) | - |`);
  for (const doc of docs) {
    lines.push(`| ${escapeCell(doc.path)} | file | ${doc.headings.length} headings | ${doc.last_modified ?? "missing"} |`);
  }
  lines.push("");
  lines.push("#### Project-Architecture Skeleton Candidates");
  lines.push("");
  lines.push("| id | topic | decision (verbatim) | provenance.source_type | provenance.source_ref | status | project_score | transferable_score | primary_signal | confidence |");
  lines.push("| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |");
  for (const candidate of reportPayload.project_architecture_candidates) {
    lines.push(
      `| ${candidate.id} | ${escapeCell(candidate.topic)} | ${escapeCell(candidate.decision)} | ${candidate.provenance_source_type} | ${escapeCell(candidate.provenance_source_ref)} | ${candidate.status} | ${candidate.project_score} | ${candidate.transferable_score} | ${escapeCell(candidate.primary_signal)} | ${candidate.confidence} |`
    );
  }
  lines.push("");
  lines.push("#### Engineering-Principle Skeleton Candidates");
  lines.push("");
  lines.push("| id | statement (verbatim/skeleton) | applies_when | provenance.source_type | provenance.source_ref | status | project_score | transferable_score | primary_signal | confidence |");
  lines.push("| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |");
  if (reportPayload.engineering_principle_candidates.length === 0) {
    lines.push("| - | - | - | - | - | - | - | - | - | - |");
  } else {
    for (const candidate of reportPayload.engineering_principle_candidates) {
      lines.push(
        `| ${candidate.id} | ${escapeCell(candidate.statement)} | ${escapeCell(candidate.applies_when)} | ${candidate.provenance_source_type} | ${escapeCell(candidate.provenance_source_ref)} | ${candidate.status} | ${candidate.project_score} | ${candidate.transferable_score} | ${escapeCell(candidate.primary_signal)} | ${candidate.confidence} |`
      );
    }
  }
  lines.push("");
  lines.push("#### Ambiguous Candidates");
  lines.push("");
  lines.push("| id | text (verbatim/skeleton) | provenance.source_type | provenance.source_ref | project_score | transferable_score | primary_signal | confidence |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | --- | --- |");
  if (reportPayload.ambiguous_candidates.length === 0) {
    lines.push("| - | - | - | - | - | - | - | - |");
  } else {
    for (const candidate of reportPayload.ambiguous_candidates) {
      lines.push(
        `| ${candidate.id} | ${escapeCell(candidate.text)} | ${candidate.provenance_source_type} | ${escapeCell(candidate.provenance_source_ref)} | ${candidate.project_score} | ${candidate.transferable_score} | ${escapeCell(candidate.primary_signal)} | ${candidate.confidence} |`
      );
    }
  }
  lines.push("");
  lines.push("#### Rejected Candidates");
  lines.push("");
  lines.push("| id | source_ref | text (verbatim/skeleton) | rejection_code | reason | project_score | transferable_score |");
  lines.push("| --- | --- | --- | --- | --- | ---: | ---: |");
  if (reportPayload.rejected_candidates.length === 0) {
    lines.push("| - | - | - | - | none | - | - |");
  } else {
    for (const candidate of reportPayload.rejected_candidates) {
      lines.push(
        `| ${candidate.id} | ${escapeCell(candidate.source_ref)} | ${escapeCell(candidate.text)} | ${candidate.rejection_code} | ${escapeCell(candidate.reason)} | ${candidate.project_score} | ${candidate.transferable_score} |`
      );
    }
  }
  lines.push("");
  lines.push("#### Notes");
  lines.push("");
  lines.push(`- signal_quality: ${reportPayload.notes.signal_quality}`);
  lines.push(`- duplicate_candidates: ${reportPayload.notes.duplicate_candidates}`);
  lines.push(`- classification_confidence: ${JSON.stringify(reportPayload.notes.classification_confidence)}`);
  lines.push(`- signal_summary: ${JSON.stringify(reportPayload.notes.signal_summary)}`);
  lines.push(`- reviewer_observations: ${reportPayload.notes.reviewer_observations}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function upsertExperimentsSection(summary) {
  const content = readFileSync(experimentsPath, "utf8");
  const decisionsHeading = "\n## Decisions";
  let next = content;
  const existingIndex =
    content.indexOf(`\n${DRY_RUN_HEADING}\n`) >= 0
      ? content.indexOf(`\n${DRY_RUN_HEADING}\n`)
      : content.indexOf(`\n${LEGACY_DRY_RUN_HEADING}\n`);
  if (existingIndex >= 0) {
    const afterExisting = content.indexOf(decisionsHeading, existingIndex);
    if (afterExisting < 0) {
      fail(`Could not locate '${decisionsHeading.trim()}' after existing Gate 2 section in ${experimentsPath}`);
    }
    next = `${content.slice(0, existingIndex + 1)}${summary}${content.slice(afterExisting)}`;
  } else {
    const insertAt = content.indexOf(decisionsHeading);
    if (insertAt < 0) {
      fail(`Could not locate '${decisionsHeading.trim()}' in ${experimentsPath}`);
    }
    next = `${content.slice(0, insertAt)}\n${summary}${content.slice(insertAt)}`;
  }
  writeFileSync(experimentsPath, next, "utf8");
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("\\n", " ")
    .replaceAll(/\s+/g, " ")
    .replaceAll("|", "\\|")
    .trim();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

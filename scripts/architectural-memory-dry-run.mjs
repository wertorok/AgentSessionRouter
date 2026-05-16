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

const DOC_SOURCES = [
  "docs/CLUSTER_CACHE_SPEC.md",
  "docs/SHADOW_EVAL_SPEC.md",
  "docs/EXPERIMENTS.md",
  "MAINTENANCE.md"
];

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
const sessionCandidates = decisions.map((row, index) => ({
  id: `PA-SD-${String(row.id).padStart(6, "0")}`,
  topic: row.topic || "untitled session",
  decision: row.decision,
  provenance_source_type: "session_decision",
  provenance_source_ref: `session:${row.session_id};decision:${row.id}`,
  status: "proposed",
  source_row_id: row.id,
  created_at: row.created_at
}));

const projectDocCandidates = docCandidates
  .filter((candidate) => candidate.classification === "project-architecture")
  .map((candidate, index) => ({
    id: `PA-DOC-${String(index + 1).padStart(4, "0")}`,
    topic: candidate.heading,
    decision: candidate.statement,
    provenance_source_type: "spec",
    provenance_source_ref: `docs:${candidate.path}#${candidate.slug}`,
    status: "proposed"
  }));

const principleCandidates = docCandidates
  .filter((candidate) => candidate.classification === "engineering-principles")
  .map((candidate, index) => ({
    id: `EP-DOC-${String(index + 1).padStart(4, "0")}`,
    statement: candidate.statement,
    applies_when: "TBD by Gate 3 reviewer rules",
    provenance_source_type: "spec",
    provenance_source_ref: `docs:${candidate.path}#${candidate.slug}`,
    status: "proposed"
  }));

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
  project_architecture_candidates: [...sessionCandidates, ...projectDocCandidates],
  engineering_principle_candidates: principleCandidates,
  rejected_candidates: [],
  notes: {
    signal_quality: decisions.length > 0 || docCandidates.length > 0 ? "medium" : "low",
    duplicate_candidates: countDuplicateDecisions(decisions),
    reviewer_observations:
      "Gate 2 is deterministic and LLM-free. Candidates are skeletons only; no quality review, applies_when population, or durable memory promotion occurred."
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
        statement,
        classification: classifyDocCandidate(doc.path, statement)
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

function classifyDocCandidate(relativePath, statement) {
  const lower = `${relativePath}\n${statement}`.toLowerCase();
  const projectSignals = [
    "agentsessionrouter",
    "routeDecision.ts".toLowerCase(),
    "router_consult",
    "cluster_consult",
    "claude_consult",
    "session_decisions",
    "router_monitor",
    "factsheet",
    "mcp",
    "sqlite"
  ];
  return projectSignals.some((signal) => lower.includes(signal)) ? "project-architecture" : "engineering-principles";
}

function renderMarkdown(reportPayload, docs, rawStats) {
  const lines = [];
  lines.push("### Architectural Memory Dry-Run (Gate 2)");
  lines.push("");
  lines.push("This is a deterministic, LLM-free dry run. It writes no cluster data, no principle store, and no durable architectural memory beyond this report artifact.");
  lines.push("");
  lines.push(`Full artifact: \`${path.relative(repoRoot, outDir)}/\``);
  lines.push("");
  lines.push(`Generated: ${reportPayload.generated_at}`);
  lines.push(`Project: ${reportPayload.project_id}`);
  lines.push(`Source rows reviewed: ${reportPayload.source_inventory.session_decisions}`);
  lines.push(`Source docs reviewed: ${reportPayload.source_inventory.docs_reviewed}`);
  lines.push("Skipped as non-distillable: 0");
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
  lines.push("| id | topic | decision (verbatim) | provenance.source_type | provenance.source_ref | status |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const candidate of reportPayload.project_architecture_candidates) {
    lines.push(
      `| ${candidate.id} | ${escapeCell(candidate.topic)} | ${escapeCell(candidate.decision)} | ${candidate.provenance_source_type} | ${escapeCell(candidate.provenance_source_ref)} | ${candidate.status} |`
    );
  }
  lines.push("");
  lines.push("#### Engineering-Principle Skeleton Candidates");
  lines.push("");
  lines.push("| id | statement (verbatim/skeleton) | applies_when | provenance.source_type | provenance.source_ref | status |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  if (reportPayload.engineering_principle_candidates.length === 0) {
    lines.push("| - | - | - | - | - | - |");
  } else {
    for (const candidate of reportPayload.engineering_principle_candidates) {
      lines.push(
        `| ${candidate.id} | ${escapeCell(candidate.statement)} | ${escapeCell(candidate.applies_when)} | ${candidate.provenance_source_type} | ${escapeCell(candidate.provenance_source_ref)} | ${candidate.status} |`
      );
    }
  }
  lines.push("");
  lines.push("#### Rejected Candidates");
  lines.push("");
  lines.push("| source_ref | rejection_code | reason |");
  lines.push("| --- | --- | --- |");
  lines.push("| - | - | none; Gate 2 does not evaluate candidate quality |");
  lines.push("");
  lines.push("#### Notes");
  lines.push("");
  lines.push(`- signal_quality: ${reportPayload.notes.signal_quality}`);
  lines.push(`- duplicate_candidates: ${reportPayload.notes.duplicate_candidates}`);
  lines.push(`- reviewer_observations: ${reportPayload.notes.reviewer_observations}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function upsertExperimentsSection(summary) {
  const content = readFileSync(experimentsPath, "utf8");
  const heading = "### Architectural Memory Dry-Run (Gate 2)";
  const decisionsHeading = "\n## Decisions";
  let next = content;
  const existingIndex = content.indexOf(`\n${heading}\n`);
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

function countDuplicateDecisions(rows) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const key = String(row.decision).trim().toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }
  return duplicates;
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

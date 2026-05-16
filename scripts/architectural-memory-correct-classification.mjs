#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const args = parseArgs(process.argv.slice(2));
const activeDate = args.active_date ?? new Date().toISOString().slice(0, 10);
const generatedAt = args.generated_at ?? `${activeDate}T00:00:00.000Z`;
const outDir = path.resolve(
  args.out_dir ?? path.join(repoRoot, "experiments", "architectural-memory-dry-run-2026-05-16")
);
const engineeringPrinciplesPath = path.resolve(
  args.engineering_principles ?? path.join(repoRoot, "docs", "ENGINEERING_PRINCIPLES.md")
);
const projectArchitecturePath = path.resolve(
  args.project_architecture ?? path.join(repoRoot, "docs", "PROJECT_ARCHITECTURE.md")
);

const moveToProjectIds = new Set([
  "AMB-SD-000007",
  "AMB-SD-000116",
  "AMB-SD-000121",
  "AMB-SD-000122",
  "AMB-SD-000123"
]);

const counterEvidenceById = {
  "AMB-DOC-0008":
    "Do not apply when classification is subjective and has no auditable deterministic signals; redesign the rubric before treating scores as evidence.",
  "AMB-SD-000035":
    "Do not apply when a metric is intentionally part of a public product/API contract; document that contract explicitly.",
  "AMB-SD-000039":
    "Do not apply to explicit forensic inspection of dead sessions; production answering must still avoid silently reusing dead sessions.",
  "AMB-SD-000041":
    "Do not apply only when a health check is known false-negative and bounded manual use is explicitly approved; otherwise block auto-routing.",
  "AMB-SD-000050":
    "Do not apply when no safe fallback exists and correctness requires fail-closed behavior; escalate instead of serving stale data.",
  "AMB-SD-000051":
    "Do not apply when evidence is immutable and cryptographically pinned; otherwise mark unverified data as unsafe until revalidated.",
  "AMB-SD-000060":
    "Do not apply when secondary routing uses no session facts or metadata; if metadata is unavailable, route conservatively.",
  "AMB-SD-000061":
    "Do not apply only when memory is current by construction; otherwise stale-memory risk must be visible."
};

const rescuePrinciples = [
  {
    id: "AMB-RESCUE-0001",
    statement:
      "Evaluation and telemetry paths must not affect caller-facing answers; observation must remain separate from production response behavior.",
    applies_when:
      "Apply to shadow evaluation, telemetry, benchmarking, and monitoring paths that run beside a production answer path.",
    revisit_when:
      "When evaluation output intentionally becomes part of product behavior.; When monitor/adversarial evidence shows telemetry mutates caller-facing answers.",
    counter_evidence:
      "If the caller explicitly requests comparison/evaluation output as the product result, expose that behavior as part of the contract instead of treating it as hidden telemetry.",
    provenance:
      "session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:89; session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:90; session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:114",
    rescued_from: ["AMB-SD-000089", "AMB-SD-000090", "AMB-SD-000114"]
  },
  {
    id: "AMB-RESCUE-0002",
    statement:
      "Untrusted or stale evidence must produce an explicit signal and safe fallback, not silent use of stale data.",
    applies_when:
      "Apply to caches, factsheets, session memory, evidence stores, and any derived context that can drift from its source.",
    revisit_when:
      "When fallback policy changes.; When stale signals become noisy.; When correctness requires fail-closed behavior instead of fallback.",
    counter_evidence:
      "If the evidence can be fully revalidated before use, the explicit signal may remain internal; never silently use evidence that cannot be revalidated.",
    provenance:
      "session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:52; session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:53; session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:62",
    rescued_from: ["AMB-SD-000052", "AMB-SD-000053", "AMB-SD-000062"]
  },
  {
    id: "AMB-RESCUE-0003",
    statement:
      "Verified evidence artifacts should be the operational source of truth; opaque model or session state must not be the only authority.",
    applies_when:
      "Apply when an agent/router can choose between verified artifacts and opaque conversational state for durable decisions.",
    revisit_when:
      "When artifact verification becomes stale.; When live source data contradicts the verified artifact.; When a new trusted storage authority is introduced.",
    counter_evidence:
      "If the verified artifact is stale or lower trust than current source data, revalidate or regenerate it before treating it as authority.",
    provenance: "docs:docs/EXPERIMENTS.md#decisions",
    rescued_from: ["AMB-DOC-0018"]
  },
  {
    id: "AMB-RESCUE-0004",
    statement:
      "Runtime-served principles need applicability conditions and an explicit rejection or counter-evidence path to avoid dogmatization.",
    applies_when:
      "Apply to any durable principle, policy, or memory item that may influence future agent behavior at runtime.",
    revisit_when:
      "When runtime serving semantics change.; When a principle is applied outside its scope.; When counter-evidence appears in monitor, review, or production data.",
    counter_evidence:
      "If a principle lacks concrete applicability and counter-evidence fields, keep it advisory/docs-only and do not serve it as normative runtime memory.",
    provenance: "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:187",
    rescued_from: ["AMB-SD-000187"]
  },
  {
    id: "AMB-RESCUE-0005",
    statement:
      "Durable architectural memory must have diffable provenance; hidden model-memory must not become the authority.",
    applies_when:
      "Apply when architectural memory persists across sessions, projects, agents, or release phases.",
    revisit_when:
      "When the provenance model changes.; When a new non-diffable trusted memory store is introduced.; When active memory cannot be traced to an artifact.",
    counter_evidence:
      "If no diffable artifact or explicit provenance exists, treat the memory as transient context only and do not promote or serve it.",
    provenance: "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:202",
    rescued_from: ["AMB-SD-000202"]
  }
];

const engineeringDoc = parseDoc(engineeringPrinciplesPath);
const projectDoc = parseDoc(projectArchitecturePath);
const movedRows = [];
const retainedEngineeringRows = [];

for (const row of engineeringDoc.rows) {
  if (moveToProjectIds.has(row.id)) {
    movedRows.push(row);
  } else {
    retainedEngineeringRows.push({
      ...row,
      counter_evidence:
        row.counter_evidence ||
        counterEvidenceById[row.id] ||
        "Revisit before runtime serving if no concrete counter-evidence condition exists."
    });
  }
}

const existingEngineeringIds = new Set(retainedEngineeringRows.map((row) => row.id));
const rescueRows = rescuePrinciples.filter((principle) => !existingEngineeringIds.has(principle.id)).map((principle) => ({
  id: principle.id,
  status: "status: active",
  active_date: activeDate,
  field_review_status: "APPROVED_FIELDS",
  statement: principle.statement,
  applies_when: principle.applies_when,
  revisit_when: principle.revisit_when,
  counter_evidence: principle.counter_evidence,
  provenance: principle.provenance,
  promotion_requirements:
    "Gate 12.5 lead-session rescue approval; active source-of-truth write; separate runtime import/serving gate before any router use",
  rescued_from: principle.rescued_from
}));

const projectRowsFromMoves = movedRows.map((row) => ({
  id: row.id,
  status: "status: active",
  active_date: activeDate,
  field_review_status: row.field_review_status,
  decision: row.statement,
  rationale:
    "Gate 12.5 reclassified this active record from engineering-principles to project-architecture because its exact wording is AgentSessionRouter-specific.",
  project_scope: "project_id=AgentSessionRouter; boundary_ref=https://github.com/wertorok/AgentSessionRouter.git",
  provenance: row.provenance,
  promotion_requirements:
    "Gate 12.5 lead-session reclassification approval; active source-of-truth write; separate runtime import/serving gate before any router use",
  reclassified_from: "engineering-principles"
}));

const nextEngineeringRows = [...retainedEngineeringRows, ...rescueRows].sort((left, right) => left.id.localeCompare(right.id));
const nextProjectRows = [...projectDoc.rows, ...projectRowsFromMoves].sort((left, right) => left.id.localeCompare(right.id));

writeEngineeringDoc(engineeringPrinciplesPath, nextEngineeringRows);
writeProjectDoc(projectArchitecturePath, nextProjectRows);

const reportPayload = {
  generated_at: generatedAt,
  status: "classification_corrected",
  active_date: activeDate,
  counts: {
    engineering_principles_before: nextEngineeringRows.length - rescuePrinciples.length + moveToProjectIds.size,
    engineering_principles_after: nextEngineeringRows.length,
    project_architecture_before: nextProjectRows.length - moveToProjectIds.size,
    project_architecture_after: nextProjectRows.length,
    moved_to_project_architecture: moveToProjectIds.size,
    rescued_engineering_principles: rescuePrinciples.length,
    active_records_total_after: nextEngineeringRows.length + nextProjectRows.length
  },
  moved_to_project_architecture: [...moveToProjectIds].map((id) => {
    const row = nextProjectRows.find((candidate) => candidate.id === id);
    return {
      id,
      decision: row?.decision ?? "",
      reason:
        row?.rationale ??
        "Gate 12.5 reclassified this active record from engineering-principles to project-architecture because its exact wording is AgentSessionRouter-specific."
    };
  }),
  rescued_engineering_principles: rescuePrinciples.map((principle) => ({
    id: principle.id,
    statement: principle.statement,
    rescued_from: principle.rescued_from
  })),
  classifier_limitation:
    "Gate 12.5 is a manual correction. The deterministic distill classifier remains known-weak because it judged wording and artifact specificity more than semantic transferability in both directions.",
  scope: {
    runtime_import_serving: false,
    cluster_writes: false,
    router_behavior_changes: false,
    classifier_algorithm_changed: false
  }
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "classification-correction.json"), `${JSON.stringify(reportPayload, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "classification-correction.md"), renderReportMarkdown(reportPayload));
console.log(JSON.stringify(reportPayload.counts, null, 2));

function parseDoc(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const tableLines = text.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| ---"));
  const header = splitRow(tableLines[0]);
  const rows = tableLines.slice(1).map((line) => {
    const values = splitRow(line);
    return Object.fromEntries(header.map((key, index) => [normalizeHeader(key), values[index] ?? ""]));
  });
  return { header, rows };
}

function writeEngineeringDoc(filePath, rows) {
  const lines = [];
  lines.push("---");
  lines.push("# Canonical source of truth for transferable engineering invariants.");
  lines.push("# Active source-of-truth records. Runtime serving/import is not enabled.");
  lines.push("# See docs/CLUSTER_CACHE_SPEC.md Phase 7 architectural memory gates.");
  lines.push("memory_product: engineering-principles");
  lines.push("status: promoted_source_of_truth");
  lines.push(`generated_at: ${generatedAt}`);
  lines.push("classification_correction_gate: Gate 12.5");
  lines.push("proposed_records: 0");
  lines.push(`active_records: ${rows.length}`);
  lines.push("---");
  lines.push("");
  lines.push("# Engineering Principles");
  lines.push("");
  lines.push("> Active source-of-truth records only. These entries are not imported or served by the router.");
  lines.push("");
  lines.push("| id | status | active_date | field_review_status | statement | applies_when | revisit_when | counter_evidence | provenance | promotion_requirements |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${escapeCell(row.id)} | ${escapeCell(row.status)} | ${escapeCell(row.active_date)} | ${escapeCell(row.field_review_status)} | ${escapeCell(row.statement)} | ${escapeCell(row.applies_when)} | ${escapeCell(row.revisit_when)} | ${escapeCell(row.counter_evidence)} | ${escapeCell(row.provenance)} | ${escapeCell(row.promotion_requirements)} |`
    );
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function writeProjectDoc(filePath, rows) {
  const lines = [];
  lines.push("---");
  lines.push("# Canonical source of truth for project-scoped architecture decisions.");
  lines.push("# Active source-of-truth records. Runtime serving/import is not enabled.");
  lines.push("# See docs/CLUSTER_CACHE_SPEC.md Phase 7 architectural memory gates.");
  lines.push("memory_product: project-architecture");
  lines.push("status: promoted_source_of_truth");
  lines.push(`generated_at: ${generatedAt}`);
  lines.push("classification_correction_gate: Gate 12.5");
  lines.push("proposed_records: 0");
  lines.push(`active_records: ${rows.length}`);
  lines.push("---");
  lines.push("");
  lines.push("# Project Architecture");
  lines.push("");
  lines.push("> Active source-of-truth records only. These entries are not imported or served by the router.");
  lines.push("");
  lines.push("| id | status | active_date | field_review_status | decision | rationale | project_scope | provenance | promotion_requirements |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${escapeCell(row.id)} | ${escapeCell(row.status)} | ${escapeCell(row.active_date)} | ${escapeCell(row.field_review_status)} | ${escapeCell(row.decision)} | ${escapeCell(row.rationale)} | ${escapeCell(row.project_scope)} | ${escapeCell(row.provenance)} | ${escapeCell(row.promotion_requirements)} |`
    );
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function renderReportMarkdown(reportPayload) {
  const lines = [];
  lines.push("# Phase 7 Gate 12.5 Classification Correction");
  lines.push("");
  lines.push(`Generated: ${reportPayload.generated_at}`);
  lines.push(`Status: \`${reportPayload.status}\``);
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  for (const [key, value] of Object.entries(reportPayload.counts)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push("");
  lines.push("## Moved To Project Architecture");
  lines.push("");
  for (const row of reportPayload.moved_to_project_architecture) {
    lines.push(`- ${row.id}: ${row.decision}`);
  }
  lines.push("");
  lines.push("## Rescued Engineering Principles");
  lines.push("");
  for (const row of reportPayload.rescued_engineering_principles) {
    lines.push(`- ${row.id}: ${row.statement}`);
  }
  lines.push("");
  lines.push("## Known Limitation");
  lines.push("");
  lines.push(reportPayload.classifier_limitation);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push("- Runtime import/serving: false");
  lines.push("- Cluster writes: false");
  lines.push("- Router behavior changes: false");
  lines.push("- Classifier algorithm changed: false");
  return `${lines.join("\n")}\n`;
}

function splitRow(line) {
  const raw = line.trim().slice(1, -1);
  const cells = [];
  let current = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "|" && raw[index - 1] !== "\\") {
      cells.push(unescapeCell(current));
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(unescapeCell(current));
  return cells.map((cell) => cell.trim());
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replaceAll(" ", "_");
}

function unescapeCell(value) {
  return value.replaceAll("\\|", "|");
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("\n", " ")
    .replaceAll(/\s+/g, " ")
    .replaceAll("|", "\\|")
    .trim();
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index];
    if (!current.startsWith("--")) {
      continue;
    }
    const key = current.slice(2).replaceAll("-", "_");
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

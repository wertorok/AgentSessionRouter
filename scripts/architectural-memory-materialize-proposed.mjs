import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = String(args.date ?? new Date().toISOString().slice(0, 10));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `architectural-memory-dry-run-${date}`));
const draftPath = path.resolve(args.draft ?? path.join(outDir, "field-population-draft.json"));
const reviewPath = path.resolve(args.review ?? path.join(outDir, "field-review.json"));
const resolutionPath = path.resolve(args.resolution ?? path.join(outDir, "request-changes-resolution.json"));
const engineeringPrinciplesPath = path.resolve(args.engineering_principles ?? path.join(repoRoot, "docs", "ENGINEERING_PRINCIPLES.md"));
const projectArchitecturePath = path.resolve(args.project_architecture ?? path.join(repoRoot, "docs", "PROJECT_ARCHITECTURE.md"));

for (const requiredPath of [draftPath, reviewPath, resolutionPath]) {
  if (!existsSync(requiredPath)) {
    fail(`Required input not found: ${requiredPath}`);
  }
}

mkdirSync(outDir, { recursive: true });

const draft = JSON.parse(readFileSync(draftPath, "utf8"));
const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const resolution = JSON.parse(readFileSync(resolutionPath, "utf8"));
const generatedAt = new Date().toISOString();

const reviewById = new Map((review.review?.decisions ?? []).map((decision) => [decision.id, decision]));
const resolutionById = new Map((resolution.actions ?? []).map((action) => [action.id, action]));

const principles = [];
const projectDecisions = [];
const excluded = [];

for (const entry of draft.engineering_principles ?? []) {
  const materialized = materializePrinciple(entry);
  if (materialized.include) {
    principles.push(materialized.record);
  } else {
    excluded.push(materialized.excluded);
  }
}

for (const entry of draft.project_architecture ?? []) {
  const materialized = materializeProjectDecision(entry);
  if (materialized.include) {
    projectDecisions.push(materialized.record);
  } else {
    excluded.push(materialized.excluded);
  }
}

principles.sort((left, right) => left.id.localeCompare(right.id));
projectDecisions.sort((left, right) => left.id.localeCompare(right.id));

const report = {
  generated_at: generatedAt,
  status: "proposed_records_only",
  source_draft: path.relative(repoRoot, draftPath),
  source_field_review: path.relative(repoRoot, reviewPath),
  source_request_changes_resolution: path.relative(repoRoot, resolutionPath),
  output_docs: {
    engineering_principles: path.relative(repoRoot, engineeringPrinciplesPath),
    project_architecture: path.relative(repoRoot, projectArchitecturePath)
  },
  counts: {
    engineering_principles: principles.length,
    project_architecture: projectDecisions.length,
    proposed_records: principles.length + projectDecisions.length,
    active_records: 0,
    excluded: excluded.length
  },
  excluded,
  notes: [
    "Materialization writes proposed records only.",
    "No record is active.",
    "No runtime import, serving path, or cluster write is added.",
    "Future promotion requires a separate explicit promotion gate."
  ]
};

writeFileSync(engineeringPrinciplesPath, renderEngineeringPrinciplesDoc(principles, report), "utf8");
writeFileSync(projectArchitecturePath, renderProjectArchitectureDoc(projectDecisions, report), "utf8");

const reportJsonPath = path.join(outDir, "materialized-proposed-records.json");
const reportMarkdownPath = path.join(outDir, "materialized-proposed-records.md");
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(reportMarkdownPath, renderReportMarkdown(report), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      engineering_principles_path: engineeringPrinciplesPath,
      project_architecture_path: projectArchitecturePath,
      report_json_path: reportJsonPath,
      report_markdown_path: reportMarkdownPath,
      counts: report.counts
    },
    null,
    2
  )
);

function materializePrinciple(entry) {
  const reviewDecision = reviewById.get(entry.id);
  const resolutionAction = resolutionById.get(entry.id);
  if (resolutionAction?.action === "EXCLUDE_FROM_PROMOTION") {
    return exclude(entry.id, "engineering-principles", resolutionAction.reason);
  }
  if (resolutionAction?.action === "FIX_AND_APPROVE_FIELDS") {
    return {
      include: true,
      record: {
        id: entry.id,
        status: "proposed",
        field_review_status: resolutionAction.field_review_status_after_resolution,
        statement: resolutionAction.replacement_statement,
        applies_when: resolutionAction.applies_when,
        revisit_when: resolutionAction.revisit_when,
        provenance: {
          ...entry.provenance,
          correction: {
            action: resolutionAction.action,
            reason: resolutionAction.reason,
            source: path.relative(repoRoot, resolutionPath)
          }
        },
        promotion_requirements: promotionRequirements()
      }
    };
  }
  if (reviewDecision?.field_review_status !== "APPROVED_FIELDS") {
    return exclude(entry.id, "engineering-principles", `field review status is ${reviewDecision?.field_review_status ?? "missing"}`);
  }
  return {
    include: true,
    record: {
      ...entry,
      field_review_status: reviewDecision.field_review_status,
      field_review_reason: reviewDecision.reason,
      promotion_requirements: promotionRequirements()
    }
  };
}

function materializeProjectDecision(entry) {
  const reviewDecision = reviewById.get(entry.id);
  const resolutionAction = resolutionById.get(entry.id);
  if (resolutionAction?.action === "EXCLUDE_FROM_PROMOTION") {
    return exclude(entry.id, "project-architecture", resolutionAction.reason);
  }
  if (reviewDecision?.field_review_status !== "APPROVED_FIELDS") {
    return exclude(entry.id, "project-architecture", `field review status is ${reviewDecision?.field_review_status ?? "missing"}`);
  }
  return {
    include: true,
    record: {
      ...entry,
      field_review_status: reviewDecision.field_review_status,
      field_review_reason: reviewDecision.reason,
      promotion_requirements: promotionRequirements()
    }
  };
}

function exclude(id, memoryProduct, reason) {
  return {
    include: false,
    excluded: {
      id,
      memory_product: memoryProduct,
      reason
    }
  };
}

function promotionRequirements() {
  return [
    "explicit future promotion gate",
    "lead-session promotion approval",
    "active source-of-truth write",
    "separate runtime import/serving gate before any router use"
  ];
}

function renderEngineeringPrinciplesDoc(records, reportPayload) {
  const lines = [];
  lines.push("---");
  lines.push("# Canonical source of truth for transferable engineering invariants.");
  lines.push("# Proposed records only. No active memory entries are present.");
  lines.push("# See docs/CLUSTER_CACHE_SPEC.md Phase 7 architectural memory gates.");
  lines.push("memory_product: engineering-principles");
  lines.push("status: proposed_records");
  lines.push(`generated_at: ${reportPayload.generated_at}`);
  lines.push(`proposed_records: ${records.length}`);
  lines.push("active_records: 0");
  lines.push("---");
  lines.push("");
  lines.push("# Engineering Principles");
  lines.push("");
  lines.push("> Proposed records only. These entries are not active memory and are not served by the router.");
  lines.push("");
  lines.push("| id | status | field_review_status | statement | applies_when | revisit_when | provenance | promotion_requirements |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const record of records) {
    lines.push(
      `| ${escapeCell(record.id)} | ${escapeCell(record.status)} | ${escapeCell(record.field_review_status)} | ${escapeCell(record.statement)} | ${escapeCell((record.applies_when ?? []).join("; "))} | ${escapeCell((record.revisit_when ?? []).join("; "))} | ${escapeCell(record.provenance?.source_ref)} | ${escapeCell((record.promotion_requirements ?? []).join("; "))} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

function renderProjectArchitectureDoc(records, reportPayload) {
  const lines = [];
  lines.push("---");
  lines.push("# Canonical source of truth for project-scoped architecture decisions.");
  lines.push("# Proposed records only. No active memory entries are present.");
  lines.push("# See docs/CLUSTER_CACHE_SPEC.md Phase 7 architectural memory gates.");
  lines.push("memory_product: project-architecture");
  lines.push("status: proposed_records");
  lines.push(`generated_at: ${reportPayload.generated_at}`);
  lines.push(`proposed_records: ${records.length}`);
  lines.push("active_records: 0");
  lines.push("---");
  lines.push("");
  lines.push("# Project Architecture");
  lines.push("");
  lines.push("> Proposed records only. These entries are not active memory and are not served by the router.");
  lines.push("");
  lines.push("| id | status | field_review_status | decision | rationale | project_scope | provenance | promotion_requirements |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const record of records) {
    const projectScope = [
      `project_id=${record.project_scope?.project_id ?? ""}`,
      `boundary_ref=${record.project_scope?.boundary_ref ?? ""}`
    ].join("; ");
    lines.push(
      `| ${escapeCell(record.id)} | ${escapeCell(record.status)} | ${escapeCell(record.field_review_status)} | ${escapeCell(record.decision)} | ${escapeCell(`${record.rationale} (${record.rationale_note})`)} | ${escapeCell(projectScope)} | ${escapeCell(record.provenance?.source_ref)} | ${escapeCell((record.promotion_requirements ?? []).join("; "))} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

function renderReportMarkdown(reportPayload) {
  const lines = [];
  lines.push("# Phase 7 Gate 11 Proposed Record Materialization");
  lines.push("");
  lines.push(`Generated: ${reportPayload.generated_at}`);
  lines.push(`Status: \`${reportPayload.status}\``);
  lines.push("");
  lines.push("> Proposed records only. This report does not promote memory, import records, serve records, or write clusters.");
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push("| bucket | count |");
  lines.push("| --- | ---: |");
  for (const [bucket, count] of Object.entries(reportPayload.counts)) {
    lines.push(`| ${bucket} | ${count} |`);
  }
  lines.push("");
  lines.push("## Excluded");
  lines.push("");
  lines.push("| id | memory_product | reason |");
  lines.push("| --- | --- | --- |");
  for (const item of reportPayload.excluded) {
    lines.push(`| ${escapeCell(item.id)} | ${escapeCell(item.memory_product)} | ${escapeCell(item.reason)} |`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  for (const note of reportPayload.notes) {
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

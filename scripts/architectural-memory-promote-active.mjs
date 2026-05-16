#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const args = parseArgs(process.argv.slice(2));
const activeDate = args.active_date ?? new Date().toISOString().slice(0, 10);
const outDir = path.resolve(
  args.out_dir ?? path.join(repoRoot, "experiments", "architectural-memory-dry-run-2026-05-16")
);
const engineeringPrinciplesPath = path.resolve(
  args.engineering_principles ?? path.join(repoRoot, "docs", "ENGINEERING_PRINCIPLES.md")
);
const projectArchitecturePath = path.resolve(
  args.project_architecture ?? path.join(repoRoot, "docs", "PROJECT_ARCHITECTURE.md")
);

const specs = [
  {
    path: engineeringPrinciplesPath,
    memoryProduct: "engineering-principles",
    expectedRecords: 13,
    title: "Engineering Principles",
    header:
      "| id | status | field_review_status | statement | applies_when | revisit_when | provenance | promotion_requirements |",
    promotedHeader:
      "| id | status | active_date | field_review_status | statement | applies_when | revisit_when | provenance | promotion_requirements |",
    separator: "| --- | --- | --- | --- | --- | --- | --- | --- |",
    promotedSeparator: "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  },
  {
    path: projectArchitecturePath,
    memoryProduct: "project-architecture",
    expectedRecords: 75,
    title: "Project Architecture",
    header:
      "| id | status | field_review_status | decision | rationale | project_scope | provenance | promotion_requirements |",
    promotedHeader:
      "| id | status | active_date | field_review_status | decision | rationale | project_scope | provenance | promotion_requirements |",
    separator: "| --- | --- | --- | --- | --- | --- | --- | --- |",
    promotedSeparator: "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  }
];

const reports = specs.map((spec) => promoteDoc(spec));
const reportPayload = {
  generated_at: new Date().toISOString(),
  status: "active_source_of_truth_promoted",
  active_date: activeDate,
  scope: {
    runtime_import_serving: false,
    cluster_writes: false,
    router_behavior_changes: false
  },
  counts: {
    active_records: reports.reduce((sum, report) => sum + report.activeRecords, 0),
    proposed_records: reports.reduce((sum, report) => sum + report.proposedRecords, 0),
    docs: reports.length
  },
  docs: reports
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "active-promotion.json"),
  `${JSON.stringify(reportPayload, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, "active-promotion.md"),
  renderReportMarkdown(reportPayload)
);

console.log(
  JSON.stringify(
    {
      status: reportPayload.status,
      active_date: activeDate,
      counts: reportPayload.counts,
      docs: reports.map((report) => ({
        path: path.relative(repoRoot, report.path),
        active_records: report.activeRecords,
        proposed_records: report.proposedRecords
      }))
    },
    null,
    2
  )
);

function promoteDoc(spec) {
  const before = fs.readFileSync(spec.path, "utf8");
  let text = before;
  text = text.replace(
    "# Proposed records only. No active memory entries are present.",
    "# Active source-of-truth records. Runtime serving/import is not enabled."
  );
  text = text.replace("status: proposed_records", "status: promoted_source_of_truth");
  text = text.replace(`proposed_records: ${spec.expectedRecords}`, "proposed_records: 0");
  text = text.replace("active_records: 0", `active_records: ${spec.expectedRecords}`);
  text = text.replace(
    "> Proposed records only. These entries are not active memory and are not served by the router.",
    "> Active source-of-truth records only. These entries are not imported or served by the router."
  );
  text = text.replace(spec.header, spec.promotedHeader);
  text = text.replace(spec.separator, spec.promotedSeparator);
  text = text.replace(
    new RegExp(`^(\\| [^|]+ \\| )proposed( \\| .*)$`, "gm"),
    `$1status: active | ${activeDate}$2`
  );

  const activeRecords = countMatches(text, "| status: active |");
  const proposedRecords = countMatches(text, "| proposed |") + countMatches(text, "status: proposed");
  if (activeRecords !== spec.expectedRecords) {
    fail(`${spec.title}: expected ${spec.expectedRecords} active records, got ${activeRecords}`);
  }
  if (proposedRecords !== 0) {
    fail(`${spec.title}: expected 0 proposed records after promotion, got ${proposedRecords}`);
  }

  fs.writeFileSync(spec.path, text);
  return {
    path: spec.path,
    memory_product: spec.memoryProduct,
    activeRecords,
    proposedRecords
  };
}

function renderReportMarkdown(reportPayload) {
  const lines = [];
  lines.push("# Phase 7 Gate 12 Active Source-of-Truth Promotion");
  lines.push("");
  lines.push(`Generated: ${reportPayload.generated_at}`);
  lines.push(`Status: \`${reportPayload.status}\``);
  lines.push(`Active date: ${reportPayload.active_date}`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push("- Runtime import/serving: false");
  lines.push("- Cluster writes: false");
  lines.push("- Router behavior changes: false");
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push(`- Active records: ${reportPayload.counts.active_records}`);
  lines.push(`- Proposed records: ${reportPayload.counts.proposed_records}`);
  lines.push("");
  lines.push("## Documents");
  lines.push("");
  lines.push("| document | active_records | proposed_records |");
  lines.push("| --- | ---: | ---: |");
  for (const doc of reportPayload.docs) {
    lines.push(
      `| ${path.relative(repoRoot, doc.path)} | ${doc.activeRecords} | ${doc.proposedRecords} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

function countMatches(value, needle) {
  return value.split(needle).length - 1;
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

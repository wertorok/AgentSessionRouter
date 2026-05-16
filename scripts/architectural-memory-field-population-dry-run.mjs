import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = String(args.date ?? new Date().toISOString().slice(0, 10));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", `architectural-memory-dry-run-${date}`));
const factsheetPath = path.resolve(args.factsheet ?? path.join(outDir, "factsheet-dry-run.json"));
const verificationPath = path.resolve(args.verification ?? path.join(outDir, "verification-report.json"));
const engineeringPrinciplesPath = path.resolve(args.engineering_principles ?? path.join(repoRoot, "docs", "ENGINEERING_PRINCIPLES.md"));
const projectArchitecturePath = path.resolve(args.project_architecture ?? path.join(repoRoot, "docs", "PROJECT_ARCHITECTURE.md"));

for (const requiredPath of [factsheetPath, verificationPath, engineeringPrinciplesPath, projectArchitecturePath]) {
  if (!existsSync(requiredPath)) {
    fail(`Required input not found: ${requiredPath}`);
  }
}

mkdirSync(outDir, { recursive: true });

const factsheet = JSON.parse(readFileSync(factsheetPath, "utf8"));
const verification = JSON.parse(readFileSync(verificationPath, "utf8"));
const verifiedById = new Map((verification.candidate_results ?? []).map((result) => [result.candidate_id, result]));
const generatedAt = new Date().toISOString();
const boundaryRef = resolveBoundaryRef();
const projectId = resolveProjectId(boundaryRef);

const engineeringPrinciples = (factsheet.gate4_approved_engineering_principles ?? [])
  .filter((row) => isVerified(row.id))
  .map((row) => buildEngineeringPrinciple(row, generatedAt));

const projectArchitecture = [
  ...(factsheet.project_architecture_carry_forward ?? []).map((candidate) =>
    buildProjectArchitectureFromCarryForward(candidate, generatedAt, projectId, boundaryRef)
  ),
  ...(factsheet.gate4_approved_project_architecture ?? []).map((row) =>
    buildProjectArchitectureFromGate4(row, generatedAt, projectId, boundaryRef)
  )
].filter((entry) => isVerified(entry.id));

const artifact = {
  generated_at: generatedAt,
  status: "draft_only",
  non_authoritative: true,
  source_factsheet: path.relative(repoRoot, factsheetPath),
  source_verification: path.relative(repoRoot, verificationPath),
  source_of_truth_targets: {
    engineering_principles: path.relative(repoRoot, engineeringPrinciplesPath),
    project_architecture: path.relative(repoRoot, projectArchitecturePath)
  },
  project_id: projectId,
  boundary_ref: boundaryRef,
  engineering_principles: engineeringPrinciples,
  project_architecture: projectArchitecture,
  excluded: {
    unverified_or_failed: [...verifiedById.values()].filter((result) => !result.verified).map((result) => result.candidate_id),
    suspended: (factsheet.gate4_suspended ?? []).map((row) => row.id),
    rejected: [...(factsheet.gate4_rejected ?? []).map((row) => row.id), ...(factsheet.gate3_rejected ?? []).map((row) => row.id)]
  },
  notes: [
    "Draft field population only. Do not import, serve, or promote this artifact.",
    "All entries remain proposed and field_review_status=pending_lead_review.",
    "Project-architecture rationale fields are conservative derived rationales and are marked with rationale_note.",
    "Engineering-principle applies_when fields are derived from lead scope_condition values.",
    "Promotion remains a future gate after lead field review and explicit activation."
  ]
};

const jsonPath = path.join(outDir, "field-population-draft.json");
const markdownPath = path.join(outDir, "field-population-draft.md");
writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
writeFileSync(markdownPath, renderMarkdown(artifact), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      draft_json_path: jsonPath,
      draft_markdown_path: markdownPath,
      engineering_principles: artifact.engineering_principles.length,
      project_architecture: artifact.project_architecture.length,
      excluded_unverified_or_failed: artifact.excluded.unverified_or_failed.length,
      excluded_suspended: artifact.excluded.suspended.length,
      excluded_rejected: artifact.excluded.rejected.length
    },
    null,
    2
  )
);

function buildEngineeringPrinciple(row, timestamp) {
  return {
    id: row.id,
    status: "proposed",
    field_review_status: "pending_lead_review",
    statement: row.candidate?.text ?? "",
    applies_when: [row.scope_condition].filter(Boolean),
    revisit_when: buildRevisitWhen(row),
    provenance: {
      source_type: row.candidate?.provenance_source_type ?? null,
      source_ref: row.candidate?.provenance_source_ref ?? null,
      derived_from: "phase-7-gate-8-field-population-dry-run",
      derived_at: timestamp,
      derived_by: "codex",
      classification_reviewed_by: "claude-lead",
      lead_reason: row.reason ?? null,
      counter_evidence: row.counter_evidence || null
    }
  };
}

function buildProjectArchitectureFromCarryForward(candidate, timestamp, currentProjectId, currentBoundaryRef) {
  return {
    id: candidate.id,
    status: "proposed",
    field_review_status: "pending_lead_review",
    decision: candidate.decision ?? "",
    rationale: `Derived rationale: this was recorded as a project-scoped implementation decision for topic "${candidate.topic}".`,
    rationale_note: "derived_from_phase7_dry_run_context",
    project_scope: {
      project_id: currentProjectId,
      boundary_ref: currentBoundaryRef
    },
    provenance: {
      source_type: candidate.provenance_source_type ?? null,
      source_ref: candidate.provenance_source_ref ?? null,
      derived_from: "phase-7-gate-8-field-population-dry-run",
      derived_at: timestamp,
      derived_by: "codex",
      deterministic_signals: {
        project_score: candidate.project_score ?? null,
        transferable_score: candidate.transferable_score ?? null,
        primary_signal: candidate.primary_signal ?? null,
        confidence: candidate.confidence ?? null
      }
    }
  };
}

function buildProjectArchitectureFromGate4(row, timestamp, currentProjectId, currentBoundaryRef) {
  return {
    id: row.id,
    status: "proposed",
    field_review_status: "pending_lead_review",
    decision: row.candidate?.text ?? "",
    rationale: row.reason
      ? `Lead-reviewed rationale: ${row.reason}`
      : "Derived rationale: lead approved this as project-architecture during Gate 4 review.",
    rationale_note: row.reason ? "lead_review_reason" : "derived_from_gate4_review",
    project_scope: {
      project_id: currentProjectId,
      boundary_ref: currentBoundaryRef
    },
    provenance: {
      source_type: row.candidate?.provenance_source_type ?? null,
      source_ref: row.candidate?.provenance_source_ref ?? null,
      derived_from: "phase-7-gate-8-field-population-dry-run",
      derived_at: timestamp,
      derived_by: "codex",
      classification_reviewed_by: "claude-lead",
      lead_reason: row.reason ?? null,
      counter_evidence: row.counter_evidence || null
    }
  };
}

function buildRevisitWhen(row) {
  const triggers = [
    "When the target project's architecture no longer matches applies_when.",
    "When router_monitor, adversarial review, or production evidence contradicts this principle."
  ];
  if (row.counter_evidence) {
    triggers.push(`When this counter-evidence becomes true: ${row.counter_evidence}`);
  }
  return triggers;
}

function isVerified(candidateId) {
  return Boolean(verifiedById.get(candidateId)?.verified);
}

function resolveBoundaryRef() {
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (remote) {
      return remote;
    }
  } catch {
    // Fall through to package metadata.
  }
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    return pkg.repository?.url ?? pkg.homepage ?? path.basename(repoRoot);
  } catch {
    return path.basename(repoRoot);
  }
}

function resolveProjectId(currentBoundaryRef) {
  const gitHubMatch = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/.exec(currentBoundaryRef);
  if (gitHubMatch) {
    return gitHubMatch[2];
  }
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    return pkg.name ?? path.basename(repoRoot);
  } catch {
    return path.basename(repoRoot);
  }
}

function renderMarkdown(artifactPayload) {
  const lines = [];
  lines.push("# Phase 7 Gate 8 Field-Population Draft");
  lines.push("");
  lines.push(`Generated: ${artifactPayload.generated_at}`);
  lines.push(`Status: \`${artifactPayload.status}\``);
  lines.push(`Source factsheet: \`${artifactPayload.source_factsheet}\``);
  lines.push(`Source verification: \`${artifactPayload.source_verification}\``);
  lines.push("");
  lines.push("> Draft only. This artifact is not active memory, not imported, not served, and not promotion-approved.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| bucket | count |");
  lines.push("| --- | ---: |");
  lines.push(`| engineering_principles | ${artifactPayload.engineering_principles.length} |`);
  lines.push(`| project_architecture | ${artifactPayload.project_architecture.length} |`);
  lines.push(`| excluded_unverified_or_failed | ${artifactPayload.excluded.unverified_or_failed.length} |`);
  lines.push(`| excluded_suspended | ${artifactPayload.excluded.suspended.length} |`);
  lines.push(`| excluded_rejected | ${artifactPayload.excluded.rejected.length} |`);
  lines.push("");
  lines.push("## Source-of-Truth Targets");
  lines.push("");
  lines.push("| memory product | target |");
  lines.push("| --- | --- |");
  lines.push(`| engineering-principles | \`${artifactPayload.source_of_truth_targets.engineering_principles}\` |`);
  lines.push(`| project-architecture | \`${artifactPayload.source_of_truth_targets.project_architecture}\` |`);
  lines.push("");
  lines.push("## Engineering Principles Draft");
  lines.push("");
  lines.push("| id | statement | applies_when | revisit_when | field_review_status |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const principle of artifactPayload.engineering_principles) {
    lines.push(
      `| ${escapeCell(principle.id)} | ${escapeCell(principle.statement)} | ${escapeCell(principle.applies_when.join("; "))} | ${escapeCell(principle.revisit_when.join("; "))} | ${escapeCell(principle.field_review_status)} |`
    );
  }
  lines.push("");
  lines.push("## Project Architecture Draft");
  lines.push("");
  lines.push("| id | decision | rationale_note | project_id | boundary_ref | field_review_status |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const decision of artifactPayload.project_architecture) {
    lines.push(
      `| ${escapeCell(decision.id)} | ${escapeCell(decision.decision)} | ${escapeCell(decision.rationale_note)} | ${escapeCell(decision.project_scope.project_id)} | ${escapeCell(decision.project_scope.boundary_ref)} | ${escapeCell(decision.field_review_status)} |`
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

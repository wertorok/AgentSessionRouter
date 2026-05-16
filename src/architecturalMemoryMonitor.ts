import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface ArchitecturalMemoryDocStats {
  memory_product: string;
  path: string;
  exists: boolean;
  active_records: number;
  proposed_records: number;
  suspended_records: number;
  active_date_records: number;
}

export interface ArchitecturalMemoryTelemetry {
  enabled: true;
  runtime_import_serving_enabled: false;
  active_records: number;
  proposed_records: number;
  suspended_records: number;
  suspended_audit_records: number | null;
  rejected_audit_records: number | null;
  excluded_records: number | null;
  rejected_or_suspended_audit_records: number | null;
  source_docs: ArchitecturalMemoryDocStats[];
  audit_artifacts: {
    active_promotion: string | null;
    request_changes_resolution: string | null;
    verification_report: string | null;
  };
  warnings: string[];
}

const MEMORY_DOCS = [
  {
    memory_product: "engineering-principles",
    relativePath: path.join("docs", "ENGINEERING_PRINCIPLES.md")
  },
  {
    memory_product: "project-architecture",
    relativePath: path.join("docs", "PROJECT_ARCHITECTURE.md")
  }
];

const EXPERIMENT_DIR = path.join("experiments", "architectural-memory-dry-run-2026-05-16");

export function buildArchitecturalMemoryTelemetry(cwd: string): ArchitecturalMemoryTelemetry {
  const sourceDocs = MEMORY_DOCS.map((doc) => readMemoryDocStats(cwd, doc.memory_product, doc.relativePath));
  const requestChangesPath = path.join(cwd, EXPERIMENT_DIR, "request-changes-resolution.json");
  const verificationReportPath = path.join(cwd, EXPERIMENT_DIR, "verification-report.json");
  const activePromotionPath = path.join(cwd, EXPERIMENT_DIR, "active-promotion.json");
  const requestChanges = readJson(requestChangesPath);
  const verificationReport = readJson(verificationReportPath);
  const warnings = buildWarnings(sourceDocs, activePromotionPath);

  return {
    enabled: true,
    runtime_import_serving_enabled: false,
    active_records: sum(sourceDocs.map((doc) => doc.active_records)),
    proposed_records: sum(sourceDocs.map((doc) => doc.proposed_records)),
    suspended_records: sum(sourceDocs.map((doc) => doc.suspended_records)),
    suspended_audit_records: numberAt(verificationReport, ["summary", "by_bucket", "gate4_suspended"]),
    rejected_audit_records: numberAt(verificationReport, ["summary", "by_bucket", "gate4_rejected"]),
    excluded_records: numberAt(requestChanges, ["summary", "excluded_from_promotion"]),
    rejected_or_suspended_audit_records: numberAt(verificationReport, ["summary", "failed"]),
    source_docs: sourceDocs,
    audit_artifacts: {
      active_promotion: existsSync(activePromotionPath) ? path.relative(cwd, activePromotionPath) : null,
      request_changes_resolution: existsSync(requestChangesPath) ? path.relative(cwd, requestChangesPath) : null,
      verification_report: existsSync(verificationReportPath) ? path.relative(cwd, verificationReportPath) : null
    },
    warnings
  };
}

function readMemoryDocStats(cwd: string, memoryProduct: string, relativePath: string): ArchitecturalMemoryDocStats {
  const absolutePath = path.join(cwd, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      memory_product: memoryProduct,
      path: relativePath,
      exists: false,
      active_records: 0,
      proposed_records: 0,
      suspended_records: 0,
      active_date_records: 0
    };
  }
  const text = readFileSync(absolutePath, "utf8");
  return {
    memory_product: memoryProduct,
    path: relativePath,
    exists: true,
    active_records: count(text, "| status: active |"),
    proposed_records: count(text, "| proposed |"),
    suspended_records: countRowsMatching(text, (line) => line.includes("| SUSPEND |") || line.includes("| suspended |")),
    active_date_records: [...text.matchAll(/\| \d{4}-\d{2}-\d{2} \| APPROVED_FIELDS \|/g)].length
  };
}

function buildWarnings(sourceDocs: ArchitecturalMemoryDocStats[], activePromotionPath: string): string[] {
  const warnings: string[] = [];
  const missingDocs = sourceDocs.filter((doc) => !doc.exists).map((doc) => doc.path);
  if (missingDocs.length > 0) {
    warnings.push(`Architectural memory source docs missing: ${missingDocs.join(", ")}`);
  }
  if (!existsSync(activePromotionPath)) {
    warnings.push("Architectural memory active-promotion artifact is missing.");
  }
  const docsWithActiveMismatch = sourceDocs.filter(
    (doc) => doc.exists && doc.active_records > 0 && doc.active_date_records !== doc.active_records
  );
  for (const doc of docsWithActiveMismatch) {
    warnings.push(
      `Architectural memory doc ${doc.path} has ${doc.active_records} active records but ${doc.active_date_records} active_date markers.`
    );
  }
  return warnings;
}

function readJson(filePath: string): unknown {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function numberAt(value: unknown, pathParts: string[]): number | null {
  let current: unknown = value;
  for (const part of pathParts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : null;
}

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function countRowsMatching(value: string, predicate: (line: string) => boolean): number {
  return value.split("\n").filter(predicate).length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

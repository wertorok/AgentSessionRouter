import { createHash } from "node:crypto";

export const ARCHITECTURAL_MEMORY_SERVING_LIMITS = {
  runtimeImportServingEnabled: false,
  selectionLlmInputTokens: 0,
  maxEngineeringPrinciples: 7,
  maxProjectArchitectureRecords: 3,
  targetSeedTokens: 900,
  absoluteSeedTokens: 1_200,
  projectScopedAddonTokens: 300,
  minPostServingContinuityRuns: 3,
  adversarialBrokenZeroSufficient: false,
  perConsultArchitecturalMemoryTokens: 0
} as const;

export type ArchitecturalMemoryProduct = "engineering-principles" | "project-architecture";
export type ArchitecturalMemoryStatus = "active" | "proposed" | "suspended" | "superseded" | "rejected" | "excluded" | "unknown";

export interface ArchitecturalMemoryRecord {
  id: string;
  memory_product: ArchitecturalMemoryProduct;
  status: ArchitecturalMemoryStatus;
  statement: string;
  applies_when: string;
  revisit_when: string;
  counter_evidence: string;
  provenance: string;
  source_path: string;
}

export interface ArchitecturalMemorySeedRequest {
  session_kind?: "lead" | "project_lead" | "review" | "planning" | "other";
  task_type?: string;
  topic_hint?: string;
  tags?: string[];
  related_files?: string[];
  project_scoped?: boolean;
}

export interface ArchitecturalMemorySeedOptions {
  max_engineering_principles?: number;
  max_project_architecture_records?: number;
  target_seed_tokens?: number;
  absolute_seed_tokens?: number;
  project_scoped_addon_tokens?: number;
  min_record_score?: number;
}

export interface ArchitecturalMemorySelectedRecord {
  record: ArchitecturalMemoryRecord;
  score: number;
  matched_signals: string[];
  compact_text: string;
  estimated_tokens: number;
}

export interface ArchitecturalMemorySeedSelection {
  selected: ArchitecturalMemorySelectedRecord[];
  skipped: Array<{
    id: string;
    reason: string;
    score: number;
  }>;
  estimated_seed_tokens: number;
  selection_llm_input_tokens: 0;
  per_consult_architectural_memory_tokens: 0;
  budget: {
    target_seed_tokens: number;
    absolute_seed_tokens: number;
    max_engineering_principles: number;
    max_project_architecture_records: number;
    project_scoped_addon_tokens: number;
  };
}

export interface ArchitecturalMemorySeedManifest {
  seed_kind: "engineering_principles";
  source_docs: Array<{ path: string; hash: string }>;
  record_ids: string[];
  record_hashes: Array<{ id: string; hash: string }>;
  seed_signature: string;
  selection_reason: Array<{ id: string; score: number; matched_signals: string[] }>;
}

export interface ArchitecturalMemorySeedDedupResult {
  should_inject: boolean;
  reason: "no_existing_manifest" | "same_seed_signature" | "delta_within_budget";
  delta_record_ids: string[];
}

const STOPWORDS = new Set([
  "and",
  "are",
  "but",
  "for",
  "from",
  "has",
  "have",
  "into",
  "must",
  "not",
  "that",
  "the",
  "this",
  "when",
  "with",
  "without"
]);

export function parseArchitecturalMemoryMarkdown(
  text: string,
  memoryProduct: ArchitecturalMemoryProduct,
  sourcePath: string
): ArchitecturalMemoryRecord[] {
  const rows = parseMarkdownTable(text);
  return rows
    .map((row) => rowToRecord(row, memoryProduct, sourcePath))
    .filter((record): record is ArchitecturalMemoryRecord => record !== null);
}

export function selectArchitecturalMemorySeed(
  records: ArchitecturalMemoryRecord[],
  request: ArchitecturalMemorySeedRequest,
  options: ArchitecturalMemorySeedOptions = {}
): ArchitecturalMemorySeedSelection {
  const maxEngineeringPrinciples =
    options.max_engineering_principles ?? ARCHITECTURAL_MEMORY_SERVING_LIMITS.maxEngineeringPrinciples;
  const maxProjectArchitectureRecords =
    options.max_project_architecture_records ?? ARCHITECTURAL_MEMORY_SERVING_LIMITS.maxProjectArchitectureRecords;
  const targetSeedTokens = options.target_seed_tokens ?? ARCHITECTURAL_MEMORY_SERVING_LIMITS.targetSeedTokens;
  const absoluteSeedTokens = options.absolute_seed_tokens ?? ARCHITECTURAL_MEMORY_SERVING_LIMITS.absoluteSeedTokens;
  const projectScopedAddonTokens =
    options.project_scoped_addon_tokens ?? ARCHITECTURAL_MEMORY_SERVING_LIMITS.projectScopedAddonTokens;
  const minRecordScore = options.min_record_score ?? 0.05;
  const requestTokens = tokenSet([
    request.session_kind ?? "",
    request.task_type ?? "",
    request.topic_hint ?? "",
    ...(request.tags ?? []),
    ...(request.related_files ?? [])
  ]);
  const candidates = records
    .map((record) => scoreRecord(record, requestTokens, request))
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
  const selected: ArchitecturalMemorySelectedRecord[] = [];
  const skipped: ArchitecturalMemorySeedSelection["skipped"] = [];
  let totalTokens = 0;
  let engineeringCount = 0;
  let projectCount = 0;
  let projectTokens = 0;

  for (const candidate of candidates) {
    if (candidate.record.status !== "active") {
      skipped.push({ id: candidate.record.id, reason: `status:${candidate.record.status}`, score: candidate.score });
      continue;
    }
    if (candidate.record.memory_product === "project-architecture" && request.project_scoped !== true) {
      skipped.push({ id: candidate.record.id, reason: "project_architecture_not_in_global_seed", score: candidate.score });
      continue;
    }
    if (candidate.score < minRecordScore) {
      skipped.push({ id: candidate.record.id, reason: "below_min_score", score: candidate.score });
      continue;
    }
    if (candidate.record.memory_product === "engineering-principles" && engineeringCount >= maxEngineeringPrinciples) {
      skipped.push({ id: candidate.record.id, reason: "engineering_principle_count_cap", score: candidate.score });
      continue;
    }
    if (candidate.record.memory_product === "project-architecture" && projectCount >= maxProjectArchitectureRecords) {
      skipped.push({ id: candidate.record.id, reason: "project_architecture_count_cap", score: candidate.score });
      continue;
    }
    if (
      candidate.record.memory_product === "project-architecture" &&
      projectTokens + candidate.estimated_tokens > projectScopedAddonTokens
    ) {
      skipped.push({ id: candidate.record.id, reason: "project_architecture_token_cap", score: candidate.score });
      continue;
    }
    if (totalTokens + candidate.estimated_tokens > targetSeedTokens) {
      skipped.push({ id: candidate.record.id, reason: "target_seed_token_cap", score: candidate.score });
      continue;
    }
    if (totalTokens + candidate.estimated_tokens > absoluteSeedTokens) {
      skipped.push({ id: candidate.record.id, reason: "absolute_seed_token_cap", score: candidate.score });
      continue;
    }
    selected.push(candidate);
    totalTokens += candidate.estimated_tokens;
    if (candidate.record.memory_product === "engineering-principles") {
      engineeringCount += 1;
    } else {
      projectCount += 1;
      projectTokens += candidate.estimated_tokens;
    }
  }

  return {
    selected,
    skipped,
    estimated_seed_tokens: totalTokens,
    selection_llm_input_tokens: ARCHITECTURAL_MEMORY_SERVING_LIMITS.selectionLlmInputTokens,
    per_consult_architectural_memory_tokens: ARCHITECTURAL_MEMORY_SERVING_LIMITS.perConsultArchitecturalMemoryTokens,
    budget: {
      target_seed_tokens: targetSeedTokens,
      absolute_seed_tokens: absoluteSeedTokens,
      max_engineering_principles: maxEngineeringPrinciples,
      max_project_architecture_records: maxProjectArchitectureRecords,
      project_scoped_addon_tokens: projectScopedAddonTokens
    }
  };
}

export function buildArchitecturalMemorySeedManifest(
  selection: ArchitecturalMemorySeedSelection,
  sourceDocs: Array<{ path: string; content: string }>
): ArchitecturalMemorySeedManifest {
  const sourceDocHashes = sourceDocs.map((doc) => ({ path: doc.path, hash: sha256(doc.content) }));
  const recordHashes = selection.selected.map((selected) => ({
    id: selected.record.id,
    hash: sha256(selected.compact_text)
  }));
  const signaturePayload = JSON.stringify({
    seed_kind: "engineering_principles",
    source_docs: sourceDocHashes,
    record_hashes: recordHashes
  });
  return {
    seed_kind: "engineering_principles",
    source_docs: sourceDocHashes,
    record_ids: selection.selected.map((selected) => selected.record.id),
    record_hashes: recordHashes,
    seed_signature: sha256(signaturePayload),
    selection_reason: selection.selected.map((selected) => ({
      id: selected.record.id,
      score: selected.score,
      matched_signals: selected.matched_signals
    }))
  };
}

export function shouldInjectArchitecturalMemorySeed(
  existingManifest: ArchitecturalMemorySeedManifest | null,
  nextManifest: ArchitecturalMemorySeedManifest
): ArchitecturalMemorySeedDedupResult {
  if (!existingManifest) {
    return {
      should_inject: nextManifest.record_ids.length > 0,
      reason: "no_existing_manifest",
      delta_record_ids: nextManifest.record_ids
    };
  }
  if (existingManifest.seed_signature === nextManifest.seed_signature) {
    return {
      should_inject: false,
      reason: "same_seed_signature",
      delta_record_ids: []
    };
  }
  const existingIds = new Set(existingManifest.record_ids);
  const deltaRecordIds = nextManifest.record_ids.filter((id) => !existingIds.has(id));
  return {
    should_inject: deltaRecordIds.length > 0,
    reason: "delta_within_budget",
    delta_record_ids: deltaRecordIds
  };
}

function scoreRecord(
  record: ArchitecturalMemoryRecord,
  requestTokens: Set<string>,
  request: ArchitecturalMemorySeedRequest
): ArchitecturalMemorySelectedRecord {
  const recordTokens = tokenSet([
    record.id,
    record.statement,
    record.applies_when,
    record.revisit_when,
    record.counter_evidence,
    record.provenance
  ]);
  const matched = [...requestTokens].filter((token) => recordTokens.has(token)).sort();
  const taskType = (request.task_type ?? "").toLowerCase();
  const architectureTask = ["architectural", "architecture", "review", "planning"].includes(taskType);
  const compatibility = architectureTask && record.memory_product === "engineering-principles" ? 0.12 : 0;
  const provenanceFileMatch = (request.related_files ?? []).some((file) => record.provenance.includes(file)) ? 0.15 : 0;
  const score = round3(matched.length * 0.08 + compatibility + provenanceFileMatch);
  const compactText = compactRecordText(record);
  return {
    record,
    score,
    matched_signals: [
      ...matched.map((token) => `token:${token}`),
      ...(compatibility > 0 ? ["task_type:architectural"] : []),
      ...(provenanceFileMatch > 0 ? ["related_file:provenance"] : [])
    ],
    compact_text: compactText,
    estimated_tokens: estimateTokens(compactText)
  };
}

function compactRecordText(record: ArchitecturalMemoryRecord): string {
  return [
    `- ${record.id}: ${truncate(record.statement, 180)}`,
    `  Applies: ${truncate(record.applies_when, 140)}`,
    `  Counter: ${truncate(record.counter_evidence, 140)}`,
    `  Source: ${truncate(record.provenance, 80)}`
  ].join("\n");
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function parseMarkdownTable(text: string): Array<Record<string, string>> {
  const lines = text.split("\n");
  const headerIndex = lines.findIndex((line) => line.trim().startsWith("| id |"));
  if (headerIndex < 0) {
    return [];
  }
  const headers = splitMarkdownRow(lines[headerIndex]).map(normalizeHeader);
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      continue;
    }
    if (/^\|\s*-+/.test(trimmed)) {
      continue;
    }
    const cells = splitMarkdownRow(line);
    if (cells.length < headers.length) {
      continue;
    }
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])));
  }
  return rows;
}

function rowToRecord(
  row: Record<string, string>,
  memoryProduct: ArchitecturalMemoryProduct,
  sourcePath: string
): ArchitecturalMemoryRecord | null {
  const id = row.id?.trim();
  if (!id) {
    return null;
  }
  return {
    id,
    memory_product: memoryProduct,
    status: parseStatus(row.status ?? ""),
    statement: row.statement || row.decision || "",
    applies_when: row.applies_when || row.rationale || "",
    revisit_when: row.revisit_when || "",
    counter_evidence: row.counter_evidence || "",
    provenance: row.provenance || "",
    source_path: sourcePath
  };
}

function parseStatus(value: string): ArchitecturalMemoryStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes("active")) {
    return "active";
  }
  if (normalized.includes("proposed")) {
    return "proposed";
  }
  if (normalized.includes("suspended") || normalized.includes("suspend")) {
    return "suspended";
  }
  if (normalized.includes("superseded")) {
    return "superseded";
  }
  if (normalized.includes("rejected")) {
    return "rejected";
  }
  if (normalized.includes("excluded")) {
    return "excluded";
  }
  return "unknown";
}

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function tokenSet(values: string[]): Set<string> {
  return new Set(
    values
      .join(" ")
      .toLowerCase()
      .replace(/[`*_()[\]{}]/g, " ")
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  );
}

function truncate(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3).trimEnd()}...` : compact;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

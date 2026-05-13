import { randomUUID } from "node:crypto";
import { ERROR_CODES } from "./constants.js";
import type {
  ClusterFactsheetRecord,
  ClusterFactsheetStatus,
  ClusterRecord,
  ClusterTrustState,
  RouterDatabase
} from "./db.js";
import { buildEvidenceSnippet, normalizeEvidenceHash, readEvidenceFile } from "./evidence.js";
import { errorPayload, type ErrorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";

export interface ClusterEvidenceRevalidationInput {
  projectId: string;
  clusterId: string;
  minRetainedRatio: number;
}

export interface ClusterEvidenceRevalidationSuccess {
  occurred: true;
  factsheet_id: string;
  factsheet_version: number;
  factsheet_status: "static_verified" | "llm_verified";
  revalidated_facts: number;
  original_facts: number;
  retained_ratio: number;
}

interface FactsheetContent {
  schema_version?: number;
  cluster_id?: string;
  summary?: string;
  facts?: unknown[];
  pitfalls?: unknown;
  forbidden_inferences?: unknown;
  omitted_facts?: unknown;
}

interface RevalidatedFact {
  id: string;
  claim: string;
  confidence: "static_verified" | "llm_verified";
  evidence: RevalidatedEvidence[];
}

interface RevalidatedEvidence {
  path: string;
  hash: string;
  selector?: string;
  snippet_hash?: string;
}

interface RejectedFact {
  id: string;
  claim: string;
  reason: string;
}

export type ClusterEvidenceRevalidationResult = ClusterEvidenceRevalidationSuccess | ErrorPayload;

export function revalidateClusterEvidence(
  db: RouterDatabase,
  cwd: string,
  input: ClusterEvidenceRevalidationInput
): ClusterEvidenceRevalidationResult {
  const loaded = loadLatestFactsheet(db, input.projectId, input.clusterId);
  if ("error" in loaded) {
    return loaded;
  }

  const parsed = parseFactsheet(loaded.factsheet);
  const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
  if (facts.length === 0) {
    return unrecoverable(input.clusterId, {
      reason: "latest factsheet has no facts",
      original_facts: 0,
      revalidated_facts: 0,
      retained_ratio: 0
    });
  }

  const fileHashes = new Map<string, { path: string; hash: string; fileSize: number }>();
  const revalidatedFacts: RevalidatedFact[] = [];
  const rejectedFacts: RejectedFact[] = [];

  for (const fact of facts) {
    const result = revalidateFact(cwd, fact, fileHashes);
    if ("rejected" in result) {
      rejectedFacts.push(result.rejected);
    } else {
      revalidatedFacts.push(result.fact);
    }
  }

  const retainedRatio = ratio(revalidatedFacts.length, facts.length);
  if (rejectedFacts.length > 0 || retainedRatio < input.minRetainedRatio) {
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "evidence_revalidation_failed",
      details: {
        factsheet_id: loaded.factsheet.id,
        factsheet_version: loaded.factsheet.version,
        original_facts: facts.length,
        revalidated_facts: revalidatedFacts.length,
        retained_ratio: retainedRatio,
        min_retained_ratio: input.minRetainedRatio,
        rejected_facts: rejectedFacts
      }
    });
    return unrecoverable(input.clusterId, {
      reason: "evidence revalidation failed; not all required evidence still matches current files",
      factsheet_id: loaded.factsheet.id,
      factsheet_version: loaded.factsheet.version,
      original_facts: facts.length,
      revalidated_facts: revalidatedFacts.length,
      retained_ratio: retainedRatio,
      min_retained_ratio: input.minRetainedRatio,
      rejected_facts: rejectedFacts,
      suggested_action: "Recreate the cluster with cluster_prepare or use claude_consult for fresh exploration."
    });
  }

  const status = inferFactsheetStatus(loaded.factsheet, revalidatedFacts);
  const content = {
    ...parsed,
    schema_version: 1,
    cluster_id: input.clusterId,
    facts: revalidatedFacts,
    omitted_facts: rejectedFacts.length
  };
  const factsheet = db.insertClusterFactsheet({
    id: `factsheet_${randomUUID()}`,
    clusterId: input.clusterId,
    contentJson: JSON.stringify(content),
    sourceSessionId: loaded.factsheet.source_session_id,
    baselineSessionId: loaded.factsheet.baseline_session_id,
    gitRev: loaded.factsheet.git_rev,
    status,
    trustState: statusToTrustState(status, revalidatedFacts.length === facts.length),
    fileHashes: [...fileHashes.values()]
  });

  db.logClusterEvent({
    clusterId: input.clusterId,
    projectId: input.projectId,
    eventType: "evidence_revalidated",
    details: {
      previous_factsheet_id: loaded.factsheet.id,
      previous_factsheet_version: loaded.factsheet.version,
      factsheet_id: factsheet.id,
      factsheet_version: factsheet.version,
      factsheet_status: status,
      original_facts: facts.length,
      revalidated_facts: revalidatedFacts.length,
      retained_ratio: retainedRatio
    }
  });

  return {
    occurred: true,
    factsheet_id: factsheet.id,
    factsheet_version: factsheet.version,
    factsheet_status: status,
    revalidated_facts: revalidatedFacts.length,
    original_facts: facts.length,
    retained_ratio: retainedRatio
  };
}

function revalidateFact(
  cwd: string,
  fact: unknown,
  fileHashes: Map<string, { path: string; hash: string; fileSize: number }>
): { fact: RevalidatedFact } | { rejected: RejectedFact } {
  if (!isObject(fact)) {
    return { rejected: { id: "invalid-fact", claim: "", reason: "fact must be an object" } };
  }

  const id = stringOrEmpty(fact.id);
  const claim = stringOrEmpty(fact.claim);
  const evidence = Array.isArray(fact.evidence) ? fact.evidence : [];
  if (!id || !claim || evidence.length === 0) {
    return {
      rejected: {
        id: id || "missing-id",
        claim,
        reason: "fact requires id, claim, and at least one evidence entry"
      }
    };
  }

  const nextEvidence: RevalidatedEvidence[] = [];
  const rejectionReasons: string[] = [];
  for (const item of evidence) {
    const result = revalidateEvidence(cwd, item, fileHashes);
    if ("evidence" in result) {
      nextEvidence.push(result.evidence);
    } else {
      rejectionReasons.push(result.reason);
    }
  }

  if (nextEvidence.length !== evidence.length) {
    return {
      rejected: {
        id,
        claim,
        reason: rejectionReasons.join("; ") || "not all evidence entries revalidated"
      }
    };
  }

  return {
    fact: {
      id,
      claim,
      confidence: fact.confidence === "llm_verified" ? "llm_verified" : "static_verified",
      evidence: nextEvidence
    }
  };
}

function revalidateEvidence(
  cwd: string,
  evidence: unknown,
  fileHashes: Map<string, { path: string; hash: string; fileSize: number }>
): { evidence: RevalidatedEvidence } | { reason: string } {
  if (!isObject(evidence)) {
    return { reason: "evidence entry must be an object" };
  }

  const evidencePath = stringOrEmpty(evidence.path);
  const selector = stringOrEmpty(evidence.selector) || undefined;
  const expectedSnippetHash = stringOrEmpty(evidence.snippet_hash) || undefined;
  const expectedHash = stringOrEmpty(evidence.hash) || undefined;
  if (!evidencePath) {
    return { reason: "evidence path is required" };
  }

  try {
    const file = readEvidenceFile(cwd, evidencePath);
    fileHashes.set(file.path, {
      path: file.path,
      hash: `sha256:${file.hash}`,
      fileSize: file.fileSize
    });

    if (!selector) {
      if (expectedHash && normalizeEvidenceHash(expectedHash) === `sha256:${file.hash}`) {
        return { evidence: { path: file.path, hash: `sha256:${file.hash}` } };
      }
      return { reason: `whole-file evidence changed for ${file.path}` };
    }

    if (!expectedSnippetHash) {
      return { reason: `selector evidence is missing snippet_hash for ${file.path}: ${selector}` };
    }

    const snippet = buildEvidenceSnippet(file.content, selector);
    if (snippet.hash !== expectedSnippetHash) {
      return { reason: `snippet changed for ${file.path}: ${selector}` };
    }

    return {
      evidence: {
        path: file.path,
        hash: `sha256:${file.hash}`,
        selector,
        snippet_hash: snippet.hash
      }
    };
  } catch (error: unknown) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
}

function loadLatestFactsheet(
  db: RouterDatabase,
  projectId: string,
  clusterId: string
): { cluster: ClusterRecord; factsheet: ClusterFactsheetRecord } | ErrorPayload {
  const cluster = db.getClusterById(clusterId);
  if (!cluster) {
    return errorPayload(ERROR_CODES.CLUSTER_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_NOT_FOUND], {
      cluster_id: clusterId
    });
  }
  if (cluster.project_id !== projectId) {
    return errorPayload(ERROR_CODES.CLUSTER_PROJECT_MISMATCH, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_PROJECT_MISMATCH], {
      cluster_id: clusterId
    });
  }
  const factsheet = db.getLatestClusterFactsheet(clusterId);
  if (!factsheet) {
    return errorPayload(ERROR_CODES.CLUSTER_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_NOT_FOUND], {
      cluster_id: clusterId,
      reason: "Cluster has no factsheet to revalidate."
    });
  }
  return { cluster, factsheet };
}

function inferFactsheetStatus(
  factsheet: ClusterFactsheetRecord,
  facts: RevalidatedFact[]
): "static_verified" | "llm_verified" {
  if (factsheet.status === "llm_verified") {
    return "llm_verified";
  }
  return facts.length > 0 && facts.every((fact) => fact.confidence === "llm_verified") ? "llm_verified" : "static_verified";
}

function statusToTrustState(status: ClusterFactsheetStatus, complete: boolean): ClusterTrustState {
  if (status === "llm_verified") {
    return complete ? "llm_verified" : "partial_llm";
  }
  return complete ? "static_verified" : "partial_static";
}

function unrecoverable(clusterId: string, details: Record<string, unknown>): ErrorPayload {
  return errorPayload(
    ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE,
    SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_FACTSHEET_UNRECOVERABLE],
    {
      cluster_id: clusterId,
      details
    }
  );
}

function parseFactsheet(factsheet: ClusterFactsheetRecord): FactsheetContent {
  try {
    const parsed = JSON.parse(factsheet.content_json) as unknown;
    if (isObject(parsed)) {
      return parsed as FactsheetContent;
    }
  } catch {
    return {};
  }
  return {};
}

function ratio(retained: number, original: number): number {
  return original === 0 ? 0 : Math.round((retained / original) * 100) / 100;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

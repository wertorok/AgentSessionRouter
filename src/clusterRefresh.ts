import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ERROR_CODES } from "./constants.js";
import { verifyFactsheetStatic, type FactsheetInput, type RejectedFact } from "./cluster.js";
import type {
  ClusterFactsheetRecord,
  ClusterFileHashRecord,
  ClusterRecord,
  ClusterTrustState,
  RouterDatabase
} from "./db.js";
import { errorPayload, type ErrorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";

export interface ClusterRefreshInput {
  projectId: string;
  clusterId: string;
  mode?: "verify_only";
}

export interface ClusterRefreshSuccess {
  cluster_id: string;
  factsheet_id: string;
  factsheet_version: number;
  mode: "verify_only";
  fresh: true;
  factsheet_status: "static_verified" | "llm_verified";
  trust_state: ClusterTrustState;
  changed_files: string[];
  verified_facts: number;
  rejected_facts: number;
  refreshed_at: string | null;
}

export type ClusterRefreshResult = ClusterRefreshSuccess | ErrorPayload;

interface LoadedRefreshContext {
  cluster: ClusterRecord;
  factsheet: ClusterFactsheetRecord;
  fileHashes: ClusterFileHashRecord[];
  factsheetContent: Record<string, unknown>;
}

export function refreshCluster(db: RouterDatabase, cwd: string, input: ClusterRefreshInput): ClusterRefreshResult {
  const loaded = loadRefreshContext(db, input.projectId, input.clusterId);
  if ("error" in loaded) {
    return loaded;
  }

  const changedFiles = findChangedFiles(cwd, loaded.fileHashes);
  let rejectedFacts: RejectedFact[] = [];
  let verifiedFacts = 0;

  try {
    const verification = verifyFactsheetStatic(cwd, input.clusterId, loaded.factsheetContent as FactsheetInput);
    rejectedFacts = verification.rejectedFacts;
    verifiedFacts = verification.factsheet.facts.length;
  } catch (error: unknown) {
    rejectedFacts = [
      {
        id: "factsheet",
        claim: "current factsheet is statically re-verifiable",
        reason: error instanceof Error ? error.message : String(error)
      }
    ];
  }

  if (changedFiles.length > 0 || rejectedFacts.length > 0) {
    db.markClusterFactsheetStale(loaded.factsheet.id);
    const details = {
      mode: input.mode ?? "verify_only",
      factsheet_id: loaded.factsheet.id,
      factsheet_version: loaded.factsheet.version,
      changed_files: changedFiles,
      rejected_facts: rejectedFacts
    };
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "factsheet_stale",
      details
    });
    return errorPayload(ERROR_CODES.CLUSTER_FACTSHEET_STALE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_FACTSHEET_STALE], {
      cluster_id: input.clusterId,
      details
    });
  }

  const factsheetStatus = inferFactsheetStatus(loaded.factsheetContent);
  const trustState = inferTrustState(loaded.factsheetContent, factsheetStatus);
  db.markClusterFactsheetFresh(loaded.factsheet.id, factsheetStatus, trustState);
  const refreshedFactsheet = db.getClusterFactsheet(loaded.factsheet.id);

  db.logClusterEvent({
    clusterId: input.clusterId,
    projectId: input.projectId,
    eventType: "cluster_refresh",
    details: {
      mode: input.mode ?? "verify_only",
      factsheet_id: loaded.factsheet.id,
      factsheet_version: loaded.factsheet.version,
      changed_files: []
    }
  });

  return {
    cluster_id: input.clusterId,
    factsheet_id: loaded.factsheet.id,
    factsheet_version: loaded.factsheet.version,
    mode: "verify_only",
    fresh: true,
    factsheet_status: factsheetStatus,
    trust_state: trustState,
    changed_files: [],
    verified_facts: verifiedFacts,
    rejected_facts: 0,
    refreshed_at: refreshedFactsheet?.verified_at ?? null
  };
}

function loadRefreshContext(db: RouterDatabase, projectId: string, clusterId: string): LoadedRefreshContext | ErrorPayload {
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
      reason: "Cluster has no factsheet to refresh."
    });
  }

  return {
    cluster,
    factsheet,
    fileHashes: db.listClusterFileHashes(factsheet.id),
    factsheetContent: parseFactsheetContent(factsheet)
  };
}

function findChangedFiles(cwd: string, fileHashes: ClusterFileHashRecord[]): string[] {
  const changed = new Set<string>();
  for (const file of fileHashes) {
    try {
      const absolutePath = path.resolve(cwd, file.path);
      const stat = statSync(absolutePath);
      const content = readFileSync(absolutePath);
      const hash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
      if (hash !== file.hash || stat.size !== file.file_size) {
        changed.add(file.path);
      }
    } catch {
      changed.add(file.path);
    }
  }
  return [...changed].sort();
}

function inferFactsheetStatus(content: Record<string, unknown>): "static_verified" | "llm_verified" {
  const facts = Array.isArray(content.facts) ? content.facts : [];
  if (facts.length > 0 && facts.every((fact) => isObject(fact) && fact.confidence === "llm_verified")) {
    return "llm_verified";
  }
  return "static_verified";
}

function inferTrustState(content: Record<string, unknown>, status: "static_verified" | "llm_verified"): ClusterTrustState {
  const omittedFacts = typeof content.omitted_facts === "number" ? content.omitted_facts : 0;
  if (status === "llm_verified") {
    return omittedFacts > 0 ? "partial_llm" : "llm_verified";
  }
  return omittedFacts > 0 ? "partial_static" : "static_verified";
}

function parseFactsheetContent(factsheet: ClusterFactsheetRecord): Record<string, unknown> {
  try {
    const parsed = JSON.parse(factsheet.content_json) as unknown;
    if (isObject(parsed)) {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

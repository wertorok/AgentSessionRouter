import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ClusterToolProfile, RouterDatabase } from "./db.js";

export interface FactsheetEvidence {
  path: string;
  hash?: string;
  selector?: string;
}

export interface FactsheetFact {
  id: string;
  claim: string;
  confidence?: string;
  evidence: FactsheetEvidence[];
}

export interface FactsheetInput {
  schema_version?: number;
  cluster_id?: string;
  summary?: string;
  facts?: FactsheetFact[];
  pitfalls?: Array<{ id?: string; text?: string }>;
  forbidden_inferences?: string[];
}

export interface VerifiedFactsheet {
  schema_version: 1;
  cluster_id: string;
  summary: string;
  facts: Array<{
    id: string;
    claim: string;
    confidence: "verified";
    evidence: Array<{
      path: string;
      hash: string;
      selector?: string;
    }>;
  }>;
  pitfalls: Array<{ id: string; text: string }>;
  forbidden_inferences: string[];
  omitted_facts: number;
}

export interface RejectedFact {
  id: string;
  claim: string;
  reason: string;
}

export interface StaticFactsheetVerification {
  factsheet: VerifiedFactsheet;
  fileHashes: Array<{
    path: string;
    hash: string;
    fileSize: number;
  }>;
  rejectedFacts: RejectedFact[];
}

export interface PrepareClusterInput {
  projectId: string;
  clusterId: string;
  name?: string;
  description?: string;
  toolProfileDefault: ClusterToolProfile;
  factsheet: FactsheetInput;
  sourceSessionId?: string | null;
  gitRev?: string | null;
}

export interface PrepareClusterResult {
  cluster_id: string;
  factsheet_id: string;
  factsheet_version: number;
  trust_state: "verified" | "partial";
  verified_facts: number;
  rejected_facts: number;
  rejected_fact_details: RejectedFact[];
  factsheet: VerifiedFactsheet;
}

interface VerifiedEvidenceFile {
  path: string;
  hash: string;
  fileSize: number;
  content: string;
}

export function prepareStaticCluster(
  db: RouterDatabase,
  cwd: string,
  input: PrepareClusterInput
): PrepareClusterResult {
  const cluster = db.upsertCluster({
    id: input.clusterId,
    projectId: input.projectId,
    name: input.name ?? input.clusterId,
    description: input.description,
    toolProfileDefault: input.toolProfileDefault
  });

  const verification = verifyFactsheetStatic(cwd, input.clusterId, input.factsheet);
  if (verification.factsheet.facts.length === 0) {
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "factsheet_rejected",
      details: {
        rejected_facts: verification.rejectedFacts
      }
    });
    throw new Error("factsheet has no statically verified facts");
  }

  const factsheetId = `factsheet_${randomUUID()}`;
  const factsheetRecord = db.insertClusterFactsheet({
    id: factsheetId,
    clusterId: cluster.id,
    contentJson: JSON.stringify(verification.factsheet),
    sourceSessionId: input.sourceSessionId,
    gitRev: input.gitRev,
    status: "verified",
    trustState: verification.rejectedFacts.length === 0 ? "verified" : "partial",
    fileHashes: verification.fileHashes
  });

  return {
    cluster_id: cluster.id,
    factsheet_id: factsheetId,
    factsheet_version: factsheetRecord.version,
    trust_state: verification.rejectedFacts.length === 0 ? "verified" : "partial",
    verified_facts: verification.factsheet.facts.length,
    rejected_facts: verification.rejectedFacts.length,
    rejected_fact_details: verification.rejectedFacts,
    factsheet: verification.factsheet
  };
}

export function verifyFactsheetStatic(
  cwd: string,
  clusterId: string,
  factsheet: FactsheetInput
): StaticFactsheetVerification {
  if (factsheet.cluster_id && factsheet.cluster_id !== clusterId) {
    throw new Error(`factsheet cluster_id ${factsheet.cluster_id} does not match ${clusterId}`);
  }

  const facts = Array.isArray(factsheet.facts) ? factsheet.facts : [];
  const verifiedFacts: VerifiedFactsheet["facts"] = [];
  const rejectedFacts: RejectedFact[] = [];
  const fileHashes = new Map<string, { path: string; hash: string; fileSize: number }>();

  for (const fact of facts) {
    const factId = stringOrEmpty(fact.id);
    const claim = stringOrEmpty(fact.claim);
    const evidence = Array.isArray(fact.evidence) ? fact.evidence : [];
    if (!factId || !claim || evidence.length === 0) {
      rejectedFacts.push({
        id: factId || "missing-id",
        claim,
        reason: "fact requires id, claim, and at least one evidence entry"
      });
      continue;
    }

    const verifiedEvidence: VerifiedFactsheet["facts"][number]["evidence"] = [];
    const rejectionReasons: string[] = [];
    for (const item of evidence) {
      try {
        const file = readVerifiedEvidenceFile(cwd, item.path);
        const selector = item.selector ? String(item.selector) : undefined;
        if (selector && !file.content.includes(selector)) {
          rejectionReasons.push(`selector not found in ${file.path}: ${selector}`);
          continue;
        }
        if (item.hash && item.hash !== file.hash && item.hash !== `sha256:${file.hash}`) {
          rejectionReasons.push(`hash mismatch for ${file.path}`);
          continue;
        }
        verifiedEvidence.push({
          path: file.path,
          hash: `sha256:${file.hash}`,
          ...(selector ? { selector } : {})
        });
        fileHashes.set(file.path, {
          path: file.path,
          hash: `sha256:${file.hash}`,
          fileSize: file.fileSize
        });
      } catch (error: unknown) {
        rejectionReasons.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (verifiedEvidence.length !== evidence.length) {
      rejectedFacts.push({
        id: factId,
        claim,
        reason: rejectionReasons.join("; ") || "not all evidence entries verified"
      });
      continue;
    }

    verifiedFacts.push({
      id: factId,
      claim,
      confidence: "verified",
      evidence: verifiedEvidence
    });
  }

  return {
    factsheet: {
      schema_version: 1,
      cluster_id: clusterId,
      summary: stringOrEmpty(factsheet.summary).slice(0, 500),
      facts: verifiedFacts,
      pitfalls: sanitizePitfalls(factsheet.pitfalls),
      forbidden_inferences: sanitizeStringArray(factsheet.forbidden_inferences, 20, 300),
      omitted_facts: rejectedFacts.length
    },
    fileHashes: [...fileHashes.values()],
    rejectedFacts
  };
}

function readVerifiedEvidenceFile(cwd: string, inputPath: string): VerifiedEvidenceFile {
  const relativePath = normalizeEvidencePath(inputPath);
  const absoluteCwd = path.resolve(cwd);
  const absolutePath = path.resolve(absoluteCwd, relativePath);
  if (absolutePath !== absoluteCwd && !absolutePath.startsWith(`${absoluteCwd}${path.sep}`)) {
    throw new Error(`evidence path escapes project cwd: ${inputPath}`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`evidence path does not exist: ${relativePath}`);
  }
  const stat = statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`evidence path is not a file: ${relativePath}`);
  }
  const content = readFileSync(absolutePath, "utf8");
  return {
    path: relativePath,
    hash: createHash("sha256").update(content).digest("hex"),
    fileSize: stat.size,
    content
  };
}

function normalizeEvidencePath(inputPath: string): string {
  if (!inputPath || path.isAbsolute(inputPath)) {
    throw new Error(`evidence path must be relative: ${inputPath}`);
  }
  const normalized = path.normalize(inputPath).replaceAll("\\", "/");
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`evidence path escapes project cwd: ${inputPath}`);
  }
  return normalized;
}

function sanitizePitfalls(value: unknown): Array<{ id: string; text: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Array<{ id: string; text: string }> = [];
  for (const item of value) {
    if (!isObject(item)) {
      continue;
    }
    const id = stringOrEmpty(item.id).slice(0, 120);
    const text = stringOrEmpty(item.text).slice(0, 500);
    if (!id || !text) {
      continue;
    }
    result.push({ id, text });
    if (result.length >= 20) {
      break;
    }
  }
  return result;
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

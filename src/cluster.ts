import { randomUUID } from "node:crypto";
import type { ClaudeAdapter, ClaudeJsonResponse } from "./claude.js";
import type { ClusterToolProfile, RouterDatabase } from "./db.js";
import { buildEvidenceSnippet, normalizeEvidenceHash, readEvidenceFile, type EvidenceFile } from "./evidence.js";
import { profilePromptOptions, type VerifierToolProfile } from "./profiles.js";

export interface FactsheetEvidence {
  path: string;
  hash?: string;
  selector?: string;
  snippet_hash?: string;
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
    confidence: "static_verified" | "llm_verified";
    evidence: Array<{
      path: string;
      hash: string;
      selector?: string;
      snippet_hash?: string;
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
  verificationMode?: "static" | "llm";
  llmVerifierProfile?: VerifierToolProfile;
}

export interface PrepareClusterResult {
  cluster_id: string;
  factsheet_id: string;
  factsheet_version: number;
  verification_stage: "static" | "llm";
  trust_state: "static_verified" | "partial_static" | "llm_verified" | "partial_llm";
  verified_facts: number;
  rejected_facts: number;
  rejected_fact_details: RejectedFact[];
  factsheet: VerifiedFactsheet;
  verifier_metrics?: {
    tool_profile: VerifierToolProfile;
    duration_ms: number;
    tokens_in?: number;
    tokens_out?: number;
  };
}

export interface LlmVerifierFactResult {
  id: string;
  verdict: "VERIFIED" | "UNVERIFIED" | "AMBIGUOUS";
  reason: string;
}

export interface LlmFactsheetVerification {
  factsheet: VerifiedFactsheet;
  rejectedFacts: RejectedFact[];
  verifierResults: LlmVerifierFactResult[];
  response: ClaudeJsonResponse;
  durationMs: number;
  toolProfile: VerifierToolProfile;
}

type VerifiedEvidenceFile = EvidenceFile;

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
  ensureHasVerifiedFacts(db, input.projectId, input.clusterId, verification);

  const trustState = verification.rejectedFacts.length === 0 ? "static_verified" : "partial_static";
  const factsheetRecord = db.insertClusterFactsheet({
    id: `factsheet_${randomUUID()}`,
    clusterId: cluster.id,
    contentJson: JSON.stringify(verification.factsheet),
    sourceSessionId: input.sourceSessionId,
    gitRev: input.gitRev,
    status: "static_verified",
    trustState,
    fileHashes: verification.fileHashes
  });

  return {
    cluster_id: cluster.id,
    factsheet_id: factsheetRecord.id,
    factsheet_version: factsheetRecord.version,
    verification_stage: "static",
    trust_state: trustState,
    verified_facts: verification.factsheet.facts.length,
    rejected_facts: verification.rejectedFacts.length,
    rejected_fact_details: verification.rejectedFacts,
    factsheet: verification.factsheet
  };
}

export async function prepareCluster(
  db: RouterDatabase,
  cwd: string,
  claude: ClaudeAdapter,
  input: PrepareClusterInput
): Promise<PrepareClusterResult> {
  const cluster = db.upsertCluster({
    id: input.clusterId,
    projectId: input.projectId,
    name: input.name ?? input.clusterId,
    description: input.description,
    toolProfileDefault: input.toolProfileDefault
  });

  const verification = verifyFactsheetStatic(cwd, input.clusterId, input.factsheet);
  ensureHasVerifiedFacts(db, input.projectId, input.clusterId, verification);

  if ((input.verificationMode ?? "static") !== "llm") {
    const trustState = verification.rejectedFacts.length === 0 ? "static_verified" : "partial_static";
    const factsheetRecord = db.insertClusterFactsheet({
      id: `factsheet_${randomUUID()}`,
      clusterId: cluster.id,
      contentJson: JSON.stringify(verification.factsheet),
      sourceSessionId: input.sourceSessionId,
      gitRev: input.gitRev,
      status: "static_verified",
      trustState,
      fileHashes: verification.fileHashes
    });

    return {
      cluster_id: cluster.id,
      factsheet_id: factsheetRecord.id,
      factsheet_version: factsheetRecord.version,
      verification_stage: "static",
      trust_state: trustState,
      verified_facts: verification.factsheet.facts.length,
      rejected_facts: verification.rejectedFacts.length,
      rejected_fact_details: verification.rejectedFacts,
      factsheet: verification.factsheet
    };
  }

  const llmVerification = await verifyFactsheetWithLlm(
    claude,
    cwd,
    verification.factsheet,
    input.llmVerifierProfile ?? "focused"
  );
  if (llmVerification.factsheet.facts.length === 0) {
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "factsheet_rejected",
      details: {
        static_rejected_facts: verification.rejectedFacts,
        llm_rejected_facts: llmVerification.rejectedFacts
      }
    });
    throw new Error("factsheet has no LLM verified facts");
  }

  const rejectedFacts = [...verification.rejectedFacts, ...llmVerification.rejectedFacts];
  llmVerification.factsheet.omitted_facts = rejectedFacts.length;
  const trustState = rejectedFacts.length === 0 ? "llm_verified" : "partial_llm";
  const factsheetRecord = db.insertClusterFactsheet({
    id: `factsheet_${randomUUID()}`,
    clusterId: cluster.id,
    contentJson: JSON.stringify(llmVerification.factsheet),
    sourceSessionId: input.sourceSessionId,
    gitRev: input.gitRev,
    status: "llm_verified",
    trustState,
    fileHashes: fileHashesForFacts(verification.fileHashes, llmVerification.factsheet)
  });
  db.logClusterEvent({
    clusterId: cluster.id,
    projectId: input.projectId,
    eventType: "llm_verifier",
    details: {
      tool_profile: llmVerification.toolProfile,
      factsheet_id: factsheetRecord.id,
      factsheet_version: factsheetRecord.version,
      verifier_results: llmVerification.verifierResults
    },
    durationMs: llmVerification.durationMs,
    tokensIn: llmVerification.response.tokensIn,
    tokensOut: llmVerification.response.tokensOut
  });

  return {
    cluster_id: cluster.id,
    factsheet_id: factsheetRecord.id,
    factsheet_version: factsheetRecord.version,
    verification_stage: "llm",
    trust_state: trustState,
    verified_facts: llmVerification.factsheet.facts.length,
    rejected_facts: rejectedFacts.length,
    rejected_fact_details: rejectedFacts,
    factsheet: llmVerification.factsheet,
    verifier_metrics: {
      tool_profile: llmVerification.toolProfile,
      duration_ms: llmVerification.durationMs,
      tokens_in: llmVerification.response.tokensIn,
      tokens_out: llmVerification.response.tokensOut
    }
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
        if (item.hash && normalizeEvidenceHash(item.hash) !== `sha256:${file.hash}`) {
          rejectionReasons.push(`hash mismatch for ${file.path}`);
          continue;
        }
        const snippet = selector ? buildEvidenceSnippet(file.content, selector) : null;
        if (item.snippet_hash && snippet && item.snippet_hash !== snippet.hash) {
          rejectionReasons.push(`snippet hash mismatch for ${file.path}: ${selector}`);
          continue;
        }
        verifiedEvidence.push({
          path: file.path,
          hash: `sha256:${file.hash}`,
          ...(selector ? { selector, snippet_hash: snippet?.hash } : {})
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
      confidence: "static_verified",
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

export async function verifyFactsheetWithLlm(
  claude: ClaudeAdapter,
  cwd: string,
  factsheet: VerifiedFactsheet,
  toolProfile: VerifierToolProfile
): Promise<LlmFactsheetVerification> {
  const prompt = buildLlmVerifierPrompt(cwd, factsheet);
  const start = Date.now();
  const response =
    claude.runPromptWithOptions !== undefined
      ? await claude.runPromptWithOptions(prompt, profilePromptOptions(toolProfile))
      : await claude.runPrompt(prompt);
  const durationMs = Date.now() - start;
  const verifierResults = parseLlmVerifierResponse(response.result);
  const resultById = new Map(verifierResults.map((result) => [result.id, result]));
  const promotedFacts: VerifiedFactsheet["facts"] = [];
  const rejectedFacts: RejectedFact[] = [];

  for (const fact of factsheet.facts) {
    const verdict = resultById.get(fact.id);
    if (verdict?.verdict === "VERIFIED") {
      promotedFacts.push({
        ...fact,
        confidence: "llm_verified"
      });
      continue;
    }
    rejectedFacts.push({
      id: fact.id,
      claim: fact.claim,
      reason: `llm_verifier:${verdict?.verdict ?? "MISSING"} ${verdict?.reason ?? "verifier did not return this fact"}`
    });
  }

  return {
    factsheet: {
      ...factsheet,
      facts: promotedFacts,
      omitted_facts: factsheet.omitted_facts + rejectedFacts.length
    },
    rejectedFacts,
    verifierResults,
    response,
    durationMs,
    toolProfile
  };
}

export function parseLlmVerifierResponse(source: string): LlmVerifierFactResult[] {
  const json = extractJsonObject(source);
  const parsed: unknown = JSON.parse(json);
  if (!isObject(parsed) || !Array.isArray(parsed.facts)) {
    throw new Error("LLM verifier response must be a JSON object with a facts array");
  }

  const results: LlmVerifierFactResult[] = [];
  for (const item of parsed.facts) {
    if (!isObject(item)) {
      continue;
    }
    const id = stringOrEmpty(item.id);
    const verdict = stringOrEmpty(item.verdict).toUpperCase();
    if (!id || (verdict !== "VERIFIED" && verdict !== "UNVERIFIED" && verdict !== "AMBIGUOUS")) {
      continue;
    }
    results.push({
      id,
      verdict,
      reason: stringOrEmpty(item.reason).slice(0, 500)
    });
  }

  if (results.length === 0) {
    throw new Error("LLM verifier response did not contain usable fact verdicts");
  }
  return results;
}

const readVerifiedEvidenceFile = readEvidenceFile;

function ensureHasVerifiedFacts(
  db: RouterDatabase,
  projectId: string,
  clusterId: string,
  verification: StaticFactsheetVerification
): void {
  if (verification.factsheet.facts.length > 0) {
    return;
  }
  db.logClusterEvent({
    clusterId,
    projectId,
    eventType: "factsheet_rejected",
    details: {
      rejected_facts: verification.rejectedFacts
    }
  });
  throw new Error("factsheet has no statically verified facts");
}

function fileHashesForFacts(
  staticFileHashes: StaticFactsheetVerification["fileHashes"],
  factsheet: VerifiedFactsheet
): StaticFactsheetVerification["fileHashes"] {
  const usedPaths = new Set(factsheet.facts.flatMap((fact) => fact.evidence.map((evidence) => evidence.path)));
  return staticFileHashes.filter((file) => usedPaths.has(file.path));
}

function buildLlmVerifierPrompt(cwd: string, factsheet: VerifiedFactsheet): string {
  const facts = factsheet.facts.map((fact) => ({
    id: fact.id,
    claim: fact.claim,
    evidence: fact.evidence.map((evidence) => {
      const file = readVerifiedEvidenceFile(cwd, evidence.path);
      return {
        path: evidence.path,
        selector: evidence.selector ?? null,
        snippet: snippetForEvidence(file.content, evidence.selector)
      };
    })
  }));

  return [
    "You are verifying a cluster factsheet for AgentSessionRouter.",
    "For each fact, decide whether the supplied evidence semantically supports the claim.",
    "Return VERIFIED only when the claim follows from the evidence.",
    "Return UNVERIFIED when support is missing or the claim names APIs/config that are not shown.",
    "Return AMBIGUOUS when the evidence is related but insufficient.",
    "Do not infer. Do not use tools. Return JSON only.",
    "",
    "Expected JSON shape:",
    '{"facts":[{"id":"fact-id","verdict":"VERIFIED|UNVERIFIED|AMBIGUOUS","reason":"short reason"}]}',
    "",
    `Factsheet cluster_id: ${factsheet.cluster_id}`,
    `Facts to verify: ${JSON.stringify(facts, null, 2)}`
  ].join("\n");
}

function snippetForEvidence(content: string, selector: string | undefined): string {
  try {
    return buildEvidenceSnippet(content, selector).text.slice(0, 1600);
  } catch {
    return content.slice(0, 1600);
  }
}

function extractJsonObject(source: string): string {
  const trimmed = source.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("LLM verifier response did not include a JSON object");
  }
  return candidate.slice(start, end + 1);
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

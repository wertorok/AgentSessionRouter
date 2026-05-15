import { randomUUID } from "node:crypto";
import type { ClaudeJsonResponse } from "./claude.js";
import type { ClusterConsultSuccess } from "./clusterConsult.js";
import type { ComparisonPreference, ConsultComparisonRecord, RouterDatabase, ShadowStatus } from "./db.js";
import type { RouterRuntime } from "./runtime.js";

export interface ShadowComparisonInput {
  projectId: string;
  clusterId: string;
  question: string;
  clusterResult: ClusterConsultSuccess;
}

export interface JudgeResult {
  answerAScore: number;
  answerAErrors: string[];
  answerBScore: number;
  answerBErrors: string[];
  preferred: "a" | "b" | "tie";
  reasoning: string;
}

export function scheduleShadowComparison(runtime: RouterRuntime, input: ShadowComparisonInput): string | null {
  if (!runtime.config.eval.shadowMode) {
    return null;
  }
  const comparisonId = `comparison_${randomUUID()}`;

  setImmediate(() => {
    void insertAndCompleteShadowComparison(runtime, comparisonId, input).catch((error: unknown) => {
      runtime.logger.warn("shadow_comparison_failed", {
        comparison_id: comparisonId,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  });
  return comparisonId;
}

export async function runShadowComparison(runtime: RouterRuntime, input: ShadowComparisonInput): Promise<ConsultComparisonRecord> {
  const comparison = insertComparison(runtime.db, `comparison_${randomUUID()}`, input);
  await completeShadowComparison(runtime, comparison.id);
  return runtime.db.getConsultComparison(comparison.id)!;
}

async function insertAndCompleteShadowComparison(
  runtime: RouterRuntime,
  comparisonId: string,
  input: ShadowComparisonInput
): Promise<void> {
  insertComparison(runtime.db, comparisonId, input);
  await completeShadowComparison(runtime, comparisonId);
}

function insertComparison(
  db: RouterDatabase,
  comparisonId: string,
  input: ShadowComparisonInput
): ConsultComparisonRecord {
  return db.insertConsultComparison({
    id: comparisonId,
    projectId: input.projectId,
    clusterId: input.clusterId,
    question: input.question,
    clusterAnswer: input.clusterResult.answer,
    clusterDurationMs: input.clusterResult.metrics.duration_ms,
    clusterCostUsd: input.clusterResult.metrics.cost_usd ?? null,
    clusterWasNotInContext: /NOT IN CONTEXT/i.test(input.clusterResult.answer),
    shadowMethod: "direct_fresh"
  });
}

export async function completeShadowComparison(runtime: RouterRuntime, comparisonId: string): Promise<void> {
  let comparison = runtime.db.getConsultComparison(comparisonId);
  if (!comparison) {
    return;
  }
  if (comparison.judged_at) {
    return;
  }

  if (comparison.shadow_status !== "ok" || !comparison.direct_answer) {
    let directResponse: ClaudeJsonResponse;
    const directStarted = runtime.clock.nowMillis();
    try {
      directResponse = await runtime.claude.runPrompt(buildDirectFreshPrompt(runtime.cwd, comparison.question));
    } catch (error: unknown) {
      runtime.db.updateConsultComparisonDirect({
        id: comparison.id,
        status: classifyShadowFailure(error),
        shadowError: error instanceof Error ? error.message : String(error),
        directDurationMs: runtime.clock.nowMillis() - directStarted
      });
      return;
    }

    runtime.db.updateConsultComparisonDirect({
      id: comparison.id,
      status: "ok",
      directAnswer: directResponse.result,
      directDurationMs: runtime.clock.nowMillis() - directStarted,
      directCostUsd: directResponse.totalCostUsd ?? null
    });
    comparison = runtime.db.getConsultComparison(comparison.id);
  }

  const readyComparison = comparison;
  if (!readyComparison?.cluster_answer || !readyComparison.direct_answer) {
    return;
  }

  const clusterIsA = Math.random() < 0.5;
  const answerA = clusterIsA ? readyComparison.cluster_answer : readyComparison.direct_answer;
  const answerB = clusterIsA ? readyComparison.direct_answer : readyComparison.cluster_answer;
  const judgePrompt = buildJudgePrompt(readyComparison.question, answerA, answerB);
  const judgeResponse = runtime.claude.runPromptWithOptions
    ? await runtime.claude.runPromptWithOptions(judgePrompt, {
        extraArgs: ["--tools", ""],
        includeConfiguredExtraArgs: false
      })
    : await runtime.claude.runPrompt(judgePrompt);
  const judge = parseJudgeResponse(judgeResponse.result);
  const preferred = decodePreference(judge.preferred, clusterIsA);

  runtime.db.updateConsultComparisonJudge({
    id: readyComparison.id,
    clusterScore: clusterIsA ? judge.answerAScore : judge.answerBScore,
    directScore: clusterIsA ? judge.answerBScore : judge.answerAScore,
    preferred,
    clusterErrors: clusterIsA ? judge.answerAErrors : judge.answerBErrors,
    directErrors: clusterIsA ? judge.answerBErrors : judge.answerAErrors,
    judgeReasoning: judge.reasoning
  });
}

function buildDirectFreshPrompt(cwd: string, question: string): string {
  return [
    "You are a shadow evaluation baseline for AgentSessionRouter.",
    "Answer the technical question about the software project in the current working directory.",
    `Project cwd: ${cwd}`,
    "Use read-only project inspection if needed. Do not modify files.",
    "Keep the answer concise but complete.",
    "",
    "Question:",
    question
  ].join("\n");
}

function buildJudgePrompt(question: string, answerA: string, answerB: string): string {
  return [
    "You are evaluating two answers to the same technical question about a software project.",
    "",
    "Question:",
    question,
    "",
    "Answer A:",
    answerA,
    "",
    "Answer B:",
    answerB,
    "",
    "Evaluate each answer:",
    "1. Factual errors: claims that are demonstrably wrong.",
    "2. Completeness: did it fully address the question?",
    "3. Honest refusal: explicit uncertainty or NOT IN CONTEXT is acceptable if the answer lacks needed context.",
    "",
    "Score each answer:",
    "0 = wrong or hallucinated",
    "1 = partial, missed key facts",
    "2 = correct but shallow",
    "3 = fully correct and substantive",
    "",
    "Output JSON only:",
    JSON.stringify(
      {
        answer_a_score: 0,
        answer_a_errors: ["specific error 1"],
        answer_b_score: 0,
        answer_b_errors: ["specific error 1"],
        preferred: "a|b|tie",
        reasoning: "one paragraph why"
      },
      null,
      2
    )
  ].join("\n");
}

export function parseJudgeResponse(source: string): JudgeResult {
  const parsed: unknown = JSON.parse(extractJsonObject(source));
  if (!isObject(parsed)) {
    throw new Error("Judge response must be a JSON object");
  }
  const preferred = stringField(parsed, "preferred").toLowerCase();
  if (preferred !== "a" && preferred !== "b" && preferred !== "tie") {
    throw new Error("Judge response preferred must be a, b, or tie");
  }
  return {
    answerAScore: scoreField(parsed, "answer_a_score"),
    answerAErrors: stringArrayField(parsed, "answer_a_errors"),
    answerBScore: scoreField(parsed, "answer_b_score"),
    answerBErrors: stringArrayField(parsed, "answer_b_errors"),
    preferred,
    reasoning: stringField(parsed, "reasoning").slice(0, 2000)
  };
}

function decodePreference(preferred: "a" | "b" | "tie", clusterIsA: boolean): ComparisonPreference {
  if (preferred === "tie") {
    return "tie";
  }
  if ((preferred === "a" && clusterIsA) || (preferred === "b" && !clusterIsA)) {
    return "cluster";
  }
  return "direct";
}

function classifyShadowFailure(error: unknown): ShadowStatus {
  const message = error instanceof Error ? error.message : String(error);
  if (/auth|login|credential|api key|oauth/i.test(message)) {
    return "failed_auth";
  }
  if (/timeout|timed out|SIGTERM|SIGKILL/i.test(message)) {
    return "failed_timeout";
  }
  return "failed_other";
}

function extractJsonObject(source: string): string {
  const trimmed = source.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Judge response did not include a JSON object");
  }
  return trimmed.slice(start, end + 1);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function stringArrayField(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string").slice(0, 20);
}

function scoreField(source: Record<string, unknown>, key: string): number {
  const value = Number(source[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`Judge response missing numeric ${key}`);
  }
  return Math.max(0, Math.min(3, Math.round(value)));
}

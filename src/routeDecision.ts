import { findBestSessionMatch, normalizeTopicKey, rankSessionMatches } from "./matching.js";
import type { RouterRuntime } from "./runtime.js";

export const MAX_QUESTION_CHARS = 20_000;
export const MAX_RELEVANT_CODE_CHARS = 30_000;
export const MAX_TOPIC_HINT_CHARS = 200;
export const MAX_TRIGGER_CHARS = 200;
export const MAX_TASK_CHARS = 1_000;
export const MAX_IDENTIFIER_CHARS = 160;
export const MAX_TAGS = 20;
export const MAX_TAG_CHARS = 80;
export const MAX_RELATED_FILES = 50;
export const MAX_RELATED_FILE_CHARS = 240;
export const SAFE_IDENTIFIER_RE = /^[A-Za-z0-9._:-]+$/;

export type RouterTaskType = "architectural" | "debug" | "lookup" | "review" | "planning";

interface RouterConsultInput {
  cluster_id?: string | null;
  session_id?: string | null;
  topic_hint?: string | null;
  trigger?: string | null;
  task?: string | null;
  task_type?: RouterTaskType | null;
  related_files?: Array<string | null | undefined> | null;
  tags?: Array<string | null | undefined> | null;
  relevant_code?: string | null;
  question: string;
  tool_profile?: "bare" | "focused" | "agent" | null;
}

export interface RouterConsultNormalizedInput {
  cluster_id?: string | null;
  session_id?: string | null;
  topic_hint: string;
  trigger: string;
  task: string;
  task_type: RouterTaskType | null;
  related_files: string[];
  tags: string[];
  relevant_code: string;
  question: string;
  tool_profile?: "bare" | "focused" | "agent" | null;
  metadata_quality: RouteMetadataQuality;
}

export type RouterConsultSelectedPath =
  | "cluster_consult_explicit"
  | "claude_consult_explicit_session"
  | "claude_consult_existing_session"
  | "claude_consult_disambiguated_session"
  | "claude_consult_new_session"
  | "claude_consult_auto";

export interface RouterConsultDecision {
  selected_path: RouterConsultSelectedPath;
  reason: string;
  session_id?: string | null;
  cluster_id?: string | null;
  match_score: number;
  candidate_gap?: number | null;
  force_new_session?: boolean;
  topic_hint: string;
  metadata_quality: RouteMetadataQuality;
  auto_cluster_routing: "disabled_read_only";
}

export interface RouteMetadataQuality {
  score: number;
  topic_hint_source: "caller" | "inferred";
  missing: string[];
  related_files_count: number;
  tags_count: number;
  generic_tags_count: number;
  task_type: string | null;
}

export function normalizeRouterConsultInput(input: RouterConsultInput): RouterConsultNormalizedInput {
  const callerTopicHint = cleanOptionalString(input.topic_hint, MAX_TOPIC_HINT_CHARS);
  const relatedFiles = normalizeRelatedFiles(input.related_files ?? []);
  const tags = normalizeTags(input.tags ?? []);
  return {
    cluster_id: cleanOptionalIdentifier(input.cluster_id),
    session_id: cleanOptionalIdentifier(input.session_id),
    topic_hint: callerTopicHint ?? inferTopicHint(input.question),
    trigger: cleanOptionalString(input.trigger, MAX_TRIGGER_CHARS) ?? "router_consult",
    task: cleanOptionalString(input.task, MAX_TASK_CHARS) ?? "Answer the parent agent's question through AgentSessionRouter.",
    task_type: input.task_type ?? null,
    related_files: relatedFiles,
    tags,
    relevant_code: cleanOptionalString(input.relevant_code, MAX_RELEVANT_CODE_CHARS) ?? "",
    question: input.question,
    tool_profile: input.tool_profile ?? null,
    metadata_quality: buildRouteMetadataQuality({
      topicHintSource: callerTopicHint ? "caller" : "inferred",
      relatedFiles,
      tags,
      taskType: input.task_type ?? null
    })
  };
}

export function resolveRouterConsultDecision(
  runtime: RouterRuntime,
  projectId: string,
  input: RouterConsultNormalizedInput
): RouterConsultDecision {
  if (input.cluster_id) {
    return {
      selected_path: "cluster_consult_explicit",
      reason: input.session_id
        ? "Explicit cluster_id provided; conservative router prefers explicit cluster over session_id."
        : "Explicit cluster_id provided by caller.",
      cluster_id: input.cluster_id,
      match_score: 1,
      topic_hint: input.topic_hint,
      metadata_quality: input.metadata_quality,
      auto_cluster_routing: "disabled_read_only"
    };
  }

  if (input.session_id) {
    return {
      selected_path: "claude_consult_explicit_session",
      reason: "Explicit session_id provided by caller.",
      session_id: input.session_id,
      match_score: 1,
      topic_hint: input.topic_hint,
      metadata_quality: input.metadata_quality,
      auto_cluster_routing: "disabled_read_only"
    };
  }

  const sessions = runtime.db.listMatchCandidates(projectId, false);
  const exactTopicSession = sessions.find((session) => normalizeTopicKey(session.topic) === normalizeTopicKey(input.topic_hint));
  if (exactTopicSession) {
    return {
      selected_path: "claude_consult_existing_session",
      reason: "Exact normalized topic match; routing to existing session before allowing a new session.",
      session_id: exactTopicSession.id,
      match_score: 1,
      topic_hint: input.topic_hint,
      metadata_quality: input.metadata_quality,
      auto_cluster_routing: "disabled_read_only"
    };
  }

  const matchInput = {
    topicHint: input.topic_hint,
    task: input.task,
    relevantCode: input.relevant_code,
    question: input.question,
    relatedFiles: input.related_files,
    tags: input.tags,
    taskType: input.task_type
  };
  const match = findBestSessionMatch(
    sessions,
    matchInput,
    runtime.config.matching.thresholdUse,
    runtime.config.matching.thresholdLowConfidence
  );
  const ranked = rankSessionMatches(sessions, matchInput);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const candidateGap = best && second ? round2(best.score - second.score) : null;
  if (match.session && !match.lowConfidence) {
    return {
      selected_path: "claude_consult_existing_session",
      reason: `High-confidence existing session match. ${match.reason}`,
      session_id: match.session.id,
      match_score: match.score,
      candidate_gap: candidateGap,
      topic_hint: input.topic_hint,
      metadata_quality: input.metadata_quality,
      auto_cluster_routing: "disabled_read_only"
    };
  }

  if (match.session && best && best.score >= runtime.config.matching.thresholdLowConfidence) {
    const gap = second ? best.score - second.score : Number.POSITIVE_INFINITY;
    if (gap >= runtime.config.matching.disambiguationGap) {
      return {
        selected_path: "claude_consult_disambiguated_session",
        reason:
          `Low-confidence session match was unambiguous enough for router-level disambiguation. ` +
          `${match.reason} gap_to_second=${Number.isFinite(gap) ? round2(gap) : "n/a"}.`,
        session_id: match.session.id,
        match_score: match.score,
        candidate_gap: Number.isFinite(gap) ? round2(gap) : null,
        topic_hint: input.topic_hint,
        metadata_quality: input.metadata_quality,
        auto_cluster_routing: "disabled_read_only"
      };
    }

    return {
      selected_path: "claude_consult_new_session",
      reason:
        `Ambiguous low-confidence session candidates; router starts a new durable session instead of guessing. ` +
        `${match.reason} gap_to_second=${round2(gap)} threshold_gap=${runtime.config.matching.disambiguationGap}.`,
      match_score: match.score,
      candidate_gap: round2(gap),
      force_new_session: true,
      topic_hint: input.topic_hint,
      metadata_quality: input.metadata_quality,
      auto_cluster_routing: "disabled_read_only"
    };
  }

  return {
    selected_path: "claude_consult_new_session",
    reason: `No exact or usable existing session match; router starts a new durable session. ${match.reason}`,
    match_score: match.score,
    candidate_gap: candidateGap,
    force_new_session: true,
    topic_hint: input.topic_hint,
    metadata_quality: input.metadata_quality,
    auto_cluster_routing: "disabled_read_only"
  };
}

export function buildRouterDryRunCandidates(
  runtime: RouterRuntime,
  projectId: string,
  input: RouterConsultNormalizedInput,
  limit: number
): Array<{
  rank: number;
  session_id: string;
  topic: string;
  status: string;
  score: number;
  reason: string;
  exact_topic_match: boolean;
  files_discussed_count: number;
  tags_count: number;
}> {
  const sessions = runtime.db.listMatchCandidates(projectId, false);
  const matchInput = {
    topicHint: input.topic_hint,
    task: input.task,
    relevantCode: input.relevant_code,
    question: input.question,
    relatedFiles: input.related_files,
    tags: input.tags,
    taskType: input.task_type
  };
  const topicKey = normalizeTopicKey(input.topic_hint);
  return rankSessionMatches(sessions, matchInput)
    .slice(0, limit)
    .map((ranked, index) => ({
      rank: index + 1,
      session_id: ranked.session.id,
      topic: ranked.session.topic,
      status: ranked.session.status,
      score: round2(ranked.score),
      reason: ranked.reason,
      exact_topic_match: normalizeTopicKey(ranked.session.topic) === topicKey,
      files_discussed_count: ranked.session.files_discussed.length,
      tags_count: ranked.session.tags.length
    }));
}

export function logRouterRouteDecision(
  runtime: RouterRuntime,
  projectId: string,
  question: string,
  decision: RouterConsultDecision
): void {
  runtime.db.logEvent({
    sessionId: decision.session_id ?? null,
    projectId,
    eventType: "router_route_decision",
    question,
    answerSummary: decision.selected_path,
    matchScore: decision.match_score,
    matchReason: [
      decision.reason,
      `topic_hint=${decision.topic_hint}`,
      `auto_cluster_routing=${decision.auto_cluster_routing}`,
      `metadata_score=${decision.metadata_quality.score}`,
      `metadata_topic_hint_source=${decision.metadata_quality.topic_hint_source}`,
      `metadata_missing=${decision.metadata_quality.missing.length ? decision.metadata_quality.missing.join(",") : "none"}`,
      `related_files_count=${decision.metadata_quality.related_files_count}`,
      `tags_count=${decision.metadata_quality.tags_count}`,
      `generic_tags_count=${decision.metadata_quality.generic_tags_count}`,
      decision.metadata_quality.task_type ? `task_type=${decision.metadata_quality.task_type}` : null,
      decision.cluster_id ? `cluster_id=${decision.cluster_id}` : null,
      decision.session_id ? `session_id=${decision.session_id}` : null,
      decision.candidate_gap === undefined || decision.candidate_gap === null
        ? null
        : `candidate_gap=${decision.candidate_gap}`,
      decision.force_new_session ? "force_new_session=true" : null
    ]
      .filter(Boolean)
      .join("; ")
  });
}

function cleanOptionalString(value: string | null | undefined, maxChars = MAX_TASK_CHARS): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxChars);
}

const GENERIC_ROUTE_TAGS = new Set(["code", "general", "misc", "project", "system", "task", "thing", "work"]);

export function normalizeTags(values: Array<string | null | undefined> | null | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .map((value) => value.slice(0, MAX_TAG_CHARS))
    )
  ).slice(0, MAX_TAGS);
}

export function normalizeRelatedFiles(values: Array<string | null | undefined> | null | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => sanitizeRelatedFile(value))
        .filter((value): value is string => Boolean(value))
    )
  ).slice(0, MAX_RELATED_FILES);
}

function sanitizeRelatedFile(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.length > MAX_RELATED_FILE_CHARS || trimmed.includes("\0")) {
    return null;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("~")) {
    return null;
  }
  if (trimmed.split("/").some((segment) => segment === "..")) {
    return null;
  }
  return trimmed;
}

export function sanitizeRequiredText(value: string, maxChars: number): string {
  return value.trim().slice(0, maxChars);
}

function cleanOptionalIdentifier(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_IDENTIFIER_CHARS || !SAFE_IDENTIFIER_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function buildRouteMetadataQuality(input: {
  topicHintSource: "caller" | "inferred";
  relatedFiles: string[];
  tags: string[];
  taskType: string | null;
}): RouteMetadataQuality {
  const missing: string[] = [];
  if (input.topicHintSource !== "caller") {
    missing.push("topic_hint");
  }
  if (input.relatedFiles.length === 0) {
    missing.push("related_files");
  }
  const genericTagsCount = input.tags.filter((tag) => GENERIC_ROUTE_TAGS.has(tag.toLowerCase())).length;
  if (input.tags.length === 0) {
    missing.push("tags");
  }
  if (!input.taskType) {
    missing.push("task_type");
  }

  const score =
    (input.topicHintSource === "caller" ? 0.35 : 0) +
    (input.relatedFiles.length > 0 ? 0.35 : 0) +
    (input.tags.length > 0 ? 0.2 : 0) +
    (input.taskType ? 0.1 : 0);

  return {
    score: round2(score),
    topic_hint_source: input.topicHintSource,
    missing,
    related_files_count: input.relatedFiles.length,
    tags_count: input.tags.length,
    generic_tags_count: genericTagsCount,
    task_type: input.taskType
  };
}

function inferTopicHint(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "router consult";
  }
  const sentence = normalized.split(/[.!?]/)[0]?.trim() || normalized;
  return sentence.slice(0, 80);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

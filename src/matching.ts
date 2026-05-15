import type { SessionMatchCandidate } from "./db.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "for",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with"
]);

export interface MatchInput {
  topicHint: string;
  task: string;
  relevantCode: string;
  question: string;
}

export interface MatchResult {
  session: SessionMatchCandidate | null;
  score: number;
  reason: string;
  lowConfidence: boolean;
}

interface CandidateScore {
  session: SessionMatchCandidate;
  score: number;
  reason: string;
}

export interface RankedSessionMatch {
  session: SessionMatchCandidate;
  score: number;
  reason: string;
}

export function findBestSessionMatch(
  sessions: SessionMatchCandidate[],
  input: MatchInput,
  thresholdUse: number,
  thresholdLowConfidence: number
): MatchResult {
  const scores = rankSessionMatches(sessions, input);
  const best = scores[0];
  if (!best || roundScore(best.score) < thresholdLowConfidence) {
    return {
      session: null,
      score: best?.score ?? 0,
      reason: best?.reason ?? "No eligible active or dormant sessions in project.",
      lowConfidence: false
    };
  }

  return {
    session: best.session,
    score: roundScore(best.score),
    reason: best.reason,
    lowConfidence: best.score < thresholdUse
  };
}

export function rankSessionMatches(sessions: SessionMatchCandidate[], input: MatchInput): RankedSessionMatch[] {
  return sessions.map((session) => scoreSession(session, input)).sort((a, b) => b.score - a.score);
}

export function normalizeTokens(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map(stripPlural)
    .map(lightStem)
    .map(normalizeSynonym)
    .filter((token) => !STOP_WORDS.has(token));

  return Array.from(new Set(normalized));
}

export function normalizeTopicKey(topic: string): string {
  return normalizeTokens(topic).join("-");
}

function scoreSession(session: SessionMatchCandidate, input: MatchInput): CandidateScore {
  const topicSimilarity = jaccard(normalizeTokens(session.topic), normalizeTokens(input.topicHint));
  const filesOverlap = scoreFilesOverlap(extractPathCandidates(input), session.files_discussed);
  const tagsOverlap = jaccard(normalizeTokens(input.task), session.tags.flatMap(normalizeTokens));
  const aliasesOverlap = scoreAliasOverlap(input, session.aliases);
  const recencyScore = session.recency_score;

  const score =
    0.3 * topicSimilarity +
    0.25 * filesOverlap +
    0.2 * tagsOverlap +
    0.15 * aliasesOverlap +
    0.1 * recencyScore;

  return {
    session,
    score,
    reason:
      `Matched topic=${roundScore(topicSimilarity)}, files=${roundScore(filesOverlap)}, ` +
      `tags=${roundScore(tagsOverlap)}, aliases=${roundScore(aliasesOverlap)}, recency=${roundScore(recencyScore)}.`
  };
}

function jaccard(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreFilesOverlap(taskPaths: string[], sessionPaths: string[]): number {
  let best = 0;
  for (const taskPath of taskPaths) {
    for (const sessionPath of sessionPaths) {
      if (taskPath === sessionPath) {
        best = Math.max(best, 1);
      } else if (taskPath.startsWith(sessionPath) || sessionPath.startsWith(taskPath)) {
        best = Math.max(best, 0.6);
      }
    }
  }
  return best;
}

function scoreAliasOverlap(input: MatchInput, aliases: string[]): number {
  const haystack = `${input.topicHint} ${input.task} ${input.question}`.toLowerCase();
  let phraseHit = 0;
  for (const alias of aliases) {
    if (alias && haystack.includes(alias.toLowerCase())) {
      phraseHit = 1;
      break;
    }
  }

  const tokenScore = jaccard(normalizeTokens(haystack), aliases.flatMap(normalizeTokens));
  return Math.max(phraseHit, tokenScore);
}

function extractPathCandidates(input: MatchInput): string[] {
  const text = `${input.task} ${input.relevantCode} ${input.question}`;
  const matches = text.match(/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+/g) ?? [];
  return Array.from(new Set(matches.map((item) => item.trim())));
}

function stripPlural(token: string): string {
  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }
  return token;
}

function lightStem(token: string): string {
  if (token === "refactoring") {
    return "refactor";
  }
  if (token.endsWith("ing") && token.length > 5) {
    return token.slice(0, -3);
  }
  return token;
}

function normalizeSynonym(token: string): string {
  if (token === "authentication") {
    return "auth";
  }
  return token;
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

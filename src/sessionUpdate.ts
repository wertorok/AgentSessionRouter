import type { SessionUpdateData } from "./db.js";

export interface ParsedSessionUpdate {
  answer: string;
  update: SessionUpdateData;
}

const UPDATE_MARKER = "SESSION_UPDATE_JSON:";

export function parseSessionUpdate(response: string): ParsedSessionUpdate | null {
  const markerIndex = response.lastIndexOf(UPDATE_MARKER);
  if (markerIndex < 0) {
    return null;
  }

  const answer = response.slice(0, markerIndex).trim();
  const jsonText = normalizeUpdateJsonText(response.slice(markerIndex + UPDATE_MARKER.length));
  const parsed: any = JSON.parse(jsonText);
  return {
    answer,
    update: sanitizeSessionUpdate(parsed)
  };
}

function normalizeUpdateJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const firstLineEnd = trimmed.indexOf("\n");
  if (firstLineEnd < 0) {
    return trimmed;
  }

  const withoutFenceStart = trimmed.slice(firstLineEnd + 1).trim();
  const fenceEnd = withoutFenceStart.lastIndexOf("```");
  if (fenceEnd < 0) {
    return withoutFenceStart;
  }

  return withoutFenceStart.slice(0, fenceEnd).trim();
}

export function sanitizeSessionUpdate(update: any): SessionUpdateData {
  return {
    summary: String(update.summary || "").trim().slice(0, 200),
    decisions: sanitizeStringArray(update.decisions, 10, 300),
    open_questions: sanitizeStringArray(update.open_questions, 5, 300),
    files_discussed: sanitizeStringArray(update.files_discussed, 20, 200),
    tags: sanitizeStringArray(update.tags, 8, 50).map((tag) => tag.toLowerCase()),
    aliases: sanitizeStringArray(update.aliases, 12, 80).map((alias) => alias.toLowerCase())
  };
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  const items = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = String(item).trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized.slice(0, maxLength));
    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

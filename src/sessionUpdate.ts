import type { SessionUpdateData } from "./db.js";

export interface ParsedSessionUpdate {
  answer: string;
  update: SessionUpdateData;
}

const UPDATE_MARKER = "SESSION_UPDATE_JSON:";
const UPDATE_MARKER_PATTERN = /(^|\n)[ \t]*(?:#{1,6}[ \t]*)?SESSION_UPDATE_JSON[ \t]*:?[ \t]*(?:\n|$)/g;

export function parseSessionUpdate(response: string): ParsedSessionUpdate | null {
  const marker = findLastUpdateMarker(response);
  if (!marker) {
    return null;
  }

  const answer = cleanAnswerBeforeMarker(response.slice(0, marker.index));
  const jsonText = normalizeUpdateJsonText(response.slice(marker.end));
  const parsed: any = JSON.parse(jsonText);
  return {
    answer,
    update: sanitizeSessionUpdate(parsed)
  };
}

export function cleanCallerAnswer(text: string): string {
  return stripPseudoToolCalls(text).trim();
}

function findLastUpdateMarker(response: string): { index: number; end: number } | null {
  let lastMarker: { index: number; end: number } | null = null;
  for (const match of response.matchAll(UPDATE_MARKER_PATTERN)) {
    const leadingNewline = match[1] ?? "";
    lastMarker = {
      index: match.index + leadingNewline.length,
      end: match.index + match[0].length
    };
  }

  if (lastMarker) {
    return lastMarker;
  }

  const legacyIndex = response.lastIndexOf(UPDATE_MARKER);
  return legacyIndex >= 0 ? { index: legacyIndex, end: legacyIndex + UPDATE_MARKER.length } : null;
}

function cleanAnswerBeforeMarker(text: string): string {
  return cleanCallerAnswer(text).replace(/\n?```(?:json)?\s*$/i, "").trim();
}

function stripPseudoToolCalls(text: string): string {
  return text
    .replace(/<minimax:tool_call\b[\s\S]*?<\/minimax:tool_call>/gi, "")
    .replace(/<tool_call\b[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool-call\b[\s\S]*?<\/tool-call>/gi, "")
    .replace(/<invoke\b[\s\S]*?<\/invoke>/gi, "")
    .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, "")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeUpdateJsonText(rawText: string): string {
  let trimmed = rawText.trim();
  if (!trimmed.startsWith("```")) {
    return extractFirstJsonObject(trimmed);
  }

  const firstLineEnd = trimmed.indexOf("\n");
  if (firstLineEnd < 0) {
    return trimmed;
  }

  const withoutFenceStart = trimmed.slice(firstLineEnd + 1).trim();
  const fenceEnd = withoutFenceStart.lastIndexOf("```");
  if (fenceEnd < 0) {
    trimmed = withoutFenceStart;
  } else {
    trimmed = withoutFenceStart.slice(0, fenceEnd).trim();
  }

  return extractFirstJsonObject(trimmed);
}

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) {
    return text.trim();
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1).trim();
      }
    }
  }

  return text.slice(start).trim();
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

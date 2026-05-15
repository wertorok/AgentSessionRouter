import type { SessionInspectView } from "./db.js";

export interface ConsultPromptInput {
  projectId: string;
  topicHint: string;
  trigger: string;
  task: string;
  taskType?: string | null;
  relatedFiles?: string[];
  tags?: string[];
  relevantCode: string;
  question: string;
  context: string;
}

export function buildConsultPrompt(input: ConsultPromptInput): string {
  return `You are acting as a senior engineering consultant for this project.

Project: ${input.projectId}
Topic: ${input.topicHint}
Trigger: ${input.trigger}
Task: ${input.task}
Task type: ${input.taskType ?? "unspecified"}
Related files:
${formatList(input.relatedFiles ?? [])}
Caller tags:
${formatList(input.tags ?? [])}

Known registry context:
${input.context}

Relevant code, max 200 lines:
${capRelevantCode(input.relevantCode)}

Question:
${input.question}

Answer the question directly and practically.
Do not restate generic background.
Use the existing decisions when possible.
This router invocation cannot execute tool calls for you.
Do not emit XML, JSON, bracketed, or pseudo tool calls such as <tool_call>, <invoke>, [TOOL_CALL], Glob, Read, Grep, or Bash.
If the registry context is insufficient, answer with the useful context you have and explicitly name what is missing; do not attempt discovery in the response.
The prose before SESSION_UPDATE_JSON must be the final caller-facing answer, not a plan to inspect files.

At the end of your response, include exactly one machine-readable block:

SESSION_UPDATE_JSON:
{
  "summary": "one sentence summary, max 200 chars",
  "decisions": ["new durable decision"],
  "open_questions": ["open question"],
  "files_discussed": ["path/or/file.ts"],
  "tags": ["tag"],
  "aliases": ["alternative phrase"]
}`;
}

function capRelevantCode(relevantCode: string): string {
  return relevantCode.split(/\r?\n/).slice(0, 200).join("\n");
}

export function buildSessionContext(session: SessionInspectView | null): string {
  if (!session) {
    return "No prior registry context for this topic.";
  }

  return formatContext("Current session registry context", session);
}

export function buildBootstrapContext(session: SessionInspectView, recoveryReason: string): string {
  return `${formatContext("Previous session registry context", session)}
Recovery reason: ${recoveryReason}`;
}

function formatContext(title: string, session: SessionInspectView): string {
  return `${title}:
Topic: ${session.topic}
Summary: ${session.summary}
Decisions:
${formatList(session.decisions)}
Open questions:
${formatList(session.open_questions)}
Files discussed:
${formatList(session.files_discussed)}
Tags:
${formatList(session.tags)}
Aliases:
${formatList(session.aliases)}`;
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "- None";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

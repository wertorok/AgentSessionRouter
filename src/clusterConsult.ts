import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ClaudeAdapter, ClaudeJsonResponse } from "./claude.js";
import { ERROR_CODES } from "./constants.js";
import type { ClusterFactsheetRecord, ClusterFileHashRecord, ClusterRecord, RouterDatabase } from "./db.js";
import { errorPayload, type ErrorPayload, SPEC_ERROR_MESSAGES } from "./errors.js";
import { pickProfile, profilePromptOptions, type ClaudeToolProfile, type ProfileAvailability, type ProfileSelection } from "./profiles.js";

export interface ClusterConsultInput {
  projectId: string;
  clusterId: string;
  question: string;
  toolProfile?: ClaudeToolProfile | null;
  allowStaticFactsheet?: boolean;
}

export interface ClusterConsultSuccess {
  cluster_id: string;
  factsheet_id: string;
  factsheet_version: number;
  factsheet_status: string;
  tool_profile: ClaudeToolProfile;
  profile_selection: ProfileSelection;
  used_fork: false;
  claude_session_id: string;
  answer: string;
  metrics: {
    duration_ms: number;
    tokens_in?: number;
    tokens_out?: number;
  };
}

export type ClusterConsultResult = ClusterConsultSuccess | ErrorPayload;

interface LoadedClusterContext {
  cluster: ClusterRecord;
  factsheet: ClusterFactsheetRecord;
  fileHashes: ClusterFileHashRecord[];
  factsheetContent: Record<string, unknown>;
}

export async function consultCluster(
  db: RouterDatabase,
  cwd: string,
  claude: ClaudeAdapter,
  availability: ProfileAvailability,
  input: ClusterConsultInput
): Promise<ClusterConsultResult> {
  const loaded = loadClusterContext(db, input.projectId, input.clusterId);
  if ("error" in loaded) {
    return loaded;
  }

  if (loaded.factsheet.status !== "llm_verified" && !input.allowStaticFactsheet) {
    return errorPayload(ERROR_CODES.CLUSTER_FACTSHEET_UNTRUSTED, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_FACTSHEET_UNTRUSTED], {
      cluster_id: input.clusterId,
      reason: `Current factsheet status is ${loaded.factsheet.status}; run cluster_prepare with verification_mode=llm or pass allow_static_factsheet=true.`
    });
  }

  const staleFiles = findStaleFiles(cwd, loaded.fileHashes);
  if (staleFiles.length > 0) {
    db.markClusterFactsheetStale(loaded.factsheet.id);
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "cluster_refresh_required",
      details: {
        factsheet_id: loaded.factsheet.id,
        factsheet_version: loaded.factsheet.version,
        changed_files: staleFiles
      }
    });
    return errorPayload(ERROR_CODES.CLUSTER_FACTSHEET_STALE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_FACTSHEET_STALE], {
      cluster_id: input.clusterId,
      details: { changed_files: staleFiles }
    });
  }

  let profileSelection: ProfileSelection;
  try {
    profileSelection = pickProfile(input.toolProfile ?? loaded.cluster.tool_profile_default, availability);
  } catch (error: unknown) {
    return errorPayload(ERROR_CODES.CLAUDE_INVOCATION_FAILED, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INVOCATION_FAILED], {
      cluster_id: input.clusterId,
      reason: error instanceof Error ? error.message : String(error)
    });
  }

  const start = Date.now();
  try {
    const response = claude.runPromptWithOptions
      ? await claude.runPromptWithOptions(buildClusterQuestionPrompt(input.question), {
          ...profilePromptOptions(profileSelection.selected),
          appendSystemPrompt: buildClusterSystemPrompt(loaded)
        })
      : await claude.runPrompt(buildClusterFallbackPrompt(loaded, input.question));
    const durationMs = Date.now() - start;
    const result: ClusterConsultSuccess = {
      cluster_id: input.clusterId,
      factsheet_id: loaded.factsheet.id,
      factsheet_version: loaded.factsheet.version,
      factsheet_status: loaded.factsheet.status,
      tool_profile: profileSelection.selected,
      profile_selection: profileSelection,
      used_fork: false,
      claude_session_id: response.sessionId,
      answer: response.result,
      metrics: {
        duration_ms: durationMs,
        tokens_in: response.tokensIn,
        tokens_out: response.tokensOut
      }
    };
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "cluster_consult",
      details: {
        factsheet_id: loaded.factsheet.id,
        factsheet_version: loaded.factsheet.version,
        factsheet_status: loaded.factsheet.status,
        tool_profile: profileSelection.selected,
        requested_profile: profileSelection.requested,
        downgraded: profileSelection.downgraded,
        used_fork: false
      },
      durationMs,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut
    });
    if (profileSelection.downgraded) {
      db.logClusterEvent({
        clusterId: input.clusterId,
        projectId: input.projectId,
        eventType: "tool_profile_downgraded",
        details: profileSelection
      });
    }
    return result;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    db.logClusterEvent({
      clusterId: input.clusterId,
      projectId: input.projectId,
      eventType: "cluster_consult_failed",
      details: {
        reason,
        profile_selection: profileSelection
      },
      durationMs: Date.now() - start
    });
    return errorPayload(ERROR_CODES.CLAUDE_INVOCATION_FAILED, SPEC_ERROR_MESSAGES[ERROR_CODES.CLAUDE_INVOCATION_FAILED], {
      cluster_id: input.clusterId,
      reason
    });
  }
}

function loadClusterContext(db: RouterDatabase, projectId: string, clusterId: string): LoadedClusterContext | ErrorPayload {
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
  const factsheet = db.getCurrentClusterFactsheet(clusterId);
  if (!factsheet) {
    const latestFactsheet = db.getLatestClusterFactsheet(clusterId);
    if (latestFactsheet?.status === "stale") {
      return errorPayload(ERROR_CODES.CLUSTER_FACTSHEET_STALE, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_FACTSHEET_STALE], {
        cluster_id: clusterId,
        details: {
          factsheet_id: latestFactsheet.id,
          factsheet_version: latestFactsheet.version
        }
      });
    }
    return errorPayload(ERROR_CODES.CLUSTER_NOT_FOUND, SPEC_ERROR_MESSAGES[ERROR_CODES.CLUSTER_NOT_FOUND], {
      cluster_id: clusterId,
      reason: "Cluster has no current factsheet."
    });
  }
  return {
    cluster,
    factsheet,
    fileHashes: db.listClusterFileHashes(factsheet.id),
    factsheetContent: parseFactsheetContent(factsheet)
  };
}

function findStaleFiles(cwd: string, fileHashes: ClusterFileHashRecord[]): string[] {
  const stale: string[] = [];
  for (const file of fileHashes) {
    try {
      const absolutePath = path.resolve(cwd, file.path);
      const stat = statSync(absolutePath);
      const content = readFileSync(absolutePath);
      const hash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
      if (hash !== file.hash || stat.size !== file.file_size) {
        stale.push(file.path);
      }
    } catch {
      stale.push(file.path);
    }
  }
  return stale;
}

function buildClusterQuestionPrompt(question: string): string {
  return [
    "Answer the user's question using the verified cluster factsheet in the appended system prompt.",
    "If the factsheet does not contain the required fact, answer NOT IN CONTEXT.",
    "",
    "Question:",
    question
  ].join("\n");
}

function buildClusterSystemPrompt(context: LoadedClusterContext): string {
  return [
    "You are consulting through AgentSessionRouter cluster_consult.",
    "Use only the verified factsheet below and the user's question.",
    "Do not infer config keys, function names, files, or behavior that are not present in the factsheet.",
    "If a required fact is absent, write NOT IN CONTEXT.",
    "Do not use tools unless the selected profile explicitly provides them.",
    "",
    `Cluster id: ${context.cluster.id}`,
    `Factsheet id: ${context.factsheet.id}`,
    `Factsheet version: ${context.factsheet.version}`,
    `Factsheet status: ${context.factsheet.status}`,
    "",
    "Factsheet JSON:",
    JSON.stringify(context.factsheetContent, null, 2)
  ].join("\n");
}

function buildClusterFallbackPrompt(context: LoadedClusterContext, question: string): string {
  return [buildClusterSystemPrompt(context), "", buildClusterQuestionPrompt(question)].join("\n");
}

function parseFactsheetContent(factsheet: ClusterFactsheetRecord): Record<string, unknown> {
  try {
    const parsed = JSON.parse(factsheet.content_json) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { ArchitecturalMemorySeedManifest } from "./architecturalMemoryServing.js";
import type { Clock } from "./clock.js";
import { daysBetweenIso } from "./clock.js";
import { CONSULT_LIKE_EVENT_TYPES, type SessionStatus } from "./constants.js";
import type { EventType } from "./constants.js";
import { SCHEMA_SQL } from "./schema.js";

const CLUSTER_ATTENTION_EVENT_TYPES = [
  "cluster_consult_failed",
  "cluster_fallback_to_claude_consult",
  "cluster_fallback_failed",
  "cluster_refresh_required",
  "factsheet_stale",
  "factsheet_rejected",
  "evidence_revalidation_failed",
  "evidence_revalidation_suppressed",
  "cluster_fallback_coalesced",
  "bare_probe_failed",
  "tool_profile_downgraded"
] as const;

const CLUSTER_ATTENTION_EVENT_TYPES_SQL = CLUSTER_ATTENTION_EVENT_TYPES.map((eventType) => `'${eventType}'`).join(
  ",\n             "
);

export interface SessionRecord {
  id: string;
  project_id: string;
  claude_session_id: string;
  topic: string;
  summary: string | null;
  status: SessionStatus;
  ttl_days: number;
  dormant_after_days: number;
  archive_after_days: number;
  archived_at: string | null;
  last_used: string;
  created_at: string;
}

export interface SessionListItem {
  id: string;
  claude_session_id: string;
  topic: string;
  status: SessionStatus;
  last_used: string;
  summary: string;
  decisions: string[];
  open_questions: string[];
  files_discussed: string[];
  tags: string[];
  aliases: string[];
}

export interface SessionMatchCandidate extends SessionListItem {
  recency_score: number;
}

export interface SessionInspectView extends SessionListItem {
  project_id: string;
  created_at: string;
}

export interface RecentEventView {
  event_type: EventType;
  created_at: string;
  match_score: number | null;
  match_reason: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  error: string | null;
}

export interface SessionUpdateData {
  summary: string;
  decisions: string[];
  open_questions: string[];
  files_discussed: string[];
  tags: string[];
  aliases: string[];
}

export interface EventInsert {
  sessionId?: string | null;
  projectId: string;
  eventType: EventType;
  question?: string | null;
  answerSummary?: string | null;
  rawResponsePath?: string | null;
  matchScore?: number | null;
  matchReason?: string | null;
  wasNewSession?: boolean;
  wasOrphanRecovery?: boolean;
  tokensIn?: number | null;
  tokensOut?: number | null;
  durationMs?: number | null;
  error?: string | null;
}

export type ClusterStatus = "active" | "stale" | "needs_prepare" | "invalidated" | "archived";
export type ClusterTrustState =
  | "unprepared"
  | "static_verified"
  | "llm_verified"
  | "partial_static"
  | "partial_llm"
  | "untrusted";
export type ClusterToolProfile = "bare" | "focused" | "agent";
export type ClusterStaticFactsheetPolicy = "allow" | "deny";
export type ClusterFactsheetStatus = "draft" | "static_verified" | "llm_verified" | "rejected" | "stale";

export interface ClusterRecord {
  id: string;
  project_id: string;
  name: string;
  description: string;
  tool_profile_default: ClusterToolProfile;
  static_factsheet_policy: ClusterStaticFactsheetPolicy;
  baseline_session_id: string | null;
  status: ClusterStatus;
  trust_state: ClusterTrustState;
  created_at: string;
  last_used: string;
}

export interface ClusterFactsheetRecord {
  id: string;
  cluster_id: string;
  version: number;
  content_json: string;
  source_session_id: string | null;
  baseline_session_id: string | null;
  git_rev: string | null;
  generated_at: string;
  verified_at: string | null;
  status: ClusterFactsheetStatus;
}

export interface ClusterFileHashRecord {
  id: number;
  cluster_id: string;
  factsheet_id: string;
  path: string;
  hash: string;
  file_size: number;
  last_verified: string;
}

export interface ClusterEventInsert {
  clusterId: string;
  projectId: string;
  eventType: string;
  details?: unknown;
  durationMs?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd?: number | null;
}

export interface ClusterFactsheetInput {
  id: string;
  clusterId: string;
  contentJson: string;
  sourceSessionId?: string | null;
  baselineSessionId?: string | null;
  gitRev?: string | null;
  status: ClusterFactsheetStatus;
  trustState?: ClusterTrustState;
  fileHashes: Array<{
    path: string;
    hash: string;
    fileSize: number;
  }>;
}

export type ShadowStatus = "pending" | "ok" | "failed_auth" | "failed_timeout" | "failed_other";
export type ComparisonPreference = "cluster" | "direct" | "tie";

export interface ConsultComparisonRecord {
  id: string;
  project_id: string;
  cluster_id: string | null;
  question: string;
  cluster_answer: string | null;
  cluster_duration_ms: number | null;
  cluster_cost_usd: number | null;
  cluster_was_not_in_context: number;
  shadow_method: string;
  shadow_status: ShadowStatus;
  shadow_error: string | null;
  direct_answer: string | null;
  direct_duration_ms: number | null;
  direct_cost_usd: number | null;
  cluster_score: number | null;
  direct_score: number | null;
  preferred: ComparisonPreference | null;
  cluster_errors_json: string | null;
  direct_errors_json: string | null;
  judge_reasoning: string | null;
  judged_at: string | null;
  created_at: string;
}

export interface ConsultComparisonInsert {
  id: string;
  projectId: string;
  clusterId?: string | null;
  question: string;
  clusterAnswer?: string | null;
  clusterDurationMs?: number | null;
  clusterCostUsd?: number | null;
  clusterWasNotInContext?: boolean;
  shadowMethod?: string;
}

export interface ConsultComparisonStats {
  cluster_id: string | null;
  n: number;
  cluster_q: number | null;
  direct_q: number | null;
  gap: number | null;
  cluster_wins: number;
  direct_wins: number;
  ties: number;
}

export interface ConsultComparisonMonitorStats extends ConsultComparisonStats {
  total: number;
  judged: number;
  not_in_context: number;
  failed_shadow: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface EventCount {
  event_type: string;
  count: number;
  latest_created_at: string | null;
}

export interface SlowSessionEventCount extends EventCount {
  max_duration_ms: number | null;
}

export interface SlowSessionEventSample {
  event_id: number;
  session_id: string | null;
  topic: string | null;
  event_type: EventType;
  question: string | null;
  raw_response_path: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  created_at: string;
}

export interface SessionMetadataEventSample {
  event_id: number;
  session_id: string | null;
  topic: string | null;
  session_status: SessionStatus | null;
  event_type: EventType;
  question: string | null;
  raw_response_path: string | null;
  error: string | null;
  created_at: string;
}

export interface SessionMetadataAffectedSession {
  session_id: string | null;
  topic: string | null;
  session_status: SessionStatus | null;
  parse_failed_count: number;
  threshold_exceeded_count: number;
  latest_created_at: string | null;
  latest_error: string | null;
  latest_raw_response_path: string | null;
}

export interface RouteDecisionCount {
  selected_path: string | null;
  count: number;
  latest_created_at: string | null;
}

export interface RouteDecisionSample {
  event_id: number;
  selected_path: string | null;
  session_id: string | null;
  topic: string | null;
  question: string | null;
  match_score: number | null;
  match_reason: string | null;
  created_at: string;
}

export interface RouteDecisionScoreRow {
  selected_path: string | null;
  match_score: number | null;
  match_reason: string | null;
}

export interface ClusterEventCount extends EventCount {
  cluster_id: string;
}

export interface ClusterReprepareCoverageDrop {
  cluster_id: string;
  source_factsheet_id: string | null;
  source_factsheet_version: number | null;
  new_factsheet_id: string | null;
  new_factsheet_version: number | null;
  current_factsheet_version: number | null;
  current_fact_count: number | null;
  source_fact_count: number;
  verified_facts: number;
  rejected_facts: number;
  coverage_retained_percent: number;
  coverage_drop_percent: number;
  created_at: string;
}

export interface StaleClusterView {
  id: string;
  name: string;
  status: ClusterStatus;
  trust_state: ClusterTrustState;
  last_used: string;
  factsheet_id: string | null;
  factsheet_version: number | null;
  factsheet_status: ClusterFactsheetStatus | null;
  verified_at: string | null;
}

export interface ShadowEvalHealth {
  total: number;
  judged: number;
  pending: number;
  ok_unjudged: number;
  failed_auth: number;
  failed_timeout: number;
  failed_other: number;
  last_created_at: string | null;
  last_judged_at: string | null;
}

export interface ArchitecturalMemorySeedInsert {
  sessionId: string;
  projectId: string;
  manifest: ArchitecturalMemorySeedManifest;
  injectedTokenCount: number;
}

export interface ArchitecturalMemorySeedRecord {
  id: number;
  session_id: string;
  project_id: string;
  seed_kind: "engineering_principles";
  seed_signature: string;
  record_ids_json: string;
  record_hashes_json: string;
  selection_reason_json: string;
  source_docs_json: string;
  injected_token_count: number;
  selected_record_count: number;
  created_at: string;
}

export interface ArchitecturalMemorySeedView {
  id: number;
  session_id: string;
  project_id: string;
  topic: string | null;
  seed_kind: "engineering_principles";
  seed_signature: string;
  record_ids: string[];
  injected_token_count: number;
  selected_record_count: number;
  created_at: string;
}

export class RouterDatabase {
  constructor(
    readonly db: Database.Database,
    private readonly clock: Clock
  ) {}

  static open(dbPath: string, clock: Clock): RouterDatabase {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma("foreign_keys = ON");
    const routerDb = new RouterDatabase(db, clock);
    routerDb.initialize();
    return routerDb;
  }

  initialize(): void {
    this.db.exec(SCHEMA_SQL);
    this.ensureColumn("clusters", "static_factsheet_policy", "TEXT NOT NULL DEFAULT 'deny'");
    this.db
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(1, this.clock.nowIso());
  }

  logEvent(event: EventInsert): void {
    this.db
      .prepare(
        `INSERT INTO session_events (
          session_id,
          project_id,
          event_type,
          question,
          answer_summary,
          raw_response_path,
          match_score,
          match_reason,
          was_new_session,
          was_orphan_recovery,
          tokens_in,
          tokens_out,
          duration_ms,
          error,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.sessionId ?? null,
        event.projectId,
        event.eventType,
        event.question ?? null,
        event.answerSummary ?? null,
        event.rawResponsePath ?? null,
        event.matchScore ?? null,
        event.matchReason ?? null,
        event.wasNewSession ? 1 : 0,
        event.wasOrphanRecovery ? 1 : 0,
        event.tokensIn ?? null,
        event.tokensOut ?? null,
        event.durationMs ?? null,
        event.error ?? null,
        this.clock.nowIso()
      );
  }

  logClusterEvent(event: ClusterEventInsert): void {
    this.db
      .prepare(
        `INSERT INTO cluster_events (
          cluster_id,
          project_id,
          event_type,
          details_json,
          duration_ms,
          tokens_in,
          tokens_out,
          cost_usd,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.clusterId,
        event.projectId,
        event.eventType,
        event.details === undefined ? null : JSON.stringify(event.details),
        event.durationMs ?? null,
        event.tokensIn ?? null,
        event.tokensOut ?? null,
        event.costUsd ?? null,
        this.clock.nowIso()
      );
  }

  close(): void {
    this.db.close();
  }

  applyLifecycle(projectId?: string): void {
    const sessions = this.selectLifecycleSessions(projectId);
    for (const session of sessions) {
      const ageDays = daysBetweenIso(this.clock, session.last_used);
      if (ageDays >= session.archive_after_days && session.status !== "archived") {
        const archivedAt = this.clock.nowIso();
        this.db
          .prepare("UPDATE sessions SET status = 'archived', archived_at = ? WHERE id = ?")
          .run(archivedAt, session.id);
        this.logEvent({
          sessionId: session.id,
          projectId: session.project_id,
          eventType: "archive",
          error: "lifecycle_archive_after_days"
        });
      } else if (ageDays >= session.dormant_after_days && session.status === "active") {
        this.db.prepare("UPDATE sessions SET status = 'dormant' WHERE id = ?").run(session.id);
        this.logEvent({
          sessionId: session.id,
          projectId: session.project_id,
          eventType: "dormant",
          error: "lifecycle_dormant_after_days"
        });
      }
    }
  }

  listSessions(projectId: string, includeDormant: boolean, includeArchived: boolean, includeOrphaned: boolean): SessionListItem[] {
    const statuses: SessionStatus[] = ["active"];
    if (includeDormant) {
      statuses.push("dormant");
    }
    if (includeArchived) {
      statuses.push("archived");
    }
    if (includeOrphaned) {
      statuses.push("orphaned");
    }

    const placeholders = statuses.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT *
         FROM sessions
         WHERE project_id = ?
           AND status IN (${placeholders})
         ORDER BY last_used DESC`
      )
      .all(projectId, ...statuses) as SessionRecord[];

    return rows.map((row) => this.toSessionListItem(row));
  }

  listMatchCandidates(projectId: string, includeArchived: boolean): SessionMatchCandidate[] {
    const statuses: SessionStatus[] = ["active", "dormant"];
    if (includeArchived) {
      statuses.push("archived");
    }

    const placeholders = statuses.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT *
         FROM sessions
         WHERE project_id = ?
           AND status IN (${placeholders})
         ORDER BY last_used DESC`
      )
      .all(projectId, ...statuses) as SessionRecord[];

    return rows.map((row) => ({
      ...this.toSessionListItem(row),
      recency_score: Math.max(0, 1 - daysBetweenIso(this.clock, row.last_used) / row.archive_after_days)
    }));
  }

  getSession(sessionId: string): SessionRecord | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as SessionRecord | undefined;
    return row ?? null;
  }

  getSessionView(sessionId: string): SessionInspectView | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return {
      ...this.toSessionListItem(session),
      project_id: session.project_id,
      created_at: session.created_at
    };
  }

  inspectSession(sessionId: string, recentEventsLimit: number): { session: SessionInspectView; recentEvents: RecentEventView[] } | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const recentEvents = this.db
      .prepare(
        `SELECT event_type, created_at, match_score, match_reason, tokens_in, tokens_out, duration_ms, error
         FROM session_events
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(sessionId, recentEventsLimit) as RecentEventView[];

    return {
      session: {
        ...this.toSessionListItem(session),
        project_id: session.project_id,
        created_at: session.created_at
      },
      recentEvents
    };
  }

  createSession(input: {
    id: string;
    projectId: string;
    claudeSessionId: string;
    topic: string;
    summary?: string;
    dormantAfterDays: number;
    archiveAfterDays: number;
  }): void {
    const now = this.clock.nowIso();
    this.db
      .prepare(
        `INSERT INTO sessions (
          id,
          project_id,
          claude_session_id,
          topic,
          summary,
          status,
          ttl_days,
          dormant_after_days,
          archive_after_days,
          archived_at,
          last_used,
          created_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        input.id,
        input.projectId,
        input.claudeSessionId,
        input.topic,
        input.summary ?? "",
        input.dormantAfterDays,
        input.dormantAfterDays,
        input.archiveAfterDays,
        now,
        now
      );
  }

  insertArchitecturalMemorySeed(input: ArchitecturalMemorySeedInsert): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO session_architectural_memory_seeds (
          session_id,
          project_id,
          seed_kind,
          seed_signature,
          record_ids_json,
          record_hashes_json,
          selection_reason_json,
          source_docs_json,
          injected_token_count,
          selected_record_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.sessionId,
        input.projectId,
        input.manifest.seed_kind,
        input.manifest.seed_signature,
        JSON.stringify(input.manifest.record_ids),
        JSON.stringify(input.manifest.record_hashes),
        JSON.stringify(input.manifest.selection_reason),
        JSON.stringify(input.manifest.source_docs),
        input.injectedTokenCount,
        input.manifest.record_ids.length,
        this.clock.nowIso()
      );
  }

  getLatestArchitecturalMemorySeed(sessionId: string): ArchitecturalMemorySeedRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM session_architectural_memory_seeds
         WHERE session_id = ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(sessionId) as ArchitecturalMemorySeedRecord | undefined;
    return row ?? null;
  }

  listArchitecturalMemorySeeds(projectId: string, limit: number): ArchitecturalMemorySeedView[] {
    const rows = this.db
      .prepare(
        `SELECT seeds.*, sessions.topic AS topic
         FROM session_architectural_memory_seeds seeds
         LEFT JOIN sessions ON sessions.id = seeds.session_id
         WHERE seeds.project_id = ?
         ORDER BY seeds.id DESC
         LIMIT ?`
      )
      .all(projectId, limit) as Array<ArchitecturalMemorySeedRecord & { topic: string | null }>;

    return rows.map((row) => ({
      id: row.id,
      session_id: row.session_id,
      project_id: row.project_id,
      topic: row.topic,
      seed_kind: row.seed_kind,
      seed_signature: row.seed_signature,
      record_ids: parseJsonArray(row.record_ids_json),
      injected_token_count: row.injected_token_count,
      selected_record_count: row.selected_record_count,
      created_at: row.created_at
    }));
  }

  countArchitecturalMemorySeeds(projectId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM session_architectural_memory_seeds
         WHERE project_id = ?`
      )
      .get(projectId) as { count: number };
    return row.count;
  }

  updateSessionLastUsed(sessionId: string): void {
    this.db.prepare("UPDATE sessions SET last_used = ?, status = 'active' WHERE id = ?").run(this.clock.nowIso(), sessionId);
  }

  markSessionOrphaned(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      return;
    }
    this.db.prepare("UPDATE sessions SET status = 'orphaned' WHERE id = ?").run(sessionId);
    this.logEvent({
      sessionId,
      projectId: session.project_id,
      eventType: "orphan_recovery",
      error: "claude_session_missing"
    });
  }

  archiveSession(sessionId: string, reason: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      return;
    }
    this.db
      .prepare("UPDATE sessions SET status = 'archived', archived_at = ? WHERE id = ?")
      .run(this.clock.nowIso(), sessionId);
    this.logEvent({
      sessionId,
      projectId: session.project_id,
      eventType: "archive",
      error: reason
    });
  }

  applySessionUpdate(sessionId: string, update: SessionUpdateData): void {
    const apply = this.db.transaction(() => {
      this.db.prepare("UPDATE sessions SET summary = ? WHERE id = ?").run(update.summary, sessionId);
      this.db.prepare("DELETE FROM session_open_questions WHERE session_id = ?").run(sessionId);

      for (const decision of update.decisions) {
        this.insertUniqueValue("session_decisions", "decision", sessionId, decision);
      }
      for (const question of update.open_questions) {
        this.insertValue("session_open_questions", "question", sessionId, question);
      }
      for (const file of update.files_discussed) {
        this.insertUniqueValue("session_files", "path", sessionId, file);
      }
      for (const tag of update.tags) {
        this.insertUniqueValue("session_tags", "tag", sessionId, tag);
      }
      for (const alias of update.aliases) {
        this.insertUniqueValue("session_aliases", "alias", sessionId, alias);
      }
    });
    apply();
  }

  applySessionRoutingHints(sessionId: string, input: { filesDiscussed?: string[]; tags?: string[] }): void {
    const apply = this.db.transaction(() => {
      for (const file of input.filesDiscussed ?? []) {
        this.insertUniqueValue("session_files", "path", sessionId, file);
      }
      for (const tag of input.tags ?? []) {
        this.insertUniqueValue("session_tags", "tag", sessionId, tag);
      }
    });
    apply();
  }

  countConsultLikeEvents(projectId: string, sinceIso: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM session_events
         WHERE project_id = ?
           AND event_type IN (?, ?)
           AND created_at >= ?`
      )
      .get(projectId, CONSULT_LIKE_EVENT_TYPES[0], CONSULT_LIKE_EVENT_TYPES[1], sinceIso) as { count: number };
    return row.count;
  }

  countDistinctResumeFailuresSince(sinceIso: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(DISTINCT session_id) AS count
         FROM session_events
         WHERE event_type = 'resume_failed'
           AND session_id IS NOT NULL
           AND created_at >= ?`
      )
      .get(sinceIso) as { count: number };
    return row.count;
  }

  oldestRecentConsultLikeEventIso(sessionId: string, limit: number): string | null {
    const rows = this.db
      .prepare(
        `SELECT created_at
         FROM session_events
         WHERE session_id = ?
           AND event_type IN (?, ?)
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(sessionId, CONSULT_LIKE_EVENT_TYPES[0], CONSULT_LIKE_EVENT_TYPES[1], limit) as Array<{ created_at: string }>;

    if (rows.length < limit) {
      return null;
    }

    return rows[rows.length - 1]?.created_at ?? null;
  }

  countParseFailuresSince(sessionId: string, sinceIso: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM session_events
         WHERE session_id = ?
           AND event_type = 'parse_failed'
           AND created_at >= ?`
      )
      .get(sessionId, sinceIso) as { count: number };
    return row.count;
  }

  getLastArchiveReason(sessionId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT error
         FROM session_events
         WHERE session_id = ?
           AND event_type = 'archive'
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(sessionId) as { error: string | null } | undefined;
    return row?.error ?? null;
  }

  upsertCluster(input: {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    toolProfileDefault: ClusterToolProfile;
    staticFactsheetPolicy?: ClusterStaticFactsheetPolicy;
  }): ClusterRecord {
    const existing = this.getClusterById(input.id);
    if (existing && existing.project_id !== input.projectId) {
      throw new Error(`cluster_id ${input.id} belongs to project ${existing.project_id}`);
    }

    const now = this.clock.nowIso();
    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO clusters (
            id,
            project_id,
            name,
            description,
            tool_profile_default,
            static_factsheet_policy,
            baseline_session_id,
            status,
            trust_state,
            created_at,
            last_used
          ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'active', 'unprepared', ?, ?)`
        )
        .run(
          input.id,
          input.projectId,
          input.name,
          input.description ?? "",
          input.toolProfileDefault,
          input.staticFactsheetPolicy ?? "deny",
          now,
          now
        );
      this.logClusterEvent({
        clusterId: input.id,
        projectId: input.projectId,
        eventType: "cluster_created"
      });
    } else {
      this.db
        .prepare(
          `UPDATE clusters
           SET name = ?,
               description = ?,
               tool_profile_default = ?,
               static_factsheet_policy = ?,
               status = 'active',
               last_used = ?
           WHERE id = ?`
        )
        .run(
          input.name,
          input.description ?? existing.description,
          input.toolProfileDefault,
          input.staticFactsheetPolicy ?? existing.static_factsheet_policy,
          now,
          input.id
        );
    }

    return this.getCluster(input.projectId, input.id)!;
  }

  getCluster(projectId: string, clusterId: string): ClusterRecord | null {
    const row = this.db.prepare("SELECT * FROM clusters WHERE project_id = ? AND id = ?").get(projectId, clusterId) as
      | ClusterRecord
      | undefined;
    return row ?? null;
  }

  getClusterById(clusterId: string): ClusterRecord | null {
    const row = this.db.prepare("SELECT * FROM clusters WHERE id = ?").get(clusterId) as ClusterRecord | undefined;
    return row ?? null;
  }

  listClusters(projectId: string, includeArchived: boolean): ClusterRecord[] {
    if (includeArchived) {
      return this.db
        .prepare("SELECT * FROM clusters WHERE project_id = ? ORDER BY last_used DESC")
        .all(projectId) as ClusterRecord[];
    }
    return this.db
      .prepare("SELECT * FROM clusters WHERE project_id = ? AND status != 'archived' ORDER BY last_used DESC")
      .all(projectId) as ClusterRecord[];
  }

  archiveCluster(projectId: string, clusterId: string, reason?: string | null): boolean {
    const cluster = this.getCluster(projectId, clusterId);
    if (!cluster) {
      return false;
    }
    this.db
      .prepare("UPDATE clusters SET status = 'archived', last_used = ? WHERE project_id = ? AND id = ?")
      .run(this.clock.nowIso(), projectId, clusterId);
    this.logClusterEvent({
      clusterId,
      projectId,
      eventType: "cluster_archived",
      details: {
        reason: reason ?? null
      }
    });
    return true;
  }

  insertClusterFactsheet(input: ClusterFactsheetInput): ClusterFactsheetRecord {
    const insert = this.db.transaction(() => {
      const versionRow = this.db
        .prepare("SELECT MAX(version) AS maxVersion FROM cluster_factsheets WHERE cluster_id = ?")
        .get(input.clusterId) as { maxVersion: number | null };
      const version = (versionRow.maxVersion ?? 0) + 1;
      const now = this.clock.nowIso();

      this.db
        .prepare(
          `INSERT INTO cluster_factsheets (
            id,
            cluster_id,
            version,
            content_json,
            source_session_id,
            baseline_session_id,
            git_rev,
            generated_at,
            verified_at,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.id,
          input.clusterId,
          version,
          input.contentJson,
          input.sourceSessionId ?? null,
          input.baselineSessionId ?? null,
          input.gitRev ?? null,
          now,
          isVerifiedFactsheetStatus(input.status) ? now : null,
          input.status
        );

      for (const file of input.fileHashes) {
        this.db
          .prepare(
            `INSERT INTO cluster_file_hashes (
              cluster_id,
              factsheet_id,
              path,
              hash,
              file_size,
              last_verified
            ) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(input.clusterId, input.id, file.path, file.hash, file.fileSize, now);
      }

      const trustState: ClusterTrustState =
        input.trustState ??
        (input.status === "llm_verified"
          ? "llm_verified"
          : input.status === "static_verified"
            ? "static_verified"
            : "untrusted");
      this.db
        .prepare("UPDATE clusters SET status = 'active', trust_state = ?, last_used = ? WHERE id = ?")
        .run(trustState, now, input.clusterId);

      return this.getClusterFactsheet(input.id)!;
    });

    const factsheet = insert();
    this.logClusterEvent({
      clusterId: input.clusterId,
      projectId: this.getClusterById(input.clusterId)?.project_id ?? "",
      eventType: factsheetEventType(input.status, input.trustState),
      details: {
        factsheet_id: input.id,
        version: factsheet.version,
        file_hashes: input.fileHashes.length
      }
    });
    return factsheet;
  }

  getClusterFactsheet(factsheetId: string): ClusterFactsheetRecord | null {
    const row = this.db.prepare("SELECT * FROM cluster_factsheets WHERE id = ?").get(factsheetId) as
      | ClusterFactsheetRecord
      | undefined;
    return row ?? null;
  }

  getCurrentClusterFactsheet(clusterId: string): ClusterFactsheetRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM cluster_factsheets
         WHERE cluster_id = ?
           AND status IN ('static_verified', 'llm_verified')
         ORDER BY version DESC
         LIMIT 1`
      )
      .get(clusterId) as ClusterFactsheetRecord | undefined;
    return row ?? null;
  }

  getLatestClusterFactsheet(clusterId: string): ClusterFactsheetRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM cluster_factsheets
         WHERE cluster_id = ?
         ORDER BY version DESC
         LIMIT 1`
      )
      .get(clusterId) as ClusterFactsheetRecord | undefined;
    return row ?? null;
  }

  listClusterFileHashes(factsheetId: string): ClusterFileHashRecord[] {
    return this.db
      .prepare("SELECT * FROM cluster_file_hashes WHERE factsheet_id = ? ORDER BY path ASC")
      .all(factsheetId) as ClusterFileHashRecord[];
  }

  markClusterFactsheetStale(factsheetId: string): void {
    const factsheet = this.getClusterFactsheet(factsheetId);
    if (!factsheet) {
      return;
    }
    const now = this.clock.nowIso();
    this.db
      .prepare("UPDATE cluster_factsheets SET status = 'stale' WHERE id = ?")
      .run(factsheetId);
    this.db
      .prepare("UPDATE clusters SET status = 'stale', trust_state = 'untrusted', last_used = ? WHERE id = ?")
      .run(now, factsheet.cluster_id);
  }

  markClusterNeedsPrepare(clusterId: string): void {
    const cluster = this.getClusterById(clusterId);
    if (!cluster) {
      return;
    }
    this.db
      .prepare("UPDATE clusters SET status = 'needs_prepare', trust_state = 'untrusted', last_used = ? WHERE id = ?")
      .run(this.clock.nowIso(), clusterId);
  }

  markClusterFactsheetFresh(factsheetId: string, status: "static_verified" | "llm_verified", trustState: ClusterTrustState): void {
    const factsheet = this.getClusterFactsheet(factsheetId);
    if (!factsheet) {
      return;
    }
    const now = this.clock.nowIso();
    this.db
      .prepare("UPDATE cluster_factsheets SET status = ?, verified_at = ? WHERE id = ?")
      .run(status, now, factsheetId);
    this.db
      .prepare("UPDATE cluster_file_hashes SET last_verified = ? WHERE factsheet_id = ?")
      .run(now, factsheetId);
    this.db
      .prepare("UPDATE clusters SET status = 'active', trust_state = ?, last_used = ? WHERE id = ?")
      .run(trustState, now, factsheet.cluster_id);
  }

  insertConsultComparison(input: ConsultComparisonInsert): ConsultComparisonRecord {
    this.db
      .prepare(
        `INSERT INTO consult_comparisons (
          id,
          project_id,
          cluster_id,
          question,
          cluster_answer,
          cluster_duration_ms,
          cluster_cost_usd,
          cluster_was_not_in_context,
          shadow_method,
          shadow_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(
        input.id,
        input.projectId,
        input.clusterId ?? null,
        input.question,
        input.clusterAnswer ?? null,
        input.clusterDurationMs ?? null,
        input.clusterCostUsd ?? null,
        input.clusterWasNotInContext ? 1 : 0,
        input.shadowMethod ?? "direct_fresh",
        this.clock.nowIso()
      );
    return this.getConsultComparison(input.id)!;
  }

  updateConsultComparisonDirect(input: {
    id: string;
    status: ShadowStatus;
    directAnswer?: string | null;
    directDurationMs?: number | null;
    directCostUsd?: number | null;
    shadowError?: string | null;
  }): void {
    this.db
      .prepare(
        `UPDATE consult_comparisons
         SET shadow_status = ?,
             shadow_error = ?,
             direct_answer = ?,
             direct_duration_ms = ?,
             direct_cost_usd = ?
         WHERE id = ?`
      )
      .run(
        input.status,
        input.shadowError ?? null,
        input.directAnswer ?? null,
        input.directDurationMs ?? null,
        input.directCostUsd ?? null,
        input.id
      );
  }

  updateConsultComparisonJudge(input: {
    id: string;
    clusterScore: number;
    directScore: number;
    preferred: ComparisonPreference;
    clusterErrors: string[];
    directErrors: string[];
    judgeReasoning: string;
  }): void {
    this.db
      .prepare(
        `UPDATE consult_comparisons
         SET cluster_score = ?,
             direct_score = ?,
             preferred = ?,
             cluster_errors_json = ?,
             direct_errors_json = ?,
             judge_reasoning = ?,
             judged_at = ?
         WHERE id = ?`
      )
      .run(
        input.clusterScore,
        input.directScore,
        input.preferred,
        JSON.stringify(input.clusterErrors),
        JSON.stringify(input.directErrors),
        input.judgeReasoning,
        this.clock.nowIso(),
        input.id
      );
  }

  getConsultComparison(id: string): ConsultComparisonRecord | null {
    const row = this.db.prepare("SELECT * FROM consult_comparisons WHERE id = ?").get(id) as
      | ConsultComparisonRecord
      | undefined;
    return row ?? null;
  }

  listConsultComparisons(input: {
    projectId: string;
    clusterId?: string | null;
    preferred?: ComparisonPreference | null;
    limit: number;
  }): ConsultComparisonRecord[] {
    const conditions = ["project_id = ?"];
    const params: Array<string | number | null> = [input.projectId];
    if (input.clusterId) {
      conditions.push("cluster_id = ?");
      params.push(input.clusterId);
    }
    if (input.preferred) {
      conditions.push("preferred = ?");
      params.push(input.preferred);
    }
    params.push(input.limit);
    return this.db
      .prepare(
        `SELECT *
         FROM consult_comparisons
         WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(...params) as ConsultComparisonRecord[];
  }

  listUnjudgedConsultComparisons(input: {
    projectId: string;
    clusterId?: string | null;
    limit: number;
  }): ConsultComparisonRecord[] {
    const conditions = ["project_id = ?", "judged_at IS NULL", "shadow_status IN ('pending', 'ok')"];
    const params: Array<string | number | null> = [input.projectId];
    if (input.clusterId) {
      conditions.push("cluster_id = ?");
      params.push(input.clusterId);
    }
    params.push(input.limit);
    return this.db
      .prepare(
        `SELECT *
         FROM consult_comparisons
         WHERE ${conditions.join(" AND ")}
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all(...params) as ConsultComparisonRecord[];
  }

  listJudgedConsultComparisons(input: {
    projectId: string;
    clusterId?: string | null;
    preferred?: ComparisonPreference | null;
    judgeReasoningContains?: string | null;
    limit: number;
  }): ConsultComparisonRecord[] {
    const conditions = ["project_id = ?", "judged_at IS NOT NULL"];
    const params: Array<string | number | null> = [input.projectId];
    if (input.clusterId) {
      conditions.push("cluster_id = ?");
      params.push(input.clusterId);
    }
    if (input.preferred) {
      conditions.push("preferred = ?");
      params.push(input.preferred);
    }
    if (input.judgeReasoningContains) {
      conditions.push("judge_reasoning LIKE ?");
      params.push(`%${input.judgeReasoningContains}%`);
    }
    params.push(input.limit);
    return this.db
      .prepare(
        `SELECT *
         FROM consult_comparisons
         WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(...params) as ConsultComparisonRecord[];
  }

  getConsultComparisonStats(projectId: string, clusterId?: string | null): ConsultComparisonStats[] {
    const conditions = ["project_id = ?", "judged_at IS NOT NULL"];
    const params: Array<string | number | null> = [projectId];
    if (clusterId) {
      conditions.push("cluster_id = ?");
      params.push(clusterId);
    }
    return this.db
      .prepare(
        `SELECT
           cluster_id,
           COUNT(*) AS n,
           ROUND(AVG(cluster_score), 2) AS cluster_q,
           ROUND(AVG(direct_score), 2) AS direct_q,
           ROUND(AVG(direct_score - cluster_score), 2) AS gap,
           SUM(CASE WHEN preferred = 'cluster' THEN 1 ELSE 0 END) AS cluster_wins,
           SUM(CASE WHEN preferred = 'direct' THEN 1 ELSE 0 END) AS direct_wins,
           SUM(CASE WHEN preferred = 'tie' THEN 1 ELSE 0 END) AS ties
         FROM consult_comparisons
         WHERE ${conditions.join(" AND ")}
         GROUP BY cluster_id
         ORDER BY n DESC, cluster_id ASC`
      )
      .all(...params) as ConsultComparisonStats[];
  }

  getConsultComparisonMonitorStats(projectId: string, sinceIso: string): ConsultComparisonMonitorStats[] {
    return this.db
      .prepare(
        `SELECT
           cluster_id,
           COUNT(*) AS total,
           SUM(CASE WHEN judged_at IS NOT NULL THEN 1 ELSE 0 END) AS judged,
           SUM(
             CASE
               WHEN cluster_was_not_in_context = 1
                AND (judged_at IS NULL OR cluster_score <= 1)
               THEN 1
               ELSE 0
             END
           ) AS not_in_context,
           SUM(CASE WHEN shadow_status IN ('failed_auth', 'failed_timeout', 'failed_other') THEN 1 ELSE 0 END) AS failed_shadow,
           SUM(CASE WHEN judged_at IS NOT NULL THEN 1 ELSE 0 END) AS n,
           ROUND(AVG(CASE WHEN judged_at IS NOT NULL THEN cluster_score END), 2) AS cluster_q,
           ROUND(AVG(CASE WHEN judged_at IS NOT NULL THEN direct_score END), 2) AS direct_q,
           ROUND(AVG(CASE WHEN judged_at IS NOT NULL THEN direct_score - cluster_score END), 2) AS gap,
           SUM(CASE WHEN preferred = 'cluster' THEN 1 ELSE 0 END) AS cluster_wins,
           SUM(CASE WHEN preferred = 'direct' THEN 1 ELSE 0 END) AS direct_wins,
           SUM(CASE WHEN preferred = 'tie' THEN 1 ELSE 0 END) AS ties
         FROM consult_comparisons
         WHERE project_id = ?
           AND created_at >= ?
         GROUP BY cluster_id
         ORDER BY total DESC, cluster_id ASC`
      )
      .all(projectId, sinceIso) as ConsultComparisonMonitorStats[];
  }

  getSessionStatusCounts(projectId: string): StatusCount[] {
    return this.db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM sessions
         WHERE project_id = ?
         GROUP BY status
         ORDER BY status ASC`
      )
      .all(projectId) as StatusCount[];
  }

  getClusterStatusCounts(projectId: string): StatusCount[] {
    return this.db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM clusters
         WHERE project_id = ?
         GROUP BY status
         ORDER BY status ASC`
      )
      .all(projectId) as StatusCount[];
  }

  getRecentSessionErrorCounts(projectId: string, sinceIso: string): EventCount[] {
    return this.db
      .prepare(
        `SELECT event_type, COUNT(*) AS count, MAX(created_at) AS latest_created_at
         FROM session_events
         WHERE project_id = ?
           AND created_at >= ?
           AND error IS NOT NULL
         GROUP BY event_type
         ORDER BY count DESC, event_type ASC`
      )
      .all(projectId, sinceIso) as EventCount[];
  }

  getRecentSlowSessionEvents(projectId: string, sinceIso: string, thresholdMs: number): SlowSessionEventCount[] {
    return this.db
      .prepare(
        `SELECT event_type,
                COUNT(*) AS count,
                MAX(duration_ms) AS max_duration_ms,
                MAX(created_at) AS latest_created_at
         FROM session_events
         WHERE project_id = ?
           AND created_at >= ?
           AND duration_ms >= ?
         GROUP BY event_type
         ORDER BY count DESC, event_type ASC`
      )
      .all(projectId, sinceIso, thresholdMs) as SlowSessionEventCount[];
  }

  listRecentSlowSessionEventSamples(
    projectId: string,
    sinceIso: string,
    thresholdMs: number,
    limit: number
  ): SlowSessionEventSample[] {
    return this.db
      .prepare(
        `SELECT e.id AS event_id,
                e.session_id,
                s.topic,
                e.event_type,
                e.question,
                e.raw_response_path,
                e.tokens_in,
                e.tokens_out,
                e.duration_ms,
                e.created_at
         FROM session_events e
         LEFT JOIN sessions s
           ON s.id = e.session_id
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.duration_ms >= ?
         ORDER BY e.duration_ms DESC
         LIMIT ?`
      )
      .all(projectId, sinceIso, thresholdMs, limit) as SlowSessionEventSample[];
  }

  getRecentSessionMetadataEventCounts(projectId: string, sinceIso: string): EventCount[] {
    return this.db
      .prepare(
        `SELECT event_type, COUNT(*) AS count, MAX(created_at) AS latest_created_at
         FROM session_events
         WHERE project_id = ?
           AND created_at >= ?
           AND event_type IN ('parse_failed', 'parse_failed_threshold_exceeded')
         GROUP BY event_type
         ORDER BY count DESC, event_type ASC`
      )
      .all(projectId, sinceIso) as EventCount[];
  }

  listRecentSessionMetadataAffectedSessions(
    projectId: string,
    sinceIso: string,
    limit: number
  ): SessionMetadataAffectedSession[] {
    return this.db
      .prepare(
        `SELECT
           e.session_id,
           s.topic,
           s.status AS session_status,
           SUM(CASE WHEN e.event_type = 'parse_failed' THEN 1 ELSE 0 END) AS parse_failed_count,
           SUM(CASE WHEN e.event_type = 'parse_failed_threshold_exceeded' THEN 1 ELSE 0 END) AS threshold_exceeded_count,
           MAX(e.created_at) AS latest_created_at,
           (
             SELECT e2.error
             FROM session_events e2
             WHERE e2.session_id = e.session_id
               AND e2.project_id = e.project_id
               AND e2.event_type IN ('parse_failed', 'parse_failed_threshold_exceeded')
               AND e2.created_at >= ?
             ORDER BY e2.id DESC
             LIMIT 1
           ) AS latest_error,
           (
             SELECT e3.raw_response_path
             FROM session_events e3
             WHERE e3.session_id = e.session_id
               AND e3.project_id = e.project_id
               AND e3.event_type = 'parse_failed'
               AND e3.raw_response_path IS NOT NULL
               AND e3.created_at >= ?
             ORDER BY e3.id DESC
             LIMIT 1
           ) AS latest_raw_response_path
         FROM session_events e
         LEFT JOIN sessions s
           ON s.id = e.session_id
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.event_type IN ('parse_failed', 'parse_failed_threshold_exceeded')
         GROUP BY e.session_id
         ORDER BY threshold_exceeded_count DESC, parse_failed_count DESC, latest_created_at DESC
         LIMIT ?`
      )
      .all(sinceIso, sinceIso, projectId, sinceIso, limit) as SessionMetadataAffectedSession[];
  }

  listRecentSessionMetadataEventSamples(
    projectId: string,
    sinceIso: string,
    limit: number
  ): SessionMetadataEventSample[] {
    return this.db
      .prepare(
        `SELECT e.id AS event_id,
                e.session_id,
                s.topic,
                s.status AS session_status,
                e.event_type,
                e.question,
                e.raw_response_path,
                e.error,
                e.created_at
         FROM session_events e
         LEFT JOIN sessions s
           ON s.id = e.session_id
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.event_type IN ('parse_failed', 'parse_failed_threshold_exceeded')
         ORDER BY e.id DESC
         LIMIT ?`
      )
      .all(projectId, sinceIso, limit) as SessionMetadataEventSample[];
  }

  getRecentRouteDecisionCounts(projectId: string, sinceIso: string): RouteDecisionCount[] {
    return this.db
      .prepare(
        `SELECT answer_summary AS selected_path,
                COUNT(*) AS count,
                MAX(created_at) AS latest_created_at
         FROM session_events
         WHERE project_id = ?
           AND created_at >= ?
           AND event_type = 'router_route_decision'
         GROUP BY answer_summary
         ORDER BY count DESC, selected_path ASC`
      )
      .all(projectId, sinceIso) as RouteDecisionCount[];
  }

  getForcedNewDueToAmbiguityCount(projectId: string, sinceIso: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM session_events
         WHERE project_id = ?
           AND created_at >= ?
           AND event_type = 'router_route_decision'
           AND answer_summary = 'claude_consult_new_session'
           AND match_reason LIKE '%Ambiguous low-confidence session candidates%'`
      )
      .get(projectId, sinceIso) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  listRecentRouteDecisionScores(projectId: string, sinceIso: string): RouteDecisionScoreRow[] {
    return this.db
      .prepare(
        `SELECT answer_summary AS selected_path,
                match_score,
                match_reason
         FROM session_events
         WHERE project_id = ?
           AND created_at >= ?
           AND event_type = 'router_route_decision'
         ORDER BY id DESC`
      )
      .all(projectId, sinceIso) as RouteDecisionScoreRow[];
  }

  listRecentRouteDecisionSamples(projectId: string, sinceIso: string, limit: number): RouteDecisionSample[] {
    return this.db
      .prepare(
        `SELECT e.id AS event_id,
                e.answer_summary AS selected_path,
                e.session_id,
                s.topic,
                e.question,
                e.match_score,
                e.match_reason,
                e.created_at
         FROM session_events e
         LEFT JOIN sessions s
           ON s.id = e.session_id
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.event_type = 'router_route_decision'
         ORDER BY e.id DESC
         LIMIT ?`
      )
      .all(projectId, sinceIso, limit) as RouteDecisionSample[];
  }

  getRecentClusterAttentionCounts(projectId: string, sinceIso: string): EventCount[] {
    return this.db
      .prepare(
        `SELECT e.event_type, COUNT(*) AS count, MAX(e.created_at) AS latest_created_at
         FROM cluster_events e
         INNER JOIN clusters c
           ON c.project_id = e.project_id
          AND c.id = e.cluster_id
          AND c.status != 'archived'
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.event_type IN (
             ${CLUSTER_ATTENTION_EVENT_TYPES_SQL}
           )
         GROUP BY e.event_type
         ORDER BY count DESC, e.event_type ASC`
      )
      .all(projectId, sinceIso) as EventCount[];
  }

  getRecentClusterAttentionCountsByCluster(projectId: string, sinceIso: string): ClusterEventCount[] {
    return this.db
      .prepare(
        `SELECT e.cluster_id, e.event_type, COUNT(*) AS count, MAX(e.created_at) AS latest_created_at
         FROM cluster_events e
         INNER JOIN clusters c
           ON c.project_id = e.project_id
          AND c.id = e.cluster_id
          AND c.status != 'archived'
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.event_type IN (
             ${CLUSTER_ATTENTION_EVENT_TYPES_SQL}
           )
         GROUP BY e.cluster_id, e.event_type
         ORDER BY count DESC, e.cluster_id ASC, e.event_type ASC`
      )
      .all(projectId, sinceIso) as ClusterEventCount[];
  }

  getClusterFallbackCount(projectId: string, sinceIso: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM cluster_events e
         INNER JOIN clusters c
           ON c.project_id = e.project_id
          AND c.id = e.cluster_id
          AND c.status != 'archived'
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.event_type = 'cluster_fallback_to_claude_consult'`
      )
      .get(projectId, sinceIso) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  listRecentClusterReprepareCoverageDrops(
    projectId: string,
    sinceIso: string,
    limit: number
  ): ClusterReprepareCoverageDrop[] {
    const rows = this.db
      .prepare(
        `SELECT e.cluster_id,
                e.details_json,
                e.created_at
         FROM cluster_events e
         INNER JOIN clusters c
           ON c.project_id = e.project_id
          AND c.id = e.cluster_id
          AND c.status != 'archived'
         WHERE e.project_id = ?
           AND e.created_at >= ?
           AND e.event_type = 'cluster_reprepare'
         ORDER BY e.id DESC
         LIMIT ?`
      )
      .all(projectId, sinceIso, Math.max(limit * 4, limit)) as Array<{
        cluster_id: string;
        details_json: string | null;
        created_at: string;
      }>;

    const drops: ClusterReprepareCoverageDrop[] = [];
    for (const row of rows) {
      const details = parseJsonObject(row.details_json);
      const sourceFactCount = numberFromUnknown(details.source_fact_count);
      const verifiedFacts = numberFromUnknown(details.verified_facts);
      const rejectedFacts = numberFromUnknown(details.rejected_facts);
      const coverageDropPercent = numberFromUnknown(details.coverage_drop_percent);
      if (rejectedFacts <= 0 && coverageDropPercent <= 0) {
        continue;
      }
      const newFactsheetVersion = nullableNumberFromUnknown(details.new_factsheet_version);
      const currentFactsheet = this.getCurrentClusterFactsheet(row.cluster_id);
      const currentFactCount = currentFactsheet ? factCountFromContentJson(currentFactsheet.content_json) : null;
      const isResolved =
        currentFactsheet !== null &&
        newFactsheetVersion !== null &&
        currentFactsheet.version > newFactsheetVersion &&
        currentFactCount !== null &&
        currentFactCount >= sourceFactCount;
      if (isResolved) {
        continue;
      }
      drops.push({
        cluster_id: row.cluster_id,
        source_factsheet_id: stringOrNull(details.source_factsheet_id),
        source_factsheet_version: nullableNumberFromUnknown(details.source_factsheet_version),
        new_factsheet_id: stringOrNull(details.new_factsheet_id),
        new_factsheet_version: newFactsheetVersion,
        current_factsheet_version: currentFactsheet?.version ?? null,
        current_fact_count: currentFactCount,
        source_fact_count: sourceFactCount,
        verified_facts: verifiedFacts,
        rejected_facts: rejectedFacts,
        coverage_retained_percent: numberFromUnknown(details.coverage_retained_percent),
        coverage_drop_percent: coverageDropPercent,
        created_at: row.created_at
      });
      if (drops.length >= limit) {
        break;
      }
    }
    return drops;
  }

  listStaleClusters(projectId: string, limit: number): StaleClusterView[] {
    return this.db
      .prepare(
        `SELECT
           c.id,
           c.name,
           c.status,
           c.trust_state,
           c.last_used,
           f.id AS factsheet_id,
           f.version AS factsheet_version,
           f.status AS factsheet_status,
           f.verified_at
         FROM clusters c
         LEFT JOIN cluster_factsheets f
           ON f.id = (
             SELECT id
             FROM cluster_factsheets
             WHERE cluster_id = c.id
             ORDER BY version DESC
             LIMIT 1
           )
         WHERE c.project_id = ?
           AND c.status IN ('stale', 'needs_prepare')
         ORDER BY c.last_used DESC
         LIMIT ?`
      )
      .all(projectId, limit) as StaleClusterView[];
  }

  getShadowEvalHealth(projectId: string): ShadowEvalHealth {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN judged_at IS NOT NULL THEN 1 ELSE 0 END) AS judged,
           SUM(CASE WHEN shadow_status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN shadow_status = 'ok' AND judged_at IS NULL THEN 1 ELSE 0 END) AS ok_unjudged,
           SUM(CASE WHEN shadow_status = 'failed_auth' THEN 1 ELSE 0 END) AS failed_auth,
           SUM(CASE WHEN shadow_status = 'failed_timeout' THEN 1 ELSE 0 END) AS failed_timeout,
           SUM(CASE WHEN shadow_status = 'failed_other' THEN 1 ELSE 0 END) AS failed_other,
           MAX(created_at) AS last_created_at,
           MAX(judged_at) AS last_judged_at
         FROM consult_comparisons
         WHERE project_id = ?`
      )
      .get(projectId) as Partial<ShadowEvalHealth> | undefined;

    return {
      total: row?.total ?? 0,
      judged: row?.judged ?? 0,
      pending: row?.pending ?? 0,
      ok_unjudged: row?.ok_unjudged ?? 0,
      failed_auth: row?.failed_auth ?? 0,
      failed_timeout: row?.failed_timeout ?? 0,
      failed_other: row?.failed_other ?? 0,
      last_created_at: row?.last_created_at ?? null,
      last_judged_at: row?.last_judged_at ?? null
    };
  }

  private selectLifecycleSessions(projectId?: string): SessionRecord[] {
    if (projectId) {
      return this.db
        .prepare("SELECT * FROM sessions WHERE project_id = ? AND status IN ('active', 'dormant')")
        .all(projectId) as SessionRecord[];
    }

    return this.db
      .prepare("SELECT * FROM sessions WHERE status IN ('active', 'dormant')")
      .all() as SessionRecord[];
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (columns.some((row) => row.name === column)) {
      return;
    }
    this.db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }

  private toSessionListItem(row: SessionRecord): SessionListItem {
    return {
      id: row.id,
      claude_session_id: row.claude_session_id,
      topic: row.topic,
      status: row.status,
      last_used: row.last_used,
      summary: row.summary ?? "",
      decisions: this.listValues("session_decisions", "decision", row.id),
      open_questions: this.listValues("session_open_questions", "question", row.id),
      files_discussed: this.listValues("session_files", "path", row.id),
      tags: this.listValues("session_tags", "tag", row.id),
      aliases: this.listValues("session_aliases", "alias", row.id)
    };
  }

  private listValues(tableName: string, columnName: string, sessionId: string): string[] {
    const rows = this.db
      .prepare(`SELECT ${columnName} AS value FROM ${tableName} WHERE session_id = ? ORDER BY id ASC`)
      .all(sessionId) as Array<{ value: string }>;
    return rows.map((row) => row.value);
  }

  private insertValue(tableName: string, columnName: string, sessionId: string, value: string): void {
    this.db
      .prepare(`INSERT INTO ${tableName} (session_id, ${columnName}, created_at) VALUES (?, ?, ?)`)
      .run(sessionId, value, this.clock.nowIso());
  }

  private insertUniqueValue(tableName: string, columnName: string, sessionId: string, value: string): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO ${tableName} (session_id, ${columnName}, created_at) VALUES (?, ?, ?)`)
      .run(sessionId, value, this.clock.nowIso());
  }
}

function isVerifiedFactsheetStatus(status: ClusterFactsheetStatus): boolean {
  return status === "static_verified" || status === "llm_verified";
}

function factsheetEventType(status: ClusterFactsheetStatus, trustState: ClusterTrustState | undefined): string {
  if (trustState === "partial_static") {
    return "factsheet_partially_static_verified";
  }
  if (trustState === "partial_llm") {
    return "factsheet_partially_llm_verified";
  }
  if (status === "static_verified") {
    return "factsheet_static_verified";
  }
  if (status === "llm_verified") {
    return "factsheet_llm_verified";
  }
  return status === "rejected" ? "factsheet_rejected" : "factsheet_generated";
}

function parseJsonObject(source: string | null): Record<string, unknown> {
  if (!source) {
    return {};
  }
  try {
    const parsed = JSON.parse(source) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function parseJsonArray(source: string | null): string[] {
  if (!source) {
    return [];
  }
  try {
    const parsed = JSON.parse(source) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }
  return [];
}

function numberFromUnknown(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumberFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function factCountFromContentJson(source: string): number {
  const content = parseJsonObject(source);
  const facts = content.facts;
  return Array.isArray(facts) ? facts.length : 0;
}

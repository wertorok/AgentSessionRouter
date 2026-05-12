import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Clock } from "./clock.js";
import { daysBetweenIso } from "./clock.js";
import { CONSULT_LIKE_EVENT_TYPES, type SessionStatus } from "./constants.js";
import type { EventType } from "./constants.js";
import { SCHEMA_SQL } from "./schema.js";

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

export type ClusterStatus = "active" | "stale" | "invalidated" | "archived";
export type ClusterTrustState =
  | "unprepared"
  | "static_verified"
  | "llm_verified"
  | "partial_static"
  | "partial_llm"
  | "untrusted";
export type ClusterToolProfile = "bare" | "focused" | "agent";
export type ClusterFactsheetStatus = "draft" | "static_verified" | "llm_verified" | "rejected" | "stale";

export interface ClusterRecord {
  id: string;
  project_id: string;
  name: string;
  description: string;
  tool_profile_default: ClusterToolProfile;
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
            baseline_session_id,
            status,
            trust_state,
            created_at,
            last_used
          ) VALUES (?, ?, ?, ?, ?, NULL, 'active', 'unprepared', ?, ?)`
        )
        .run(
          input.id,
          input.projectId,
          input.name,
          input.description ?? "",
          input.toolProfileDefault,
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
               status = 'active',
               last_used = ?
           WHERE id = ?`
        )
        .run(input.name, input.description ?? existing.description, input.toolProfileDefault, now, input.id);
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
        .prepare("UPDATE clusters SET trust_state = ?, last_used = ? WHERE id = ?")
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

  listClusterFileHashes(factsheetId: string): ClusterFileHashRecord[] {
    return this.db
      .prepare("SELECT * FROM cluster_file_hashes WHERE factsheet_id = ? ORDER BY path ASC")
      .all(factsheetId) as ClusterFileHashRecord[];
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

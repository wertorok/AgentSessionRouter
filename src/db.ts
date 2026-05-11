import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Clock } from "./clock.js";
import type { EventType } from "./constants.js";
import { SCHEMA_SQL } from "./schema.js";

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

  close(): void {
    this.db.close();
  }
}


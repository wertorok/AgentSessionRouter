export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  claude_session_id TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  summary TEXT,

  status TEXT DEFAULT 'active',
  ttl_days INTEGER DEFAULT 30,
  dormant_after_days INTEGER DEFAULT 30,
  archive_after_days INTEGER DEFAULT 90,
  archived_at TEXT,

  last_used TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_project_status
ON sessions(project_id, status);

CREATE INDEX IF NOT EXISTS idx_sessions_project_last_used
ON sessions(project_id, last_used);

CREATE TABLE IF NOT EXISTS session_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_decisions_unique
ON session_decisions(session_id, decision);

CREATE TABLE IF NOT EXISTS session_open_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS session_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_files_unique
ON session_files(session_id, path);

CREATE TABLE IF NOT EXISTS session_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_tags_unique
ON session_tags(session_id, tag);

CREATE TABLE IF NOT EXISTS session_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_aliases_unique
ON session_aliases(session_id, alias);

CREATE TABLE IF NOT EXISTS session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,

  question TEXT,
  answer_summary TEXT,
  raw_response_path TEXT,

  match_score REAL,
  match_reason TEXT,
  was_new_session INTEGER DEFAULT 0,
  was_orphan_recovery INTEGER DEFAULT 0,

  tokens_in INTEGER,
  tokens_out INTEGER,
  duration_ms INTEGER,

  error TEXT,
  created_at TEXT NOT NULL,

  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_session_events_project_created
ON session_events(project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_session_events_type_created
ON session_events(event_type, created_at);
`;


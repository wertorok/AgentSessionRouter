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

CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tool_profile_default TEXT NOT NULL DEFAULT 'bare',
  baseline_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  trust_state TEXT NOT NULL DEFAULT 'unprepared',
  created_at TEXT NOT NULL,
  last_used TEXT NOT NULL,
  UNIQUE(project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_clusters_project_status
ON clusters(project_id, status);

CREATE TABLE IF NOT EXISTS cluster_factsheets (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  source_session_id TEXT,
  baseline_session_id TEXT,
  git_rev TEXT,
  generated_at TEXT NOT NULL,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  FOREIGN KEY(cluster_id) REFERENCES clusters(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cluster_factsheets_version
ON cluster_factsheets(cluster_id, version);

CREATE TABLE IF NOT EXISTS cluster_file_hashes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id TEXT NOT NULL,
  factsheet_id TEXT NOT NULL,
  path TEXT NOT NULL,
  hash TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  last_verified TEXT NOT NULL,
  FOREIGN KEY(cluster_id) REFERENCES clusters(id),
  FOREIGN KEY(factsheet_id) REFERENCES cluster_factsheets(id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_file_hashes_factsheet
ON cluster_file_hashes(factsheet_id);

CREATE TABLE IF NOT EXISTS cluster_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details_json TEXT,
  duration_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cluster_events_cluster_created
ON cluster_events(cluster_id, created_at);

CREATE TABLE IF NOT EXISTS consult_comparisons (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cluster_id TEXT,
  question TEXT NOT NULL,

  cluster_answer TEXT,
  cluster_duration_ms INTEGER,
  cluster_cost_usd REAL,
  cluster_was_not_in_context INTEGER NOT NULL DEFAULT 0,

  shadow_method TEXT NOT NULL DEFAULT 'direct_fresh',
  shadow_status TEXT NOT NULL DEFAULT 'pending',
  shadow_error TEXT,
  direct_answer TEXT,
  direct_duration_ms INTEGER,
  direct_cost_usd REAL,

  cluster_score INTEGER,
  direct_score INTEGER,
  preferred TEXT,
  cluster_errors_json TEXT,
  direct_errors_json TEXT,
  judge_reasoning TEXT,
  judged_at TEXT,

  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consult_comparisons_project_created
ON consult_comparisons(project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_consult_comparisons_cluster_judged
ON consult_comparisons(cluster_id, judged_at);
`;

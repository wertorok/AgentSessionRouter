# Persistent Claude Session Router MCP — Production Spec

## 1. Purpose

`Persistent Claude Session Router MCP` is an MCP server that allows a parent coding agent, such as Codex or Claude Code, to consult Claude CLI through the correct long-lived Claude session.

The server is not just a proxy. It is a context persistence and routing layer.

It solves four problems:

1. Avoid sending full historical context on every consultation.
2. Route each question to the most relevant Claude session by project, topic, files, tags, aliases, and recency.
3. Preserve domain-specific architectural memory across coding sessions.
4. Prevent session corruption, stale resumes, runaway costs, and unobservable routing decisions.

---

## 2. Core Architecture

```txt
Parent Codex / Claude Code
        |
        v
claude-proxy subagent
        |
        v
Persistent Claude Session Router MCP
        |
        |-- SQLite registry
        |-- session lifecycle manager
        |-- session matcher
        |-- per-session lock manager
        |-- cost circuit breaker
        |-- Claude session health checker
        |-- SESSION_UPDATE_JSON parser
        |
        v
Claude CLI --resume <session_id>
```

The MCP server stores an internal registry of Claude sessions. The actual Claude conversation history remains in Claude CLI session files. The registry stores compact metadata, decisions, files, tags, aliases, routing logs, and lifecycle state.

---

## 3. Design Principles

1. One real question creates or updates one Claude session.
2. New sessions are created implicitly only through `claude_consult` with `session_id: null`, after auto-routing finds no eligible match above `threshold_low_confidence`.
3. No empty sessions.
4. Decisions are append-only.
5. Summary is replaceable but capped.
6. Routing must be explainable.
7. Routing must be project-scoped.
8. Claude session health must be checked before resume.
9. Concurrent writes to the same Claude session must be locked.
10. Cost limits must fail closed.
11. The local registry is the durable source of compact architectural memory, not Claude's volatile full context.

---

## 4. Tools

The MVP exposes five MCP tools.

---

### 4.1 `claude_sessions_list`

Returns known Claude sessions for a project.

#### Input

```json
{
  "project_id": "string or null",
  "include_dormant": true,
  "include_archived": false,
  "include_orphaned": false
}
```

If `project_id` is null, the server derives it from the current working directory.

#### Output

```json
{
  "project_id": "higgsfield-mcp",
  "sessions": [
    {
      "id": "internal-session-id",
      "claude_session_id": "claude-jsonl-session-id",
      "topic": "auth system refactor",
      "status": "active",
      "last_used": "2026-05-10T09:23:00Z",
      "summary": "Passport.js with JWT refresh tokens and Redis store.",
      "decisions": [
        "Use passport.js",
        "Use Redis for refresh tokens"
      ],
      "open_questions": [
        "OAuth provider list not finalized"
      ],
      "files_discussed": [
        "src/auth/",
        "src/middleware/auth.ts"
      ],
      "tags": ["auth", "jwt", "redis"],
      "aliases": ["login flow", "user sessions", "session storage"]
    }
  ]
}
```

---

### 4.2 `claude_consult`

Calls Claude in a selected session or creates a new session if `session_id` is null.

#### Input

```json
{
  "project_id": "string or null",
  "session_id": "internal-session-id or null",
  "topic_hint": "auth system refactor",
  "trigger": "AGENTS.md: auth changes require escalation",
  "task": "Add OAuth to existing auth system",
  "relevant_code": "max 200 lines",
  "question": "Should we integrate OAuth via passport strategy or custom provider flow?"
}
```

If `project_id` is null, the server derives it from cwd.

If `session_id` is provided:

1. Verify the session exists in SQLite.
2. Verify it belongs to the same `project_id`.
3. Verify the Claude session file exists.
4. If the Claude session is missing, mark it as `orphaned` and create a new Claude session using the old compact metadata as bootstrap context.

If `session_id` is null:

1. The server attempts deterministic auto-routing within the same `project_id` using eligible `active` and `dormant` sessions.
2. The server scores candidates using the matching logic from §8.
3. If the best score is `>= threshold_low_confidence` (`0.55` by default), reuse that session.
4. If the best score is `< threshold_low_confidence`, create a new Claude session.
5. A new Claude session is created only when the question is actually sent.
6. No separate `create` tool exists.

#### Output

```json
{
  "session_id": "internal-session-id",
  "claude_session_id": "claude-jsonl-session-id",
  "answer": "Claude response verbatim, except internal SESSION_UPDATE_JSON may be parsed separately.",
  "routing": {
    "match_score": 0.87,
    "match_reason": "Matched project higgsfield-mcp, topic auth, files src/auth/, tags oauth/auth.",
    "was_new_session": false,
    "was_orphan_recovery": false
  },
  "session_update": {
    "summary": "OAuth should use passport strategy and reuse existing JWT refresh flow.",
    "decisions": ["Use passport OAuth strategy"],
    "open_questions": ["Confirm Google and GitHub as first providers"],
    "files_discussed": ["src/auth/", "src/routes/oauth.ts"],
    "tags": ["auth", "oauth", "passport", "jwt"],
    "aliases": ["social login", "oauth login", "user identity provider"]
  }
}
```

---

### 4.3 `claude_session_archive`

Archives a session manually.

#### Input

```json
{
  "project_id": "string or null",
  "session_id": "internal-session-id",
  "reason": "Auth refactor completed"
}
```

#### Output

```json
{
  "ok": true,
  "status": "archived"
}
```

---

### 4.4 `claude_session_inspect`

Returns the full registry view of a session without invoking Claude.

This is a read-only self-knowledge tool. It does not call Claude and does not count against cost limits.

#### Input

```json
{
  "project_id": "string or null",
  "session_id": "internal-session-id",
  "recent_events_limit": 10
}
```

If `recent_events_limit` is omitted, default to 10. Hard max is 50.

#### Output

```json
{
  "session": {
    "id": "internal-session-id",
    "claude_session_id": "claude-jsonl-session-id",
    "project_id": "higgsfield-mcp",
    "topic": "auth system refactor",
    "status": "active",
    "summary": "...",
    "decisions": ["...", "..."],
    "open_questions": ["..."],
    "files_discussed": ["..."],
    "tags": ["..."],
    "aliases": ["..."],
    "last_used": "2026-05-10T09:23:00Z",
    "created_at": "2026-04-22T12:00:00Z"
  },
  "recent_events": [
    {
      "event_type": "consult",
      "created_at": "...",
      "match_score": 0.87,
      "match_reason": "...",
      "tokens_in": 1240,
      "tokens_out": 380
    }
  ],
  "recent_events_note": "truncated; default returns up to 10 events, hard max 50"
}
```

#### Why

The proxy agent can call `claude_session_inspect` to surface known decisions back into the next prompt explicitly, instead of trusting Claude's compacted memory. The registry is authoritative; Claude memory is helpful but not authoritative.

---

### 4.5 `claude_router_reset`

Manual operator tool to exit degraded mode after external CLI compatibility has been verified.

The tool triggers a health probe and succeeds only if the probe passes.

#### Input

```json
{
  "reason": "Updated COMPATIBILITY.md after verifying claude version"
}
```

#### Output

```json
{
  "ok": true,
  "mode": "normal"
}
```

Rules:

```txt
- Triggers a health probe.
- Succeeds only if the probe passes.
- Logs event_type: router_reset.
- Does not delete sessions.
- Does not clear session_events.
```

If the health probe fails, return:

```json
{
  "error": {
    "code": "ROUTER_RESET_REJECTED",
    "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again."
  }
}
```

---

## 5. Project Scoping

Every session belongs to one project.

### Rule

```sql
project_id TEXT NOT NULL
```

`project_id` is derived from cwd by default or passed explicitly by the caller.

Suggested derivation:

```txt
project_id = basename(git_root || cwd)
```

If a Git root exists, use the Git root directory name. Otherwise use cwd basename.

### Why this matters

Without `project_id`, sessions from unrelated projects can collide by tags.

Example:

```txt
Project A: claude-mcp-server, topic: auth system
Project B: higgsfield-mcp, topic: auth system
```

Both may have tags like:

```txt
auth, jwt, session, user
```

The router must never mix them unless explicitly requested.

Default behavior:

```txt
claude_sessions_list filters by project_id.
claude_consult validates project_id before resume.
claude_session_archive validates project_id before archive.
```

---

## 6. Session Lifecycle

### Status values

Use lowercase in storage:

```txt
active
dormant
archived
orphaned
```

### Meaning

```txt
active   = recently used and eligible for routing
dormant  = old but still eligible with recency penalty
archived = hidden from default routing
orphaned = registry exists but Claude session file is missing
```

### Lifecycle columns

```sql
status TEXT DEFAULT 'active',
ttl_days INTEGER DEFAULT 30,
dormant_after_days INTEGER DEFAULT 30,
archive_after_days INTEGER DEFAULT 90,
archived_at TEXT
```

### Lifecycle rules

```txt
If now - last_used >= dormant_after_days:
    status = dormant

If now - last_used >= archive_after_days:
    status = archived
    archived_at = now
```

### Routing behavior

```txt
active   -> participates normally
dormant  -> participates with recency penalty
archived -> ignored unless include_archived is true
orphaned -> ignored for direct resume, may be used as bootstrap context
```

### Maintenance

Run lifecycle maintenance:

1. On server startup.
2. Periodically, at least once per day.
3. Before `claude_sessions_list` if cheap enough.

---

## 7. Claude Session Health Check

Before calling Claude with `--resume`, verify that the Claude session still exists.

### Logic

```ts
if (session_id) {
  const session = db.getSession(session_id);
  assertSameProject(session.project_id, project_id);

  const exists = await checkClaudeSessionExists(session.claude_session_id);

  if (!exists) {
    await markSessionOrphaned(session_id);
    session_id = null;
    bootstrap_context = buildBootstrapContextFromOldSession(session);
  }
}
```

### Orphan recovery

If a selected session is orphaned:

1. Mark old session as `orphaned`.
2. Create a new Claude session.
3. Pass compact bootstrap context from the old registry entry.
4. Save `was_orphan_recovery = true` in `session_events`.

Bootstrap context should include:

```txt
Previous session became unavailable. Continue from this compact registry context.

Topic: ...
Summary: ...
Known decisions:
- ...
Open questions:
- ...
Files discussed:
- ...
Tags:
- ...
Aliases:
- ...
```

---

## 8. Session Matching

The proxy agent may choose a session itself after calling `claude_sessions_list`, but the MCP server must also run deterministic matching internally when `claude_consult.session_id` is null.

This means `session_id: null` does not blindly create a new session. It means: auto-route first, create only if no eligible active or dormant session in the same project reaches `threshold_low_confidence`.

### Score formula

```txt
score =
  0.30 * topic_similarity
+ 0.25 * files_overlap
+ 0.20 * tags_overlap
+ 0.15 * aliases_overlap
+ 0.10 * recency_score
```

### Thresholds

```txt
score >= 0.70  -> use session
0.55 - 0.69   -> use best matching session but mark low confidence
score < 0.55  -> create new session
```

### `topic_similarity`

For MVP, use Jaccard similarity over normalized tokens.

```txt
topic_similarity = |tokens(topic_a) ∩ tokens(topic_b)| / |tokens(topic_a) ∪ tokens(topic_b)|
```

### Token normalization

Apply:

1. Lowercase.
2. Trim whitespace.
3. Remove punctuation.
4. Remove stop words.
5. Strip simple plural suffixes.
6. Optional light stemming.

Example:

```txt
"Auth System Refactor" -> ["auth", "system", "refactor"]
"Refactoring authentication systems" -> ["refactor", "auth", "system"]
```

### `files_overlap`

Compare task file paths against `files_discussed`.

Suggested logic:

```txt
exact file match       -> strong match
same directory prefix  -> medium match
no overlap             -> 0
```

### `tags_overlap`

Jaccard similarity over normalized tags.

### `aliases_overlap`

Jaccard similarity over normalized alias tokens or exact alias phrase containment.

Aliases are important for cheap synonym handling before embeddings are added.

Example:

```txt
Session tags: ["auth", "jwt", "redis"]
Session aliases: ["user sessions", "session storage", "login flow"]
New task: "add session storage for users"
```

Keyword overlap against tags may be low, but alias overlap should recover the match.

### `recency_score`

Suggested MVP formula:

```txt
age_days = now - last_used
recency_score = max(0, 1 - age_days / archive_after_days)
```

Dormant sessions naturally receive lower recency scores.

---

## 9. SESSION_UPDATE_JSON Contract

Claude must include a machine-readable update block at the end of every response.

### Required format

```txt
SESSION_UPDATE_JSON:
{
  "summary": "one sentence summary",
  "decisions": ["decision 1", "decision 2"],
  "open_questions": ["question 1"],
  "files_discussed": ["path/or/file.ts"],
  "tags": ["tag1", "tag2"],
  "aliases": ["alternative term 1", "alternative term 2"]
}
```

The MCP server parses this block, sanitizes it, and stores it.

If parsing fails:

1. Return Claude answer.
2. Store raw response.
3. Add `parse_failed` event.
4. Do not update compact metadata.

### Parse failure rate threshold

Track `parse_failed` events per session.

Consult-like events are `event_type IN ('consult', 'new_session')`. New-session calls count as consults for parse-rate calculations because they are real Claude consultations.

If the session has at least 10 consult-like events and `parse_failed` rate exceeds 20% over the last 10 consult-like events in the same session, the server:

1. Logs `event_type: parse_failed_threshold_exceeded`.
2. Automatically archives the session with reason: `parse_failure_threshold`.
3. Forces creation of a new session on the next consult.
4. Uses bootstrap context from the archived session.

This catches sessions where Claude has drifted from the `SESSION_UPDATE_JSON` contract due to long context or compacting.

---

## 10. Sanitizer Rules

Never write Claude-provided JSON directly to the database without caps.

### Sanitizer

```ts
function sanitizeSessionUpdate(update: any) {
  return {
    summary: String(update.summary || "")
      .trim()
      .slice(0, 200),

    decisions: dedupe(update.decisions || [])
      .map(String)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map(s => s.slice(0, 300)),

    open_questions: dedupe(update.open_questions || [])
      .map(String)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map(s => s.slice(0, 300)),

    files_discussed: dedupe(update.files_discussed || [])
      .map(String)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map(s => s.slice(0, 200)),

    tags: dedupe(update.tags || [])
      .map(String)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8)
      .map(s => s.slice(0, 50)),

    aliases: dedupe(update.aliases || [])
      .map(String)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12)
      .map(s => s.slice(0, 80))
  };
}
```

### Storage rules

```txt
summary         -> replace
open_questions  -> replace or merge, implementation choice
decisions       -> append-only
files_discussed -> merge/dedupe
tags            -> merge/dedupe
aliases         -> merge/dedupe
```

### Decisions are append-only

Correct:

```ts
for (const decision of newDecisions) {
  if (!existsDecision(session_id, decision)) {
    insertDecision(session_id, decision);
  }
}
```

Incorrect:

```ts
deleteDecisions(session_id);
insertDecisions(session_id, newDecisions);
```

Decisions are audit history and must not be destroyed by a later Claude response.

---

## 11. Concurrency

SQLite protects database consistency, but it does not protect Claude `.jsonl` session files from concurrent writes.

The server must enforce per-session locks.

### MVP lock provider

```ts
const sessionLocks = new Map<string, Promise<void>>();

async function withSessionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  while (sessionLocks.has(key)) {
    await sessionLocks.get(key);
  }

  let release!: () => void;
  const lock = new Promise<void>(resolve => {
    release = resolve;
  });

  sessionLocks.set(key, lock);

  try {
    return await fn();
  } finally {
    sessionLocks.delete(key);
    release();
  }
}
```

### Lock key

```txt
Existing session -> claude_session_id
New session      -> project_id + normalized(topic_hint)
```

This prevents two parallel consults from creating duplicate sessions for the same topic.

### Future lock providers

Design with an interface:

```txt
LockProvider
- MemoryLockProvider for MVP
- FileLockProvider later
- SQLiteLockProvider later
```

If the MCP server is ever run in multiple processes, in-memory locks are not enough.

---

## 12. Cost Circuit Breaker

The MCP server must prevent runaway Claude calls.

### Config

```toml
[limits]
max_consults_per_hour = 30
max_consults_per_day = 200
max_tokens_per_consult = 8000
```

### Behavior

Before calling Claude:

1. Count consult-like events in the current hour.
2. Count consult-like events in the current day.
3. Estimate or measure input tokens.
4. Reject if limits are exceeded.

Consult-like events are:

```sql
event_type IN ('consult', 'new_session')
```

New sessions count against cost limits because they still invoke Claude.

### Error output

```json
{
  "error": {
    "code": "COST_LIMIT_EXCEEDED",
    "message": "Claude consult limit exceeded: max_consults_per_hour=30. Parent agent should continue without Claude escalation or retry later.",
    "limit": "max_consults_per_hour",
    "value": 30
  }
}
```

The parent agent should treat this as a hard stop for Claude escalation and continue with local reasoning.

---

## 13. Observability

Every consultation and lifecycle event must be logged.

### Required event fields

```sql
CREATE TABLE session_events (
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
```

### Event types

```txt
consult
new_session
orphan_recovery
archive
dormant
resume_failed
parse_failed
parse_failed_threshold_exceeded
cost_limit_exceeded
health_check_failed
health_probe_passed
health_probe_failed
unknown_claude_version
resume_systematic_failure
degraded_mode_entered
router_reset
```

### Why this matters

Without observability, routing errors are impossible to debug.

Example question:

```txt
Why did OAuth get routed into API design instead of auth system?
```

The answer should be visible from:

```txt
match_score
match_reason
project_id
files_overlap
tags_overlap
aliases_overlap
recency_score
```

---

## 14. SQLite Schema

```sql
CREATE TABLE sessions (
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

CREATE INDEX idx_sessions_project_status
ON sessions(project_id, status);

CREATE INDEX idx_sessions_project_last_used
ON sessions(project_id, last_used);

CREATE TABLE session_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX idx_session_decisions_unique
ON session_decisions(session_id, decision);

CREATE TABLE session_open_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE session_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX idx_session_files_unique
ON session_files(session_id, path);

CREATE TABLE session_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX idx_session_tags_unique
ON session_tags(session_id, tag);

CREATE TABLE session_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX idx_session_aliases_unique
ON session_aliases(session_id, alias);

CREATE TABLE session_events (
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

CREATE INDEX idx_session_events_project_created
ON session_events(project_id, created_at);

CREATE INDEX idx_session_events_type_created
ON session_events(event_type, created_at);
```

---

## 15. Claude CLI Invocation

### Base command

```txt
claude -p --output-format json
```

### Resume command

```txt
claude -p --output-format json --resume <claude_session_id>
```

### New session command

```txt
claude -p --output-format json
```

The MCP server must parse Claude JSON output and extract the returned Claude session id.

---

## 16. Prompt Sent to Claude

The MCP server sends a compact structured prompt.

### Template

```txt
You are acting as a senior engineering consultant for this project.

Project: {{project_id}}
Topic: {{topic_hint}}
Trigger: {{trigger}}
Task: {{task}}

Known registry context:
{{bootstrap_or_session_context}}

Relevant code, max 200 lines:
{{relevant_code}}

Question:
{{question}}

Answer the question directly and practically.
Do not restate generic background.
Use the existing decisions when possible.

At the end of your response, include exactly one machine-readable block:

SESSION_UPDATE_JSON:
{
  "summary": "one sentence summary, max 200 chars",
  "decisions": ["new durable decision"],
  "open_questions": ["open question"],
  "files_discussed": ["path/or/file.ts"],
  "tags": ["tag"],
  "aliases": ["alternative phrase"]
}
```

---

## 17. Proxy Agent Instructions

The parent system may use a `claude-proxy` subagent with this contract.

```txt
You are a context packager and session router.

STEP 1 — Call claude_sessions_list with the current project_id.
You will receive active and dormant Claude sessions with topics and summaries.

STEP 2 — Choose the right session:
- Match the current task against project_id, session topic, files_discussed, tags, aliases, and last_used.
- If a session clearly covers this domain, use that session_id.
- If multiple sessions are partially relevant, use the most recent high-scoring one.
- If no session matches, pass session_id: null.

STEP 3 — Call claude_consult with:
{
  "project_id": "current project id",
  "session_id": "chosen id or null",
  "topic_hint": "short domain topic",
  "trigger": "which AGENTS.md rule triggered this",
  "task": "what Codex was trying to do",
  "relevant_code": "key snippets, max 200 lines",
  "question": "specific decision needed"
}

STEP 4 — Return Claude's answer verbatim to parent Codex.

You have no other tools.
Do not answer the question yourself.
Do not merge sessions.
One question uses one primary session.
```

---

## 18. Claude `/compact` Note

Claude may auto-compact long sessions when context becomes large. If a resumed Claude session was compacted, `--resume` continues from Claude's compacted internal summary, not necessarily the full original conversation.

This is expected behavior.

Implication:

```txt
The MCP registry summary, decisions, files, tags, and aliases may diverge from Claude's compacted memory.
```

Therefore:

1. Treat local registry decisions as the durable source of architectural memory.
2. Treat Claude resumed memory as helpful but not authoritative.
3. For large or old sessions, pass known decisions from the registry into the new prompt even when using `--resume`.
4. Do not rely only on “Claude remembers”.

---

## 19. External CLI Compatibility

This server directly depends on the `claude` CLI. It may be used by `codex` or other coding agents as MCP clients, but it does not require the `codex` CLI unless optional Codex-side integration tests are enabled.

Both CLIs can change behavior between versions.

### 19.1 Tested versions

Maintain a `COMPATIBILITY.md` in the repo root.

```txt
claude-code:
  required: true
  tested: [VERSION_A, VERSION_B, VERSION_C]
  last_verified: <date>

codex-cli:
  required: false
  tested: [VERSION_X, VERSION_Y]
  last_verified: <date>
  note: "Only relevant for integration tests or local Codex workflows."
```

Update this file on every release of either CLI before declaring the version supported.

### 19.2 Boot-time health probe

On every server start, run a probe before accepting MCP traffic:

1. Detect installed Claude version via `claude --version`.
2. Compare against `COMPATIBILITY.md`.
3. If version is unknown, log `event_type: unknown_claude_version` and continue in best-effort mode with a stderr warning.
4. Run minimal `claude -p --output-format json "ping"` and verify the response shape contains expected fields, such as `session_id` and `result` or equivalent.
5. If a stored test fixture session exists, try `claude --resume <fixture_id>` and verify it works.
6. If the probe fails, the server starts in degraded mode.

### 19.3 Degraded mode

In degraded mode, tools remain registered, but Claude invocation is blocked.

```txt
claude_sessions_list:     works read-only
claude_session_inspect:   works read-only
claude_session_archive:   works
claude_router_reset:      triggers a health probe; succeeds only if the probe passes
claude_consult:           returns CLAUDE_INCOMPATIBLE
```

Error response:

```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "...",
    "tested_versions": ["..."]
  }
}
```

### 19.4 Resume failure tracking

If `claude --resume` fails across different sessions in a rolling window, default 5 failures in 1 hour, the server enters degraded mode automatically and logs:

```txt
event_type: resume_systematic_failure
```

This catches the case where an external Claude CLI update breaks the resume contract.

Recovery requires manual operator action:

1. Read `session_events`.
2. Verify `claude --version`.
3. Update `COMPATIBILITY.md` if needed.
4. Call `claude_router_reset`, which triggers a health probe and exits degraded mode only if the probe passes.
5. Alternatively, restart the server after fixing compatibility issues.

Self-healing degraded mode is not part of the MVP.

---

## 20. Bootstrap Context Format

When creating a replacement session after orphan recovery, archive recovery, or parse failure threshold, the server injects compact registry context into the first prompt.

```txt
Previous session registry context:
Topic: ...
Summary: ...
Decisions:
- ...
Open questions:
- ...
Files discussed:
- ...
Tags:
- ...
Aliases:
- ...
Recovery reason: orphaned | parse_failure_threshold | archived_resume
```

The registry remains authoritative. Bootstrap context is only a transfer mechanism.

---

## 21. Error Handling

### Invalid project

```json
{
  "error": {
    "code": "PROJECT_MISMATCH",
    "message": "Session belongs to another project_id. Refusing to resume."
  }
}
```

### Session not found

```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No session found for the provided session_id."
  }
}
```

### Cost limit exceeded

```json
{
  "error": {
    "code": "COST_LIMIT_EXCEEDED",
    "message": "Claude consult limit exceeded. Parent agent should continue without Claude escalation."
  }
}
```

### Claude invocation failed

```json
{
  "error": {
    "code": "CLAUDE_INVOCATION_FAILED",
    "message": "Claude CLI failed. See session_events for raw error."
  }
}
```

### Update parse failed

This should not fail the consult.

```json
{
  "session_id": "...",
  "answer": "Claude answer...",
  "warning": {
    "code": "SESSION_UPDATE_PARSE_FAILED",
    "message": "Claude answered, but SESSION_UPDATE_JSON could not be parsed. Metadata was not updated."
  }
}
```

### Claude incompatible

```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "...",
    "tested_versions": ["..."]
  }
}
```

### Router reset rejected

```json
{
  "error": {
    "code": "ROUTER_RESET_REJECTED",
    "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again."
  }
}
```

---

## 22. Configuration

Suggested config file:

```toml
[storage]
db_path = ".claude-session-router/sessions.sqlite"
raw_logs_dir = ".claude-session-router/raw"

[limits]
max_consults_per_hour = 30
max_consults_per_day = 200
max_tokens_per_consult = 8000

[lifecycle]
default_dormant_after_days = 30
default_archive_after_days = 90

[matching]
use_aliases = true
use_embeddings = false
threshold_use = 0.70
threshold_low_confidence = 0.55

[claude]
command = "claude"
output_format = "json"
resume_failure_window_minutes = 60
resume_failure_threshold = 5
compatibility_file = "COMPATIBILITY.md"
```

Relative paths in config are resolved relative to the directory containing the config file, not the process cwd.

---

## 23. MVP Implementation Checklist

### Storage

- [ ] SQLite database initialization.
- [ ] Schema migrations.
- [ ] Raw response logging.
- [ ] Project-scoped queries.

### Tools

- [ ] `claude_sessions_list`.
- [ ] `claude_consult`.
- [ ] `claude_session_archive`.
- [ ] `claude_session_inspect`.
- [ ] `claude_router_reset`.

### Matching

- [ ] Token normalization.
- [ ] Jaccard topic similarity.
- [ ] Files overlap.
- [ ] Tags overlap.
- [ ] Aliases overlap.
- [ ] Recency score.
- [ ] Match reason generation.

### Lifecycle

- [ ] active/dormant/archived/orphaned statuses.
- [ ] Startup maintenance.
- [ ] Archive command.
- [ ] Orphan detection.
- [ ] Orphan recovery with bootstrap context.

### Reliability

- [ ] Claude session file existence check.
- [ ] Per-session lock.
- [ ] New-session lock by project + normalized topic.
- [ ] SESSION_UPDATE_JSON parser.
- [ ] Sanitizer with hard caps.
- [ ] Append-only decisions.
- [ ] Parse failure rate tracking.
- [ ] Parse failure threshold auto-archive.

### External CLI Compatibility

- [ ] `COMPATIBILITY.md` initialized with tested versions.
- [ ] Boot-time `claude --version` probe.
- [ ] Boot-time minimal `claude -p` probe.
- [ ] Boot-time `claude --resume` probe with fixture.
- [ ] Degraded mode for incompatible Claude version.
- [ ] Resume systematic failure counter.
- [ ] Automatic degraded mode on N resume failures.
- [ ] `claude_router_reset` tool.

### Self-Knowledge

- [ ] `claude_session_inspect` tool.
- [ ] Read-only behavior.
- [ ] No cost counting.
- [ ] No Claude invocation.

### Cost Control

- [ ] Hourly consult-like event limit using `event_type IN ('consult', 'new_session')`.
- [ ] Daily consult-like event limit using `event_type IN ('consult', 'new_session')`.
- [ ] Per-consult token cap.
- [ ] Cost-limit error response.

### Observability

- [ ] `session_events` writes for every consult-like event.
- [ ] `consult` and `new_session` used consistently as consult-like events in limits and parse threshold logic.
- [ ] Match score logging.
- [ ] Match reason logging.
- [ ] Duration logging.
- [ ] Tokens in/out logging if available.
- [ ] Error event logging.

---

## 24. Non-goals for MVP

Do not implement in the first version:

1. Embeddings-based routing.
2. Multi-session merging.
3. Automatic cross-session debate.
4. Web dashboard.
5. Distributed locking.
6. Remote database.
7. Complex semantic memory rewriting.
8. Automatic deletion of Claude sessions.
9. Automatic version probing of external CLIs beyond `claude --version`.
10. Automatic migration when Claude `.jsonl` format changes.
11. Self-healing degraded mode; recovery requires manual operator action.

These can be added later.

---

## 25. Future Extensions

Potential later additions:

1. Embedding-based topic matching.
2. Cross-session read-only context lookup.
3. Session split and merge tools.
4. Dashboard for session registry.
5. Session quality scoring.
6. Automatic stale decision detection.
7. Integration with AGENTS.md rule parser.
8. Integration with Codex/Claude Code trace logs.
9. SQLite or file-based distributed lock provider.
10. Token and cost analytics by project.

---

## 26. Final Summary

This MCP server provides a durable context layer between coding agents and Claude CLI.

The final MVP includes:

```txt
Core:
- SQLite registry
- project_id scoping
- claude_sessions_list
- claude_consult
- claude_session_archive
- claude_session_inspect
- claude_router_reset

Context:
- topic
- summary
- append-only decisions
- open_questions
- files_discussed
- tags
- aliases

Routing:
- auto-route first when claude_consult.session_id is null
- deterministic scoring
- Jaccard topic similarity
- files/tags/aliases overlap
- recency score
- match_score and match_reason

Reliability:
- session lifecycle
- Claude session health check
- orphan recovery
- per-session lock
- sanitized SESSION_UPDATE_JSON
- raw response logging
- external CLI version probe
- degraded mode for incompatible Claude
- systematic resume failure tracking
- parse failure rate auto-archive

Cost control:
- max consult-like events per hour
- max consult-like events per day
- max tokens per consult
- consult-like events are consult + new_session

Observability:
- event_type
- project_id
- match_score
- match_reason
- was_new_session
- was_orphan_recovery
- tokens_in/out
- duration_ms
- errors
```

This is a production-ready foundation for using Claude as a persistent domain-aware architect while Codex or Claude Code remains the execution agent.


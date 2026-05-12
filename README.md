# Persistent Claude Session Router MCP

Persistent Claude Session Router MCP is a local MCP server that lets a parent coding agent consult the Claude CLI through durable, project-scoped Claude sessions.

It is not a thin proxy. It keeps a compact SQLite registry of Claude sessions, routing decisions, summaries, durable decisions, files, tags, aliases, lifecycle state, cost events, and error diagnostics. Claude's full conversation history stays in Claude Code's own session files; this server stores the durable index and routing memory around those sessions.

Repository: https://github.com/wertorok/AgentSessionRouter

## What This Solves

- Avoids resending full historical context on every consultation.
- Routes related questions back into the right long-lived Claude session.
- Keeps compact architectural memory in SQLite: summaries, append-only decisions, open questions, files, tags, and aliases.
- Protects Claude session files with per-session locks.
- Fails closed on cost limits and degraded Claude CLI state.
- Makes routing and failures observable through `session_events`.

## Current Status

Implemented MVP tools:

- `claude_sessions_list`
- `claude_consult`
- `claude_session_archive`
- `claude_session_inspect`
- `claude_router_reset`

Experimental cluster-cache tools:

- `cluster_prepare`
- `cluster_get`
- `cluster_list`

Validation performed:

- Unit/integration tests: `43 passed`
- Live MCP stdio E2E: `LIVE_CONSULT_PASS`
- Live matrix run: committed as `LIVE_TEST_LOG.md`
- Post-fix targeted live rerun: `TARGETED_RERUN_PASS`
- Post-install smoke: stub and live modes pass on Linux with Claude Code `2.1.92`

Research and next-architecture docs:

- `docs/EXPERIMENTS.md`
- `docs/CLUSTER_CACHE_SPEC.md`

The full live matrix found three important issues: duplicate same-topic concurrent sessions, archive/consult races, and incomplete token extraction for current Claude JSON. Those were fixed in `c24986c` and verified by `LIVE_TARGETED_RERUN.md`.

Claude usage-limit responses are classified as `claude_usage_limit` and include an actionable `operator_action`.

The cluster-cache implementation can store `static_verified` factsheets and can optionally run an LLM verifier to promote them to `llm_verified`. It probes `bare`/`focused` tool profiles and deterministically downgrades `bare` to `focused` when needed. It does not yet implement cluster consults, fork baselines, refresh/invalidation, or auto-routing. See `docs/CLUSTER_CACHE_SPEC.md` for the remaining v2 phases.

## Requirements

- Node.js `>=20`
- npm
- Claude Code CLI installed as `claude`
- A working Claude login or API credential
- SQLite support through `better-sqlite3`

Check locally:

```powershell
node -v
npm -v
claude --version
claude auth status
claude -p --output-format json "ping"
```

## Install

From the repo root:

```powershell
npm install
npm run build
npm test
```

Run the server directly:

```powershell
node dist/src/index.js
```

The process uses stdio for MCP transport. Do not expect normal logs on stdout; stdout is reserved for MCP protocol messages. Operational logs go to stderr.

Run the post-install isolation smoke test after building:

```powershell
npm run smoke:postinstall
```

The default smoke test uses a stub Claude CLI, starts the real MCP server in a temporary project cwd, verifies a consult round trip, and confirms registry/raw logs stay under that project. Use `npm run smoke:postinstall:live` only when you intentionally want it to call the real Claude CLI.

## MCP Client Configuration

Use the built server entry point:

```txt
node <repo-root>\dist\src\index.js
```

Generic MCP server config shape:

```json
{
  "mcpServers": {
    "claude-session-router": {
      "command": "node",
      "args": [
        "C:\\path\\to\\AgentSessionRouter\\dist\\src\\index.js"
      ],
      "cwd": "C:\\path\\to\\your-project"
    }
  }
}
```

For project-specific behavior, start the MCP server with its working directory set to the project you want to route for. If `project_id` is omitted in tool calls, the server derives it from the Git root directory name, or from the cwd basename if no Git root exists.

For global clients such as Codex, do not leave the MCP `cwd` at your home directory. Configure each MCP entry with the repository directory it should serve:

```toml
[mcp_servers.claude-session-router]
command = "node"
args = ["/root/projects/AgentSessionRouter/dist/src/index.js"]
cwd = "/root/projects/your-project"
startup_timeout_sec = 180
```

If you need the router available in several projects, run one MCP server entry per project with a distinct `cwd`. A shared SQLite registry is supported by using absolute `storage.db_path` and `storage.raw_logs_dir`, but routing remains project-scoped by `project_id`.

## Configuration

The server looks for `router.config.toml` in the process cwd. If absent, defaults are used.

Example:

```toml
[storage]
db_path = ".claude-session-router/sessions.sqlite"
raw_logs_dir = ".claude-session-router/raw"

[limits]
max_consults_per_hour = 30
max_consults_per_day = 200
max_tokens_per_consult = 8000
token_anomaly_ratio = 4.0
token_anomaly_min_delta = 20000

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
command_timeout_ms = 90000
extra_args = []
resume_failure_window_minutes = 60
resume_failure_threshold = 5
compatibility_file = "COMPATIBILITY.md"
```

Relative paths in `router.config.toml` are resolved relative to the directory containing that config file, not relative to the process cwd.

By default, registry files live under the current project:

```txt
.claude-session-router/sessions.sqlite
.claude-session-router/raw/
```

To share one registry across multiple launched server cwd values, set absolute `db_path` and `raw_logs_dir` values in each config.

`claude.extra_args` is appended to every `claude -p` invocation before the router-managed `--output-format`, `--resume`, and prompt arguments. This lets operators choose their Claude Code tool policy. For example, to force answer-only consultations:

```toml
[claude]
extra_args = ["--tools", ""]
```

`claude.command_timeout_ms` bounds each Claude CLI command, including startup health probes and consult calls. Set the MCP client's startup timeout above this value plus process startup overhead.

## Compatibility

`COMPATIBILITY.md` records verified external CLI versions.

Currently verified:

```txt
claude-code:
  tested: ["2.1.138 (Claude Code)"]
  last_verified: 2026-05-11
```

On startup the server:

1. Runs `claude --version`.
2. Compares the detected version with `COMPATIBILITY.md`.
3. Runs `claude -p --output-format json "ping"`.
4. Optionally probes a fixture resume session if a fixture id file exists.

Unknown Claude versions are logged as `unknown_claude_version` but can still run in best-effort mode if the health probe succeeds.

If the probe fails, the server starts in degraded mode. In degraded mode:

- `claude_sessions_list` works
- `claude_session_inspect` works
- `claude_session_archive` works
- `claude_router_reset` can attempt recovery
- `claude_consult` returns `CLAUDE_INCOMPATIBLE`

## Isolation Diagnostics

The router records isolation and context-drift signals in `session_events`:

- `broad_cwd_warning`: startup cwd is the filesystem root or home directory. Set MCP `cwd` to the target repository.
- `token_anomaly`: Claude reported input tokens above both `token_anomaly_ratio` and `token_anomaly_min_delta`. Inspect the event's `error`, `tokens_in`, and recent consult context to check for accidental context bleed.

`claude_session_inspect` includes recent event `duration_ms` and `error` fields so these diagnostics are visible without opening SQLite directly.

## Tools

All MCP tool results are returned as JSON text payloads in the standard MCP tool result format.

### `claude_sessions_list`

Lists known sessions for a project.

Input:

```json
{
  "project_id": null,
  "include_dormant": true,
  "include_archived": false,
  "include_orphaned": false
}
```

Output:

```json
{
  "project_id": "my-project",
  "sessions": [
    {
      "id": "session_...",
      "claude_session_id": "claude-jsonl-session-id",
      "topic": "auth design",
      "status": "active",
      "last_used": "2026-05-11T18:27:43.773Z",
      "summary": "OAuth should reuse the existing auth boundary.",
      "decisions": ["Use session cookies for the web app."],
      "open_questions": ["Which providers are launch scope?"],
      "files_discussed": ["src/auth/index.ts"],
      "tags": ["auth", "oauth"],
      "aliases": ["login flow", "social login"]
    }
  ]
}
```

### `claude_consult`

Consults Claude in a selected session or creates/reuses a session through deterministic routing.

Input:

```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "auth design",
  "trigger": "AGENTS.md: auth changes require escalation",
  "task": "Design login flow",
  "relevant_code": "src/auth/index.ts\nexport const auth = true;",
  "question": "Should auth use sessions or JWT for this small app?"
}
```

Behavior:

- If `session_id` is provided, the server validates project ownership and Claude session file health before resuming it.
- If `session_id` is `null`, the server auto-routes within the same project before creating a new session.
- Exact normalized topic matches are reused before weighted scoring.
- Weighted routing uses topic, files, tags, aliases, and recency.
- If no candidate reaches `threshold_low_confidence`, a new Claude session is created.
- Claude must return a `SESSION_UPDATE_JSON` block; parsed updates are sanitized and stored.

Output:

```json
{
  "session_id": "session_...",
  "claude_session_id": "claude-jsonl-session-id",
  "answer": "Claude answer without the parsed update block.",
  "routing": {
    "match_score": 0.85,
    "match_reason": "Matched topic=1, files=1, tags=0.23, aliases=1, recency=1.",
    "was_new_session": false,
    "was_orphan_recovery": false
  },
  "session_update": {
    "summary": "Auth should use session cookies for this small web app.",
    "decisions": ["Use session cookies."],
    "open_questions": ["Confirm OAuth providers."],
    "files_discussed": ["src/auth/index.ts"],
    "tags": ["auth", "sessions"],
    "aliases": ["login flow"]
  }
}
```

### `claude_session_inspect`

Returns the full compact registry view without invoking Claude and without counting against cost limits.

Input:

```json
{
  "project_id": null,
  "session_id": "session_...",
  "recent_events_limit": 10
}
```

Use this when a parent agent wants to surface durable registry decisions explicitly before asking Claude another question.

### `claude_session_archive`

Archives a session manually.

Input:

```json
{
  "project_id": null,
  "session_id": "session_...",
  "reason": "Auth refactor completed"
}
```

Output:

```json
{
  "ok": true,
  "status": "archived"
}
```

Archive uses the same per-session lock as consult, so archive and resume do not write the same Claude session concurrently.

### `claude_router_reset`

Attempts to exit degraded mode.

Input:

```json
{
  "reason": "Updated COMPATIBILITY.md after verifying Claude CLI"
}
```

Success:

```json
{
  "ok": true,
  "mode": "normal"
}
```

Failure:

```json
{
  "error": {
    "code": "ROUTER_RESET_REJECTED",
    "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
    "reason": "Claude CLI returned error result: You've hit your limit; resets 9:40pm (Europe/London)",
    "category": "claude_usage_limit",
    "operator_action": "Wait until the Claude usage-limit reset time shown in the error, reduce live consult volume, or switch the Claude CLI to an account with available usage."
  }
}
```

### `cluster_prepare`

Stores a cluster factsheet. By default it performs static local-file verification and stores `static_verified`. With `verification_mode: "llm"`, it first runs static verification, then asks Claude in a no-tools verifier profile to promote only semantically supported facts to `llm_verified`.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "name": "Config and cwd isolation",
  "tool_profile_default": "bare",
  "verification_mode": "static",
  "llm_verifier_profile": "focused",
  "factsheet": {
    "summary": "Verified facts for config/cwd isolation.",
    "facts": [
      {
        "id": "claude-extra-args",
        "claim": "Claude extra args are configured under the claude config section.",
        "evidence": [
          {
            "path": "src/config.ts",
            "selector": "extraArgs"
          }
        ]
      }
    ],
    "forbidden_inferences": ["mcp.cwd", "claude.policy"]
  }
}
```

Output:

```json
{
  "project_id": "AgentSessionRouter",
  "cluster_id": "config-and-cwd-isolation",
  "factsheet_id": "factsheet_...",
  "factsheet_version": 1,
  "verification_stage": "static",
  "trust_state": "static_verified",
  "verified_facts": 1,
  "rejected_facts": 0
}
```

If some facts fail static verification but at least one fact is valid, the factsheet is stored with only the statically verified facts and cluster `trust_state` is `partial_static`. If no facts verify, the tool returns `CLUSTER_FACTSHEET_INVALID`.

LLM verification uses `llm_verifier_profile: "focused"` as the portable default, which invokes Claude with `--tools ""`. `llm_verifier_profile: "bare"` invokes Claude with `--bare --tools ""` when the local Claude auth supports it.

### `cluster_get`

Returns cluster metadata, the current `static_verified` or `llm_verified` factsheet, and the scoped file hashes without invoking Claude.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "include_factsheet": true
}
```

### `cluster_list`

Lists cluster cache entries for a project without invoking Claude.

Input:

```json
{
  "project_id": null,
  "include_archived": false
}
```

## Routing Model

When `claude_consult.session_id` is `null`, routing is project-scoped and deterministic.

Candidate sessions:

- `active`
- `dormant`

Ignored by default:

- `archived`
- `orphaned`

Scoring:

```txt
score =
  0.30 * topic_similarity
+ 0.25 * files_overlap
+ 0.20 * tags_overlap
+ 0.15 * aliases_overlap
+ 0.10 * recency_score
```

Thresholds:

```txt
score >= 0.70  -> reuse session
0.55 - 0.69   -> reuse session, mark low confidence in match_reason
score < 0.55  -> create new session
```

Additional hardening:

- Exact normalized topic matches are reused before weighted scoring.
- New-session creation is locked by `project_id + normalized(topic_hint)`.
- Existing-session writes are locked by Claude session id.
- After waiting on a session lock, the route is revalidated so archived/orphaned state cannot be overwritten by stale consult state.

## Session Lifecycle

Session statuses:

```txt
active
dormant
archived
orphaned
```

Default lifecycle:

- `active` becomes `dormant` after 30 days since `last_used`.
- `dormant` or `active` becomes `archived` after 90 days since `last_used`.
- `archived_at` is populated on archive.

Lifecycle maintenance runs:

- on startup
- periodically, about once per day
- before `claude_sessions_list` for the selected project

## Registry Semantics

The SQLite registry is the durable source of compact architectural memory.

Storage rules:

- `summary`: replaced on each successful update
- `decisions`: append-only and deduped
- `open_questions`: replaced
- `files_discussed`: merged and deduped
- `tags`: merged and deduped
- `aliases`: merged and deduped

Claude may compact its own long sessions. The registry remains authoritative for durable decisions even if Claude's resumed memory diverges.

## SESSION_UPDATE_JSON

Every Claude answer is prompted to end with:

```txt
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

The parser also accepts a fenced JSON block after the marker, because real Claude output sometimes returns:

````txt
SESSION_UPDATE_JSON:
```json
{
  "summary": "..."
}
```
````

If parsing fails:

- the answer is still returned
- a `SESSION_UPDATE_PARSE_FAILED` warning is included
- a `parse_failed` event is logged
- compact metadata is not updated
- the raw response is written under `raw_logs_dir`

Sanitizer caps:

- summary: 200 chars
- decisions: 10 items, 300 chars each
- open questions: 5 items, 300 chars each
- files discussed: 20 items, 200 chars each
- tags: 8 items, 50 chars each
- aliases: 12 items, 80 chars each

## Cost Control

Configured limits:

```toml
[limits]
max_consults_per_hour = 30
max_consults_per_day = 200
max_tokens_per_consult = 8000
```

Consult-like events are exactly:

```sql
event_type IN ('consult', 'new_session')
```

New sessions count because they invoke Claude.

The server checks limits before invoking Claude. If a limit is exceeded, it returns:

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

## Observability

All important actions write `session_events`.

Useful event types:

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

Cluster-cache actions write to `cluster_events`. Current event types:

```txt
cluster_created
factsheet_static_verified
factsheet_partially_static_verified
factsheet_llm_verified
factsheet_partially_llm_verified
factsheet_rejected
```

Useful SQLite queries:

```sql
SELECT id, project_id, topic, status, last_used, archived_at
FROM sessions
ORDER BY last_used DESC;
```

```sql
SELECT event_type, COUNT(*) AS count
FROM session_events
GROUP BY event_type
ORDER BY event_type;
```

```sql
SELECT event_type, match_score, match_reason, was_new_session,
       was_orphan_recovery, duration_ms, tokens_in, tokens_out, error
FROM session_events
ORDER BY id DESC
LIMIT 20;
```

```sql
SELECT decision, created_at
FROM session_decisions
WHERE session_id = ?
ORDER BY id;
```

Token metrics:

- Current Claude JSON exposes nested `usage.input_tokens` and `usage.output_tokens`.
- The adapter reads those values when present.
- If unavailable, the server falls back to local estimates.

## Error Codes

Spec error codes are preserved exactly:

- `PROJECT_MISMATCH`
- `SESSION_NOT_FOUND`
- `COST_LIMIT_EXCEEDED`
- `CLAUDE_INVOCATION_FAILED`
- `SESSION_UPDATE_PARSE_FAILED`
- `CLAUDE_INCOMPATIBLE`
- `ROUTER_RESET_REJECTED`
- `CLUSTER_NOT_FOUND`
- `CLUSTER_PROJECT_MISMATCH`
- `CLUSTER_FACTSHEET_INVALID`

Diagnostic fields may be included:

```json
{
  "reason": "...",
  "category": "claude_usage_limit",
  "operator_action": "Wait until the Claude usage-limit reset time shown in the error..."
}
```

Known diagnostic categories:

- `claude_account_billing`
- `claude_usage_limit`
- `claude_auth`
- `claude_hook`
- `claude_command_unavailable`
- `claude_output_shape`
- `claude_cli_unknown`

## Troubleshooting

### `CLAUDE_INCOMPATIBLE`

Check the diagnostic fields first:

```json
{
  "category": "claude_usage_limit",
  "operator_action": "Wait until the Claude usage-limit reset time shown in the error..."
}
```

Then verify:

```powershell
claude --version
claude auth status
claude -p --output-format json "ping"
```

If the CLI works again, call:

```json
{
  "reason": "Claude CLI verified manually"
}
```

with `claude_router_reset`.

### Unknown Claude Version

If `COMPATIBILITY.md` does not list your detected Claude version, the server logs `unknown_claude_version`.

If the health probe passes, the server can still run in best-effort mode. Before declaring production support, deliberately verify the version and update `COMPATIBILITY.md`.

### Claude Session Missing

If a stored Claude `.jsonl` file cannot be found:

- the old registry session is marked `orphaned`
- a new Claude session is created
- compact registry context from the old session is passed as bootstrap context
- `was_orphan_recovery` is set in routing output

### Usage Limit

If Claude returns:

```txt
You've hit your limit; resets ...
```

the server returns:

```json
{
  "category": "claude_usage_limit",
  "operator_action": "Wait until the Claude usage-limit reset time shown in the error, reduce live consult volume, or switch the Claude CLI to an account with available usage."
}
```

### Hooks on stderr

Claude Code hooks may write warnings to stderr, for example `SessionEnd hook ... failed`. The adapter parses stdout JSON. Hook stderr is not fatal if Claude exits successfully and stdout contains valid JSON.

## Development

Build:

```powershell
npm run build
```

Test:

```powershell
npm test
```

Run server:

```powershell
npm start
```

The test suite does not invoke the real Claude CLI.

## Live Validation

Reports already present in this repo:

- `CLAUDE_LIVE_DIAGNOSIS.md`
- `LIVE_E2E_REPORT.md`
- `LIVE_TEST_LOG.md`
- `LIVE_TARGETED_RERUN.md`

Preferred post-fix live regression:

```powershell
npm run build
node scripts/live-targeted-rerun.mjs
```

This rerun makes a small number of real Claude calls and checks the production paths that were fixed after the full matrix: same-topic concurrent null consults, archive/consult races, and token metrics.

Run the full live matrix harness when you need broader rehearsal coverage:

```powershell
npm run build
node scripts/live-test-matrix.mjs
```

The full matrix makes many real Claude calls and can consume account quota. It creates temporary projects under the OS temp directory and logs results into `LIVE_TEST_LOG.md`.

The harness uses a Haiku wrapper for cost control on Windows because Node cannot spawn `.cmd` wrappers directly as a normal executable in this setup.

## Repository Layout

```txt
src/
  claude.ts          Claude CLI adapter and health probe
  clock.ts           Centralized clock helpers
  cluster.ts         Static cluster factsheet verification and preparation
  config.ts          TOML config loading and path resolution
  consult.ts         claude_consult routing and invocation service
  constants.ts       Statuses, event types, error codes, defaults
  db.ts              SQLite registry access layer
  errors.ts          Spec error payloads and Claude failure diagnosis
  locks.ts           In-memory per-key lock provider
  matching.ts        Deterministic routing score logic
  prompt.ts          Prompt and bootstrap context builders
  project.ts         project_id derivation
  runtime.ts         Runtime state, degraded mode, lifecycle timer
  schema.sql         SQLite schema artifact
  server.ts          MCP server construction
  sessionUpdate.ts   SESSION_UPDATE_JSON parser and sanitizer
  tools.ts           MCP tool registrations

tests/
  cluster.test.ts
  consult.test.ts
  core.test.ts
  db.test.ts
  tools.test.ts

scripts/
  diagnose-claude-live.mjs
  live-e2e.mjs
  live-targeted-rerun.mjs
  live-test-matrix.mjs
```

## Publication Notes

This repository is prepared for GitHub publication at:

```txt
https://github.com/wertorok/AgentSessionRouter
```

The package remains `"private": true` and `"license": "UNLICENSED"` so it cannot be accidentally published to npm and does not grant an open-source license by implication. Choose and add a license before advertising the repository as open source.

Suggested final publish flow:

```powershell
npm install
npm run build
npm test
git remote add origin https://github.com/wertorok/AgentSessionRouter.git
git push -u origin master
```

If `origin` already exists, use `git remote set-url origin https://github.com/wertorok/AgentSessionRouter.git`.

## Known MVP Boundaries

Not implemented in the MVP:

- embeddings-based routing
- multi-session merge/debate
- web dashboard
- distributed locking across multiple server processes
- remote database
- automatic deletion of Claude sessions
- automatic migration if Claude changes `.jsonl` format
- self-healing degraded mode

The current lock provider is in-memory. If you run multiple MCP server processes against the same registry and Claude session files, use a future file or SQLite lock provider before relying on concurrency guarantees.

## Operator Checklist

Before using in a real project:

1. Run `npm run build`.
2. Run `npm test`.
3. Verify `claude -p --output-format json "ping"`.
4. Confirm your installed Claude CLI version is listed in `COMPATIBILITY.md`; update it only after deliberate verification.
5. Decide whether registry storage should be project-local or absolute/shared.
6. Configure cost limits for your account budget.
7. Add the MCP server to your parent agent config.
8. Run one smoke consult and inspect `session_events`.

## Minimal Smoke Test

1. Start the server through an MCP client.
2. Call `claude_sessions_list`:

```json
{
  "project_id": null
}
```

3. Call `claude_consult`:

```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "smoke test",
  "trigger": "manual README smoke test",
  "task": "Verify MCP server can create a persistent Claude session",
  "relevant_code": "",
  "question": "Reply briefly and include the required session update."
}
```

4. Call `claude_session_inspect` with the returned `session_id`.
5. Query SQLite or inspect `LIVE_E2E_REPORT.md` style output to confirm `new_session`, `match_score`, `duration_ms`, and token fields were recorded.

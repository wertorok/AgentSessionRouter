# Persistent Claude Session Router MCP

Persistent Claude Session Router MCP is a local MCP server that lets a parent coding agent consult the Claude CLI through durable, project-scoped Claude sessions.

It is not a thin proxy. It keeps a compact SQLite registry of Claude sessions, routing decisions, summaries, durable decisions, files, tags, aliases, lifecycle state, cost events, and error diagnostics. Claude's full conversation history stays in Claude Code's own session files; this server stores the durable index and routing memory around those sessions.

Repository: https://github.com/wertorok/AgentSessionRouter

## What This Solves

Coding agents often waste time and tokens rediscovering the same project before every consultation. This server gives a parent agent two reusable context layers:

- **v1 session router**: routes related questions back into durable, project-scoped Claude sessions and keeps compact registry memory in SQLite.
- **v2 cluster cache**: stores verified factsheets per task cluster and uses restricted Claude tool profiles, such as `--bare --tools ""`, to skip project rediscovery when the factsheet is enough.
- **v2.1-lite shadow eval**: optional telemetry that compares real `cluster_consult` answers against an isolated fresh Claude baseline in the background, then scores the pair with a blind structured judge.
- **v2.3 conservative router**: exposes `router_consult` as the recommended parent-agent entry point. It records a route decision, prefers explicit clusters/sessions, reuses exact or high-confidence sessions, and leaves automatic cluster selection as monitored telemetry until real route data justifies it.

The v1 layer is the durable session and decision registry. The v2 layer is the verified cache layer on top. The v2.1-lite eval layer is observability only. The v2.3 router layer is conservative orchestration over those tools. They work independently: you can use `router_consult`, normal `claude_consult` sessions, cluster factsheet consults, optional shadow eval, or any combination.

Measured on this repository during the v2 experiments:

```txt
Original broad Claude Code discovery: 264.8s, 56,051 input tokens, about $0.30
Fresh cluster_consult without fork:     6.1s,    489 input tokens, about $0.015
```

The exact numbers depend on your Claude account, model, CLI version, and prompt size. The important behavior is that verified factsheets let Claude answer without repeating broad discovery.

Measured quality comparison, 90 invocations on 2026-05-12:

- On factual lookup questions, `cluster_consult` matched or beat `direct_resume` quality: `3.00` vs `2.80`.
- With calibrated scoring, `cluster_consult` reached `98.8%` of `direct_resume` mean quality across the full matrix: `2.73` vs `2.77`.
- `cluster_consult` ran at `23.3%` of `direct_resume` estimated per-invocation cost: `$0.0164` vs `$0.0702`.
- No confirmed nonexistent field, event, or function hallucinations were found across 30 `cluster_consult` responses.
- For questions outside factsheet coverage, `cluster_consult` returned `NOT IN CONTEXT` instead of guessing.
- v1 `claude_consult` remains the right default for reasoning/open-ended questions; it also reduced estimated cost versus fresh Claude calls from `$0.1745` to `$0.0702` at comparable quality.

Full benchmark data is committed under `experiments/quality-comparison-2026-05-12/`.

Targeted factsheet expansion on 2026-05-13 added verifier rationale, orphan-recovery paths, and `cluster_refresh` extension facts. On the three previously weak questions B1/B2/C1, `cluster_consult` scored `2.89` mean quality with no low-score rows; B2 and C1 stabilized at `3/3/3`. Artifact: `experiments/factsheet-expansion-2026-05-13/`.

## Current Status

Implemented MVP tools:

- `claude_sessions_list`
- `claude_consult`
- `router_consult`
- `claude_session_archive`
- `claude_session_inspect`
- `claude_router_reset`
- `router_status`
- `router_monitor`

Experimental cluster-cache tools:

- `cluster_prepare`
- `cluster_get`
- `cluster_consult`
- `cluster_refresh`
- `cluster_list`
- `cluster_archive`

Optional shadow-eval tools:

- `comparison_stats`
- `comparison_list`
- `comparison_process_pending`
- `comparison_rejudge`

Validation performed:

- Unit/integration tests: `91 passed`
- Live MCP stdio E2E: `LIVE_CONSULT_PASS`
- Live matrix run: committed as `LIVE_TEST_LOG.md`
- Post-fix targeted live rerun: `TARGETED_RERUN_PASS`
- Post-install smoke: stub mode passes and covers v1, v2 cluster tools, `router_status`, and `router_monitor`
- MCP workload matrix: stub mode passes 22/22 checks, including clean `SESSION_UPDATE_JSON`, parse-failure threshold archival, archived-bootstrap replacement, conservative `router_consult`, evidence revalidation, fallback, and shadow telemetry
- Router monitor snapshots: `npm run monitor:snapshot` writes `router_status` + `router_monitor` payloads under `experiments/router-monitor-snapshots/`
- Route sample follow-up: 118/118 shadow comparisons judged, 0 pending, active
  `agentsessionrouter-codebase` factsheet v4 is `llm_verified` with 50
  verified facts and 0 rejected facts
- Session continuity benchmark: `npm run session:continuity` measures the
  original v1 value separately from cluster shadow eval. The 2026-05-15 run
  showed fresh-each-turn memory score `0.67`, durable `claude_consult` session
  score `3.00`, and `router_consult` exact-topic reuse score `3.00`.

Research and next-architecture docs:

- `docs/EXPERIMENTS.md`
- `docs/CLUSTER_CACHE_SPEC.md`
- `docs/RELEASE_v2.0.md`
- `docs/RELEASE_v2.2.md`
- `docs/SHADOW_EVAL_SPEC.md`

The full live matrix found three important issues: duplicate same-topic concurrent sessions, archive/consult races, and incomplete token extraction for current Claude JSON. Those were fixed in `c24986c` and verified by `LIVE_TARGETED_RERUN.md`.

Claude usage-limit responses are classified as `claude_usage_limit` and include an actionable `operator_action`.

The cluster-cache implementation can store `static_verified` factsheets, optionally run an LLM verifier to promote them to `llm_verified`, consult Claude through a verified factsheet without fork, and revalidate changed evidence with selector/snippet checks. It probes `bare`/`focused` tool profiles and deterministically downgrades `bare` to `focused` when needed. If the cache path cannot prove its evidence, caller-facing `cluster_consult` falls back internally to normal `claude_consult` and still returns an answer when Claude is available. Optional shadow eval records real-world quality/cost telemetry without changing the answer returned to the parent agent. `router_consult` records top-level route decisions and avoids accidental broad cold discovery when the caller provides an explicit cluster/session or a reusable session can be matched. Fork baselines, distillation from existing v1 sessions, and automatic cluster selection are post-MVP enhancements rather than release blockers.

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

## Quick Cluster Cache Example

Use `cluster_prepare` when you already know a small set of project facts and want future questions to avoid rediscovery. Each fact must cite local file evidence.

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "name": "Config and cwd isolation",
  "tool_profile_default": "bare",
  "verification_mode": "llm",
  "llm_verifier_profile": "focused",
  "factsheet": {
    "summary": "Verified config facts for Claude invocation policy.",
    "facts": [
      {
        "id": "claude-extra-args",
        "claim": "Claude extra args are configured through the claude.extra_args config field.",
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

Then consult the cluster:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "question": "Which config field controls additional Claude CLI args?"
}
```

Before or after code changes, recheck the factsheet without invoking Claude:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "mode": "verify_only"
}
```

If any cited evidence file changed, lower-level stale checks mark the cluster stale. Caller-facing `cluster_consult` then tries strict evidence revalidation in the same MCP call: every cited selector must still exist and every stored `snippet_hash` must match. If that proof succeeds, the consult proceeds with updated hashes. If it fails, the router marks the cluster `needs_prepare`, falls back to normal `claude_consult`, and still returns an answer to the parent agent unless Claude itself is unavailable.

## Optional Shadow Comparison Eval

Shadow eval is a lightweight measurement layer for real parent-agent traffic. It is disabled by default.

When `[eval].shadow_mode = true`, a successful `cluster_consult` still returns the cluster answer to the caller immediately. After that return path, the router schedules a background comparison:

1. Run an isolated fresh Claude baseline for the same question.
2. Blindly shuffle the cluster answer and direct answer as answer A/B.
3. Ask a no-tools judge to score both answers with structured JSON.
4. Store the result in `consult_comparisons`.

This is telemetry, not routing. It does not affect the answer returned to Codex or any other parent agent. Shadow calls also do not append decisions, summaries, tags, or aliases to production router sessions. The baseline is intentionally `direct_fresh` for the MVP so eval state cannot contaminate long-lived production sessions.

Do not use shadow eval alone to judge durable session continuity. Shadow eval
answers the question "is this verified cluster answer better than a fresh direct
baseline?" It does not answer "does a durable session remember prior turns?" Use
`npm run session:continuity` for that second question.

Use the comparison tools to inspect accumulated results:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation"
}
```

`comparison_stats` returns aggregate quality and preference counts per cluster. `comparison_list` returns recent comparison rows and omits full answers unless `include_answers: true` is set.

`router_monitor` is the operator-facing information monitor built on top of shadow eval, router status, and cluster events. It returns one diagnosis payload with health, cache decay, comparison quality, direct-win samples, recommendations, and next directions. Use it when a parent agent needs to decide what is working, what is failing, what to change, and why.

## Consultation Method Selection

Use `router_consult` as the recommended parent-agent entry point when the caller wants an answer and does not need to exercise a specific lower-level path for debugging. Pass `cluster_id` when the domain is known to be covered by a cluster, or `session_id` when a specific durable session must be used. If neither is provided, `router_consult` reuses exact/high-confidence v1 sessions, reuses low-confidence sessions only when the best candidate is clearly separated from the runner-up, or starts a new durable session when candidates are ambiguous. Every decision is recorded in `router_monitor.route_health`.

Automatic cluster selection is intentionally disabled in the current conservative router. Stable clusters appear as monitor signals, not as automatic routing targets.

Use the benchmark-backed decision tree below when choosing an explicit lower-level consult path.

Use `cluster_consult` when:

- The question is factual: field names, event types, default values, exact config/API behavior.
- The answer should fit the verified factsheet for an existing cluster.
- Speed and bounded cost matter more than broad exploration.
- An honest `NOT IN CONTEXT` response is acceptable when the factsheet lacks a needed fact.

Use `claude_consult` with an existing routed/resumed session when:

- The question requires reasoning about why code is shaped a certain way.
- The question is open-ended: "suggest", "how would you", tradeoffs, or future design.
- The answer must connect multiple code paths or registry decisions not captured as factsheet facts.
- The decision is architecturally critical and shallow answers are risky.

Use a fresh Claude exploration when:

- The project or subsystem is new to the router.
- No relevant session or cluster exists yet.
- The question crosses multiple domains and needs real discovery before any factsheet can be trusted.

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

This is an intentional safety boundary. The server does not accept arbitrary `project_root` or `cwd` values through normal tool inputs; the MCP process cwd is the project trust boundary. This avoids letting a caller redirect the router into neighboring repositories or broad home/root directories during a consult.

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

[eval]
shadow_mode = false

[cluster]
auto_refresh = true
auto_refresh_min_retained_ratio = 1.0
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

`eval.shadow_mode` enables optional v2.1-lite quality telemetry. When `true`, each successful `cluster_consult` schedules a background comparison against an isolated fresh Claude baseline and stores the judge result in `consult_comparisons`. This does not block or alter the response returned to the parent agent, and it does not write shadow results into production Claude session registry state.

`cluster.auto_refresh` makes caller-facing `cluster_consult` self-heal changed evidence when it can prove the cited evidence is still identical. If a scoped file hash changed, the router revalidates each fact by finding its selector in the current file and comparing the stored `snippet_hash` for the evidence window. When every required selector/snippet still matches, it writes a new factsheet version with updated file hashes, logs `evidence_revalidated`, and consults Claude in the same MCP call. If any required selector is missing or its snippet changed, the router logs `evidence_revalidation_failed`, marks the cluster `needs_prepare`, falls back to normal `claude_consult`, logs `cluster_fallback_to_claude_consult`, and still returns an answer to the parent agent. The production default is strict: `cluster.auto_refresh_min_retained_ratio = 1.0`, and rejected facts always fail evidence revalidation.

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
- `router_status` works
- `claude_router_reset` can attempt recovery
- `claude_consult` returns `CLAUDE_INCOMPATIBLE`

## Operational Status

Use `router_status` when a parent agent needs one health snapshot before deciding whether to refresh factsheets, inspect errors, or continue normal work. It does not invoke Claude.

The status report includes:

- normal/degraded mode and Claude version probe details
- v1 session counts by lifecycle status
- v2 cluster counts by status, including stale and `needs_prepare` cluster details
- recent session error event counts
- recent cluster attention event counts such as `cluster_refresh_required`, `cluster_fallback_to_claude_consult`, and `cluster_consult_failed`
- shadow-eval totals, judged count, pending count, and failed shadow baselines
- warnings suitable for caller-agent decision rules

Important refresh behavior: caller-facing `cluster_consult` does not answer from changed evidence unless the evidence is strictly revalidated first. If scoped factsheet files changed and `cluster.auto_refresh` is enabled, it checks every selector and stored `snippet_hash` before factsheet-backed consulting. If every cited snippet still matches, it writes updated hashes and returns the final answer in the same MCP call. If any cited snippet is missing or changed, it falls back internally to normal `claude_consult` and returns that answer. `router_status` is the aggregate place to notice clusters needing prepare, revalidation failures, fallback counts, and shadow-eval drift without manually querying SQLite.

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

### `router_consult`

Recommended parent-agent entry point. It wraps the lower-level consult tools with conservative route selection and records the decision for `router_monitor.route_health`.

Input:

```json
{
  "project_id": null,
  "cluster_id": null,
  "session_id": null,
  "topic_hint": "project roadmap",
  "trigger": "parent agent needs a consult",
  "task": "Plan the next router maintenance step",
  "relevant_code": "",
  "question": "What should we fix next after the v2.3 monitor work?",
  "tool_profile": null
}
```

Behavior:

- If `cluster_id` is provided, calls `cluster_consult` explicitly.
- If `session_id` is provided, calls `claude_consult` with that session explicitly.
- If no explicit target is provided, reuses exact or high-confidence v1 sessions.
- If a low-confidence candidate is clearly separated from the runner-up, selects that session automatically.
- If candidates are ambiguous, starts a new durable session instead of guessing.
- Records `router_route_decision` in `session_events`.
- Does not automatically select a cluster from monitor candidates yet; `auto_cluster_routing` is `disabled_read_only`.

Output excerpt:

```json
{
  "project_id": "AgentSessionRouter",
  "route_decision": {
    "selected_path": "claude_consult_existing_session",
    "reason": "Exact topic match found in active session registry.",
    "session_id": "session_...",
    "match_score": 1,
    "topic_hint": "project roadmap",
    "auto_cluster_routing": "disabled_read_only"
  },
  "session_id": "session_...",
  "answer": "..."
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

### `router_status`

Returns aggregate operational health without invoking Claude.

Input:

```json
{
  "project_id": null,
  "recent_hours": 24,
  "warnings_limit": 10
}
```

Output excerpt:

```json
{
  "project_id": "AgentSessionRouter",
  "mode": "normal",
  "v1_sessions": {
    "active": 3,
    "dormant": 1,
    "archived": 4,
    "orphaned": 0,
    "total": 8
  },
  "v2_clusters": {
    "active": 2,
    "stale": 1,
    "invalidated": 0,
    "archived": 0,
    "total": 3,
    "fallback_count_last_24h": 2,
    "stale_clusters": [
      {
        "id": "agentsessionrouter-codebase",
        "factsheet_version": 2,
        "factsheet_status": "stale"
      }
    ]
  },
  "shadow_eval": {
    "enabled": true,
    "total": 47,
    "judged": 43,
    "pending": 2,
    "failed_auth": 1,
    "failed_timeout": 0,
    "failed_other": 1
  },
  "warnings": [
    "Cluster 'agentsessionrouter-codebase' is stale; latest factsheet factsheet_... version 2 needs refresh or re-prepare."
  ]
}
```

### `router_monitor`

Returns the information monitor for agent/operator decisions. It does not invoke Claude.

Input:

```json
{
  "project_id": null,
  "recent_hours": 24,
  "sample_limit": 10
}
```

Output sections:

- `health`: normal/degraded mode, Claude version, v1/v2 counts, shadow-eval pipeline health.
- `cache_health`: stale/needs-prepare clusters and recent revalidation/fallback attention events.
- `latency`: slow consult aggregates plus concrete slow-session samples with topic, question, token counts, duration, and raw response path.
- `metadata_health`: `SESSION_UPDATE_JSON` parse failures, affected sessions, threshold archives, and raw response paths.
- `route_health`: recent `router_consult` selected-path counts and concrete route-decision samples.
- `quality`: recent shadow comparison stats, direct-win samples, `NOT IN CONTEXT` samples, and read-only auto-routing candidates.
- `recommendations`: prioritized actions with area, cluster id, action, and reason.
- `next_directions`: higher-level signals such as factsheet expansion, shadow stabilization, or future auto-routing candidates.

Use `router_status` for a compact health check. Use `router_monitor` when deciding what to fix next.

Large monitor samples are bounded in the tool response. `router_monitor` accepts
requested `sample_limit` values up to 200, caps the effective sample output to a
safe internal limit, and reports `output_limits` so callers know when output was
truncated.

To save a point-in-time monitor snapshot for trend comparison:

```bash
npm run build
npm run router:sanity -- --out experiments/router-consult-sanity/<label>.json
npm run monitor:snapshot -- --recent-hours 24 --sample-limit 20
```

`router:sanity` runs a small live MCP route check against this repository: it selects an active cluster and active session when available, calls `router_consult`, then saves the resulting route decisions and monitor state. Use it after route changes or before deciding whether a slow direct consult was a one-off or a routing problem.

### `cluster_prepare`

Stores a cluster factsheet. By default it performs static local-file verification and stores `static_verified`. With `verification_mode: "llm"`, it first runs static verification, then asks Claude in a no-tools verifier profile to promote only semantically supported facts to `llm_verified`.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "name": "Config and cwd isolation",
  "tool_profile_default": "bare",
  "static_factsheet_policy": "deny",
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

### `cluster_consult`

Consults Claude with the current cluster factsheet. The current phase injects the factsheet through `--append-system-prompt` and does not use fork sessions.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "question": "Which config field controls Claude extra args?",
  "tool_profile": null
}
```

Behavior:

- Requires the current factsheet to be `llm_verified` unless the cluster was prepared with `static_factsheet_policy: "allow"`.
- The static/LLM trust decision is cluster metadata, not a per-call caller decision.
- Checks scoped evidence file hashes before invoking Claude.
- If cited files changed and `cluster.auto_refresh` is enabled, revalidates selectors and `snippet_hash` values internally before consulting.
- If all cited selectors/snippets still match, writes a new factsheet version with updated file hashes and proceeds without changing the caller-facing response shape.
- If any required selector is missing, any snippet changed, or the configured strict retained-ratio threshold is not met, falls back internally to normal `claude_consult` and returns that answer.
- Low-level stale/cache-health errors are internal to caller-facing `cluster_consult`; the MCP tool falls back to `claude_consult` when the cache path cannot safely answer.
- Returns an error to the caller only when input/project validation fails or Claude itself cannot answer through either path.
- Selects `bare`, `focused`, or `agent` through the profile selector; `bare` can downgrade to `focused`, but never to `agent`.

Output:

```json
{
  "cluster_id": "config-and-cwd-isolation",
  "factsheet_version": 1,
  "factsheet_status": "llm_verified",
  "tool_profile": "bare",
  "used_fork": false,
  "answer": "..."
}
```

### `cluster_refresh`

Revalidates the latest cluster factsheet without invoking Claude. The MVP supports `verify_only`, which checks only the scoped evidence files already attached to the factsheet.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "mode": "verify_only"
}
```

Fresh output:

```json
{
  "cluster_id": "config-and-cwd-isolation",
  "factsheet_id": "factsheet_...",
  "factsheet_version": 1,
  "mode": "verify_only",
  "fresh": true,
  "factsheet_status": "llm_verified",
  "trust_state": "llm_verified",
  "changed_files": [],
  "verified_facts": 1,
  "rejected_facts": 0
}
```

If a scoped evidence file changed, the tool marks the factsheet and cluster stale and returns `CLUSTER_FACTSHEET_STALE`. It does not regenerate facts or call Claude in `verify_only` mode.

### `cluster_list`

Lists cluster cache entries for a project without invoking Claude.

Input:

```json
{
  "project_id": null,
  "include_archived": false
}
```

### `cluster_archive`

Archives a cluster cache entry without deleting its factsheets, events, or comparison history. Archived clusters are hidden from normal `cluster_list` output and excluded from active `router_monitor` quality/fallback recommendations, while remaining available through `cluster_list` with `include_archived: true`.

Input:

```json
{
  "project_id": null,
  "cluster_id": "old-benchmark-cluster",
  "reason": "superseded by current benchmark cluster"
}
```

### `comparison_stats`

Returns aggregate shadow-eval telemetry for a project, optionally scoped to one cluster. This tool never invokes Claude.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation"
}
```

Output:

```json
{
  "project_id": "AgentSessionRouter",
  "stats": [
    {
      "cluster_id": "config-and-cwd-isolation",
      "n": 12,
      "cluster_q": 2.83,
      "direct_q": 2.67,
      "gap": -0.16,
      "cluster_wins": 5,
      "direct_wins": 3,
      "ties": 4
    }
  ]
}
```

### `comparison_list`

Lists recent shadow-eval comparison rows. Full answers are omitted by default so parent agents can inspect quality telemetry without pulling large answer text back into context.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "preferred": "direct",
  "include_answers": false,
  "limit": 20
}
```

Output:

```json
{
  "project_id": "AgentSessionRouter",
  "comparisons": [
    {
      "id": "comparison_...",
      "cluster_id": "config-and-cwd-isolation",
      "question": "Which config field controls Claude extra args?",
      "shadow_method": "direct_fresh",
      "shadow_status": "ok",
      "cluster_score": 3,
      "direct_score": 2,
      "preferred": "cluster",
      "cluster_answer": "[omitted]",
      "direct_answer": "[omitted]",
      "judge_reasoning": "The cluster answer is exact and the direct answer is correct but less specific."
    }
  ]
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
score >= 0.70                         -> reuse session
0.55 - 0.69 and gap_to_second >= 0.10 -> router-disambiguated reuse
0.55 - 0.69 and gap_to_second < 0.10  -> create new session instead of guessing
score < 0.55                          -> create new session
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

If repeated parse failures exceed the threshold for a session, the router archives
that session with `parse_failure_threshold`. A later same-topic consult creates a
replacement session bootstrapped from the archived registry context, so the
caller still receives an answer instead of handling router internals.

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
cluster_consult
cluster_consult_failed
cluster_created
cluster_fallback_failed
cluster_fallback_to_claude_consult
evidence_revalidated
evidence_revalidation_failed
cluster_refresh
cluster_refresh_required
factsheet_static_verified
factsheet_partially_static_verified
factsheet_llm_verified
factsheet_partially_llm_verified
factsheet_rejected
factsheet_stale
llm_verifier
tool_profile_downgraded
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
- `CLUSTER_FACTSHEET_STALE`
- `CLUSTER_FACTSHEET_UNTRUSTED`

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
  clusterEvidenceRevalidation.ts caller-facing strict evidence revalidation
  clusterConsult.ts  cluster_consult factsheet invocation service
  clusterRefresh.ts  cluster_refresh scoped factsheet revalidation service
  cluster.ts         Static cluster factsheet verification and preparation
  config.ts          TOML config loading and path resolution
  consult.ts         claude_consult routing and invocation service
  constants.ts       Statuses, event types, error codes, defaults
  db.ts              SQLite registry access layer
  errors.ts          Spec error payloads and Claude failure diagnosis
  locks.ts           In-memory per-key lock provider
  matching.ts        Deterministic routing score logic
  profiles.ts        Claude tool profile probes and selection
  prompt.ts          Prompt and bootstrap context builders
  project.ts         project_id derivation
  runtime.ts         Runtime state, degraded mode, lifecycle timer
  schema.sql         SQLite schema artifact
  server.ts          MCP server construction
  sessionUpdate.ts   SESSION_UPDATE_JSON parser and sanitizer
  shadowEval.ts      Optional shadow comparison telemetry and judge parser
  tools.ts           MCP tool registrations

tests/
  clusterConsult.test.ts
  clusterRefresh.test.ts
  cluster.test.ts
  consult.test.ts
  core.test.ts
  db.test.ts
  profiles.test.ts
  shadowEval.test.ts
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
- automatic cluster selection / auto-routing
- fork baselines for cluster consults
- automatic distillation from existing v1 sessions into cluster factsheets
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

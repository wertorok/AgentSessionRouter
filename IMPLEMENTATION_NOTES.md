# IMPLEMENTATION_NOTES.md

## Understanding

- `SPEC.md` exists in the repository root and is the source of truth.
- Node.js is available as `v22.18.0`, which satisfies the target runtime requirement `Node.js >=20`; npm is available as `11.5.2`.
- The implementation is a TypeScript/Node MCP server that routes parent-agent questions to persistent Claude CLI sessions through a durable SQLite registry.
- The MVP exposes exactly five tools: `claude_sessions_list`, `claude_consult`, `claude_session_archive`, `claude_session_inspect`, and `claude_router_reset`.
- Claude CLI is required; Codex CLI is optional and only relevant for optional integration/local workflows.
- `claude_consult.session_id: null` means auto-route first within the same project using eligible active/dormant sessions, then create a new Claude session only if no candidate reaches `threshold_low_confidence`, default `0.55`.
- The local registry is authoritative for compact architectural memory. Claude resumed memory is helpful but not authoritative.
- Decisions are append-only; summary is replaceable; files, tags, and aliases merge/dedupe.
- Consult-like events are exactly `consult` and `new_session` for cost limits and parse-failure threshold logic.
- Relative config paths resolve relative to the config file directory, not process cwd.
- stdout is reserved for MCP transport; operational logging must go to stderr.

## Ambiguities

- The spec allows `open_questions` to be replace or merge. Conservative implementation decision: replace.
- The spec says to run a fixture resume probe if a stored test fixture session exists, but does not define fixture storage. Conservative implementation decision: skip fixture probe when absent and do not fail health because no fixture exists.
- Claude session file lookup is required, but exact Claude storage layout may vary by CLI version. Conservative implementation decision: isolate lookup in `claude.ts` and search the default Claude project/session areas without adding extra config knobs.
- MCP wire formatting is not specified beyond semantic JSON payloads. Conservative implementation decision: use the standard MCP SDK tool result format and put the spec JSON as the semantic payload.
- `COMPATIBILITY.md` used placeholder tested-version values during implementation. After live validation, Claude Code `2.1.138 (Claude Code)` was deliberately verified and recorded for release publication.

## Parking lot

- Embeddings-based routing.
- Multi-session merging or debate.
- Web dashboard.
- Distributed locking providers.
- Remote database.
- Automatic deletion or migration of Claude session files.
- Self-healing degraded mode.
- Optional live Claude verification scripts.
- Additional config files or scripts not required by the phase brief.

## Helper Review Summary

- Spec compliance review found and Phase 8 fixed: null-consult route resolution now happens under a topic lock, auto-routed resumes now check Claude session existence before `--resume`, recency is no longer hard-coded, punctuation is removed during token normalization, lifecycle maintenance runs at startup and daily, optional fixture resume probe is checked when `fixture_resume_session_id.txt` exists, archived parse-failure bootstrap preserves `parse_failure_threshold`, and `relevant_code` is capped to 200 lines in the prompt builder.
- Reliability review found and Phase 8 fixed: project-level cost checks are serialized so concurrent consults cannot all pass the same hourly/day counter, auto-route stale sessions recover as orphaned before resume, and same-timestamp parse-threshold windows use event ids for deterministic ordering.
- Remaining conservative choice: successful Claude-call persistence is not wrapped in one cross-cutting transaction because raw response file writes and SQLite writes cannot be made atomic together without adding out-of-spec infrastructure; SQLite metadata writes remain transaction-scoped where they mutate compact metadata.

## Final Compliance Notes

### Approved structural deviations

1. `src/db.ts`, `src/schema.sql`, and `src/schema.ts` were used instead of `src/db/schema.sql`, `src/db/migrations.ts`, and `src/db/client.ts`.
   Rationale: compact single-module DB layer; `src/schema.sql` preserves the schema artifact; `src/schema.ts` lets runtime load schema text without extra build/file-copy plumbing.
   Constraint: no schema behavior may diverge from SPEC §14.

2. `src/runtime.ts` was used instead of `src/mode.ts`.
   Rationale: runtime state includes degraded mode plus config, DB, Claude adapter, locks, health probe application, lifecycle maintenance, and router reset.
   Constraint: degraded/normal mode behavior must remain byte-compatible with SPEC §19.3 and §4.5.

3. Tests are 16 tests across 3 files, covering the required targets by grouping multiple coverage targets per test file.
   Constraint: no real Claude CLI is invoked in automated tests.

## Phase 10 Live Claude Diagnosis

- Real Claude CLI output shape was validated with manual commands in `CLAUDE_LIVE_DIAGNOSIS.md`; the installed CLI returns JSON containing `session_id` and `result`, so the parser shape is compatible.
- Implementation change: `src/claude.ts` now treats Claude JSON `is_error: true` as a Claude invocation failure and surfaces the JSON `result` text in the error path, instead of obscuring it behind a generic process exit.
- Initial live blocker was external environment/billing state: the real adapter invocation returned `Credit balance is too low`; this was resolved by operator-side Claude re-login/credit remediation before Phase 11 live validation.

## Phase 11 Live MCP Hardening

- After Claude CLI re-login, the adapter path `claude -p --output-format json ping` passed with valid JSON, `session_id`, and `result`; bare-mode auth failures are diagnostic only because the MCP adapter does not use `--bare`.
- MCP error payloads now preserve spec error codes/messages and add diagnostic fields: `reason`, `category`, and `operator_action`, so clients can tell whether to fix auth, billing, command path, hooks, or output-shape compatibility.
- Live E2E exposed a parser fragility: Claude returned `SESSION_UPDATE_JSON` inside a fenced `json` block. The parser now accepts that live-shaped output while keeping the same sanitization caps and parse boundary.
- Final live verdict in `LIVE_E2E_REPORT.md`: `LIVE_CONSULT_PASS`; real Claude consult created a session, related null consult auto-routed to the existing session, unrelated null consult created a separate session, restart persistence worked, degraded-mode errors remained actionable.

## Post-Matrix Fixes

- Null consults now reuse an active/dormant session with the same normalized topic before falling back to threshold scoring. This prevents duplicate sessions for concurrent same-topic creation even when Claude has not yet produced enough tags/files/aliases to make the weighted score exceed `0.55`.
- Consult now revalidates the selected route after acquiring the per-session lock. If a session was archived or orphaned while the consult waited, the consult uses the fresh archived/orphan recovery path instead of reactivating stale state.
- `claude_session_archive` now uses the same per-session lock as consults, so archive and resume cannot write the same Claude session concurrently.
- Claude token metrics now read nested `usage.input_tokens` and `usage.output_tokens` from current Claude JSON output before falling back to estimates.
- Degraded-mode diagnostics now classify `You've hit your limit` as `claude_usage_limit` with an operator action that says to wait for the reset time or switch to an account with available usage.
- SESSION_UPDATE_JSON parsing now accepts the live Claude shape where the marker appears inside a fenced `json` block and ignores trailing prose/fence text after the first balanced JSON object.

## Operational Isolation Hardening

- Startup now logs `broad_cwd_warning` when the MCP process cwd is the filesystem root or the operator home directory; global MCP clients must set `cwd` to the target repository.
- Claude CLI invocations now honor `claude.command_timeout_ms` for version probes, health probes, and consult calls, preventing unbounded startup or tool-call hangs.
- `claude.extra_args` allows operator-managed Claude Code tool policy without hardcoding a policy in the router.
- Consult responses and `session_events` now surface `token_anomaly` when reported Claude input tokens exceed both the ratio and minimum-delta thresholds, which helps detect accidental context bleed without flagging normal Claude Code baseline overhead.
- `scripts/post-install-smoke.mjs` provides a stubbed post-install MCP smoke test that verifies project-scoped cwd inheritance, event persistence, raw log location, and optional Codex config cwd safety.

## Publication Readiness Review

- Helper documentation audit confirmed the release-facing docs needed verified compatibility, stale quota-note cleanup, generic MCP client paths, GitHub metadata, and post-fix live evidence in README.
- Helper regression audit found no remaining production code must-fix after `LIVE_TARGETED_RERUN.md`; it recommended hardening the targeted rerun assertion so archive/consult race validation also verifies replacement-session creation.
- Publication metadata now points at `https://github.com/wertorok/AgentSessionRouter` while keeping `"private": true` and `"license": "UNLICENSED"` until a license is deliberately chosen.
- The historical full live matrix recommendation remains in `LIVE_TEST_LOG.md`, with a post-fix note pointing to the targeted live rerun that validated the fixed production paths.
- Final targeted live rerun after parser hardening passed with 4 Haiku consult attempts: same-topic concurrent null consults, archive/consult serialization, and nested token metrics all passed with parsed session updates.

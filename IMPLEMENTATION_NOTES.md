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
- `COMPATIBILITY.md` must use placeholder tested-version values until deliberate release verification is performed.

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

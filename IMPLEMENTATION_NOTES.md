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

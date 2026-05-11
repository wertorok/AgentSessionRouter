# Live MCP E2E Report

## Environment

| Field | Value |
| --- | --- |
| OS | Windows_NT 10.0.26200 x64 |
| Node | v22.18.0 |
| npm | 11.5.2 |
| Claude CLI version | 2.1.131 (Claude Code) |
| Server command | node C:\Users\Davinchi\AgentSessionRouter\dist\src\index.js |
| DB path | C:\Users\Davinchi\AppData\Local\Temp\claude-router-live-e2e-tMOfoV\live-project\.claude-session-router\sessions.sqlite |
| Raw logs path | C:\Users\Davinchi\AppData\Local\Temp\claude-router-live-e2e-tMOfoV\live-project\.claude-session-router\raw |

## Health Probe Result

degraded

## Scenario Table

| scenario | expected | actual | pass | evidence |
| --- | --- | --- | --- | --- |
| claude_sessions_list | empty/current registry lists successfully | 0 session(s) | true | {"project_id":"live-project","sessions":[]} |
| claude_consult | creates a real session when Claude CLI is compatible | CLAUDE_INCOMPATIBLE: Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode. | true | {"error":{"code":"CLAUDE_INCOMPATIBLE","message":"Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.","tested_versions":[]}} |
| claude_consult | broken Claude command returns CLAUDE_INCOMPATIBLE | CLAUDE_INCOMPATIBLE: Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode. | true | {"error":{"code":"CLAUDE_INCOMPATIBLE","message":"Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.","tested_versions":["VERSION_A","VERSION_B","VERSION_C"]}} |
| claude_sessions_list | list still works in degraded mode | 1 session(s) | true | {"project_id":"live-project","sessions":[{"id":"seeded-degraded-session","claude_session_id":"seeded-degraded-claude-session","topic":"seeded degraded validation","status":"active","last_used":"2026-05-11T00:00:00.000Z","summary":"Seeded registry row for degraded-mode inspect/archive validation because live Claude consult could not create a session.","decisions":[],"open_questions":[],"files_discussed":[],"tags":[],"aliases":[]}]} |
| claude_session_inspect | inspect still works in degraded mode | inspect seeded-degraded-session | true | {"session":{"id":"seeded-degraded-session","claude_session_id":"seeded-degraded-claude-session","topic":"seeded degraded validation","status":"active","last_used":"2026-05-11T00:00:00.000Z","summary":"Seeded registry row for degraded-mode inspect/archive validation because live Claude consult could not create a session.","decisions":[],"open_questions":[],"files_discussed":[],"tags":[],"aliases":[],"project_id":"live-project","created_at":"2026-05-11T00:00:00.000Z"},"recent_events":[],"recent_ev |
| claude_session_archive | archive still works in degraded mode | {"ok":true,"status":"archived"} | true | {"ok":true,"status":"archived"} |
| claude_router_reset | router reset rejected while Claude command broken | ROUTER_RESET_REJECTED: Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again. | true | {"error":{"code":"ROUTER_RESET_REJECTED","message":"Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again."}} |

## Routing Metrics

No successful routing metrics were available.

## Latency/Token Metrics

| tool | duration_ms | is_error |
| --- | --- | --- |
| claude_sessions_list | 22 | false |
| claude_consult | 10 | true |
| claude_consult | 15 | true |
| claude_sessions_list | 8 | false |
| claude_session_inspect | 9 | false |
| claude_session_archive | 176 | false |
| claude_router_reset | 112 | true |

Token metrics from SQLite last events:

| event_type | duration_ms | tokens_in | tokens_out | match_score | was_new_session | error |
| --- | --- | --- | --- | --- | --- | --- |
| degraded_mode_entered |  |  |  |  | 0 | spawn definitely-missing-claude-command ENOENT |
| health_probe_failed |  |  |  |  | 0 | spawn definitely-missing-claude-command ENOENT |
| archive |  |  |  |  | 0 | Phase 9 degraded archive validation |
| degraded_mode_entered |  |  |  |  | 0 | spawn definitely-missing-claude-command ENOENT |
| health_probe_failed |  |  |  |  | 0 | spawn definitely-missing-claude-command ENOENT |
| degraded_mode_entered |  |  |  |  | 0 | Command failed: claude -p --output-format json ping<br>SessionEnd hook [node "${CLAUDE_PLUGIN_ROOT}/scripts/session-lifecycle-hook.mjs" SessionEnd] failed: Hook cancelled |
| health_probe_failed |  |  |  |  | 0 | Command failed: claude -p --output-format json ping<br>SessionEnd hook [node "${CLAUDE_PLUGIN_ROOT}/scripts/session-lifecycle-hook.mjs" SessionEnd] failed: Hook cancelled |

## Registry Metrics

Sessions by status:

| status | count |
| --- | --- |
| archived | 1 |

## Observability Metrics

Events by event_type:

| event_type | count |
| --- | --- |
| archive | 1 |
| degraded_mode_entered | 3 |
| health_probe_failed | 3 |

Last 10 events:

| created_at | event_type | match_score | match_reason | was_new_session | was_orphan_recovery | duration_ms | tokens_in | tokens_out | error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-11T17:57:06.420Z | degraded_mode_entered |  |  | 0 | 0 |  |  |  | spawn definitely-missing-claude-command ENOENT |
| 2026-05-11T17:57:06.338Z | health_probe_failed |  |  | 0 | 0 |  |  |  | spawn definitely-missing-claude-command ENOENT |
| 2026-05-11T17:57:06.313Z | archive |  |  | 0 | 0 |  |  |  | Phase 9 degraded archive validation |
| 2026-05-11T17:57:06.058Z | degraded_mode_entered |  |  | 0 | 0 |  |  |  | spawn definitely-missing-claude-command ENOENT |
| 2026-05-11T17:57:05.968Z | health_probe_failed |  |  | 0 | 0 |  |  |  | spawn definitely-missing-claude-command ENOENT |
| 2026-05-11T17:57:04.406Z | degraded_mode_entered |  |  | 0 | 0 |  |  |  | Command failed: claude -p --output-format json ping<br>SessionEnd hook [node "${CLAUDE_PLUGIN_ROOT}/scripts/session-lifecycle-hook.mjs" SessionEnd] failed: Hook cancelled |
| 2026-05-11T17:57:04.384Z | health_probe_failed |  |  | 0 | 0 |  |  |  | Command failed: claude -p --output-format json ping<br>SessionEnd hook [node "${CLAUDE_PLUGIN_ROOT}/scripts/session-lifecycle-hook.mjs" SessionEnd] failed: Hook cancelled |

## Final Verdict

DEGRADED_ONLY: Claude consults could not complete live, but degraded behavior and read-only tooling were validated. See scenario evidence for the blocking error.

## Evidence JSON

```json
{
  "createdSessionId": null,
  "createdClaudeSessionId": null,
  "secondSessionId": null,
  "unrelatedSessionId": null,
  "seededDegradedSessionId": "seeded-degraded-session",
  "evidence": [
    {
      "name": "list_tools",
      "payload": [
        "claude_sessions_list",
        "claude_session_inspect",
        "claude_consult",
        "claude_session_archive",
        "claude_router_reset"
      ]
    },
    {
      "name": "claude_sessions_list",
      "args": {
        "project_id": null
      },
      "payload": {
        "project_id": "live-project",
        "sessions": []
      }
    },
    {
      "name": "claude_consult",
      "args": {
        "project_id": null,
        "session_id": null,
        "topic_hint": "live auth routing validation",
        "trigger": "Phase 9 live E2E validation",
        "task": "Validate persistent routing for src/auth/live-e2e.ts",
        "relevant_code": "src/auth/live-e2e.ts\nexport const live = true;",
        "question": "For this live validation, confirm whether future related auth routing questions should reuse this session."
      },
      "payload": {
        "error": {
          "code": "CLAUDE_INCOMPATIBLE",
          "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
          "tested_versions": []
        }
      }
    },
    {
      "name": "seed_degraded_registry_session",
      "payload": {
        "session_id": "seeded-degraded-session",
        "reason": "Live Claude consult did not create a session; seed validates degraded read-only/archive tools against real SQLite registry state."
      }
    },
    {
      "name": "claude_consult",
      "args": {
        "project_id": "live-project",
        "session_id": null,
        "topic_hint": "broken degraded validation",
        "trigger": "Phase 9 live E2E validation",
        "task": "Validate degraded mode",
        "relevant_code": "",
        "question": "Should be blocked while Claude command is broken."
      },
      "payload": {
        "error": {
          "code": "CLAUDE_INCOMPATIBLE",
          "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
          "tested_versions": [
            "VERSION_A",
            "VERSION_B",
            "VERSION_C"
          ]
        }
      }
    },
    {
      "name": "claude_sessions_list",
      "args": {
        "project_id": "live-project",
        "include_archived": true
      },
      "payload": {
        "project_id": "live-project",
        "sessions": [
          {
            "id": "seeded-degraded-session",
            "claude_session_id": "seeded-degraded-claude-session",
            "topic": "seeded degraded validation",
            "status": "active",
            "last_used": "2026-05-11T00:00:00.000Z",
            "summary": "Seeded registry row for degraded-mode inspect/archive validation because live Claude consult could not create a session.",
            "decisions": [],
            "open_questions": [],
            "files_discussed": [],
            "tags": [],
            "aliases": []
          }
        ]
      }
    },
    {
      "name": "claude_session_inspect",
      "args": {
        "project_id": "live-project",
        "session_id": "seeded-degraded-session",
        "recent_events_limit": 5
      },
      "payload": {
        "session": {
          "id": "seeded-degraded-session",
          "claude_session_id": "seeded-degraded-claude-session",
          "topic": "seeded degraded validation",
          "status": "active",
          "last_used": "2026-05-11T00:00:00.000Z",
          "summary": "Seeded registry row for degraded-mode inspect/archive validation because live Claude consult could not create a session.",
          "decisions": [],
          "open_questions": [],
          "files_discussed": [],
          "tags": [],
          "aliases": [],
          "project_id": "live-project",
          "created_at": "2026-05-11T00:00:00.000Z"
        },
        "recent_events": [],
        "recent_events_note": "truncated; default returns up to 10 events, hard max 50"
      }
    },
    {
      "name": "claude_session_archive",
      "args": {
        "project_id": "live-project",
        "session_id": "seeded-degraded-session",
        "reason": "Phase 9 degraded archive validation"
      },
      "payload": {
        "ok": true,
        "status": "archived"
      }
    },
    {
      "name": "claude_router_reset",
      "args": {
        "reason": "Phase 9 broken reset validation"
      },
      "payload": {
        "error": {
          "code": "ROUTER_RESET_REJECTED",
          "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again."
        }
      }
    }
  ]
}
```

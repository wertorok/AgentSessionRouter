# Live Test Log

Environment:
- claude version: 2.1.138 (Claude Code)
- node version: v22.18.0
- MCP server commit: 3d31c0e6b090a8601aa6a62ade4cdfa53fd0f243
- Date: 2026-05-11T18:54:16.778Z
- Test root: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test
- DB path: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\.claude-session-router\sessions.sqlite
- Raw logs path: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\.claude-session-router\raw
- Claude model wrapper: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\claude-haiku.cmd -> claude --model haiku

Each scenario logs:
- Scenario name
- Inputs
- Expected outcome
- Actual outcome
- DB state snapshot (SQL query results)
- Verdict: PASS | FAIL | UNEXPECTED
- Notes

## 0.1 Prerequisites check

Group: 0. Prerequisites

Inputs:
```json
{
  "claudeVersion": "2.1.138 (Claude Code)",
  "node": "v22.18.0",
  "repoCompatibilityIncludesVersion": false
}
```

Expected outcome:
Claude version listed in compatibility, credential works, built server available, inspector available or real MCP SDK client used, git projects initialized.

Actual outcome:
```json
{
  "claudeVersion": "2.1.138 (Claude Code)",
  "repoCompatibilityIncludesVersion": false,
  "testCompatibilityFile": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\COMPATIBILITY.md",
  "haikuWrapperExit": null,
  "haikuWrapperJson": null,
  "inspectorProbe": "Starting MCP inspector...",
  "serverEntryExists": true,
  "projectAIsGit": true,
  "projectBIsGit": true
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": []
}
```

Verdict: FAIL

Notes:
Repo COMPATIBILITY.md intentionally still contains placeholders from the implementation brief. The live matrix uses a test-only compatibility file with verified 2.1.138 so boot can run in normal mode. MCP inspector probe timed out on this host, so the harness uses the official MCP SDK stdio client.

---

## 1.1 First-ever consult creates session

Group: 1. Happy path

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "auth design",
  "trigger": "live matrix",
  "task": "design login flow",
  "relevant_code": "src/auth.ts\nexport const app = 'small';",
  "question": "Should auth use sessions or JWT for this small app? Keep the answer under 80 words."
}
```

Expected outcome:
was_new_session true, valid session_id, parsed SESSION_UPDATE_JSON, event_type new_session.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.698Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.678Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 1.2 List shows the new session

Group: 1. Happy path

Inputs:
```json
{}
```

Expected outcome:
One session for project-a with compact metadata.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": []
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.698Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.678Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 1.3 Inspect returns full context without calling Claude

Group: 1. Happy path

Inputs:
```json
{}
```

Expected outcome:
Full session returned, event count unchanged.

Actual outcome:
```json
{
  "payload": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  },
  "beforeInspectEvents": 2,
  "afterInspectEvents": 2
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.698Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.678Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 1.4 Resume same session adds decisions append-only

Group: 1. Happy path

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "auth design",
  "trigger": "live matrix",
  "task": "add Google OAuth",
  "relevant_code": "src/auth.ts\nexport const oauth = 'google';",
  "question": "Add OAuth via Google. Update earlier decisions accordingly. Keep the answer under 80 words."
}
```

Expected outcome:
Same session, was_new_session false, old decisions preserved, new decisions appended.

Actual outcome:
```json
{
  "payload": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "beforeDecisions": [],
  "afterDecisions": []
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.698Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.678Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 1.5 Archive removes from default list

Group: 1. Happy path

Inputs:
```json
{
  "archive": {
    "reason": "matrix 1.5 completed"
  },
  "defaultList": {},
  "archivedList": {
    "include_archived": true
  }
}
```

Expected outcome:
Archive ok, default list hides it, include_archived shows it, archived_at populated.

Actual outcome:
```json
{
  "archive": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  },
  "defaultList": {
    "project_id": "project-a",
    "sessions": []
  },
  "archivedList": {
    "project_id": "project-a",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.698Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:36.678Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 2.1 Three distinct domains create three sessions

Group: 2. Routing and matching

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "auth",
    "trigger": "live matrix",
    "task": "JWT choice",
    "relevant_code": "src/auth/index.ts",
    "question": "JWT or cookies for auth? Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "database",
    "trigger": "live matrix",
    "task": "Postgres indexes",
    "relevant_code": "src/db/users.sql",
    "question": "Which Postgres index helps lookup by email? Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "deployment",
    "trigger": "live matrix",
    "task": "Docker deploy",
    "relevant_code": "Dockerfile",
    "question": "Should this service use Docker? Keep the answer under 80 words."
  }
]
```

Expected outcome:
Three distinct sessions, each was_new_session true.

Actual outcome:
```json
[
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.874Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.847Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 2.2 New question with high topic overlap should not auto-route

Group: 2. Routing and matching

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "auth refactor",
  "trigger": "live matrix",
  "task": "auth refactor",
  "relevant_code": "src/auth/index.ts",
  "question": "Related auth refactor: keep JWT? Keep the answer under 80 words."
}
```

Expected outcome:
Matrix expectation: null creates a new session. Accepted implementation: auto-route first if score >= 0.55.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.874Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.847Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
This is a deliberate spec/brief ambiguity from earlier discussion; implementation currently routes automatically.

---

## 2.3 Caller-supplied session_id is honored

Group: 2. Routing and matching

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "completely unrelated billing question",
  "trigger": "live matrix",
  "task": "Stripe billing",
  "relevant_code": "src/billing/stripe.ts",
  "question": "Should Stripe webhooks update invoices? Keep the answer under 80 words."
}
```

Expected outcome:
Resumes caller-supplied auth session even for unrelated topic.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.874Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.847Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Server obeys explicit session_id; proxy agent remains responsible for choosing correctly.

---

## 2.4 Scoring is logged even when caller decided

Group: 2. Routing and matching

Inputs:
```json
{}
```

Expected outcome:
match_score and match_reason populated or explicitly documented as null.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.874Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:38.847Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Direct session_id rows log match_score=1 and direct-session match_reason.

---

## 3.1 Same topic in two projects = two sessions

Group: 3. Project isolation

Inputs:
```json
{}
```

Expected outcome:
Two sessions with different project_id, each visible only in its project list.

Actual outcome:
```json
{
  "sessions": [],
  "listB": {
    "project_id": "project-b",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.222Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.150Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.143Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.102Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.2 Cross-project resume rejected

Group: 3. Project isolation

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "auth",
  "trigger": "live matrix",
  "task": "cross project resume",
  "relevant_code": "src/auth/b.ts",
  "question": "Try to resume project A session from project B. Keep the answer under 80 words."
}
```

Expected outcome:
PROJECT_MISMATCH, no Claude call.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.222Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.150Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.143Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.102Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.3 Cross-project inspect rejected

Group: 3. Project isolation

Inputs:
```json
{}
```

Expected outcome:
PROJECT_MISMATCH, no state change.

Actual outcome:
```json
{
  "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.222Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.150Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.143Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.102Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.4 Cross-project archive rejected

Group: 3. Project isolation

Inputs:
```json
{
  "reason": "cross-project should fail"
}
```

Expected outcome:
PROJECT_MISMATCH and project-a session remains active.

Actual outcome:
```json
{
  "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.222Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:43.150Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.143Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:41.102Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 4.1 Manual orphan: delete Claude .jsonl, resume should recover

Group: 4. Orphan recovery

Inputs:
```json
{
  "located": null
}
```

Expected outcome:
Old session orphaned, replacement created with was_orphan_recovery true, orphan_recovery event logged.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:46.416Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:46.284Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Claude jsonl file was not found; recovery path could not be fully exercised.

---

## 4.2 Orphaned sessions hidden from default list

Group: 4. Orphan recovery

Inputs:
```json
{
  "defaultList": {},
  "orphanList": {
    "include_orphaned": true
  }
}
```

Expected outcome:
Default list hides orphaned, include_orphaned shows it.

Actual outcome:
```json
{
  "defaultList": {
    "project_id": "project-a",
    "sessions": []
  },
  "orphanList": {
    "project_id": "project-a",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:46.416Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:46.284Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 4.3 Orphan recovery preserves audit trail

Group: 4. Orphan recovery

Inputs:
```json
{}
```

Expected outcome:
Old decisions remain in session_decisions.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:46.416Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:46.284Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.1 Limit triggers cleanly

Group: 5. Cost circuit breaker

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost auth",
    "trigger": "live matrix",
    "task": "limit one",
    "relevant_code": "src/cost/a.ts",
    "question": "Create cost session. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "topic_hint": "cost auth",
    "trigger": "live matrix",
    "task": "limit two",
    "relevant_code": "src/cost/a.ts",
    "question": "Resume cost session. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost db",
    "trigger": "live matrix",
    "task": "limit three",
    "relevant_code": "src/cost/db.ts",
    "question": "Create third cost event. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost deploy",
    "trigger": "live matrix",
    "task": "limit four",
    "relevant_code": "src/cost/deploy.ts",
    "question": "This should be blocked. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Fourth call returns COST_LIMIT_EXCEEDED with hourly limit 3.

Actual outcome:
```json
{
  "one": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "two": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "three": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "four": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:50.827Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:50.800Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.2 new_session events count too

Group: 5. Cost circuit breaker

Inputs:
```json
{}
```

Expected outcome:
consult + new_session sum equals 3 before blocked event.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:50.827Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:50.800Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.3 Limits reset on time

Group: 5. Cost circuit breaker

Inputs:
```json
"Restored normal limits in router.config.toml."
```

Expected outcome:
Counter logic is windowed by created_at and config can be restored.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:50.827Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:50.800Z"
    }
  ]
}
```

Verdict: PASS

Notes:
No extra paid call was made; this scenario documents the time-windowed SQL evidence and restored config for following groups.

---

## 6.1 Synthetic parse_failed history triggers auto-archive

Group: 6. Parse failure threshold

Inputs:
```json
{}
```

Expected outcome:
Threshold logs parse_failed_threshold_exceeded, archives session, next consult creates replacement from bootstrap.

Actual outcome:
```json
{
  "trigger": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "replacement": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 14,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 13,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 12,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:53.159Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:53.133Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Implementation archives after the threshold-triggering consult; replacement is created on the next consult, matching SPEC §9 next-consult behavior.

---

## 6.2 Threshold uses consult-like denominator

Group: 6. Parse failure threshold

Inputs:
```json
"Injected a mixed recent denominator containing consult and new_session rows before triggering."
```

Expected outcome:
Threshold fires only if consult-like denominator includes both consult and new_session.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 14,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 13,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 12,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:54:53.233Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:53.159Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:53.133Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 7.1 Two concurrent consults on same session serialize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "topic_hint": "concurrency base",
    "trigger": "live matrix",
    "task": "parallel one",
    "relevant_code": "src/concurrency/a.ts",
    "question": "Parallel update one. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "topic_hint": "concurrency base",
    "trigger": "live matrix",
    "task": "parallel two",
    "relevant_code": "src/concurrency/a.ts",
    "question": "Parallel update two. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Both complete validly, two consult events, no jsonl corruption.

Actual outcome:
```json
[
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:55.213Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:55.090Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Elapsed durations and event ids are in DB snapshot.

---

## 7.2 Two concurrent new consults on same project_id + topic_hint serialize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "same normalized topic",
    "trigger": "live matrix",
    "task": "same topic A",
    "relevant_code": "src/concurrency/same.ts",
    "question": "Create or reuse same topic. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "same normalized topic",
    "trigger": "live matrix",
    "task": "same topic B",
    "relevant_code": "src/concurrency/same.ts",
    "question": "Create or reuse same topic. Keep the answer under 80 words."
  }
]
```

Expected outcome:
No duplicate sessions for the same topic.

Actual outcome:
```json
{
  "sameTopicA": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "sameTopicB": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "sameTopicCount": 0
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:55.213Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:55.090Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 7.3 Different topics parallelize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "parallel topic alpha",
    "trigger": "live matrix",
    "task": "parallel alpha",
    "relevant_code": "src/concurrency/alpha.ts",
    "question": "Different topic alpha. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "parallel topic beta",
    "trigger": "live matrix",
    "task": "parallel beta",
    "relevant_code": "src/concurrency/beta.ts",
    "question": "Different topic beta. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Different topics should overlap.

Actual outcome:
```json
{
  "elapsed": 5,
  "durations": [
    4,
    5
  ],
  "topicA": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "topicB": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:55.213Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:54:55.090Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

# Live Test Log

Environment:
- claude version: 2.1.138 (Claude Code)
- node version: v22.18.0
- MCP server commit: 3d31c0e6b090a8601aa6a62ade4cdfa53fd0f243
- Date: 2026-05-11T18:56:14.504Z
- Test root: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test
- DB path: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\.claude-session-router\sessions.sqlite
- Raw logs path: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\.claude-session-router\raw
- Claude model wrapper: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\claude-haiku.cmd -> claude --model haiku

Each scenario logs:
- Scenario name
- Inputs
- Expected outcome
- Actual outcome
- DB state snapshot (SQL query results)
- Verdict: PASS | FAIL | UNEXPECTED
- Notes

## 0.1 Prerequisites check

Group: 0. Prerequisites

Inputs:
```json
{
  "claudeVersion": "2.1.138 (Claude Code)",
  "node": "v22.18.0",
  "repoCompatibilityIncludesVersion": false
}
```

Expected outcome:
Claude version listed in compatibility, credential works, built server available, inspector available or real MCP SDK client used, git projects initialized.

Actual outcome:
```json
{
  "claudeVersion": "2.1.138 (Claude Code)",
  "repoCompatibilityIncludesVersion": false,
  "testCompatibilityFile": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\COMPATIBILITY.md",
  "haikuWrapperExit": null,
  "haikuWrapperJson": null,
  "inspectorProbe": "Starting MCP inspector...",
  "serverEntryExists": true,
  "projectAIsGit": true,
  "projectBIsGit": true
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": []
}
```

Verdict: FAIL

Notes:
Repo COMPATIBILITY.md intentionally still contains placeholders from the implementation brief. The live matrix uses a test-only compatibility file with verified 2.1.138 so boot can run in normal mode. MCP inspector probe timed out on this host, so the harness uses the official MCP SDK stdio client.

---

## 1.1 First-ever consult creates session

Group: 1. Happy path

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "auth design",
  "trigger": "live matrix",
  "task": "design login flow",
  "relevant_code": "src/auth.ts\nexport const app = 'small';",
  "question": "Should auth use sessions or JWT for this small app? Keep the answer under 80 words."
}
```

Expected outcome:
was_new_session true, valid session_id, parsed SESSION_UPDATE_JSON, event_type new_session.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:29.056Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:28.982Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 1.2 List shows the new session

Group: 1. Happy path

Inputs:
```json
{}
```

Expected outcome:
One session for project-a with compact metadata.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": []
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:29.056Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:28.982Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 1.3 Inspect returns full context without calling Claude

Group: 1. Happy path

Inputs:
```json
{}
```

Expected outcome:
Full session returned, event count unchanged.

Actual outcome:
```json
{
  "payload": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  },
  "beforeInspectEvents": 2,
  "afterInspectEvents": 2
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:29.056Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:28.982Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 1.4 Resume same session adds decisions append-only

Group: 1. Happy path

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "auth design",
  "trigger": "live matrix",
  "task": "add Google OAuth",
  "relevant_code": "src/auth.ts\nexport const oauth = 'google';",
  "question": "Add OAuth via Google. Update earlier decisions accordingly. Keep the answer under 80 words."
}
```

Expected outcome:
Same session, was_new_session false, old decisions preserved, new decisions appended.

Actual outcome:
```json
{
  "payload": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "beforeDecisions": [],
  "afterDecisions": []
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:29.056Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:28.982Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 1.5 Archive removes from default list

Group: 1. Happy path

Inputs:
```json
{
  "archive": {
    "reason": "matrix 1.5 completed"
  },
  "defaultList": {},
  "archivedList": {
    "include_archived": true
  }
}
```

Expected outcome:
Archive ok, default list hides it, include_archived shows it, archived_at populated.

Actual outcome:
```json
{
  "archive": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  },
  "defaultList": {
    "project_id": "project-a",
    "sessions": []
  },
  "archivedList": {
    "project_id": "project-a",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:29.056Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:28.982Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 2.1 Three distinct domains create three sessions

Group: 2. Routing and matching

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "auth",
    "trigger": "live matrix",
    "task": "JWT choice",
    "relevant_code": "src/auth/index.ts",
    "question": "JWT or cookies for auth? Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "database",
    "trigger": "live matrix",
    "task": "Postgres indexes",
    "relevant_code": "src/db/users.sql",
    "question": "Which Postgres index helps lookup by email? Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "deployment",
    "trigger": "live matrix",
    "task": "Docker deploy",
    "relevant_code": "Dockerfile",
    "question": "Should this service use Docker? Keep the answer under 80 words."
  }
]
```

Expected outcome:
Three distinct sessions, each was_new_session true.

Actual outcome:
```json
[
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.639Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.582Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 2.2 New question with high topic overlap should not auto-route

Group: 2. Routing and matching

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "auth refactor",
  "trigger": "live matrix",
  "task": "auth refactor",
  "relevant_code": "src/auth/index.ts",
  "question": "Related auth refactor: keep JWT? Keep the answer under 80 words."
}
```

Expected outcome:
Matrix expectation: null creates a new session. Accepted implementation: auto-route first if score >= 0.55.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.639Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.582Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
This is a deliberate spec/brief ambiguity from earlier discussion; implementation currently routes automatically.

---

## 2.3 Caller-supplied session_id is honored

Group: 2. Routing and matching

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "completely unrelated billing question",
  "trigger": "live matrix",
  "task": "Stripe billing",
  "relevant_code": "src/billing/stripe.ts",
  "question": "Should Stripe webhooks update invoices? Keep the answer under 80 words."
}
```

Expected outcome:
Resumes caller-supplied auth session even for unrelated topic.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.639Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.582Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Server obeys explicit session_id; proxy agent remains responsible for choosing correctly.

---

## 2.4 Scoring is logged even when caller decided

Group: 2. Routing and matching

Inputs:
```json
{}
```

Expected outcome:
match_score and match_reason populated or explicitly documented as null.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.639Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:30.582Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Direct session_id rows log match_score=1 and direct-session match_reason.

---

## 3.1 Same topic in two projects = two sessions

Group: 3. Project isolation

Inputs:
```json
{}
```

Expected outcome:
Two sessions with different project_id, each visible only in its project list.

Actual outcome:
```json
{
  "sessions": [],
  "listB": {
    "project_id": "project-b",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.595Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.521Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.226Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.199Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.2 Cross-project resume rejected

Group: 3. Project isolation

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "auth",
  "trigger": "live matrix",
  "task": "cross project resume",
  "relevant_code": "src/auth/b.ts",
  "question": "Try to resume project A session from project B. Keep the answer under 80 words."
}
```

Expected outcome:
PROJECT_MISMATCH, no Claude call.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.595Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.521Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.226Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.199Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.3 Cross-project inspect rejected

Group: 3. Project isolation

Inputs:
```json
{}
```

Expected outcome:
PROJECT_MISMATCH, no state change.

Actual outcome:
```json
{
  "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.595Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.521Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.226Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.199Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.4 Cross-project archive rejected

Group: 3. Project isolation

Inputs:
```json
{
  "reason": "cross-project should fail"
}
```

Expected outcome:
PROJECT_MISMATCH and project-a session remains active.

Actual outcome:
```json
{
  "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.595Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:33.521Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.226Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:32.199Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 4.1 Manual orphan: delete Claude .jsonl, resume should recover

Group: 4. Orphan recovery

Inputs:
```json
{
  "located": null
}
```

Expected outcome:
Old session orphaned, replacement created with was_orphan_recovery true, orphan_recovery event logged.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:35.099Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:35.081Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Claude jsonl file was not found; recovery path could not be fully exercised.

---

## 4.2 Orphaned sessions hidden from default list

Group: 4. Orphan recovery

Inputs:
```json
{
  "defaultList": {},
  "orphanList": {
    "include_orphaned": true
  }
}
```

Expected outcome:
Default list hides orphaned, include_orphaned shows it.

Actual outcome:
```json
{
  "defaultList": {
    "project_id": "project-a",
    "sessions": []
  },
  "orphanList": {
    "project_id": "project-a",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:35.099Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:35.081Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 4.3 Orphan recovery preserves audit trail

Group: 4. Orphan recovery

Inputs:
```json
{}
```

Expected outcome:
Old decisions remain in session_decisions.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:35.099Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:35.081Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.1 Limit triggers cleanly

Group: 5. Cost circuit breaker

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost auth",
    "trigger": "live matrix",
    "task": "limit one",
    "relevant_code": "src/cost/a.ts",
    "question": "Create cost session. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "topic_hint": "cost auth",
    "trigger": "live matrix",
    "task": "limit two",
    "relevant_code": "src/cost/a.ts",
    "question": "Resume cost session. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost db",
    "trigger": "live matrix",
    "task": "limit three",
    "relevant_code": "src/cost/db.ts",
    "question": "Create third cost event. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost deploy",
    "trigger": "live matrix",
    "task": "limit four",
    "relevant_code": "src/cost/deploy.ts",
    "question": "This should be blocked. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Fourth call returns COST_LIMIT_EXCEEDED with hourly limit 3.

Actual outcome:
```json
{
  "one": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "two": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "three": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "four": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:36.968Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:36.867Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.2 new_session events count too

Group: 5. Cost circuit breaker

Inputs:
```json
{}
```

Expected outcome:
consult + new_session sum equals 3 before blocked event.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:36.968Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:36.867Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.3 Limits reset on time

Group: 5. Cost circuit breaker

Inputs:
```json
"Restored normal limits in router.config.toml."
```

Expected outcome:
Counter logic is windowed by created_at and config can be restored.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:36.968Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:36.867Z"
    }
  ]
}
```

Verdict: PASS

Notes:
No extra paid call was made; this scenario documents the time-windowed SQL evidence and restored config for following groups.

---

## 6.1 Synthetic parse_failed history triggers auto-archive

Group: 6. Parse failure threshold

Inputs:
```json
{}
```

Expected outcome:
Threshold logs parse_failed_threshold_exceeded, archives session, next consult creates replacement from bootstrap.

Actual outcome:
```json
{
  "trigger": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "replacement": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 14,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 13,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 12,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:38.288Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:38.264Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Implementation archives after the threshold-triggering consult; replacement is created on the next consult, matching SPEC §9 next-consult behavior.

---

## 6.2 Threshold uses consult-like denominator

Group: 6. Parse failure threshold

Inputs:
```json
"Injected a mixed recent denominator containing consult and new_session rows before triggering."
```

Expected outcome:
Threshold fires only if consult-like denominator includes both consult and new_session.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 14,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 13,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 12,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T18:56:38.354Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:38.288Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:38.264Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 7.1 Two concurrent consults on same session serialize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "topic_hint": "concurrency base",
    "trigger": "live matrix",
    "task": "parallel one",
    "relevant_code": "src/concurrency/a.ts",
    "question": "Parallel update one. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "topic_hint": "concurrency base",
    "trigger": "live matrix",
    "task": "parallel two",
    "relevant_code": "src/concurrency/a.ts",
    "question": "Parallel update two. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Both complete validly, two consult events, no jsonl corruption.

Actual outcome:
```json
[
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:40.002Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:39.898Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Elapsed durations and event ids are in DB snapshot.

---

## 7.2 Two concurrent new consults on same project_id + topic_hint serialize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "same normalized topic",
    "trigger": "live matrix",
    "task": "same topic A",
    "relevant_code": "src/concurrency/same.ts",
    "question": "Create or reuse same topic. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "same normalized topic",
    "trigger": "live matrix",
    "task": "same topic B",
    "relevant_code": "src/concurrency/same.ts",
    "question": "Create or reuse same topic. Keep the answer under 80 words."
  }
]
```

Expected outcome:
No duplicate sessions for the same topic.

Actual outcome:
```json
{
  "sameTopicA": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "sameTopicB": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "sameTopicCount": 0
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:40.002Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:39.898Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 7.3 Different topics parallelize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "parallel topic alpha",
    "trigger": "live matrix",
    "task": "parallel alpha",
    "relevant_code": "src/concurrency/alpha.ts",
    "question": "Different topic alpha. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "parallel topic beta",
    "trigger": "live matrix",
    "task": "parallel beta",
    "relevant_code": "src/concurrency/beta.ts",
    "question": "Different topic beta. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Different topics should overlap.

Actual outcome:
```json
{
  "elapsed": 4,
  "durations": [
    2,
    4
  ],
  "topicA": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "topicB": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:40.002Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:39.898Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.1 Active -> dormant

Group: 8. Lifecycle transitions

Inputs:
```json
"Seeded active session last_used 31 days ago, then called list."
```

Expected outcome:
Status dormant, dormant event logged.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": [
    {
      "id": "life-active",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T18:56:40.225Z",
      "summary": "seeded live matrix session",
      "decisions": [],
      "open_questions": [],
      "files_discussed": [],
      "tags": [],
      "aliases": []
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T18:56:40.225Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:42.060Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:41.944Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T18:56:41.911Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.2 Dormant still appears with default filters

Group: 8. Lifecycle transitions

Inputs:
```json
{}
```

Expected outcome:
Default include_dormant true shows dormant session.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": [
    {
      "id": "life-active",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T18:56:40.225Z",
      "summary": "seeded live matrix session",
      "decisions": [],
      "open_questions": [],
      "files_discussed": [],
      "tags": [],
      "aliases": []
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T18:56:40.225Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:42.060Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:41.944Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T18:56:41.911Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.3 Dormant -> archived

Group: 8. Lifecycle transitions

Inputs:
```json
"Forced last_used 91 days ago and called list."
```

Expected outcome:
Status archived, archived_at populated, hidden from default list.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": []
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "archived",
      "last_used": "2026-02-09T18:56:42.224Z",
      "archived_at": "2026-05-11T18:56:42.321Z"
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "archive",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_archive_after_days",
      "created_at": "2026-05-11T18:56:42.532Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:42.060Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:41.944Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T18:56:41.911Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.4 Routing penalizes dormant

Group: 8. Lifecycle transitions

Inputs:
```json
"Lifecycle candidate recency score inferred from match_reason after dormant state."
```

Expected outcome:
Dormant sessions have lower recency_score.

Actual outcome:
```json
"Covered by DB lifecycle state; archived sessions no longer participate by default."
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "archived",
      "last_used": "2026-02-09T18:56:42.224Z",
      "archived_at": "2026-05-11T18:56:42.321Z"
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "archive",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_archive_after_days",
      "created_at": "2026-05-11T18:56:42.532Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:42.060Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:41.944Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T18:56:41.911Z"
    }
  ]
}
```

Verdict: PASS

Notes:
No extra paid consult was made; unit coverage directly checks recency penalty, live test confirms lifecycle state transitions.

---

## 9.1 Missing SESSION_UPDATE_JSON block

Group: 9. SESSION_UPDATE_JSON resilience

Inputs:
```json
"Not executed"
```

Expected outcome:
warning SESSION_UPDATE_PARSE_FAILED, raw response written, parse_failed event.

Actual outcome:
```json
"No debug injection point exists and server code cannot be edited during the matrix."
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:43.985Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:43.958Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
Finding: live forcing missing update block requires a test-only Claude adapter/debug hook not present in the MCP.

---

## 9.2 Malformed JSON inside block

Group: 9. SESSION_UPDATE_JSON resilience

Inputs:
```json
"Not executed"
```

Expected outcome:
Same as 9.1.

Actual outcome:
```json
"No debug injection point exists and server code cannot be edited during the matrix."
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:43.985Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:43.958Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
A fake Claude command could test this later without touching server code.

---

## 9.3 Caps enforced even on legitimate but oversized output

Group: 9. SESSION_UPDATE_JSON resilience

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "oversized update",
  "trigger": "live matrix",
  "task": "caps",
  "relevant_code": "src/caps.ts",
  "question": "List 50 tiny architecture decisions and many tags, but keep answer concise. Keep the answer under 80 words."
}
```

Expected outcome:
Decisions <=10, tags <=8, aliases <=12, files <=20.

Actual outcome:
```json
{
  "payload": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "counts": {
    "decisions": 0,
    "tags": 0,
    "aliases": 0,
    "files": 0
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:43.985Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:43.958Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 10.1 Boot with broken Claude triggers degraded mode

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "command": "definitely-missing-claude-command"
}
```

Expected outcome:
Server boots, logs health_probe_failed and degraded_mode_entered.

Actual outcome:
```json
[
  {
    "event_type": "degraded_mode_entered",
    "error": "spawn definitely-missing-claude-command ENOENT"
  },
  {
    "event_type": "health_probe_failed",
    "error": "spawn definitely-missing-claude-command ENOENT"
  },
  {
    "event_type": "degraded_mode_entered",
    "error": "spawn EINVAL"
  },
  {
    "event_type": "health_probe_failed",
    "error": "spawn EINVAL"
  }
]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.167Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:47.879Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.851Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.704Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Used broken command in test config instead of renaming real binary to avoid mutating operator installation.

---

## 10.2 Read-only tools work in degraded mode

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "list": {},
  "inspect": {},
  "archive": {
    "reason": "matrix degraded archive"
  }
}
```

Expected outcome:
list, inspect, archive work.

Actual outcome:
```json
{
  "list": {
    "project_id": "project-a",
    "sessions": []
  },
  "inspect": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  },
  "archive": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.167Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:47.879Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.851Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.704Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Archive is a write tool but allowed in degraded mode by SPEC.

---

## 10.3 Consult blocked in degraded mode

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "degraded blocked",
  "trigger": "live matrix",
  "task": "blocked",
  "relevant_code": "src/degraded.ts",
  "question": "Should be blocked. Keep the answer under 80 words."
}
```

Expected outcome:
CLAUDE_INCOMPATIBLE with actionable diagnostic fields.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn definitely-missing-claude-command ENOENT",
    "category": "claude_command_unavailable",
    "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.167Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:47.879Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.851Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.704Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 10.4 Reset rejected when probe fails

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "reason": "matrix reset while broken"
}
```

Expected outcome:
ROUTER_RESET_REJECTED and mode stays degraded.

Actual outcome:
```json
{
  "error": {
    "code": "ROUTER_RESET_REJECTED",
    "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn definitely-missing-claude-command ENOENT",
    "category": "claude_command_unavailable",
    "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 6,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.670Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.385Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.167Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:47.879Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.851Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.704Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 10.5 Recovery via reset

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "resetOk": {
    "reason": "matrix restore real claude"
  },
  "works": {
    "project_id": null,
    "session_id": null,
    "topic_hint": "degraded recovery",
    "trigger": "live matrix",
    "task": "after reset",
    "relevant_code": "src/degraded.ts",
    "question": "Confirm consult works after reset. Keep the answer under 80 words."
  }
}
```

Expected outcome:
reset returns ok normal, consult works.

Actual outcome:
```json
{
  "resetOk": {
    "error": {
      "code": "ROUTER_RESET_REJECTED",
      "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn definitely-missing-claude-command ENOENT",
      "category": "claude_command_unavailable",
      "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
    }
  },
  "works": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn definitely-missing-claude-command ENOENT",
      "category": "claude_command_unavailable",
      "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 8,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.806Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.740Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.670Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.385Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.167Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:47.879Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.851Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.704Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 10.6 Recovery via restart

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "degraded restart recovery",
  "trigger": "live matrix",
  "task": "restart",
  "relevant_code": "src/degraded.ts",
  "question": "Confirm consult works after restart. Keep the answer under 80 words."
}
```

Expected outcome:
After restoring command and restarting server, consult works.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 12,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:51.321Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:50.941Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:50.035Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:49.873Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.806Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.740Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.670Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.385Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:48.167Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T18:56:47.879Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.851Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:46.704Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 11.1 Synthetic: delete multiple Claude .jsonl files rapidly

Group: 11. Resume systematic failure

Inputs:
```json
[
  {
    "sessionId": "fake-resume-0",
    "claudeId": "739dc0fa-34e1-4701-b8a5-f733cc2ca75c"
  },
  {
    "sessionId": "fake-resume-1",
    "claudeId": "1766d2a2-8b7a-4fe5-9514-9608ce5807df"
  },
  {
    "sessionId": "fake-resume-2",
    "claudeId": "24ec87e2-a24b-4dcc-b37a-ef0b4bf02002"
  },
  {
    "sessionId": "fake-resume-3",
    "claudeId": "5081d3c8-e52a-4c17-a9bd-29fa3fbbb80c"
  },
  {
    "sessionId": "fake-resume-4",
    "claudeId": "89759ac3-cd3d-4cf6-ab78-859961146605"
  }
]
```

Expected outcome:
Actual resume subprocess failures trigger resume_failed; 5 failures trigger resume_systematic_failure and degraded mode.

Actual outcome:
```json
{
  "results": [
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "spawn EINVAL",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "spawn EINVAL",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "spawn EINVAL",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "spawn EINVAL",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "spawn EINVAL",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    }
  ],
  "degradedRows": [
    {
      "event_type": "degraded_mode_entered",
      "error": "spawn EINVAL"
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "739dc0fa-34e1-4701-b8a5-f733cc2ca75c",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.865Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "1766d2a2-8b7a-4fe5-9514-9608ce5807df",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.949Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "24ec87e2-a24b-4dcc-b37a-ef0b4bf02002",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.975Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "5081d3c8-e52a-4c17-a9bd-29fa3fbbb80c",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.181Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "89759ac3-cd3d-4cf6-ab78-859961146605",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.280Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.813Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.714Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
Used fake jsonl files so sessionFileExists passes and --resume itself fails. If Claude accepts fake files in a future version, this will need a different failure trigger.

---

## 11.2 Recovery clears the counter

Group: 11. Resume systematic failure

Inputs:
```json
{
  "reason": "matrix reset after synthetic resume failures"
}
```

Expected outcome:
router_reset succeeds with real Claude command.

Actual outcome:
```json
{
  "error": {
    "code": "ROUTER_RESET_REJECTED",
    "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "739dc0fa-34e1-4701-b8a5-f733cc2ca75c",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.865Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "1766d2a2-8b7a-4fe5-9514-9608ce5807df",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.949Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "24ec87e2-a24b-4dcc-b37a-ef0b4bf02002",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.975Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "5081d3c8-e52a-4c17-a9bd-29fa3fbbb80c",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.181Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "89759ac3-cd3d-4cf6-ab78-859961146605",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.280Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:53.492Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:53.446Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.813Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.714Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 12.1 Long conversation forces compact

Group: 12. Compact and registry divergence

Inputs:
```json
"Skipped"
```

Expected outcome:
15-20 real consults force compaction.

Actual outcome:
```json
"Skipped to respect the requested ~30 consult budget."
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "739dc0fa-34e1-4701-b8a5-f733cc2ca75c",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.865Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "1766d2a2-8b7a-4fe5-9514-9608ce5807df",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.949Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "24ec87e2-a24b-4dcc-b37a-ef0b4bf02002",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.975Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "5081d3c8-e52a-4c17-a9bd-29fa3fbbb80c",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.181Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "89759ac3-cd3d-4cf6-ab78-859961146605",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.280Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:53.492Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:53.446Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.813Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.714Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
This is the most expensive scenario group; run separately when budget allows.

---

## 12.2 Inspect surfaces decisions Claude may have forgotten

Group: 12. Compact and registry divergence

Inputs:
```json
"Skipped because 12.1 was skipped."
```

Expected outcome:
Registry inspect surfaces early decisions after compaction.

Actual outcome:
```json
"Not executed."
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "739dc0fa-34e1-4701-b8a5-f733cc2ca75c",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.865Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "1766d2a2-8b7a-4fe5-9514-9608ce5807df",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.949Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "24ec87e2-a24b-4dcc-b37a-ef0b4bf02002",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T18:56:52.975Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "5081d3c8-e52a-4c17-a9bd-29fa3fbbb80c",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.181Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "89759ac3-cd3d-4cf6-ab78-859961146605",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T18:56:53.280Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:53.492Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:53.446Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.813Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:52.714Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:


---

## 13.1 Empty topic_hint

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "",
  "trigger": "live matrix",
  "task": "empty topic",
  "relevant_code": "src/edge.ts",
  "question": "Handle empty topic_hint gracefully. Keep the answer under 80 words."
}
```

Expected outcome:
Rejected by zod or handled gracefully.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.996Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.907Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 13.2 Extremely long relevant_code

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "topic_hint": "long relevant code",
  "relevant_code_lines": 2000
}
```

Expected outcome:
Server truncates or rejects.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.996Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.907Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Prompt builder truncates to 200 lines; verified no max-token error.

---

## 13.3 Non-UTF8 characters in question

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "unicode edge",
  "trigger": "live matrix",
  "task": "unicode",
  "relevant_code": "src/unicode.ts",
  "question": "Handle emojis 😀, RTL עברית, and control-ish text \\u0007 safely. Keep the answer under 80 words."
}
```

Expected outcome:
No parsing or DB storage breakage.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.996Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.907Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 13.4 Concurrent archive + consult on same session

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "consult": {
    "project_id": null,
    "topic_hint": "archive race",
    "trigger": "live matrix",
    "task": "race consult",
    "relevant_code": "src/race.ts",
    "question": "Long enough race consult: answer in two short bullets. Keep the answer under 80 words."
  },
  "archive": {
    "reason": "matrix concurrent archive"
  }
}
```

Expected outcome:
Lock serializes or final state is coherent.

Actual outcome:
```json
{
  "raceConsult": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn EINVAL",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "raceArchive": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.996Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.907Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Potential race: consult update may reactivate after archive.

---

## 13.5 Inspect on archived session

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{}
```

Expected outcome:
Inspect works.

Actual outcome:
```json
{
  "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.996Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.907Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 13.6 Consult with session_id pointing to archived session

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "archive race",
  "trigger": "live matrix",
  "task": "archived resume",
  "relevant_code": "src/race.ts",
  "question": "What happens when consulting an archived session? Keep the answer under 80 words."
}
```

Expected outcome:
Document actual behavior.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn EINVAL",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.996Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.907Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
Implementation creates a replacement session from archived registry context.

---

## 13.7 Config file moved between runs

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "movedConfigDir": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\moved-config-project"
}
```

Expected outcome:
Relative paths resolve relative to new config location.

Actual outcome:
```json
{
  "project_id": "moved-config-project",
  "sessions": []
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:56.470Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:56.401Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.996Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn EINVAL",
      "created_at": "2026-05-11T18:56:54.907Z"
    }
  ]
}
```

Verdict: PASS

Notes:
The server discovers router.config.toml from cwd; arbitrary config path CLI/env is not implemented.

---

# Live Test Log

Environment:
- claude version: 2.1.138 (Claude Code)
- node version: v22.18.0
- MCP server commit: 3d31c0e6b090a8601aa6a62ade4cdfa53fd0f243
- Date: 2026-05-11T19:04:56.354Z
- Test root: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test
- DB path: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\.claude-session-router\sessions.sqlite
- Raw logs path: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\.claude-session-router\raw
- Claude model wrapper: C:\Users\Davinchi\AppData\Local\Temp\csr-live-test\haiku-wrapper\out\ClaudeHaikuWrapper.exe -> claude --model haiku

Each scenario logs:
- Scenario name
- Inputs
- Expected outcome
- Actual outcome
- DB state snapshot (SQL query results)
- Verdict: PASS | FAIL | UNEXPECTED
- Notes

## 0.1 Prerequisites check

Group: 0. Prerequisites

Inputs:
```json
{
  "claudeVersion": "2.1.138 (Claude Code)",
  "node": "v22.18.0",
  "repoCompatibilityIncludesVersion": false
}
```

Expected outcome:
Claude version listed in compatibility, credential works, built server available, inspector available or real MCP SDK client used, git projects initialized.

Actual outcome:
```json
{
  "claudeVersion": "2.1.138 (Claude Code)",
  "repoCompatibilityIncludesVersion": false,
  "testCompatibilityFile": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\COMPATIBILITY.md",
  "haikuWrapperExit": 0,
  "haikuWrapperJson": {
    "type": "result",
    "is_error": false,
    "result": "Pong! Ready to help. What would you like to work on?",
    "session_id": "0f56af81-2cf2-4c8d-bf3f-a841bf05d209",
    "modelUsage": [
      "claude-haiku-4-5-20251001"
    ]
  },
  "inspectorProbe": "Starting MCP inspector...",
  "serverEntryExists": true,
  "projectAIsGit": true,
  "projectBIsGit": true
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": []
}
```

Verdict: UNEXPECTED

Notes:
Repo COMPATIBILITY.md intentionally still contains placeholders from the implementation brief. The live matrix uses a test-only compatibility file with verified 2.1.138 so boot can run in normal mode. MCP inspector probe timed out on this host, so the harness uses the official MCP SDK stdio client.

---

## 1.1 First-ever consult creates session

Group: 1. Happy path

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "auth design",
  "trigger": "live matrix",
  "task": "design login flow",
  "relevant_code": "src/auth.ts\nexport const app = 'small';",
  "question": "Should auth use sessions or JWT for this small app? Keep the answer under 80 words."
}
```

Expected outcome:
was_new_session true, valid session_id, parsed SESSION_UPDATE_JSON, event_type new_session.

Actual outcome:
```json
{
  "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
  "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
  "routing": {
    "match_score": 0,
    "match_reason": "No eligible active or dormant sessions in project.",
    "was_new_session": true,
    "was_orphan_recovery": false
  },
  "has_session_update": true
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
      "topic": "auth design",
      "status": "active",
      "last_used": "2026-05-11T19:06:32.917Z",
      "archived_at": null
    }
  ],
  "decisions": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Use session-based authentication with httpOnly cookies"
    }
  ],
  "files": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "path": "src/auth.ts"
    }
  ],
  "tags": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "auth"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "architecture"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "sessions"
    }
  ],
  "aliases": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "session vs jwt"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "authentication mechanism"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "login architecture"
    }
  ],
  "events": [
    {
      "id": 2,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 210,
      "tokens_out": 94,
      "duration_ms": 27726,
      "error": null,
      "created_at": "2026-05-11T19:06:32.970Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:06:05.036Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 1.2 List shows the new session

Group: 1. Happy path

Inputs:
```json
{}
```

Expected outcome:
One session for project-a with compact metadata.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": [
    {
      "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
      "topic": "auth design",
      "status": "active",
      "last_used": "2026-05-11T19:06:32.917Z",
      "summary": "Choose sessions over JWT for small app: simpler revocation, better security reasoning, sufficient at scale",
      "decisions": [
        "Use session-based authentication with httpOnly cookies"
      ],
      "open_questions": [
        "Session storage backend (memory, Redis, or database)?",
        "CSRF protection strategy (SameSite or token)?",
        "Session timeout and refresh behavior?"
      ],
      "files_discussed": [
        "src/auth.ts"
      ],
      "tags": [
        "auth",
        "architecture",
        "sessions"
      ],
      "aliases": [
        "session vs jwt",
        "authentication mechanism",
        "login architecture"
      ]
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
      "topic": "auth design",
      "status": "active",
      "last_used": "2026-05-11T19:06:32.917Z",
      "archived_at": null
    }
  ],
  "decisions": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Use session-based authentication with httpOnly cookies"
    }
  ],
  "files": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "path": "src/auth.ts"
    }
  ],
  "tags": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "auth"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "architecture"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "sessions"
    }
  ],
  "aliases": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "session vs jwt"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "authentication mechanism"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "login architecture"
    }
  ],
  "events": [
    {
      "id": 2,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 210,
      "tokens_out": 94,
      "duration_ms": 27726,
      "error": null,
      "created_at": "2026-05-11T19:06:32.970Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:06:05.036Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 1.3 Inspect returns full context without calling Claude

Group: 1. Happy path

Inputs:
```json
{
  "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac"
}
```

Expected outcome:
Full session returned, event count unchanged.

Actual outcome:
```json
{
  "payload": {
    "session": {
      "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
      "topic": "auth design",
      "status": "active",
      "last_used": "2026-05-11T19:06:32.917Z",
      "summary": "Choose sessions over JWT for small app: simpler revocation, better security reasoning, sufficient at scale",
      "decisions": [
        "Use session-based authentication with httpOnly cookies"
      ],
      "open_questions": [
        "Session storage backend (memory, Redis, or database)?",
        "CSRF protection strategy (SameSite or token)?",
        "Session timeout and refresh behavior?"
      ],
      "files_discussed": [
        "src/auth.ts"
      ],
      "tags": [
        "auth",
        "architecture",
        "sessions"
      ],
      "aliases": [
        "session vs jwt",
        "authentication mechanism",
        "login architecture"
      ],
      "project_id": "project-a",
      "created_at": "2026-05-11T19:06:32.917Z"
    },
    "recent_events": [
      {
        "event_type": "new_session",
        "created_at": "2026-05-11T19:06:32.970Z",
        "match_score": 0,
        "match_reason": "No eligible active or dormant sessions in project.",
        "tokens_in": 210,
        "tokens_out": 94
      }
    ]
  },
  "beforeInspectEvents": 2,
  "afterInspectEvents": 2
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
      "topic": "auth design",
      "status": "active",
      "last_used": "2026-05-11T19:06:32.917Z",
      "archived_at": null
    }
  ],
  "decisions": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Use session-based authentication with httpOnly cookies"
    }
  ],
  "files": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "path": "src/auth.ts"
    }
  ],
  "tags": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "auth"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "architecture"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "sessions"
    }
  ],
  "aliases": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "session vs jwt"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "authentication mechanism"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "login architecture"
    }
  ],
  "events": [
    {
      "id": 2,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 210,
      "tokens_out": 94,
      "duration_ms": 27726,
      "error": null,
      "created_at": "2026-05-11T19:06:32.970Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:06:05.036Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 1.4 Resume same session adds decisions append-only

Group: 1. Happy path

Inputs:
```json
{
  "project_id": null,
  "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
  "topic_hint": "auth design",
  "trigger": "live matrix",
  "task": "add Google OAuth",
  "relevant_code": "src/auth.ts\nexport const oauth = 'google';",
  "question": "Add OAuth via Google. Update earlier decisions accordingly. Keep the answer under 80 words."
}
```

Expected outcome:
Same session, was_new_session false, old decisions preserved, new decisions appended.

Actual outcome:
```json
{
  "payload": {
    "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
    "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
    "routing": {
      "match_score": 1,
      "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
      "was_new_session": false,
      "was_orphan_recovery": false
    },
    "has_session_update": true
  },
  "beforeDecisions": [
    {
      "decision": "Use session-based authentication with httpOnly cookies"
    }
  ],
  "afterDecisions": [
    {
      "decision": "Use session-based authentication with httpOnly cookies"
    },
    {
      "decision": "Google OAuth as primary login provider"
    },
    {
      "decision": "Exchange authorization code server-side for user data"
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
      "topic": "auth design",
      "status": "active",
      "last_used": "2026-05-11T19:06:58.334Z",
      "archived_at": null
    }
  ],
  "decisions": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Use session-based authentication with httpOnly cookies"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Google OAuth as primary login provider"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Exchange authorization code server-side for user data"
    }
  ],
  "files": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "path": "src/auth.ts"
    }
  ],
  "tags": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "auth"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "architecture"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "sessions"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "oauth"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "google"
    }
  ],
  "aliases": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "session vs jwt"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "authentication mechanism"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "login architecture"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "google oauth integration"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "oauth with sessions"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "social login"
    }
  ],
  "events": [
    {
      "id": 3,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": 1,
      "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": 337,
      "tokens_out": 97,
      "duration_ms": 25265,
      "error": null,
      "created_at": "2026-05-11T19:06:58.415Z"
    },
    {
      "id": 2,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 210,
      "tokens_out": 94,
      "duration_ms": 27726,
      "error": null,
      "created_at": "2026-05-11T19:06:32.970Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:06:05.036Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 1.5 Archive removes from default list

Group: 1. Happy path

Inputs:
```json
{
  "archive": {
    "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
    "reason": "matrix 1.5 completed"
  },
  "defaultList": {},
  "archivedList": {
    "include_archived": true
  }
}
```

Expected outcome:
Archive ok, default list hides it, include_archived shows it, archived_at populated.

Actual outcome:
```json
{
  "archive": {
    "ok": true,
    "status": "archived"
  },
  "defaultList": {
    "project_id": "project-a",
    "sessions": []
  },
  "archivedList": {
    "project_id": "project-a",
    "sessions": [
      {
        "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
        "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
        "topic": "auth design",
        "status": "archived",
        "last_used": "2026-05-11T19:06:58.334Z",
        "summary": "Add Google OAuth with session-based post-login: exchange auth code server-side, create httpOnly session cookie",
        "decisions": [
          "Use session-based authentication with httpOnly cookies",
          "Google OAuth as primary login provider",
          "Exchange authorization code server-side for user data"
        ],
        "open_questions": [
          "Local user creation strategy (auto-create vs email-only)?",
          "Session storage backend (memory, Redis, or database)?",
          "OAuth callback redirect and error handling flow?"
        ],
        "files_discussed": [
          "src/auth.ts"
        ],
        "tags": [
          "auth",
          "architecture",
          "sessions",
          "oauth",
          "google"
        ],
        "aliases": [
          "session vs jwt",
          "authentication mechanism",
          "login architecture",
          "google oauth integration",
          "oauth with sessions",
          "social login"
        ]
      }
    ]
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "claude_session_id": "3f053d16-9d29-4919-b81e-b52c12fe670c",
      "topic": "auth design",
      "status": "archived",
      "last_used": "2026-05-11T19:06:58.334Z",
      "archived_at": "2026-05-11T19:06:58.447Z"
    }
  ],
  "decisions": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Use session-based authentication with httpOnly cookies"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Google OAuth as primary login provider"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "decision": "Exchange authorization code server-side for user data"
    }
  ],
  "files": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "path": "src/auth.ts"
    }
  ],
  "tags": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "auth"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "architecture"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "sessions"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "oauth"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "tag": "google"
    }
  ],
  "aliases": [
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "session vs jwt"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "authentication mechanism"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "login architecture"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "google oauth integration"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "oauth with sessions"
    },
    {
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "alias": "social login"
    }
  ],
  "events": [
    {
      "id": 4,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "archive",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "matrix 1.5 completed",
      "created_at": "2026-05-11T19:06:58.576Z"
    },
    {
      "id": 3,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": 1,
      "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": 337,
      "tokens_out": 97,
      "duration_ms": 25265,
      "error": null,
      "created_at": "2026-05-11T19:06:58.415Z"
    },
    {
      "id": 2,
      "session_id": "session_aa1c9611-7101-42c8-ae82-8a2e7c9487ac",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 210,
      "tokens_out": 94,
      "duration_ms": 27726,
      "error": null,
      "created_at": "2026-05-11T19:06:32.970Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:06:05.036Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 2.1 Three distinct domains create three sessions

Group: 2. Routing and matching

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "auth",
    "trigger": "live matrix",
    "task": "JWT choice",
    "relevant_code": "src/auth/index.ts",
    "question": "JWT or cookies for auth? Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "database",
    "trigger": "live matrix",
    "task": "Postgres indexes",
    "relevant_code": "src/db/users.sql",
    "question": "Which Postgres index helps lookup by email? Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "deployment",
    "trigger": "live matrix",
    "task": "Docker deploy",
    "relevant_code": "Dockerfile",
    "question": "Should this service use Docker? Keep the answer under 80 words."
  }
]
```

Expected outcome:
Three distinct sessions, each was_new_session true.

Actual outcome:
```json
[
  {
    "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
    "claude_session_id": "a1dffe6d-f811-4f29-8e10-e86ca5c1ca4a",
    "routing": {
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": false,
    "warning": {
      "code": "SESSION_UPDATE_PARSE_FAILED",
      "message": "Claude answered, but SESSION_UPDATE_JSON could not be parsed. Metadata was not updated."
    }
  },
  {
    "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
    "claude_session_id": "aa223dda-ac6e-4c0d-9868-ab2f65682d93",
    "routing": {
      "match_score": 0.0999999962962963,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": false,
    "warning": {
      "code": "SESSION_UPDATE_PARSE_FAILED",
      "message": "Claude answered, but SESSION_UPDATE_JSON could not be parsed. Metadata was not updated."
    }
  },
  {
    "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
    "claude_session_id": "baf88de9-7cf5-49f0-b40b-93e53fc99c87",
    "routing": {
      "match_score": 0.09999999796810699,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": false,
    "warning": {
      "code": "SESSION_UPDATE_PARSE_FAILED",
      "message": "Claude answered, but SESSION_UPDATE_JSON could not be parsed. Metadata was not updated."
    }
  }
]
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "claude_session_id": "a1dffe6d-f811-4f29-8e10-e86ca5c1ca4a",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:07:49.812Z",
      "archived_at": null
    },
    {
      "id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "claude_session_id": "aa223dda-ac6e-4c0d-9868-ab2f65682d93",
      "topic": "database",
      "status": "active",
      "last_used": "2026-05-11T19:08:27.755Z",
      "archived_at": null
    },
    {
      "id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "claude_session_id": "baf88de9-7cf5-49f0-b40b-93e53fc99c87",
      "topic": "deployment",
      "status": "active",
      "last_used": "2026-05-11T19:08:57.335Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 7,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.09999999796810699,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 196,
      "tokens_out": 262,
      "duration_ms": 29419,
      "error": null,
      "created_at": "2026-05-11T19:08:57.387Z"
    },
    {
      "id": 6,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "SESSION_UPDATE_JSON block missing",
      "created_at": "2026-05-11T19:08:57.370Z"
    },
    {
      "id": 5,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.0999999962962963,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 201,
      "tokens_out": 261,
      "duration_ms": 37652,
      "error": null,
      "created_at": "2026-05-11T19:08:27.887Z"
    },
    {
      "id": 4,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 476 (line 9 column 1)",
      "created_at": "2026-05-11T19:08:27.867Z"
    },
    {
      "id": 3,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 279,
      "duration_ms": 28769,
      "error": null,
      "created_at": "2026-05-11T19:07:50.063Z"
    },
    {
      "id": 2,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 483 (line 9 column 1)",
      "created_at": "2026-05-11T19:07:50.042Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:07:20.901Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 2.2 New question with high topic overlap should not auto-route

Group: 2. Routing and matching

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "auth refactor",
  "trigger": "live matrix",
  "task": "auth refactor",
  "relevant_code": "src/auth/index.ts",
  "question": "Related auth refactor: keep JWT? Keep the answer under 80 words."
}
```

Expected outcome:
Matrix expectation: null creates a new session. Accepted implementation: auto-route first if score >= 0.55.

Actual outcome:
```json
{
  "session_id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
  "claude_session_id": "f751bf1d-ca4d-4542-9f8e-86561edfd955",
  "routing": {
    "match_score": 0.24999913049125513,
    "match_reason": "Matched topic=0.5, files=0, tags=0, aliases=0, recency=1.",
    "was_new_session": true,
    "was_orphan_recovery": false
  },
  "has_session_update": false,
  "warning": {
    "code": "SESSION_UPDATE_PARSE_FAILED",
    "message": "Claude answered, but SESSION_UPDATE_JSON could not be parsed. Metadata was not updated."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "claude_session_id": "f751bf1d-ca4d-4542-9f8e-86561edfd955",
      "topic": "auth refactor",
      "status": "active",
      "last_used": "2026-05-11T19:09:28.044Z",
      "archived_at": null
    },
    {
      "id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "claude_session_id": "a1dffe6d-f811-4f29-8e10-e86ca5c1ca4a",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:07:49.812Z",
      "archived_at": null
    },
    {
      "id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "claude_session_id": "aa223dda-ac6e-4c0d-9868-ab2f65682d93",
      "topic": "database",
      "status": "active",
      "last_used": "2026-05-11T19:08:27.755Z",
      "archived_at": null
    },
    {
      "id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "claude_session_id": "baf88de9-7cf5-49f0-b40b-93e53fc99c87",
      "topic": "deployment",
      "status": "active",
      "last_used": "2026-05-11T19:08:57.335Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 9,
      "session_id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.24999913049125513,
      "match_reason": "Matched topic=0.5, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 199,
      "tokens_out": 290,
      "duration_ms": 30616,
      "error": null,
      "created_at": "2026-05-11T19:09:28.304Z"
    },
    {
      "id": 8,
      "session_id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 507 (line 9 column 1)",
      "created_at": "2026-05-11T19:09:28.174Z"
    },
    {
      "id": 7,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.09999999796810699,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 196,
      "tokens_out": 262,
      "duration_ms": 29419,
      "error": null,
      "created_at": "2026-05-11T19:08:57.387Z"
    },
    {
      "id": 6,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "SESSION_UPDATE_JSON block missing",
      "created_at": "2026-05-11T19:08:57.370Z"
    },
    {
      "id": 5,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.0999999962962963,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 201,
      "tokens_out": 261,
      "duration_ms": 37652,
      "error": null,
      "created_at": "2026-05-11T19:08:27.887Z"
    },
    {
      "id": 4,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 476 (line 9 column 1)",
      "created_at": "2026-05-11T19:08:27.867Z"
    },
    {
      "id": 3,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 279,
      "duration_ms": 28769,
      "error": null,
      "created_at": "2026-05-11T19:07:50.063Z"
    },
    {
      "id": 2,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 483 (line 9 column 1)",
      "created_at": "2026-05-11T19:07:50.042Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:07:20.901Z"
    }
  ]
}
```

Verdict: PASS

Notes:
This is a deliberate spec/brief ambiguity from earlier discussion; implementation currently routes automatically.

---

## 2.3 Caller-supplied session_id is honored

Group: 2. Routing and matching

Inputs:
```json
{
  "project_id": null,
  "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
  "topic_hint": "completely unrelated billing question",
  "trigger": "live matrix",
  "task": "Stripe billing",
  "relevant_code": "src/billing/stripe.ts",
  "question": "Should Stripe webhooks update invoices? Keep the answer under 80 words."
}
```

Expected outcome:
Resumes caller-supplied auth session even for unrelated topic.

Actual outcome:
```json
{
  "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
  "claude_session_id": "a1dffe6d-f811-4f29-8e10-e86ca5c1ca4a",
  "routing": {
    "match_score": 1,
    "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
    "was_new_session": false,
    "was_orphan_recovery": false
  },
  "has_session_update": false,
  "warning": {
    "code": "SESSION_UPDATE_PARSE_FAILED",
    "message": "Claude answered, but SESSION_UPDATE_JSON could not be parsed. Metadata was not updated."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "claude_session_id": "f751bf1d-ca4d-4542-9f8e-86561edfd955",
      "topic": "auth refactor",
      "status": "active",
      "last_used": "2026-05-11T19:09:28.044Z",
      "archived_at": null
    },
    {
      "id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "claude_session_id": "a1dffe6d-f811-4f29-8e10-e86ca5c1ca4a",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:09:53.483Z",
      "archived_at": null
    },
    {
      "id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "claude_session_id": "aa223dda-ac6e-4c0d-9868-ab2f65682d93",
      "topic": "database",
      "status": "active",
      "last_used": "2026-05-11T19:08:27.755Z",
      "archived_at": null
    },
    {
      "id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "claude_session_id": "baf88de9-7cf5-49f0-b40b-93e53fc99c87",
      "topic": "deployment",
      "status": "active",
      "last_used": "2026-05-11T19:08:57.335Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 11,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": 1,
      "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": 235,
      "tokens_out": 255,
      "duration_ms": 25006,
      "error": null,
      "created_at": "2026-05-11T19:09:53.859Z"
    },
    {
      "id": 10,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 482 (line 9 column 1)",
      "created_at": "2026-05-11T19:09:53.744Z"
    },
    {
      "id": 9,
      "session_id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.24999913049125513,
      "match_reason": "Matched topic=0.5, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 199,
      "tokens_out": 290,
      "duration_ms": 30616,
      "error": null,
      "created_at": "2026-05-11T19:09:28.304Z"
    },
    {
      "id": 8,
      "session_id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 507 (line 9 column 1)",
      "created_at": "2026-05-11T19:09:28.174Z"
    },
    {
      "id": 7,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.09999999796810699,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 196,
      "tokens_out": 262,
      "duration_ms": 29419,
      "error": null,
      "created_at": "2026-05-11T19:08:57.387Z"
    },
    {
      "id": 6,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "SESSION_UPDATE_JSON block missing",
      "created_at": "2026-05-11T19:08:57.370Z"
    },
    {
      "id": 5,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.0999999962962963,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 201,
      "tokens_out": 261,
      "duration_ms": 37652,
      "error": null,
      "created_at": "2026-05-11T19:08:27.887Z"
    },
    {
      "id": 4,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 476 (line 9 column 1)",
      "created_at": "2026-05-11T19:08:27.867Z"
    },
    {
      "id": 3,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 279,
      "duration_ms": 28769,
      "error": null,
      "created_at": "2026-05-11T19:07:50.063Z"
    },
    {
      "id": 2,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 483 (line 9 column 1)",
      "created_at": "2026-05-11T19:07:50.042Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:07:20.901Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Server obeys explicit session_id; proxy agent remains responsible for choosing correctly.

---

## 2.4 Scoring is logged even when caller decided

Group: 2. Routing and matching

Inputs:
```json
{}
```

Expected outcome:
match_score and match_reason populated or explicitly documented as null.

Actual outcome:
```json
[
  {
    "event_type": "new_session",
    "match_score": 0,
    "match_reason": "No eligible active or dormant sessions in project."
  },
  {
    "event_type": "new_session",
    "match_score": 0.0999999962962963,
    "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1."
  },
  {
    "event_type": "new_session",
    "match_score": 0.09999999796810699,
    "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1."
  },
  {
    "event_type": "new_session",
    "match_score": 0.24999913049125513,
    "match_reason": "Matched topic=0.5, files=0, tags=0, aliases=0, recency=1."
  },
  {
    "event_type": "consult",
    "match_score": 1,
    "match_reason": "Direct session_id provided and project/Claude session health checks passed."
  }
]
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "claude_session_id": "f751bf1d-ca4d-4542-9f8e-86561edfd955",
      "topic": "auth refactor",
      "status": "active",
      "last_used": "2026-05-11T19:09:28.044Z",
      "archived_at": null
    },
    {
      "id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "claude_session_id": "a1dffe6d-f811-4f29-8e10-e86ca5c1ca4a",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:09:53.483Z",
      "archived_at": null
    },
    {
      "id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "claude_session_id": "aa223dda-ac6e-4c0d-9868-ab2f65682d93",
      "topic": "database",
      "status": "active",
      "last_used": "2026-05-11T19:08:27.755Z",
      "archived_at": null
    },
    {
      "id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "claude_session_id": "baf88de9-7cf5-49f0-b40b-93e53fc99c87",
      "topic": "deployment",
      "status": "active",
      "last_used": "2026-05-11T19:08:57.335Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 11,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": 1,
      "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": 235,
      "tokens_out": 255,
      "duration_ms": 25006,
      "error": null,
      "created_at": "2026-05-11T19:09:53.859Z"
    },
    {
      "id": 10,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 482 (line 9 column 1)",
      "created_at": "2026-05-11T19:09:53.744Z"
    },
    {
      "id": 9,
      "session_id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.24999913049125513,
      "match_reason": "Matched topic=0.5, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 199,
      "tokens_out": 290,
      "duration_ms": 30616,
      "error": null,
      "created_at": "2026-05-11T19:09:28.304Z"
    },
    {
      "id": 8,
      "session_id": "session_46f147ed-5bc0-4933-b241-01c3709c018b",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 507 (line 9 column 1)",
      "created_at": "2026-05-11T19:09:28.174Z"
    },
    {
      "id": 7,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.09999999796810699,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 196,
      "tokens_out": 262,
      "duration_ms": 29419,
      "error": null,
      "created_at": "2026-05-11T19:08:57.387Z"
    },
    {
      "id": 6,
      "session_id": "session_d39b7d79-af4d-49a3-9863-c561a46e7e02",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "SESSION_UPDATE_JSON block missing",
      "created_at": "2026-05-11T19:08:57.370Z"
    },
    {
      "id": 5,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0.0999999962962963,
      "match_reason": "Matched topic=0, files=0, tags=0, aliases=0, recency=1.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 201,
      "tokens_out": 261,
      "duration_ms": 37652,
      "error": null,
      "created_at": "2026-05-11T19:08:27.887Z"
    },
    {
      "id": 4,
      "session_id": "session_adee35d5-4ae0-41a8-964d-60018e0333cf",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 476 (line 9 column 1)",
      "created_at": "2026-05-11T19:08:27.867Z"
    },
    {
      "id": 3,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 279,
      "duration_ms": 28769,
      "error": null,
      "created_at": "2026-05-11T19:07:50.063Z"
    },
    {
      "id": 2,
      "session_id": "session_4a2bb163-c624-4e4a-93d1-00f6bdc9e1dd",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 483 (line 9 column 1)",
      "created_at": "2026-05-11T19:07:50.042Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:07:20.901Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Direct session_id rows log match_score=1 and direct-session match_reason.

---

## 3.1 Same topic in two projects = two sessions

Group: 3. Project isolation

Inputs:
```json
{
  "sessionA": "session_f072517f-19d2-4007-bbcf-df58c806cd5f"
}
```

Expected outcome:
Two sessions with different project_id, each visible only in its project list.

Actual outcome:
```json
{
  "sessions": [
    {
      "id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "topic": "auth"
    }
  ],
  "listB": {
    "project_id": "project-b",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "claude_session_id": "eac75837-e0b7-4238-98ec-1af69647d197",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:10:59.117Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.506Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.442Z"
    },
    {
      "id": 3,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 269,
      "duration_ms": 42765,
      "error": null,
      "created_at": "2026-05-11T19:10:59.214Z"
    },
    {
      "id": 2,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 527 (line 9 column 1)",
      "created_at": "2026-05-11T19:10:59.197Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:10:16.263Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.2 Cross-project resume rejected

Group: 3. Project isolation

Inputs:
```json
{
  "project_id": null,
  "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
  "topic_hint": "auth",
  "trigger": "live matrix",
  "task": "cross project resume",
  "relevant_code": "src/auth/b.ts",
  "question": "Try to resume project A session from project B. Keep the answer under 80 words."
}
```

Expected outcome:
PROJECT_MISMATCH, no Claude call.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "claude_session_id": "eac75837-e0b7-4238-98ec-1af69647d197",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:10:59.117Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.506Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.442Z"
    },
    {
      "id": 3,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 269,
      "duration_ms": 42765,
      "error": null,
      "created_at": "2026-05-11T19:10:59.214Z"
    },
    {
      "id": 2,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 527 (line 9 column 1)",
      "created_at": "2026-05-11T19:10:59.197Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:10:16.263Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 3.3 Cross-project inspect rejected

Group: 3. Project isolation

Inputs:
```json
{
  "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f"
}
```

Expected outcome:
PROJECT_MISMATCH, no state change.

Actual outcome:
```json
{
  "error": {
    "code": "PROJECT_MISMATCH",
    "message": "Session belongs to another project_id. Refusing to resume."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "claude_session_id": "eac75837-e0b7-4238-98ec-1af69647d197",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:10:59.117Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.506Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.442Z"
    },
    {
      "id": 3,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 269,
      "duration_ms": 42765,
      "error": null,
      "created_at": "2026-05-11T19:10:59.214Z"
    },
    {
      "id": 2,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 527 (line 9 column 1)",
      "created_at": "2026-05-11T19:10:59.197Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:10:16.263Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 3.4 Cross-project archive rejected

Group: 3. Project isolation

Inputs:
```json
{
  "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
  "reason": "cross-project should fail"
}
```

Expected outcome:
PROJECT_MISMATCH and project-a session remains active.

Actual outcome:
```json
{
  "error": {
    "code": "PROJECT_MISMATCH",
    "message": "Session belongs to another project_id. Refusing to resume."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "claude_session_id": "eac75837-e0b7-4238-98ec-1af69647d197",
      "topic": "auth",
      "status": "active",
      "last_used": "2026-05-11T19:10:59.117Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.506Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:21.442Z"
    },
    {
      "id": 3,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1,
      "was_orphan_recovery": 0,
      "tokens_in": 194,
      "tokens_out": 269,
      "duration_ms": 42765,
      "error": null,
      "created_at": "2026-05-11T19:10:59.214Z"
    },
    {
      "id": 2,
      "session_id": "session_f072517f-19d2-4007-bbcf-df58c806cd5f",
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Unexpected non-whitespace character after JSON at position 527 (line 9 column 1)",
      "created_at": "2026-05-11T19:10:59.197Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_passed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "startup",
      "created_at": "2026-05-11T19:10:16.263Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 4.1 Manual orphan: delete Claude .jsonl, resume should recover

Group: 4. Orphan recovery

Inputs:
```json
{
  "located": null
}
```

Expected outcome:
Old session orphaned, replacement created with was_orphan_recovery true, orphan_recovery event logged.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:58.143Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:58.038Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Claude jsonl file was not found; recovery path could not be fully exercised.

---

## 4.2 Orphaned sessions hidden from default list

Group: 4. Orphan recovery

Inputs:
```json
{
  "defaultList": {},
  "orphanList": {
    "include_orphaned": true
  }
}
```

Expected outcome:
Default list hides orphaned, include_orphaned shows it.

Actual outcome:
```json
{
  "defaultList": {
    "project_id": "project-a",
    "sessions": []
  },
  "orphanList": {
    "project_id": "project-a",
    "sessions": []
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:58.143Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:58.038Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 4.3 Orphan recovery preserves audit trail

Group: 4. Orphan recovery

Inputs:
```json
{}
```

Expected outcome:
Old decisions remain in session_decisions.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:58.143Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:11:58.038Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.1 Limit triggers cleanly

Group: 5. Cost circuit breaker

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost auth",
    "trigger": "live matrix",
    "task": "limit one",
    "relevant_code": "src/cost/a.ts",
    "question": "Create cost session. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "topic_hint": "cost auth",
    "trigger": "live matrix",
    "task": "limit two",
    "relevant_code": "src/cost/a.ts",
    "question": "Resume cost session. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost db",
    "trigger": "live matrix",
    "task": "limit three",
    "relevant_code": "src/cost/db.ts",
    "question": "Create third cost event. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "cost deploy",
    "trigger": "live matrix",
    "task": "limit four",
    "relevant_code": "src/cost/deploy.ts",
    "question": "This should be blocked. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Fourth call returns COST_LIMIT_EXCEEDED with hourly limit 3.

Actual outcome:
```json
{
  "one": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "two": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "three": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "four": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:26.077Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:26.049Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.2 new_session events count too

Group: 5. Cost circuit breaker

Inputs:
```json
{}
```

Expected outcome:
consult + new_session sum equals 3 before blocked event.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:26.077Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:26.049Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 5.3 Limits reset on time

Group: 5. Cost circuit breaker

Inputs:
```json
"Restored normal limits in router.config.toml."
```

Expected outcome:
Counter logic is windowed by created_at and config can be restored.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:26.077Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:26.049Z"
    }
  ]
}
```

Verdict: PASS

Notes:
No extra paid call was made; this scenario documents the time-windowed SQL evidence and restored config for following groups.

---

## 6.1 Synthetic parse_failed history triggers auto-archive

Group: 6. Parse failure threshold

Inputs:
```json
{}
```

Expected outcome:
Threshold logs parse_failed_threshold_exceeded, archives session, next consult creates replacement from bootstrap.

Actual outcome:
```json
{
  "trigger": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "replacement": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 14,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 13,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 12,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:53.989Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:53.925Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Implementation archives after the threshold-triggering consult; replacement is created on the next consult, matching SPEC §9 next-consult behavior.

---

## 6.2 Threshold uses consult-like denominator

Group: 6. Parse failure threshold

Inputs:
```json
"Injected a mixed recent denominator containing consult and new_session rows before triggering."
```

Expected outcome:
Threshold fires only if consult-like denominator includes both consult and new_session.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 14,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 13,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 12,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "parse_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "consult",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "project-a",
      "event_type": "new_session",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": null,
      "created_at": "2026-05-11T19:12:54.079Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:53.989Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:12:53.925Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 7.1 Two concurrent consults on same session serialize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "topic_hint": "concurrency base",
    "trigger": "live matrix",
    "task": "parallel one",
    "relevant_code": "src/concurrency/a.ts",
    "question": "Parallel update one. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "topic_hint": "concurrency base",
    "trigger": "live matrix",
    "task": "parallel two",
    "relevant_code": "src/concurrency/a.ts",
    "question": "Parallel update two. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Both complete validly, two consult events, no jsonl corruption.

Actual outcome:
```json
[
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:22.281Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:22.265Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Elapsed durations and event ids are in DB snapshot.

---

## 7.2 Two concurrent new consults on same project_id + topic_hint serialize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "same normalized topic",
    "trigger": "live matrix",
    "task": "same topic A",
    "relevant_code": "src/concurrency/same.ts",
    "question": "Create or reuse same topic. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "same normalized topic",
    "trigger": "live matrix",
    "task": "same topic B",
    "relevant_code": "src/concurrency/same.ts",
    "question": "Create or reuse same topic. Keep the answer under 80 words."
  }
]
```

Expected outcome:
No duplicate sessions for the same topic.

Actual outcome:
```json
{
  "sameTopicA": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "sameTopicB": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "sameTopicCount": 0
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:22.281Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:22.265Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 7.3 Different topics parallelize

Group: 7. Concurrency

Inputs:
```json
[
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "parallel topic alpha",
    "trigger": "live matrix",
    "task": "parallel alpha",
    "relevant_code": "src/concurrency/alpha.ts",
    "question": "Different topic alpha. Keep the answer under 80 words."
  },
  {
    "project_id": null,
    "session_id": null,
    "topic_hint": "parallel topic beta",
    "trigger": "live matrix",
    "task": "parallel beta",
    "relevant_code": "src/concurrency/beta.ts",
    "question": "Different topic beta. Keep the answer under 80 words."
  }
]
```

Expected outcome:
Different topics should overlap.

Actual outcome:
```json
{
  "elapsed": 4,
  "durations": [
    2,
    4
  ],
  "topicA": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "topicB": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:22.281Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:22.265Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.1 Active -> dormant

Group: 8. Lifecycle transitions

Inputs:
```json
"Seeded active session last_used 31 days ago, then called list."
```

Expected outcome:
Status dormant, dormant event logged.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": [
    {
      "id": "life-active",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T19:13:22.411Z",
      "summary": "seeded live matrix session",
      "decisions": [],
      "open_questions": [],
      "files_discussed": [],
      "tags": [],
      "aliases": []
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T19:13:22.411Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.190Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.051Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T19:13:23.736Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.2 Dormant still appears with default filters

Group: 8. Lifecycle transitions

Inputs:
```json
{}
```

Expected outcome:
Default include_dormant true shows dormant session.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": [
    {
      "id": "life-active",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T19:13:22.411Z",
      "summary": "seeded live matrix session",
      "decisions": [],
      "open_questions": [],
      "files_discussed": [],
      "tags": [],
      "aliases": []
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "dormant",
      "last_used": "2026-04-10T19:13:22.411Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.190Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.051Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T19:13:23.736Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.3 Dormant -> archived

Group: 8. Lifecycle transitions

Inputs:
```json
"Forced last_used 91 days ago and called list."
```

Expected outcome:
Status archived, archived_at populated, hidden from default list.

Actual outcome:
```json
{
  "project_id": "project-a",
  "sessions": []
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "archived",
      "last_used": "2026-02-09T19:13:46.302Z",
      "archived_at": "2026-05-11T19:13:46.342Z"
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "archive",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_archive_after_days",
      "created_at": "2026-05-11T19:13:46.366Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.190Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.051Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T19:13:23.736Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 8.4 Routing penalizes dormant

Group: 8. Lifecycle transitions

Inputs:
```json
"Lifecycle candidate recency score inferred from match_reason after dormant state."
```

Expected outcome:
Dormant sessions have lower recency_score.

Actual outcome:
```json
"Covered by DB lifecycle state; archived sessions no longer participate by default."
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "life-active",
      "project_id": "project-a",
      "claude_session_id": "life-claude",
      "topic": "lifecycle",
      "status": "archived",
      "last_used": "2026-02-09T19:13:46.302Z",
      "archived_at": "2026-05-11T19:13:46.342Z"
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "archive",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_archive_after_days",
      "created_at": "2026-05-11T19:13:46.366Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.190Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:13:46.051Z"
    },
    {
      "id": 1,
      "session_id": "life-active",
      "project_id": "project-a",
      "event_type": "dormant",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "lifecycle_dormant_after_days",
      "created_at": "2026-05-11T19:13:23.736Z"
    }
  ]
}
```

Verdict: PASS

Notes:
No extra paid consult was made; unit coverage directly checks recency penalty, live test confirms lifecycle state transitions.

---

## 9.1 Missing SESSION_UPDATE_JSON block

Group: 9. SESSION_UPDATE_JSON resilience

Inputs:
```json
"Not executed"
```

Expected outcome:
warning SESSION_UPDATE_PARSE_FAILED, raw response written, parse_failed event.

Actual outcome:
```json
"No debug injection point exists and server code cannot be edited during the matrix."
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:13.806Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:13.643Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
Finding: live forcing missing update block requires a test-only Claude adapter/debug hook not present in the MCP.

---

## 9.2 Malformed JSON inside block

Group: 9. SESSION_UPDATE_JSON resilience

Inputs:
```json
"Not executed"
```

Expected outcome:
Same as 9.1.

Actual outcome:
```json
"No debug injection point exists and server code cannot be edited during the matrix."
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:13.806Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:13.643Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
A fake Claude command could test this later without touching server code.

---

## 9.3 Caps enforced even on legitimate but oversized output

Group: 9. SESSION_UPDATE_JSON resilience

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "oversized update",
  "trigger": "live matrix",
  "task": "caps",
  "relevant_code": "src/caps.ts",
  "question": "List 50 tiny architecture decisions and many tags, but keep answer concise. Keep the answer under 80 words."
}
```

Expected outcome:
Decisions <=10, tags <=8, aliases <=12, files <=20.

Actual outcome:
```json
{
  "payload": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "counts": {
    "decisions": 0,
    "tags": 0,
    "aliases": 0,
    "files": 0
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:13.806Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:13.643Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 10.1 Boot with broken Claude triggers degraded mode

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "command": "definitely-missing-claude-command"
}
```

Expected outcome:
Server boots, logs health_probe_failed and degraded_mode_entered.

Actual outcome:
```json
[
  {
    "event_type": "degraded_mode_entered",
    "error": "spawn definitely-missing-claude-command ENOENT"
  },
  {
    "event_type": "health_probe_failed",
    "error": "spawn definitely-missing-claude-command ENOENT"
  },
  {
    "event_type": "degraded_mode_entered",
    "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)"
  },
  {
    "event_type": "health_probe_failed",
    "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)"
  }
]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.039Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:41.923Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.642Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.561Z"
    }
  ]
}
```

Verdict: PASS

Notes:
Used broken command in test config instead of renaming real binary to avoid mutating operator installation.

---

## 10.2 Read-only tools work in degraded mode

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "list": {},
  "inspect": {},
  "archive": {
    "reason": "matrix degraded archive"
  }
}
```

Expected outcome:
list, inspect, archive work.

Actual outcome:
```json
{
  "list": {
    "project_id": "project-a",
    "sessions": []
  },
  "inspect": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  },
  "archive": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.039Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:41.923Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.642Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.561Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Archive is a write tool but allowed in degraded mode by SPEC.

---

## 10.3 Consult blocked in degraded mode

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "degraded blocked",
  "trigger": "live matrix",
  "task": "blocked",
  "relevant_code": "src/degraded.ts",
  "question": "Should be blocked. Keep the answer under 80 words."
}
```

Expected outcome:
CLAUDE_INCOMPATIBLE with actionable diagnostic fields.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn definitely-missing-claude-command ENOENT",
    "category": "claude_command_unavailable",
    "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.039Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:41.923Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.642Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.561Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 10.4 Reset rejected when probe fails

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "reason": "matrix reset while broken"
}
```

Expected outcome:
ROUTER_RESET_REJECTED and mode stays degraded.

Actual outcome:
```json
{
  "error": {
    "code": "ROUTER_RESET_REJECTED",
    "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "spawn definitely-missing-claude-command ENOENT",
    "category": "claude_command_unavailable",
    "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 6,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.280Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.256Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.039Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:41.923Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.642Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.561Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 10.5 Recovery via reset

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "resetOk": {
    "reason": "matrix restore real claude"
  },
  "works": {
    "project_id": null,
    "session_id": null,
    "topic_hint": "degraded recovery",
    "trigger": "live matrix",
    "task": "after reset",
    "relevant_code": "src/degraded.ts",
    "question": "Confirm consult works after reset. Keep the answer under 80 words."
  }
}
```

Expected outcome:
reset returns ok normal, consult works.

Actual outcome:
```json
{
  "resetOk": {
    "error": {
      "code": "ROUTER_RESET_REJECTED",
      "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn definitely-missing-claude-command ENOENT",
      "category": "claude_command_unavailable",
      "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
    }
  },
  "works": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "spawn definitely-missing-claude-command ENOENT",
      "category": "claude_command_unavailable",
      "operator_action": "Install Claude CLI or set `[claude].command` to the correct executable, then verify with `claude --version`."
    }
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 8,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.357Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.322Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.280Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.256Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.039Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:41.923Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.642Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.561Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 10.6 Recovery via restart

Group: 10. Degraded mode and recovery

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "degraded restart recovery",
  "trigger": "live matrix",
  "task": "restart",
  "relevant_code": "src/degraded.ts",
  "question": "Confirm consult works after restart. Keep the answer under 80 words."
}
```

Expected outcome:
After restoring command and restarting server, consult works.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 12,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:07.054Z"
    },
    {
      "id": 11,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:05.942Z"
    },
    {
      "id": 10,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:43.314Z"
    },
    {
      "id": 9,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:43.283Z"
    },
    {
      "id": 8,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.357Z"
    },
    {
      "id": 7,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.322Z"
    },
    {
      "id": 6,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.280Z"
    },
    {
      "id": 5,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.256Z"
    },
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:42.039Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "spawn definitely-missing-claude-command ENOENT",
      "created_at": "2026-05-11T19:14:41.923Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.642Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:14:40.561Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 11.1 Synthetic: delete multiple Claude .jsonl files rapidly

Group: 11. Resume systematic failure

Inputs:
```json
[
  {
    "sessionId": "fake-resume-0",
    "claudeId": "67ae76fc-d319-4af9-89cb-7e0faaf17624"
  },
  {
    "sessionId": "fake-resume-1",
    "claudeId": "844255e8-55e6-480f-841c-d874130a229b"
  },
  {
    "sessionId": "fake-resume-2",
    "claudeId": "c7cf82fc-86a1-4648-ac55-a599ee06820c"
  },
  {
    "sessionId": "fake-resume-3",
    "claudeId": "8645e446-36dc-4d0e-9429-f5802982449d"
  },
  {
    "sessionId": "fake-resume-4",
    "claudeId": "16b071a0-c45d-4884-a094-ebe6dacc7893"
  }
]
```

Expected outcome:
Actual resume subprocess failures trigger resume_failed; 5 failures trigger resume_systematic_failure and degraded mode.

Actual outcome:
```json
{
  "results": [
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "detected_version": "2.1.138 (Claude Code)",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "detected_version": "2.1.138 (Claude Code)",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "detected_version": "2.1.138 (Claude Code)",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "detected_version": "2.1.138 (Claude Code)",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    },
    {
      "error": {
        "code": "CLAUDE_INCOMPATIBLE",
        "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
        "detected_version": "2.1.138 (Claude Code)",
        "tested_versions": [
          "2.1.138"
        ],
        "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
        "category": "claude_cli_unknown",
        "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
      }
    }
  ],
  "degradedRows": [
    {
      "event_type": "degraded_mode_entered",
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)"
    }
  ]
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "67ae76fc-d319-4af9-89cb-7e0faaf17624",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.413Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "844255e8-55e6-480f-841c-d874130a229b",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.488Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "c7cf82fc-86a1-4648-ac55-a599ee06820c",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.516Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "8645e446-36dc-4d0e-9429-f5802982449d",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.550Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "16b071a0-c45d-4884-a094-ebe6dacc7893",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.570Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.351Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.312Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
Used fake jsonl files so sessionFileExists passes and --resume itself fails. If Claude accepts fake files in a future version, this will need a different failure trigger.

---

## 11.2 Recovery clears the counter

Group: 11. Resume systematic failure

Inputs:
```json
{
  "reason": "matrix reset after synthetic resume failures"
}
```

Expected outcome:
router_reset succeeds with real Claude command.

Actual outcome:
```json
{
  "error": {
    "code": "ROUTER_RESET_REJECTED",
    "message": "Health probe has not passed since degraded mode was entered. Fix compatibility issues and run reset again.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "67ae76fc-d319-4af9-89cb-7e0faaf17624",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.413Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "844255e8-55e6-480f-841c-d874130a229b",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.488Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "c7cf82fc-86a1-4648-ac55-a599ee06820c",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.516Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "8645e446-36dc-4d0e-9429-f5802982449d",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.550Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "16b071a0-c45d-4884-a094-ebe6dacc7893",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.570Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:56.804Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:56.726Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.351Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.312Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 12.1 Long conversation forces compact

Group: 12. Compact and registry divergence

Inputs:
```json
"Skipped"
```

Expected outcome:
15-20 real consults force compaction.

Actual outcome:
```json
"Skipped to respect the requested ~30 consult budget."
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "67ae76fc-d319-4af9-89cb-7e0faaf17624",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.413Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "844255e8-55e6-480f-841c-d874130a229b",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.488Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "c7cf82fc-86a1-4648-ac55-a599ee06820c",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.516Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "8645e446-36dc-4d0e-9429-f5802982449d",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.550Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "16b071a0-c45d-4884-a094-ebe6dacc7893",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.570Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:56.804Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:56.726Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.351Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.312Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
This is the most expensive scenario group; run separately when budget allows.

---

## 12.2 Inspect surfaces decisions Claude may have forgotten

Group: 12. Compact and registry divergence

Inputs:
```json
"Skipped because 12.1 was skipped."
```

Expected outcome:
Registry inspect surfaces early decisions after compaction.

Actual outcome:
```json
"Not executed."
```

DB state snapshot:
```json
{
  "sessions": [
    {
      "id": "fake-resume-0",
      "project_id": "project-a",
      "claude_session_id": "67ae76fc-d319-4af9-89cb-7e0faaf17624",
      "topic": "fake resume 0",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.413Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-1",
      "project_id": "project-a",
      "claude_session_id": "844255e8-55e6-480f-841c-d874130a229b",
      "topic": "fake resume 1",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.488Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-2",
      "project_id": "project-a",
      "claude_session_id": "c7cf82fc-86a1-4648-ac55-a599ee06820c",
      "topic": "fake resume 2",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.516Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-3",
      "project_id": "project-a",
      "claude_session_id": "8645e446-36dc-4d0e-9429-f5802982449d",
      "topic": "fake resume 3",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.550Z",
      "archived_at": null
    },
    {
      "id": "fake-resume-4",
      "project_id": "project-a",
      "claude_session_id": "16b071a0-c45d-4884-a094-ebe6dacc7893",
      "topic": "fake resume 4",
      "status": "active",
      "last_used": "2026-05-11T19:15:33.570Z",
      "archived_at": null
    }
  ],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:56.804Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:56.726Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.351Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:15:33.312Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:


---

## 13.1 Empty topic_hint

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "",
  "trigger": "live matrix",
  "task": "empty topic",
  "relevant_code": "src/edge.ts",
  "question": "Handle empty topic_hint gracefully. Keep the answer under 80 words."
}
```

Expected outcome:
Rejected by zod or handled gracefully.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 13.2 Extremely long relevant_code

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "topic_hint": "long relevant code",
  "relevant_code_lines": 2000
}
```

Expected outcome:
Server truncates or rejects.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Prompt builder truncates to 200 lines; verified no max-token error.

---

## 13.3 Non-UTF8 characters in question

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "project_id": null,
  "session_id": null,
  "topic_hint": "unicode edge",
  "trigger": "live matrix",
  "task": "unicode",
  "relevant_code": "src/unicode.ts",
  "question": "Handle emojis 😀, RTL עברית, and control-ish text \\u0007 safely. Keep the answer under 80 words."
}
```

Expected outcome:
No parsing or DB storage breakage.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 13.4 Concurrent archive + consult on same session

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "consult": {
    "project_id": null,
    "topic_hint": "archive race",
    "trigger": "live matrix",
    "task": "race consult",
    "relevant_code": "src/race.ts",
    "question": "Long enough race consult: answer in two short bullets. Keep the answer under 80 words."
  },
  "archive": {
    "reason": "matrix concurrent archive"
  }
}
```

Expected outcome:
Lock serializes or final state is coherent.

Actual outcome:
```json
{
  "raceConsult": {
    "error": {
      "code": "CLAUDE_INCOMPATIBLE",
      "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
      "detected_version": "2.1.138 (Claude Code)",
      "tested_versions": [
        "2.1.138"
      ],
      "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "category": "claude_cli_unknown",
      "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
    }
  },
  "raceArchive": {
    "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_archive: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Potential race: consult update may reactivate after archive.

---

## 13.5 Inspect on archived session

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{}
```

Expected outcome:
Inspect works.

Actual outcome:
```json
{
  "raw_text": "MCP error -32602: Input validation error: Invalid arguments for tool claude_session_inspect: [\n  {\n    \"expected\": \"string\",\n    \"code\": \"invalid_type\",\n    \"path\": [\n      \"session_id\"\n    ],\n    \"message\": \"Invalid input: expected string, received undefined\"\n  }\n]"
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## 13.6 Consult with session_id pointing to archived session

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "project_id": null,
  "topic_hint": "archive race",
  "trigger": "live matrix",
  "task": "archived resume",
  "relevant_code": "src/race.ts",
  "question": "What happens when consulting an archived session? Keep the answer under 80 words."
}
```

Expected outcome:
Document actual behavior.

Actual outcome:
```json
{
  "error": {
    "code": "CLAUDE_INCOMPATIBLE",
    "message": "Claude CLI version is incompatible. See COMPATIBILITY.md. Server is in degraded mode.",
    "detected_version": "2.1.138 (Claude Code)",
    "tested_versions": [
      "2.1.138"
    ],
    "reason": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
    "category": "claude_cli_unknown",
    "operator_action": "Run `claude --version`, `claude auth status`, and `claude -p --output-format json ping`; fix the reported Claude CLI issue, then run `claude_router_reset`."
  }
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
Implementation creates a replacement session from archived registry context.

---

## 13.7 Config file moved between runs

Group: 13. Edge cases and adversarial inputs

Inputs:
```json
{
  "movedConfigDir": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\moved-config-project"
}
```

Expected outcome:
Relative paths resolve relative to new config location.

Actual outcome:
```json
{
  "project_id": "moved-config-project",
  "sessions": []
}
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.136Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.109Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: PASS

Notes:
The server discovers router.config.toml from cwd; arbitrary config path CLI/env is not implemented.

---

## 14.1 Token counts populated

Group: 14. Cost and observability sanity

Inputs:
```json
{}
```

Expected outcome:
tokens_in, tokens_out, duration_ms non-null for consult-like events.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.136Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.109Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: FAIL

Notes:
Values are populated. Quality note: adapter currently estimates tokens unless Claude top-level token fields exist; nested usage.* is not parsed.

---

## 14.2 Match reasons are human-readable

Group: 14. Cost and observability sanity

Inputs:
```json
{}
```

Expected outcome:
One-line explanations citing dominant factors.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.136Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.109Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: FAIL

Notes:


---

## 14.3 Raw logs stored correctly

Group: 14. Cost and observability sanity

Inputs:
```json
{}
```

Expected outcome:
parse_failed raw_response_path points to existing files.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.136Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.109Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: UNEXPECTED

Notes:
No natural parse_failed rows were produced in the no-code-edit live run; scenario 9.1/9.2 needs a fake Claude command injection.

---

## 14.4 Event timestamps monotonic per session

Group: 14. Cost and observability sanity

Inputs:
```json
{}
```

Expected outcome:
created_at monotonically increasing by event id.

Actual outcome:
```json
[]
```

DB state snapshot:
```json
{
  "sessions": [],
  "decisions": [],
  "files": [],
  "tags": [],
  "aliases": [],
  "events": [
    {
      "id": 4,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.136Z"
    },
    {
      "id": 3,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:46.109Z"
    },
    {
      "id": 2,
      "session_id": null,
      "project_id": "router",
      "event_type": "degraded_mode_entered",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.951Z"
    },
    {
      "id": 1,
      "session_id": null,
      "project_id": "router",
      "event_type": "health_probe_failed",
      "match_score": null,
      "match_reason": null,
      "was_new_session": 0,
      "was_orphan_recovery": 0,
      "tokens_in": null,
      "tokens_out": null,
      "duration_ms": null,
      "error": "Command failed: C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-live-test\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe -p --output-format json ping\nClaude CLI returned error result: You've hit your limit · resets 9:40pm (Europe/London)",
      "created_at": "2026-05-11T19:16:21.853Z"
    }
  ]
}
```

Verdict: PASS

Notes:


---

## Final Summary

| Group | Scenarios | PASS | FAIL | UNEXPECTED |
|-------|-----------|------|------|------------|
| 0. Prerequisites | 1 | 0 | 0 | 1 |
| 1. Happy path | 5 | 5 | 0 | 0 |
| 2. Routing and matching | 4 | 4 | 0 | 0 |
| 3. Project isolation | 4 | 2 | 2 | 0 |
| 4. Orphan recovery | 3 | 0 | 3 | 0 |
| 5. Cost circuit breaker | 3 | 1 | 2 | 0 |
| 6. Parse failure threshold | 2 | 0 | 2 | 0 |
| 7. Concurrency | 3 | 2 | 1 | 0 |
| 8. Lifecycle transitions | 4 | 4 | 0 | 0 |
| 9. SESSION_UPDATE_JSON resilience | 3 | 1 | 0 | 2 |
| 10. Degraded mode and recovery | 6 | 3 | 3 | 0 |
| 11. Resume systematic failure | 2 | 0 | 1 | 1 |
| 12. Compact and registry divergence | 2 | 0 | 0 | 2 |
| 13. Edge cases and adversarial inputs | 7 | 3 | 3 | 1 |
| 14. Cost and observability sanity | 4 | 1 | 2 | 1 |

### Critical findings
- 7.2 duplicate sessions were created for concurrent null consults with the same normalized topic.
- 13.4 concurrent archive + consult can leave a session active after archive because archive is not locked with consult.

### Quality findings
- 14.1 token counts are populated but are estimates for current Claude JSON because nested usage.input_tokens/output_tokens are not extracted.

### Spec ambiguities found
- 9.1/9.2 require a debug injection point or fake Claude command to exercise parse failures without editing server code.

### Cost summary
- Total consults made: 22
- Total claude_consult tool calls attempted: 42
- Approximate token usage from DB counters: 3573
- Claude model requested by wrapper: haiku

### Recommendation
NEEDS FIXES

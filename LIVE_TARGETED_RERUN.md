# Live Targeted Rerun

## Environment

```json
{
  "os": "Windows_NT 10.0.26200 x64",
  "node": "v22.18.0",
  "claude": "2.1.138 (Claude Code)",
  "commit": "74e204c196fd4cdd3de54c554fe17b3c7087ed91",
  "server": "node C:\\Users\\Davinchi\\AgentSessionRouter\\dist\\src\\index.js",
  "dbPath": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-targeted-rerun-uQxy4R\\.claude-session-router\\sessions.sqlite",
  "rawDir": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-targeted-rerun-uQxy4R\\.claude-session-router\\raw",
  "wrapperPath": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-targeted-rerun-uQxy4R\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe",
  "consultAttempts": 4
}
```

## Scenario Results

### same-topic concurrent null consults

Expected: One session for the exact same topic; second call reuses it after topic lock.

Verdict: PASS

Actual:

```json
{
  "first": {
    "session_id": "session_a59eeeb9-f491-4946-8f78-acbd6c3715a7",
    "claude_session_id": "3d6ed0aa-f523-495a-ae53-7cfd8d315efe",
    "routing": {
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": true
  },
  "second": {
    "session_id": "session_a59eeeb9-f491-4946-8f78-acbd6c3715a7",
    "claude_session_id": "3d6ed0aa-f523-495a-ae53-7cfd8d315efe",
    "routing": {
      "match_score": 1,
      "match_reason": "Exact normalized topic match within project; reusing existing session.",
      "was_new_session": false,
      "was_orphan_recovery": false
    },
    "has_session_update": true
  },
  "topicRows": [
    {
      "id": "session_a59eeeb9-f491-4946-8f78-acbd6c3715a7",
      "topic": "same normalized target",
      "status": "active"
    }
  ],
  "eventRows": [
    {
      "event_type": "new_session",
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": 1
    },
    {
      "event_type": "consult",
      "match_score": 1,
      "match_reason": "Exact normalized topic match within project; reusing existing session.",
      "was_new_session": 0
    }
  ]
}
```

### archive and consult same session race

Expected: Old session remains archived; consult does not reactivate stale state.

Verdict: PASS

Actual:

```json
{
  "setup": {
    "session_id": "session_c9c4061d-2e4f-4f21-8712-7542b1a4ec28",
    "claude_session_id": "2a986fd1-d783-4f63-8939-acb3c20e63f8",
    "routing": {
      "match_score": 0.4257894691831817,
      "match_reason": "Matched topic=0.2, files=1, tags=0, aliases=0.11, recency=1.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": true
  },
  "consult": {
    "session_id": "session_4973f990-c988-4527-8371-5f6a4e462116",
    "claude_session_id": "81588e24-d6a3-4784-a82e-cbae4b6efd15",
    "routing": {
      "match_score": 0,
      "match_reason": "Selected session was archived; creating replacement from registry context.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": true
  },
  "archive": {
    "ok": true,
    "status": "archived"
  },
  "oldSession": [
    {
      "id": "session_c9c4061d-2e4f-4f21-8712-7542b1a4ec28",
      "status": "archived",
      "archived_at": "2026-05-11T20:49:36.514Z"
    }
  ],
  "relatedEvents": [
    {
      "event_type": "new_session",
      "match_reason": "Matched topic=0.2, files=1, tags=0, aliases=0.11, recency=1.",
      "error": null
    },
    {
      "event_type": "archive",
      "match_reason": null,
      "error": "targeted rerun archive race"
    }
  ]
}
```

### nested Claude usage token counts

Expected: Consult-like events have non-null tokens_in/tokens_out/duration_ms from Claude JSON usage when available.

Verdict: PASS

Actual:

```json
[
  {
    "event_type": "new_session",
    "tokens_in": 10,
    "tokens_out": 971,
    "duration_ms": 29559
  },
  {
    "event_type": "new_session",
    "tokens_in": 10,
    "tokens_out": 1061,
    "duration_ms": 54455
  },
  {
    "event_type": "consult",
    "tokens_in": 10,
    "tokens_out": 464,
    "duration_ms": 44320
  },
  {
    "event_type": "new_session",
    "tokens_in": 10,
    "tokens_out": 515,
    "duration_ms": 34917
  }
]
```

## Final Verdict

TARGETED_RERUN_PASS

## Evidence

```json
[
  {
    "name": "claude_consult",
    "args": {
      "project_id": null,
      "session_id": null,
      "topic_hint": "same normalized target",
      "trigger": "targeted live rerun",
      "task": "parallel same topic A",
      "relevant_code": "src/targeted-rerun.ts\nexport const live = true;",
      "question": "Create or reuse this exact topic session. Keep the answer under 60 words."
    },
    "payload": {
      "session_id": "session_a59eeeb9-f491-4946-8f78-acbd6c3715a7",
      "claude_session_id": "3d6ed0aa-f523-495a-ae53-7cfd8d315efe",
      "answer": "I'm establishing a topic session for **targeted live rerun** with `live: true` in `src/targeted-rerun.ts`. This session enables parallel execution of **same topic A** tasks using normalized target matching. No prior registry exists, so this is a fresh session. The `live` export indicates active, production-ready configuration.",
      "routing": {
        "match_score": 0,
        "match_reason": "No eligible active or dormant sessions in project.",
        "was_new_session": true,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Targeted live rerun session for parallel same topic A with normalized target matching and live export enabled",
        "decisions": [
          "use live=true configuration",
          "normalize target matching for parallel tasks",
          "establish fresh registry for this topic"
        ],
        "open_questions": [
          "what parallel task dependencies exist?",
          "how is normalization defined for target matching?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts"
        ],
        "tags": [
          "live-rerun",
          "parallel-execution",
          "normalized-target"
        ],
        "aliases": [
          "same-topic-session",
          "target-rerun-parallel"
        ]
      }
    },
    "durationMs": 35281
  },
  {
    "name": "claude_consult",
    "args": {
      "project_id": null,
      "session_id": null,
      "topic_hint": "same normalized target",
      "trigger": "targeted live rerun",
      "task": "parallel same topic B",
      "relevant_code": "src/targeted-rerun.ts\nexport const live = true;",
      "question": "Create or reuse this exact topic session. Keep the answer under 60 words."
    },
    "payload": {
      "session_id": "session_a59eeeb9-f491-4946-8f78-acbd6c3715a7",
      "claude_session_id": "3d6ed0aa-f523-495a-ae53-7cfd8d315efe",
      "answer": "Reusing established session for **parallel same topic B**. Same normalized target applies. Task B executes in parallel with A under `live: true` configuration. Normalization and registry established in prior session context. No new decisions needed—leverage existing architecture and dependency resolution framework.",
      "routing": {
        "match_score": 1,
        "match_reason": "Exact normalized topic match within project; reusing existing session.",
        "was_new_session": false,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Parallel task B extends same normalized target session with live execution and inherited normalization rules",
        "decisions": [
          "reuse live=true configuration for task B",
          "apply same normalization strategy to task B",
          "execute B parallel to A under unified registry"
        ],
        "open_questions": [
          "what is task B's specific normalized target",
          "are A-B dependencies bidirectional or unidirectional?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts"
        ],
        "tags": [
          "live-rerun",
          "parallel-execution",
          "normalized-target",
          "task-b"
        ],
        "aliases": [
          "parallel-b-execution",
          "extended-same-topic-session"
        ]
      }
    },
    "durationMs": 79892
  },
  {
    "name": "claude_consult",
    "args": {
      "project_id": null,
      "session_id": null,
      "topic_hint": "archive race target",
      "trigger": "targeted live rerun",
      "task": "race setup",
      "relevant_code": "src/targeted-rerun.ts\nexport const live = true;",
      "question": "Create a session for archive race validation. Keep the answer under 60 words."
    },
    "payload": {
      "session_id": "session_c9c4061d-2e4f-4f21-8712-7542b1a4ec28",
      "claude_session_id": "2a986fd1-d783-4f63-8939-acb3c20e63f8",
      "answer": "Create a session for archive race validation targeting live rerun with the existing `live = true` flag in src/targeted-rerun.ts. This session will execute archive race condition tests against the live environment, validating concurrent access patterns and ensuring consistency under race conditions.",
      "routing": {
        "match_score": 0.4257894691831817,
        "match_reason": "Matched topic=0.2, files=1, tags=0, aliases=0.11, recency=1.",
        "was_new_session": true,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Archive race validation session created using live rerun trigger with existing live flag from targeted-rerun.ts",
        "decisions": [
          "Use live=true flag for archive race validation",
          "Execute race condition tests against live environment"
        ],
        "open_questions": [
          "What specific race conditions require validation?",
          "What are the consistency guarantees to verify?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts"
        ],
        "tags": [
          "archive",
          "race-condition",
          "validation",
          "live-testing"
        ],
        "aliases": [
          "archive race test session",
          "concurrent access validation"
        ]
      }
    },
    "durationMs": 54539
  },
  {
    "name": "claude_session_archive",
    "args": {
      "session_id": "session_c9c4061d-2e4f-4f21-8712-7542b1a4ec28",
      "reason": "targeted rerun archive race"
    },
    "payload": {
      "ok": true,
      "status": "archived"
    },
    "durationMs": 162
  },
  {
    "name": "claude_consult",
    "args": {
      "project_id": null,
      "session_id": "session_c9c4061d-2e4f-4f21-8712-7542b1a4ec28",
      "topic_hint": "archive race target",
      "trigger": "targeted live rerun",
      "task": "race consult",
      "relevant_code": "src/targeted-rerun.ts\nexport const live = true;",
      "question": "Answer briefly while archive races this consult. Keep the answer under 60 words."
    },
    "payload": {
      "session_id": "session_4973f990-c988-4527-8371-5f6a4e462116",
      "claude_session_id": "81588e24-d6a3-4784-a82e-cbae4b6efd15",
      "answer": "Looking at the archive race validation context, here's the consulting guidance:\n\n**Focus on these critical race conditions:**\n1. **Concurrent archive deletion/read conflicts** — ensure readers see consistent state during archive operations\n2. **Metadata consistency** — archive metadata remains valid under concurrent updates\n3. **Reference integrity** — no orphaned or dangling references when archives are modified concurrently\n\n**Validation approach with live=true:** Execute archive operations under load, verify state consistency across concurrent readers/writers.\n\n---",
      "routing": {
        "match_score": 0,
        "match_reason": "Selected session was archived; creating replacement from registry context.",
        "was_new_session": true,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Archive race validation should target concurrent deletion/read conflicts, metadata consistency, and reference integrity; execute load testing against live environment",
        "decisions": [
          "Focus archive race tests on deletion/read conflicts, metadata consistency, and reference integrity",
          "Use live load testing to validate consistency guarantees"
        ],
        "open_questions": [
          "What is the acceptable latency for consistency checks under concurrent load?",
          "Should race validation include cascading archive scenarios?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts"
        ],
        "tags": [
          "archive",
          "race-condition",
          "validation",
          "live-testing",
          "concurrency"
        ],
        "aliases": [
          "concurrent archive validation",
          "archive consistency under load"
        ]
      }
    },
    "durationMs": 29748
  },
  {
    "name": "server_stderr",
    "stderr": ""
  }
]
```

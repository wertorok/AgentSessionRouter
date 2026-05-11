# Live Targeted Rerun

## Environment

```json
{
  "os": "Windows_NT 10.0.26200 x64",
  "node": "v22.18.0",
  "claude": "2.1.138 (Claude Code)",
  "commit": "edd7716bc0d7186309404a661b6399c5482ffadb",
  "server": "node C:\\Users\\Davinchi\\AgentSessionRouter\\dist\\src\\index.js",
  "dbPath": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-targeted-rerun-J4Fj73\\.claude-session-router\\sessions.sqlite",
  "rawDir": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-targeted-rerun-J4Fj73\\.claude-session-router\\raw",
  "wrapperPath": "C:\\Users\\Davinchi\\AppData\\Local\\Temp\\csr-targeted-rerun-J4Fj73\\haiku-wrapper\\out\\ClaudeHaikuWrapper.exe",
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
    "session_id": "session_212c09f0-601a-4eaa-a40a-bb623080a359",
    "claude_session_id": "feb5a1e1-f35c-47b0-8041-4cf542088fc3",
    "routing": {
      "match_score": 0,
      "match_reason": "No eligible active or dormant sessions in project.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": true
  },
  "second": {
    "session_id": "session_212c09f0-601a-4eaa-a40a-bb623080a359",
    "claude_session_id": "feb5a1e1-f35c-47b0-8041-4cf542088fc3",
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
      "id": "session_212c09f0-601a-4eaa-a40a-bb623080a359",
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

Expected: Archive and consult serialize. If archive wins, consult creates a replacement; if consult wins, archive still leaves the old session archived.

Verdict: PASS

Actual:

```json
{
  "setup": {
    "session_id": "session_69c91239-7466-4fec-b9a2-fc5980e06292",
    "claude_session_id": "9b61bce2-c814-4014-9959-be6ed667da7f",
    "routing": {
      "match_score": 0.42666666566358025,
      "match_reason": "Matched topic=0.2, files=1, tags=0, aliases=0.11, recency=1.",
      "was_new_session": true,
      "was_orphan_recovery": false
    },
    "has_session_update": true
  },
  "consult": {
    "session_id": "session_69c91239-7466-4fec-b9a2-fc5980e06292",
    "claude_session_id": "9b61bce2-c814-4014-9959-be6ed667da7f",
    "routing": {
      "match_score": 1,
      "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
      "was_new_session": false,
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
      "id": "session_69c91239-7466-4fec-b9a2-fc5980e06292",
      "status": "archived",
      "archived_at": "2026-05-11T21:13:21.969Z"
    }
  ],
  "relatedEvents": [
    {
      "event_type": "new_session",
      "match_reason": "Matched topic=0.2, files=1, tags=0, aliases=0.11, recency=1.",
      "error": null
    },
    {
      "event_type": "consult",
      "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
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
    "event_type": "consult",
    "tokens_in": 10,
    "tokens_out": 698,
    "duration_ms": 22242
  },
  {
    "event_type": "new_session",
    "tokens_in": 10,
    "tokens_out": 753,
    "duration_ms": 20632
  },
  {
    "event_type": "consult",
    "tokens_in": 10,
    "tokens_out": 466,
    "duration_ms": 24160
  },
  {
    "event_type": "new_session",
    "tokens_in": 10,
    "tokens_out": 681,
    "duration_ms": 21152
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
      "session_id": "session_212c09f0-601a-4eaa-a40a-bb623080a359",
      "claude_session_id": "feb5a1e1-f35c-47b0-8041-4cf542088fc3",
      "answer": "I'll establish the topic session for targeted rerun on \"same normalized target\" with parallel execution.\n\n**Session Setup:**\n\nThe configuration in `src/targeted-rerun.ts` confirms `live = true` is active. For this topic:\n\n- **Session ID**: `parallel-same-topic-A` \n- **Target**: Normalized target (same baseline)\n- **Mode**: Live rerun with parallel execution enabled\n- **Status**: Ready to execute\n\nThe `router.config.toml` file is pending—likely holds routing rules for the parallel tasks. Confirm whether this should be committed before execution, or if it's ephemeral test configuration.\n\n---",
      "routing": {
        "match_score": 0,
        "match_reason": "No eligible active or dormant sessions in project.",
        "was_new_session": true,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Established targeted rerun session for 'same normalized target' with live=true and parallel execution ready",
        "decisions": [
          "Live mode active in src/targeted-rerun.ts",
          "Parallel execution enabled for topic A"
        ],
        "open_questions": [
          "Is router.config.toml config ephemeral or committed state?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts",
          "router.config.toml"
        ],
        "tags": [
          "targeted-rerun",
          "live-execution",
          "parallel"
        ],
        "aliases": [
          "parallel-same-topic-a",
          "normalized-target-session"
        ]
      }
    },
    "durationMs": 21281
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
      "session_id": "session_212c09f0-601a-4eaa-a40a-bb623080a359",
      "claude_session_id": "feb5a1e1-f35c-47b0-8041-4cf542088fc3",
      "answer": "**Reusing existing session for Topic B:**\n\nTopic B executes in parallel within the same \"same normalized target\" session. Live mode (`live = true`) applies across both topic threads. Router configuration applies uniformly—no additional setup needed if `router.config.toml` is session-scoped.\n\n**Status**: Topic B ready for parallel dispatch alongside Topic A within unified normalized-target-session.\n\n---",
      "routing": {
        "match_score": 1,
        "match_reason": "Exact normalized topic match within project; reusing existing session.",
        "was_new_session": false,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Topic B added as parallel execution branch within existing normalized-target-session; live mode and router config shared",
        "decisions": [
          "Topic B executes parallel to Topic A in same session",
          "Live mode applies across all topics",
          "Router config shared across parallel branches"
        ],
        "open_questions": [
          "Confirm router.config.toml scope: session-wide or per-topic?",
          "Are there topic A/B execution dependencies?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts",
          "router.config.toml"
        ],
        "tags": [
          "targeted-rerun",
          "live-execution",
          "parallel",
          "multi-topic"
        ],
        "aliases": [
          "parallel-same-topic-b",
          "topic-b-parallel-branch"
        ]
      }
    },
    "durationMs": 45473
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
      "session_id": "session_69c91239-7466-4fec-b9a2-fc5980e06292",
      "claude_session_id": "9b61bce2-c814-4014-9959-be6ed667da7f",
      "answer": "Initialize the archive race validation session using the live mode from `targeted-rerun.ts` (currently `live = true`). Establish baseline race metrics and target thresholds upfront. Configure race validators and logging to capture timing data. Execute the targeted rerun in live mode, then validate results against defined pass/fail criteria before archiving results.\n\n---",
      "routing": {
        "match_score": 0.42666666566358025,
        "match_reason": "Matched topic=0.2, files=1, tags=0, aliases=0.11, recency=1.",
        "was_new_session": true,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Archive race validation session initialized with live mode enabled for targeted rerun testing",
        "decisions": [
          "Use live=true mode from targeted-rerun.ts for validation",
          "Establish baseline race metrics before execution",
          "Define explicit pass/fail criteria for archive race validation"
        ],
        "open_questions": [
          "What are the specific target thresholds for race validation?",
          "Which race conditions are critical for archive validation?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts"
        ],
        "tags": [
          "archive-race",
          "validation",
          "live-rerun",
          "race-condition"
        ],
        "aliases": [
          "archive race session",
          "targeted race validation",
          "live rerun validation"
        ]
      }
    },
    "durationMs": 20714
  },
  {
    "name": "claude_session_archive",
    "args": {
      "session_id": "session_69c91239-7466-4fec-b9a2-fc5980e06292",
      "reason": "targeted rerun archive race"
    },
    "payload": {
      "ok": true,
      "status": "archived"
    },
    "durationMs": 22352
  },
  {
    "name": "claude_consult",
    "args": {
      "project_id": null,
      "session_id": "session_69c91239-7466-4fec-b9a2-fc5980e06292",
      "topic_hint": "archive race target",
      "trigger": "targeted live rerun",
      "task": "race consult",
      "relevant_code": "src/targeted-rerun.ts\nexport const live = true;",
      "question": "Answer briefly while archive races this consult. Keep the answer under 60 words."
    },
    "payload": {
      "session_id": "session_69c91239-7466-4fec-b9a2-fc5980e06292",
      "claude_session_id": "9b61bce2-c814-4014-9959-be6ed667da7f",
      "answer": "Identify critical archive mutation points requiring synchronization. Establish locks at state transitions and validate atomicity under concurrent load. Define latency thresholds (P99) and monitor race detection metrics. Target: zero race conditions in live validation. Prioritize lock-free patterns where feasible; use mutex-backed fallbacks for complex state changes.\n\n---",
      "routing": {
        "match_score": 1,
        "match_reason": "Direct session_id provided and project/Claude session health checks passed.",
        "was_new_session": false,
        "was_orphan_recovery": false
      },
      "session_update": {
        "summary": "Race condition consultation identifies critical synchronization points and establishes P99 latency targets for live validation",
        "decisions": [
          "Target zero race conditions detected during live validation",
          "Prioritize lock-free patterns, use mutex fallbacks for complex state",
          "Establish P99 latency threshold as primary race metric"
        ],
        "open_questions": [
          "What is the acceptable P99 latency threshold for archive mutations?",
          "Which archive state transitions pose the highest concurrency risk?"
        ],
        "files_discussed": [
          "src/targeted-rerun.ts"
        ],
        "tags": [
          "archive-race",
          "synchronization",
          "race-condition",
          "concurrency",
          "live-validation"
        ],
        "aliases": [
          "race condition consult",
          "archive concurrency strategy",
          "race detection planning"
        ]
      }
    },
    "durationMs": 22353
  },
  {
    "name": "server_stderr",
    "stderr": ""
  }
]
```

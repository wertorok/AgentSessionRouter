# Session Continuity Benchmark

Started: 2026-05-15T20:42:20.657Z
Finished: 2026-05-15T20:44:45.205Z
Project id: AgentSessionRouter-continuity-2026-05-15-v5

## Purpose

This benchmark measures the original v1 router value: whether multiple questions in one durable session preserve conversational decisions better than cold/fresh calls.

Current cluster shadow eval still measures `cluster_consult` against `direct_fresh`; this benchmark is separate and should not be conflated with shadow eval.

## Method Summary

| Method | Calls | Failed | Unique sessions | Avg score all | Avg score memory probes | Avg score memory+synthesis | Tool markup | Missing-memory admissions | Total duration ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fresh_each_turn | 5 | 0 | 5 | 1.6 | 0.5 | 0.67 | 0 | 2 | 58072 |
| same_claude_session | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 27479 |
| router_exact_topic | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 34200 |
| router_explicit_session | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 22491 |

## Route Counts

```json
{
  "claude_consult": 10,
  "claude_consult_new_session": 2,
  "claude_consult_existing_session": 4,
  "claude_consult_explicit_session": 4
}
```

## Calls

| Method | Turn | Kind | Status | Score | Selected path | Session | Missing requirements |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| fresh_each_turn | T1 | seed | ok | 3 |  | session_f7cc1317-b3cc-46fd-bcb0-7a36665294ac |  |
| fresh_each_turn | T2 | memory_probe | ok | 1 |  | session_99ebabbd-e689-485d-aaa8-c4004d3c9f82 | alpha, caller-answer |
| fresh_each_turn | T3 | seed | ok | 3 |  | session_1df62ebc-a2a9-4018-ac43-7c5d91bc60e4 |  |
| fresh_each_turn | T4 | memory_probe | ok | 0 |  | session_c8c8fb68-f4a4-44bd-a113-bd5719dd304c | alpha, beta, caller-answer, revalidation-fallback |
| fresh_each_turn | T5 | synthesis | ok | 1 |  | session_09a7c4a6-7f01-4a1c-806f-3703f037c484 | alpha, beta |
| same_claude_session | T1 | seed | ok | 3 |  | session_435b9c52-7a1a-4813-bd7c-578548958a86 |  |
| same_claude_session | T2 | memory_probe | ok | 3 |  | session_435b9c52-7a1a-4813-bd7c-578548958a86 |  |
| same_claude_session | T3 | seed | ok | 3 |  | session_435b9c52-7a1a-4813-bd7c-578548958a86 |  |
| same_claude_session | T4 | memory_probe | ok | 3 |  | session_435b9c52-7a1a-4813-bd7c-578548958a86 |  |
| same_claude_session | T5 | synthesis | ok | 2 |  | session_435b9c52-7a1a-4813-bd7c-578548958a86 | session-benchmark |
| router_exact_topic | T1 | seed | ok | 3 | claude_consult_new_session | session_68ad0102-4a5c-4c0c-a5db-95e3dc813800 |  |
| router_exact_topic | T2 | memory_probe | ok | 3 | claude_consult_existing_session | session_68ad0102-4a5c-4c0c-a5db-95e3dc813800 |  |
| router_exact_topic | T3 | seed | ok | 3 | claude_consult_existing_session | session_68ad0102-4a5c-4c0c-a5db-95e3dc813800 |  |
| router_exact_topic | T4 | memory_probe | ok | 3 | claude_consult_existing_session | session_68ad0102-4a5c-4c0c-a5db-95e3dc813800 |  |
| router_exact_topic | T5 | synthesis | ok | 2 | claude_consult_existing_session | session_68ad0102-4a5c-4c0c-a5db-95e3dc813800 | session-benchmark |
| router_explicit_session | T1 | seed | ok | 3 | claude_consult_new_session | session_9ea8c99c-4e21-4f01-850b-0a21843fe541 |  |
| router_explicit_session | T2 | memory_probe | ok | 3 | claude_consult_explicit_session | session_9ea8c99c-4e21-4f01-850b-0a21843fe541 |  |
| router_explicit_session | T3 | seed | ok | 3 | claude_consult_explicit_session | session_9ea8c99c-4e21-4f01-850b-0a21843fe541 |  |
| router_explicit_session | T4 | memory_probe | ok | 3 | claude_consult_explicit_session | session_9ea8c99c-4e21-4f01-850b-0a21843fe541 |  |
| router_explicit_session | T5 | synthesis | ok | 2 | claude_consult_explicit_session | session_9ea8c99c-4e21-4f01-850b-0a21843fe541 | session-benchmark |

## Findings

- Durable v1 session context beat fresh-each-turn on memory probes (3 vs 0.5).
- router_consult exact-topic reuse matched or exceeded direct same-session continuity (3 vs 3).
- router_consult explicit-session continuity matched or exceeded direct same-session continuity (3 vs 3).
- SESSION_UPDATE_JSON metadata parsed during the run: 8 inspected session(s), 21 stored decision(s).
- Do not use direct_fresh shadow quality as proof about durable session memory; this benchmark measures that separately.

## Session Metadata

- session_f7cc1317-b3cc-46fd-bcb0-7a36665294ac: ok, topic=session continuity benchmark 2026-05-15-v5 fresh_each_turn T1 m3gy4r, status=active, decisions=1, events=1
- session_99ebabbd-e689-485d-aaa8-c4004d3c9f82: ok, topic=session continuity benchmark 2026-05-15-v5 fresh_each_turn T2 bzinu6, status=active, decisions=0, events=1
- session_1df62ebc-a2a9-4018-ac43-7c5d91bc60e4: ok, topic=session continuity benchmark 2026-05-15-v5 fresh_each_turn T3 qykbe7, status=active, decisions=1, events=1
- session_c8c8fb68-f4a4-44bd-a113-bd5719dd304c: ok, topic=session continuity benchmark 2026-05-15-v5 fresh_each_turn T4 pvvn0n, status=active, decisions=0, events=1
- session_09a7c4a6-7f01-4a1c-806f-3703f037c484: ok, topic=session continuity benchmark 2026-05-15-v5 fresh_each_turn T5 oc3jju, status=active, decisions=3, events=1
- session_435b9c52-7a1a-4813-bd7c-578548958a86: ok, topic=session continuity benchmark 2026-05-15-v5 same_claude_session, status=active, decisions=3, events=5
- session_68ad0102-4a5c-4c0c-a5db-95e3dc813800: ok, topic=session continuity benchmark 2026-05-15-v5 router_exact_topic, status=active, decisions=6, events=9
- session_9ea8c99c-4e21-4f01-850b-0a21843fe541: ok, topic=session continuity benchmark 2026-05-15-v5 router_explicit_session, status=active, decisions=7, events=9

## Final Monitor Snapshot

```json
{
  "shadow_eval": {
    "enabled": true,
    "total": 0,
    "judged": 0,
    "pending": 0,
    "ok_unjudged": 0,
    "failed_auth": 0,
    "failed_timeout": 0,
    "failed_other": 0,
    "last_created_at": null,
    "last_judged_at": null
  },
  "route_counts": [
    {
      "selected_path": "claude_consult_existing_session",
      "count": 4,
      "latest_created_at": "2026-05-15T20:44:13.238Z"
    },
    {
      "selected_path": "claude_consult_explicit_session",
      "count": 4,
      "latest_created_at": "2026-05-15T20:44:37.873Z"
    },
    {
      "selected_path": "claude_consult_new_session",
      "count": 2,
      "latest_created_at": "2026-05-15T20:44:22.697Z"
    }
  ],
  "metadata_health": {
    "event_counts": [],
    "affected_sessions": [],
    "samples": []
  },
  "recommendations": [
    {
      "priority": "low",
      "area": "routing",
      "action": "Inspect route_health.samples for claude_consult_new_session decisions; add aliases/tags/file evidence or pass an explicit session if these should have reused context.",
      "reason": "2 router_consult call(s) started a new durable session after automatic routing checks."
    }
  ]
}
```

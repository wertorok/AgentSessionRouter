# Session Continuity Benchmark

Started: 2026-05-16T18:25:52.370Z
Finished: 2026-05-16T18:28:38.350Z
Project id: AgentSessionRouter-continuity-2026-05-16

## Purpose

This benchmark measures the original v1 router value: whether multiple questions in one durable session preserve conversational decisions better than cold/fresh calls.

Current cluster shadow eval still measures `cluster_consult` against `direct_fresh`; this benchmark is separate and should not be conflated with shadow eval.

## Method Summary

| Method | Calls | Failed | Unique sessions | Avg score all | Avg score memory probes | Avg score memory+synthesis | Tool markup | Missing-memory admissions | Total duration ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fresh_each_turn | 5 | 0 | 5 | 1.6 | 0.5 | 0.67 | 0 | 1 | 45674 |
| same_claude_session | 5 | 0 | 1 | 3 | 3 | 3 | 0 | 0 | 48438 |
| router_exact_topic | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 23636 |
| router_explicit_session | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 44604 |

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
| fresh_each_turn | T1 | seed | ok | 3 |  | session_70fc720d-ed88-499f-8d21-2d96a67a8aa2 |  |
| fresh_each_turn | T2 | memory_probe | ok | 1 |  | session_c22f46b2-b688-42d1-89f9-a03e3b9eaf4a | alpha, caller-answer |
| fresh_each_turn | T3 | seed | ok | 3 |  | session_583c8f09-0eac-4073-8748-32375e86c549 |  |
| fresh_each_turn | T4 | memory_probe | ok | 0 |  | session_6d9e9350-faac-44e4-89f5-8d4b8aeb069c | alpha, beta, caller-answer, revalidation-fallback |
| fresh_each_turn | T5 | synthesis | ok | 1 |  | session_5b1790d5-5515-4f2e-a4f9-7596dcf2e666 | alpha, beta |
| same_claude_session | T1 | seed | ok | 3 |  | session_52f3657d-1c5c-4e0f-946a-e229fe20d144 |  |
| same_claude_session | T2 | memory_probe | ok | 3 |  | session_52f3657d-1c5c-4e0f-946a-e229fe20d144 |  |
| same_claude_session | T3 | seed | ok | 3 |  | session_52f3657d-1c5c-4e0f-946a-e229fe20d144 |  |
| same_claude_session | T4 | memory_probe | ok | 3 |  | session_52f3657d-1c5c-4e0f-946a-e229fe20d144 |  |
| same_claude_session | T5 | synthesis | ok | 3 |  | session_52f3657d-1c5c-4e0f-946a-e229fe20d144 |  |
| router_exact_topic | T1 | seed | ok | 3 | claude_consult_new_session | session_ced6c095-35fe-458b-afa0-6f363e8b834e |  |
| router_exact_topic | T2 | memory_probe | ok | 3 | claude_consult_existing_session | session_ced6c095-35fe-458b-afa0-6f363e8b834e |  |
| router_exact_topic | T3 | seed | ok | 3 | claude_consult_existing_session | session_ced6c095-35fe-458b-afa0-6f363e8b834e |  |
| router_exact_topic | T4 | memory_probe | ok | 3 | claude_consult_existing_session | session_ced6c095-35fe-458b-afa0-6f363e8b834e |  |
| router_exact_topic | T5 | synthesis | ok | 2 | claude_consult_existing_session | session_ced6c095-35fe-458b-afa0-6f363e8b834e | session-benchmark |
| router_explicit_session | T1 | seed | ok | 3 | claude_consult_new_session | session_3c96aee2-ac2d-4aa7-b876-5bf4e18c04e6 |  |
| router_explicit_session | T2 | memory_probe | ok | 3 | claude_consult_explicit_session | session_3c96aee2-ac2d-4aa7-b876-5bf4e18c04e6 |  |
| router_explicit_session | T3 | seed | ok | 3 | claude_consult_explicit_session | session_3c96aee2-ac2d-4aa7-b876-5bf4e18c04e6 |  |
| router_explicit_session | T4 | memory_probe | ok | 3 | claude_consult_explicit_session | session_3c96aee2-ac2d-4aa7-b876-5bf4e18c04e6 |  |
| router_explicit_session | T5 | synthesis | ok | 2 | claude_consult_explicit_session | session_3c96aee2-ac2d-4aa7-b876-5bf4e18c04e6 | session-benchmark |

## Findings

- Durable v1 session context beat fresh-each-turn on memory probes (3 vs 0.5).
- router_consult exact-topic reuse matched or exceeded direct same-session continuity (3 vs 3).
- router_consult explicit-session continuity matched or exceeded direct same-session continuity (3 vs 3).
- SESSION_UPDATE_JSON metadata parsed during the run: 8 inspected session(s), 11 stored decision(s).
- Do not use direct_fresh shadow quality as proof about durable session memory; this benchmark measures that separately.

## Session Metadata

- session_70fc720d-ed88-499f-8d21-2d96a67a8aa2: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T1 4sns6c, status=active, decisions=1, events=1
- session_c22f46b2-b688-42d1-89f9-a03e3b9eaf4a: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T2 pzi453, status=active, decisions=0, events=1
- session_583c8f09-0eac-4073-8748-32375e86c549: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T3 8jc8z7, status=active, decisions=1, events=1
- session_6d9e9350-faac-44e4-89f5-8d4b8aeb069c: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T4 ygqe3q, status=active, decisions=0, events=2
- session_5b1790d5-5515-4f2e-a4f9-7596dcf2e666: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T5 h5xke1, status=active, decisions=1, events=1
- session_52f3657d-1c5c-4e0f-946a-e229fe20d144: ok, topic=session continuity benchmark 2026-05-16 same_claude_session, status=active, decisions=2, events=5
- session_ced6c095-35fe-458b-afa0-6f363e8b834e: ok, topic=session continuity benchmark 2026-05-16 router_exact_topic, status=active, decisions=4, events=9
- session_3c96aee2-ac2d-4aa7-b876-5bf4e18c04e6: ok, topic=session continuity benchmark 2026-05-16 router_explicit_session, status=active, decisions=2, events=9

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
      "latest_created_at": "2026-05-16T18:27:46.203Z"
    },
    {
      "selected_path": "claude_consult_explicit_session",
      "count": 4,
      "latest_created_at": "2026-05-16T18:28:23.062Z"
    },
    {
      "selected_path": "claude_consult_new_session",
      "count": 2,
      "latest_created_at": "2026-05-16T18:27:53.713Z"
    }
  ],
  "metadata_health": {
    "event_counts": [
      {
        "event_type": "parse_failed",
        "count": 1,
        "latest_created_at": "2026-05-16T18:26:31.075Z"
      }
    ],
    "affected_sessions": [
      {
        "session_id": "session_6d9e9350-faac-44e4-89f5-8d4b8aeb069c",
        "topic": "session continuity benchmark 2026-05-16 fresh_each_turn T4 ygqe3q",
        "session_status": "active",
        "parse_failed_count": 1,
        "threshold_exceeded_count": 0,
        "latest_created_at": "2026-05-16T18:26:31.075Z",
        "latest_error": "SESSION_UPDATE_JSON block missing",
        "latest_raw_response_path": "/root/projects/AgentSessionRouter/.claude-session-router/raw/session_6d9e9350-faac-44e4-89f5-8d4b8aeb069c-1778955991074.txt"
      }
    ],
    "samples": [
      {
        "event_id": 431,
        "session_id": "session_6d9e9350-faac-44e4-89f5-8d4b8aeb069c",
        "topic": "session continuity benchmark 2026-05-16 fresh_each_turn T4 ygqe3q",
        "session_status": "active",
        "event_type": "parse_failed",
        "question": null,
        "raw_response_path": "/root/projects/AgentSessionRouter/.claude-session-router/raw/session_6d9e9350-faac-44e4-89f5-8d4b8aeb069c-1778955991074.txt",
        "error": "SESSION_UPDATE_JSON block missing",
        "created_at": "2026-05-16T18:26:31.075Z"
      }
    ]
  },
  "recommendations": [
    {
      "priority": "medium",
      "area": "sessions",
      "action": "Inspect recent session_events and raw responses.",
      "reason": "Session event 'parse_failed' has 1 error row(s)."
    },
    {
      "priority": "medium",
      "area": "metadata",
      "action": "Inspect metadata_health.samples raw responses and tighten SESSION_UPDATE_JSON prompting if failures repeat.",
      "reason": "1 SESSION_UPDATE_JSON parse failure(s) occurred in the recent window."
    },
    {
      "priority": "low",
      "area": "routing",
      "action": "Inspect route_health.samples for claude_consult_new_session decisions; add aliases/tags/file evidence or pass an explicit session if these should have reused context.",
      "reason": "2 router_consult call(s) started a new durable session after automatic routing checks."
    }
  ]
}
```

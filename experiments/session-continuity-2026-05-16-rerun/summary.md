# Session Continuity Benchmark

Started: 2026-05-16T18:47:49.456Z
Finished: 2026-05-16T18:50:20.367Z
Project id: AgentSessionRouter-continuity-2026-05-16-rerun

## Purpose

This benchmark measures the original v1 router value: whether multiple questions in one durable session preserve conversational decisions better than cold/fresh calls.

Current cluster shadow eval still measures `cluster_consult` against `direct_fresh`; this benchmark is separate and should not be conflated with shadow eval.

## Method Summary

| Method | Calls | Failed | Unique sessions | Avg score all | Avg score memory probes | Avg score memory+synthesis | Tool markup | Missing-memory admissions | Total duration ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fresh_each_turn | 5 | 0 | 5 | 1.6 | 0.5 | 0.67 | 0 | 2 | 48227 |
| same_claude_session | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 39787 |
| router_exact_topic | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 25020 |
| router_explicit_session | 5 | 0 | 1 | 3 | 3 | 3 | 0 | 0 | 34374 |

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
| fresh_each_turn | T1 | seed | ok | 3 |  | session_0885db56-c3ea-4187-a0c6-af9495cfdc99 |  |
| fresh_each_turn | T2 | memory_probe | ok | 1 |  | session_a8465f4e-4491-4b0d-ab09-5b2633080495 | alpha, caller-answer |
| fresh_each_turn | T3 | seed | ok | 3 |  | session_06d52cd7-fc24-411a-8cbd-5c67871d625c |  |
| fresh_each_turn | T4 | memory_probe | ok | 0 |  | session_10db8c3f-3072-4408-a770-9320528f2566 | alpha, beta, caller-answer, revalidation-fallback |
| fresh_each_turn | T5 | synthesis | ok | 1 |  | session_03a75ec2-b9b5-40dc-8210-c02e724783be | alpha, beta |
| same_claude_session | T1 | seed | ok | 3 |  | session_8ca6443d-f284-4647-b53e-497d93dd76d3 |  |
| same_claude_session | T2 | memory_probe | ok | 3 |  | session_8ca6443d-f284-4647-b53e-497d93dd76d3 |  |
| same_claude_session | T3 | seed | ok | 3 |  | session_8ca6443d-f284-4647-b53e-497d93dd76d3 |  |
| same_claude_session | T4 | memory_probe | ok | 3 |  | session_8ca6443d-f284-4647-b53e-497d93dd76d3 |  |
| same_claude_session | T5 | synthesis | ok | 2 |  | session_8ca6443d-f284-4647-b53e-497d93dd76d3 | session-benchmark |
| router_exact_topic | T1 | seed | ok | 3 | claude_consult_new_session | session_e21533fc-d8f5-4ad7-aa26-46f0f405ace6 |  |
| router_exact_topic | T2 | memory_probe | ok | 3 | claude_consult_existing_session | session_e21533fc-d8f5-4ad7-aa26-46f0f405ace6 |  |
| router_exact_topic | T3 | seed | ok | 3 | claude_consult_existing_session | session_e21533fc-d8f5-4ad7-aa26-46f0f405ace6 |  |
| router_exact_topic | T4 | memory_probe | ok | 3 | claude_consult_existing_session | session_e21533fc-d8f5-4ad7-aa26-46f0f405ace6 |  |
| router_exact_topic | T5 | synthesis | ok | 2 | claude_consult_existing_session | session_e21533fc-d8f5-4ad7-aa26-46f0f405ace6 | session-benchmark |
| router_explicit_session | T1 | seed | ok | 3 | claude_consult_new_session | session_5299047a-a347-4bc3-80ba-5a3f919a2388 |  |
| router_explicit_session | T2 | memory_probe | ok | 3 | claude_consult_explicit_session | session_5299047a-a347-4bc3-80ba-5a3f919a2388 |  |
| router_explicit_session | T3 | seed | ok | 3 | claude_consult_explicit_session | session_5299047a-a347-4bc3-80ba-5a3f919a2388 |  |
| router_explicit_session | T4 | memory_probe | ok | 3 | claude_consult_explicit_session | session_5299047a-a347-4bc3-80ba-5a3f919a2388 |  |
| router_explicit_session | T5 | synthesis | ok | 3 | claude_consult_explicit_session | session_5299047a-a347-4bc3-80ba-5a3f919a2388 |  |

## Findings

- Durable v1 session context beat fresh-each-turn on memory probes (3 vs 0.5).
- router_consult exact-topic reuse matched or exceeded direct same-session continuity (3 vs 3).
- router_consult explicit-session continuity matched or exceeded direct same-session continuity (3 vs 3).
- SESSION_UPDATE_JSON metadata parsed during the run: 8 inspected session(s), 18 stored decision(s).
- Do not use direct_fresh shadow quality as proof about durable session memory; this benchmark measures that separately.

## Session Metadata

- session_0885db56-c3ea-4187-a0c6-af9495cfdc99: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T1 iercav, status=active, decisions=1, events=1
- session_a8465f4e-4491-4b0d-ab09-5b2633080495: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T2 07gy9l, status=active, decisions=0, events=1
- session_06d52cd7-fc24-411a-8cbd-5c67871d625c: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T3 dxacir, status=active, decisions=1, events=1
- session_10db8c3f-3072-4408-a770-9320528f2566: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T4 9hg6by, status=active, decisions=0, events=2
- session_03a75ec2-b9b5-40dc-8210-c02e724783be: ok, topic=session continuity benchmark 2026-05-16 fresh_each_turn T5 275axg, status=active, decisions=1, events=1
- session_8ca6443d-f284-4647-b53e-497d93dd76d3: ok, topic=session continuity benchmark 2026-05-16 same_claude_session, status=active, decisions=3, events=5
- session_e21533fc-d8f5-4ad7-aa26-46f0f405ace6: ok, topic=session continuity benchmark 2026-05-16 router_exact_topic, status=active, decisions=6, events=9
- session_5299047a-a347-4bc3-80ba-5a3f919a2388: ok, topic=session continuity benchmark 2026-05-16 router_explicit_session, status=active, decisions=6, events=9

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
      "latest_created_at": "2026-05-16T18:49:37.677Z"
    },
    {
      "selected_path": "claude_consult_explicit_session",
      "count": 4,
      "latest_created_at": "2026-05-16T18:50:11.088Z"
    },
    {
      "selected_path": "claude_consult_new_session",
      "count": 2,
      "latest_created_at": "2026-05-16T18:49:45.971Z"
    }
  ],
  "metadata_health": {
    "event_counts": [
      {
        "event_type": "parse_failed",
        "count": 1,
        "latest_created_at": "2026-05-16T18:48:21.836Z"
      }
    ],
    "affected_sessions": [
      {
        "session_id": "session_10db8c3f-3072-4408-a770-9320528f2566",
        "topic": "session continuity benchmark 2026-05-16 fresh_each_turn T4 9hg6by",
        "session_status": "active",
        "parse_failed_count": 1,
        "threshold_exceeded_count": 0,
        "latest_created_at": "2026-05-16T18:48:21.836Z",
        "latest_error": "SESSION_UPDATE_JSON block missing",
        "latest_raw_response_path": "/root/projects/AgentSessionRouter/.claude-session-router/raw/session_10db8c3f-3072-4408-a770-9320528f2566-1778957301835.txt"
      }
    ],
    "samples": [
      {
        "event_id": 463,
        "session_id": "session_10db8c3f-3072-4408-a770-9320528f2566",
        "topic": "session continuity benchmark 2026-05-16 fresh_each_turn T4 9hg6by",
        "session_status": "active",
        "event_type": "parse_failed",
        "question": null,
        "raw_response_path": "/root/projects/AgentSessionRouter/.claude-session-router/raw/session_10db8c3f-3072-4408-a770-9320528f2566-1778957301835.txt",
        "error": "SESSION_UPDATE_JSON block missing",
        "created_at": "2026-05-16T18:48:21.836Z"
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

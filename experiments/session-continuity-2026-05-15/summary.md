# Session Continuity Benchmark

Started: 2026-05-15T19:28:16.457Z
Finished: 2026-05-15T19:30:35.552Z
Project id: AgentSessionRouter-continuity-2026-05-15

## Purpose

This benchmark measures the original v1 router value: whether multiple questions in one durable session preserve conversational decisions better than cold/fresh calls.

Current cluster shadow eval still measures `cluster_consult` against `direct_fresh`; this benchmark is separate and should not be conflated with shadow eval.

## Method Summary

| Method | Calls | Failed | Unique sessions | Avg score all | Avg score memory probes | Tool markup | Missing-memory admissions | Total duration ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fresh_each_turn | 5 | 0 | 5 | 1.6 | 0.67 | 0 | 2 | 47439 |
| same_claude_session | 5 | 0 | 1 | 3 | 3 | 0 | 0 | 20774 |
| router_exact_topic | 5 | 0 | 1 | 3 | 3 | 0 | 0 | 19943 |
| router_explicit_session | 5 | 0 | 1 | 2.8 | 2.67 | 0 | 0 | 47367 |

## Route Counts

```json
{
  "claude_consult": 10,
  "claude_consult_auto": 2,
  "claude_consult_existing_session": 4,
  "claude_consult_explicit_session": 4
}
```

## Calls

| Method | Turn | Kind | Status | Score | Selected path | Session | Missing requirements |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| fresh_each_turn | T1 | seed | ok | 3 |  | session_d2d1b595-106b-402e-8a06-59e56197ee42 |  |
| fresh_each_turn | T2 | memory_probe | ok | 1 |  | session_04fbf7ca-3f9f-4b19-832f-0e98d45c9b5b | alpha, caller-answer |
| fresh_each_turn | T3 | seed | ok | 3 |  | session_b38b25c1-3585-4ac1-a891-20429420cc4a |  |
| fresh_each_turn | T4 | memory_probe | ok | 0 |  | session_141272cd-fbd3-4822-a0fa-beb8820d65ec | alpha, beta, caller-answer, revalidation-fallback |
| fresh_each_turn | T5 | synthesis | ok | 1 |  | session_d8bd6365-d381-402e-9a45-c5d3b62adeef | alpha, beta |
| same_claude_session | T1 | seed | ok | 3 |  | session_fc11b933-295b-44bc-87bd-1ad068dc0393 |  |
| same_claude_session | T2 | memory_probe | ok | 3 |  | session_fc11b933-295b-44bc-87bd-1ad068dc0393 |  |
| same_claude_session | T3 | seed | ok | 3 |  | session_fc11b933-295b-44bc-87bd-1ad068dc0393 |  |
| same_claude_session | T4 | memory_probe | ok | 3 |  | session_fc11b933-295b-44bc-87bd-1ad068dc0393 |  |
| same_claude_session | T5 | synthesis | ok | 3 |  | session_fc11b933-295b-44bc-87bd-1ad068dc0393 |  |
| router_exact_topic | T1 | seed | ok | 3 | claude_consult_auto | session_d15502ee-1437-436a-9583-e97dec442273 |  |
| router_exact_topic | T2 | memory_probe | ok | 3 | claude_consult_existing_session | session_d15502ee-1437-436a-9583-e97dec442273 |  |
| router_exact_topic | T3 | seed | ok | 3 | claude_consult_existing_session | session_d15502ee-1437-436a-9583-e97dec442273 |  |
| router_exact_topic | T4 | memory_probe | ok | 3 | claude_consult_existing_session | session_d15502ee-1437-436a-9583-e97dec442273 |  |
| router_exact_topic | T5 | synthesis | ok | 3 | claude_consult_existing_session | session_d15502ee-1437-436a-9583-e97dec442273 |  |
| router_explicit_session | T1 | seed | ok | 3 | claude_consult_auto | session_1abce066-f37f-4874-ae0e-ce644a4e11ef |  |
| router_explicit_session | T2 | memory_probe | ok | 3 | claude_consult_explicit_session | session_1abce066-f37f-4874-ae0e-ce644a4e11ef |  |
| router_explicit_session | T3 | seed | ok | 3 | claude_consult_explicit_session | session_1abce066-f37f-4874-ae0e-ce644a4e11ef |  |
| router_explicit_session | T4 | memory_probe | ok | 3 | claude_consult_explicit_session | session_1abce066-f37f-4874-ae0e-ce644a4e11ef |  |
| router_explicit_session | T5 | synthesis | ok | 2 | claude_consult_explicit_session | session_1abce066-f37f-4874-ae0e-ce644a4e11ef | session-benchmark |

## Findings

- Durable v1 session context beat fresh-each-turn on memory probes (3 vs 0.67).
- router_consult exact-topic reuse matched or exceeded direct same-session continuity (3 vs 3).
- router_consult explicit-session continuity trailed direct same-session continuity (2.67 vs 3); inspect the synthesis answer and scoring rubric before treating this as a route failure.
- SESSION_UPDATE_JSON metadata parsed during the run: 8 inspected session(s), 19 stored decision(s).
- Do not use direct_fresh shadow quality as proof about durable session memory; this benchmark measures that separately.

## Session Metadata

- session_d2d1b595-106b-402e-8a06-59e56197ee42: ok, topic=session continuity benchmark 2026-05-15 fresh_each_turn T1 tmiwd0, status=active, decisions=1, events=1
- session_04fbf7ca-3f9f-4b19-832f-0e98d45c9b5b: ok, topic=session continuity benchmark 2026-05-15 fresh_each_turn T2 994iwn, status=active, decisions=1, events=1
- session_b38b25c1-3585-4ac1-a891-20429420cc4a: ok, topic=session continuity benchmark 2026-05-15 fresh_each_turn T3 uqi29g, status=active, decisions=1, events=1
- session_141272cd-fbd3-4822-a0fa-beb8820d65ec: ok, topic=session continuity benchmark 2026-05-15 fresh_each_turn T4 dlfltd, status=active, decisions=1, events=1
- session_d8bd6365-d381-402e-9a45-c5d3b62adeef: ok, topic=session continuity benchmark 2026-05-15 fresh_each_turn T5 5os5ne, status=active, decisions=2, events=1
- session_fc11b933-295b-44bc-87bd-1ad068dc0393: ok, topic=session continuity benchmark 2026-05-15 same_claude_session, status=active, decisions=6, events=5
- session_d15502ee-1437-436a-9583-e97dec442273: ok, topic=session continuity benchmark 2026-05-15 router_exact_topic, status=active, decisions=4, events=9
- session_1abce066-f37f-4874-ae0e-ce644a4e11ef: ok, topic=session continuity benchmark 2026-05-15 router_explicit_session, status=active, decisions=3, events=9

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
      "latest_created_at": "2026-05-15T19:29:41.916Z"
    },
    {
      "selected_path": "claude_consult_explicit_session",
      "count": 4,
      "latest_created_at": "2026-05-15T19:30:21.335Z"
    },
    {
      "selected_path": "claude_consult_auto",
      "count": 2,
      "latest_created_at": "2026-05-15T19:29:48.175Z"
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
      "action": "Inspect route_health.samples for claude_consult_auto decisions; add explicit cluster_id/session_id or improve topic hints if these become slow.",
      "reason": "2 router_consult call(s) delegated to claude_consult auto-routing in the recent window."
    }
  ]
}
```

# Session Continuity Benchmark

Gate 13 pre-serving baseline.

Commit: `a8fa199662da27070d5c44ead6e36a8e661e76f0`

Runtime architectural-memory serving: `false`

Serving wiring enabled: `false`

Known scorer artifact baseline: `router_exact_topic` T2/T4/T5 = `[3,3,2]`.
T5 missed only the narrow `session-benchmark` wording requirement while
preserving the substantive ALPHA-17/BETA-29 reasoning. Future post-serving
comparisons must compare against this baseline unless the scorer changes.

Started: 2026-05-17T06:09:00.006Z
Finished: 2026-05-17T06:12:39.044Z
Project id: AgentSessionRouter-continuity-2026-05-17-gate13-baseline-a8fa199

## Purpose

This benchmark measures the original v1 router value: whether multiple questions in one durable session preserve conversational decisions better than cold/fresh calls.

Current cluster shadow eval still measures `cluster_consult` against `direct_fresh`; this benchmark is separate and should not be conflated with shadow eval.

## Method Summary

| Method | Calls | Failed | Unique sessions | Avg score all | Avg score memory probes | Avg score memory+synthesis | Tool markup | Missing-memory admissions | Total duration ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fresh_each_turn | 5 | 0 | 5 | 1.6 | 0.5 | 0.67 | 0 | 2 | 91835 |
| same_claude_session | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 50261 |
| router_exact_topic | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 36608 |
| router_explicit_session | 5 | 0 | 1 | 2.8 | 3 | 2.67 | 0 | 0 | 37827 |

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
| fresh_each_turn | T1 | seed | ok | 3 |  | session_d0ce58ba-4fcc-46bb-9a1e-fe67590e804d |  |
| fresh_each_turn | T2 | memory_probe | ok | 1 |  | session_2616cac2-c1da-4132-bef6-d28f2ac398db | alpha, caller-answer |
| fresh_each_turn | T3 | seed | ok | 3 |  | session_2b90d173-6cb0-424d-9e8a-5ce1941ee1b6 |  |
| fresh_each_turn | T4 | memory_probe | ok | 0 |  | session_d497b720-2d96-498f-82c4-a5b19d3d0b6b | alpha, beta, caller-answer, revalidation-fallback |
| fresh_each_turn | T5 | synthesis | ok | 1 |  | session_ff68e574-0e51-445a-b0f7-31d5c21abc19 | alpha, beta, session-benchmark |
| same_claude_session | T1 | seed | ok | 3 |  | session_5f2a705b-6533-4ce1-9ce2-14871568b55d |  |
| same_claude_session | T2 | memory_probe | ok | 3 |  | session_5f2a705b-6533-4ce1-9ce2-14871568b55d |  |
| same_claude_session | T3 | seed | ok | 3 |  | session_5f2a705b-6533-4ce1-9ce2-14871568b55d |  |
| same_claude_session | T4 | memory_probe | ok | 3 |  | session_5f2a705b-6533-4ce1-9ce2-14871568b55d |  |
| same_claude_session | T5 | synthesis | ok | 2 |  | session_5f2a705b-6533-4ce1-9ce2-14871568b55d | session-benchmark |
| router_exact_topic | T1 | seed | ok | 3 | claude_consult_new_session | session_0c8fc0a3-d827-4714-9b7a-8035c0f5280f |  |
| router_exact_topic | T2 | memory_probe | ok | 3 | claude_consult_existing_session | session_0c8fc0a3-d827-4714-9b7a-8035c0f5280f |  |
| router_exact_topic | T3 | seed | ok | 3 | claude_consult_existing_session | session_0c8fc0a3-d827-4714-9b7a-8035c0f5280f |  |
| router_exact_topic | T4 | memory_probe | ok | 3 | claude_consult_existing_session | session_0c8fc0a3-d827-4714-9b7a-8035c0f5280f |  |
| router_exact_topic | T5 | synthesis | ok | 2 | claude_consult_existing_session | session_0c8fc0a3-d827-4714-9b7a-8035c0f5280f | session-benchmark |
| router_explicit_session | T1 | seed | ok | 3 | claude_consult_new_session | session_7b23cc00-6670-4fcb-9fe9-89232561fcae |  |
| router_explicit_session | T2 | memory_probe | ok | 3 | claude_consult_explicit_session | session_7b23cc00-6670-4fcb-9fe9-89232561fcae |  |
| router_explicit_session | T3 | seed | ok | 3 | claude_consult_explicit_session | session_7b23cc00-6670-4fcb-9fe9-89232561fcae |  |
| router_explicit_session | T4 | memory_probe | ok | 3 | claude_consult_explicit_session | session_7b23cc00-6670-4fcb-9fe9-89232561fcae |  |
| router_explicit_session | T5 | synthesis | ok | 2 | claude_consult_explicit_session | session_7b23cc00-6670-4fcb-9fe9-89232561fcae | session-benchmark |

## Findings

- Durable v1 session context beat fresh-each-turn on memory probes (3 vs 0.5).
- router_consult exact-topic reuse matched or exceeded direct same-session continuity (3 vs 3).
- router_consult explicit-session continuity matched or exceeded direct same-session continuity (3 vs 3).
- SESSION_UPDATE_JSON metadata parsed during the run: 8 inspected session(s), 18 stored decision(s).
- Do not use direct_fresh shadow quality as proof about durable session memory; this benchmark measures that separately.

## Session Metadata

- session_d0ce58ba-4fcc-46bb-9a1e-fe67590e804d: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 fresh_each_turn T1 304ikg, status=active, decisions=1, events=1
- session_2616cac2-c1da-4132-bef6-d28f2ac398db: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 fresh_each_turn T2 36um5i, status=active, decisions=0, events=1
- session_2b90d173-6cb0-424d-9e8a-5ce1941ee1b6: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 fresh_each_turn T3 4eg1fd, status=active, decisions=1, events=1
- session_d497b720-2d96-498f-82c4-a5b19d3d0b6b: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 fresh_each_turn T4 b2q2vr, status=active, decisions=1, events=1
- session_ff68e574-0e51-445a-b0f7-31d5c21abc19: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 fresh_each_turn T5 r1bqnh, status=active, decisions=2, events=1
- session_5f2a705b-6533-4ce1-9ce2-14871568b55d: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 same_claude_session, status=active, decisions=3, events=5
- session_0c8fc0a3-d827-4714-9b7a-8035c0f5280f: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 router_exact_topic, status=active, decisions=6, events=9
- session_7b23cc00-6670-4fcb-9fe9-89232561fcae: ok, topic=session continuity benchmark 2026-05-17-gate13-baseline-a8fa199 router_explicit_session, status=active, decisions=4, events=9

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
      "latest_created_at": "2026-05-17T06:11:45.533Z"
    },
    {
      "selected_path": "claude_consult_explicit_session",
      "count": 4,
      "latest_created_at": "2026-05-17T06:12:28.248Z"
    },
    {
      "selected_path": "claude_consult_new_session",
      "count": 2,
      "latest_created_at": "2026-05-17T06:12:01.165Z"
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

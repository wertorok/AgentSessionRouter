# Router Route Sample

Started: 2026-05-15T18:57:13.135Z
Finished: 2026-05-15T18:58:11.780Z
Project: AgentSessionRouter

## Selection

- Fresh cluster: agentsessionrouter-codebase
- Stale clusters sampled: none
- Primary session: session_e5feff70-5233-4395-906d-0ecb13bbbb69 (router consult shadow eval sample)

## Route Counts In This Script

```json
{
  "cluster_consult_explicit": 3,
  "none": 1
}
```

## Monitor Route Counts

```json
[
  {
    "selected_path": "cluster_consult_explicit",
    "count": 37,
    "latest_created_at": "2026-05-15T18:57:38.034Z"
  },
  {
    "selected_path": "claude_consult_explicit_session",
    "count": 21,
    "latest_created_at": "2026-05-15T18:52:41.351Z"
  },
  {
    "selected_path": "claude_consult_existing_session",
    "count": 18,
    "latest_created_at": "2026-05-15T18:53:06.848Z"
  },
  {
    "selected_path": "claude_consult_auto",
    "count": 3,
    "latest_created_at": "2026-05-15T17:02:39.057Z"
  }
]
```

## Shadow Eval

```json
{
  "enabled": true,
  "total": 118,
  "judged": 118,
  "pending": 0,
  "ok_unjudged": 0,
  "failed_auth": 0,
  "failed_timeout": 0,
  "failed_other": 0,
  "last_created_at": "2026-05-15T18:57:51.351Z",
  "last_judged_at": "2026-05-15T18:58:11.761Z"
}
```

## Diagnostics

```json
{
  "total_calls": 3,
  "failed_calls": 0,
  "not_in_context_answers": 0,
  "tool_markup_answers": 0,
  "empty_answers": 0,
  "slow_over_60s": 0
}
```

## Comparison Stats

```json
[
  {
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-full",
    "n": 30,
    "cluster_q": 1.63,
    "direct_q": 0.13,
    "gap": -1.5,
    "cluster_wins": 19,
    "direct_wins": 0,
    "ties": 11
  },
  {
    "cluster_id": "agentsessionrouter-codebase-rerun",
    "n": 30,
    "cluster_q": 2.17,
    "direct_q": 0.3,
    "gap": -1.87,
    "cluster_wins": 27,
    "direct_wins": 0,
    "ties": 3
  },
  {
    "cluster_id": "agentsessionrouter-codebase",
    "n": 28,
    "cluster_q": 2.75,
    "direct_q": 0.39,
    "gap": -2.36,
    "cluster_wins": 28,
    "direct_wins": 0,
    "ties": 0
  },
  {
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-targeted",
    "n": 10,
    "cluster_q": 2.1,
    "direct_q": 0.1,
    "gap": -2,
    "cluster_wins": 8,
    "direct_wins": 0,
    "ties": 2
  },
  {
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v2",
    "n": 10,
    "cluster_q": 1.8,
    "direct_q": 0.1,
    "gap": -1.7,
    "cluster_wins": 8,
    "direct_wins": 0,
    "ties": 2
  },
  {
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3",
    "n": 10,
    "cluster_q": 1.7,
    "direct_q": 0.3,
    "gap": -1.4,
    "cluster_wins": 9,
    "direct_wins": 0,
    "ties": 1
  }
]
```

## Calls

| Scenario | Selected path | Status | Duration ms | Cluster | Session | NOT IN CONTEXT | Tool markup |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| cluster_A1 | cluster_consult_explicit | ok | 11452 | agentsessionrouter-codebase |  |  |  |
| cluster_A2 | cluster_consult_explicit | ok | 8278 | agentsessionrouter-codebase |  |  |  |
| cluster_A3 | cluster_consult_explicit | ok | 13323 | agentsessionrouter-codebase |  |  |  |
| stale_cluster_matrix_skipped |  | ok |  |  |  |  |  |

## Current Recommendations

```json
[
  {
    "priority": "high",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3",
    "action": "Run cluster_prepare or expand/rebuild this factsheet.",
    "reason": "Cluster is needs_prepare; factsheet factsheet_462264ce-f355-4b3d-bbc6-785a6c518d8f cannot be trusted as current cache."
  },
  {
    "priority": "high",
    "area": "cache",
    "cluster_id": "claude-code-live-workload",
    "action": "Run cluster_prepare or expand/rebuild this factsheet.",
    "reason": "Cluster is needs_prepare; factsheet factsheet_03616a74-e8b6-488b-9395-64e5af913314 cannot be trusted as current cache."
  },
  {
    "priority": "high",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-full",
    "action": "Run cluster_prepare or expand/rebuild this factsheet.",
    "reason": "Cluster is needs_prepare; factsheet factsheet_d27eb28a-7fdc-4ef3-bf24-50501b8dbecd cannot be trusted as current cache."
  },
  {
    "priority": "medium",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-full",
    "action": "Refresh factsheet evidence; selectors or snippets changed.",
    "reason": "Strict evidence revalidation failed 4 time(s)."
  },
  {
    "priority": "medium",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-full",
    "action": "Re-prepare or broaden this cluster if fallback is recurring.",
    "reason": "Router fell back to claude_consult 3 time(s), meaning cache could not serve those calls."
  },
  {
    "priority": "medium",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3",
    "action": "Re-prepare or broaden this cluster if fallback is recurring.",
    "reason": "Router fell back to claude_consult 3 time(s), meaning cache could not serve those calls."
  },
  {
    "priority": "medium",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3",
    "action": "Refresh factsheet evidence; selectors or snippets changed.",
    "reason": "Strict evidence revalidation failed 3 time(s)."
  },
  {
    "priority": "medium",
    "area": "cache",
    "cluster_id": "claude-code-live-workload",
    "action": "Re-prepare or broaden this cluster if fallback is recurring.",
    "reason": "Router fell back to claude_consult 3 time(s), meaning cache could not serve those calls."
  },
  {
    "priority": "medium",
    "area": "cache",
    "cluster_id": "claude-code-live-workload",
    "action": "Refresh factsheet evidence; selectors or snippets changed.",
    "reason": "Strict evidence revalidation failed 3 time(s)."
  },
  {
    "priority": "high",
    "area": "fallback",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-full",
    "action": "Investigate Claude availability and fallback path immediately.",
    "reason": "Fallback failed 1 time(s) in the recent window."
  },
  {
    "priority": "medium",
    "area": "coverage",
    "cluster_id": "agentsessionrouter-codebase",
    "action": "Inspect NOT IN CONTEXT samples and decide whether to expand factsheet or route those questions to claude_consult.",
    "reason": "Cluster produced 1 NOT IN CONTEXT answer(s)."
  },
  {
    "priority": "medium",
    "area": "sessions",
    "action": "Inspect recent session_events and raw responses.",
    "reason": "Session event 'cost_limit_exceeded' has 9 error row(s)."
  },
  {
    "priority": "medium",
    "area": "sessions",
    "action": "Inspect recent session_events and raw responses.",
    "reason": "Session event 'parse_failed' has 9 error row(s)."
  },
  {
    "priority": "medium",
    "area": "sessions",
    "action": "Inspect recent session_events and raw responses.",
    "reason": "Session event 'token_anomaly' has 2 error row(s)."
  },
  {
    "priority": "medium",
    "area": "sessions",
    "action": "Inspect recent session_events and raw responses.",
    "reason": "Session event 'health_check_failed' has 1 error row(s)."
  },
  {
    "priority": "medium",
    "area": "metadata",
    "action": "Inspect metadata_health.samples raw responses and tighten SESSION_UPDATE_JSON prompting if failures repeat.",
    "reason": "9 SESSION_UPDATE_JSON parse failure(s) occurred in the recent window."
  },
  {
    "priority": "low",
    "area": "routing",
    "action": "Inspect route_health.samples for claude_consult_auto decisions; add explicit cluster_id/session_id or improve topic hints if these become slow.",
    "reason": "3 router_consult call(s) delegated to claude_consult auto-routing in the recent window."
  },
  {
    "priority": "medium",
    "area": "latency",
    "action": "Prefer cluster_consult for covered questions, or inspect the raw Claude response when direct consults approach the caller timeout boundary.",
    "reason": "Session event 'new_session' exceeded the slow-call threshold 1 time(s); max duration 302712ms."
  },
  {
    "priority": "medium",
    "area": "latency",
    "action": "Treat this as direct-discovery/context bloat: reuse an existing session or a covered cluster before repeating a broad new_session consult.",
    "reason": "Slow new_session used 78258 input tokens over 302712ms for topic 'project roadmap after v2.3.1'. Raw response: /root/projects/AgentSessionRouter/.claude-session-router/raw/session_e65145e0-1911-4a87-ad7d-8477254bdbb2-1778846888340.txt."
  }
]
```

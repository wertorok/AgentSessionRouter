# Router Route Sample

Started: 2026-05-15T16:52:20.053Z
Finished: 2026-05-15T16:55:42.754Z
Project: AgentSessionRouter

## Selection

- Fresh cluster: agentsessionrouter-codebase
- Primary session: session_11d18ee8-3799-443f-8f5f-ecd866db9e57 (v2.1 shadow eval architecture)

## Route Counts In This Script

```json
{
  "cluster_consult_explicit": 10,
  "claude_consult_explicit_session": 4,
  "claude_consult_existing_session": 3,
  "claude_consult_auto": 2
}
```

## Monitor Route Counts

```json
[
  {
    "selected_path": "cluster_consult_explicit",
    "count": 12,
    "latest_created_at": "2026-05-15T16:53:52.477Z"
  },
  {
    "selected_path": "claude_consult_explicit_session",
    "count": 7,
    "latest_created_at": "2026-05-15T16:54:35.545Z"
  },
  {
    "selected_path": "claude_consult_existing_session",
    "count": 3,
    "latest_created_at": "2026-05-15T16:55:08.228Z"
  },
  {
    "selected_path": "claude_consult_auto",
    "count": 2,
    "latest_created_at": "2026-05-15T16:55:23.915Z"
  }
]
```

## Shadow Eval

```json
{
  "enabled": true,
  "total": 102,
  "judged": 102,
  "pending": 0,
  "ok_unjudged": 0,
  "failed_auth": 0,
  "failed_timeout": 0,
  "failed_other": 0,
  "last_created_at": "2026-05-15T16:54:09.755Z",
  "last_judged_at": "2026-05-15T16:54:28.830Z"
}
```

## Calls

| Scenario | Selected path | Status | Duration ms | Cluster | Session |
| --- | --- | --- | ---: | --- | --- |
| cluster_A1 | cluster_consult_explicit | ok | 7418 | agentsessionrouter-codebase |  |
| cluster_A2 | cluster_consult_explicit | ok | 17370 | agentsessionrouter-codebase |  |
| cluster_A3 | cluster_consult_explicit | ok | 10654 | agentsessionrouter-codebase |  |
| cluster_A4 | cluster_consult_explicit | ok | 5965 | agentsessionrouter-codebase |  |
| cluster_A5 | cluster_consult_explicit | ok | 4873 | agentsessionrouter-codebase |  |
| cluster_B1 | cluster_consult_explicit | ok | 5041 | agentsessionrouter-codebase |  |
| cluster_B2 | cluster_consult_explicit | ok | 7264 | agentsessionrouter-codebase |  |
| cluster_B3 | cluster_consult_explicit | ok | 15019 | agentsessionrouter-codebase |  |
| cluster_C1 | cluster_consult_explicit | ok | 16723 | agentsessionrouter-codebase |  |
| cluster_C2 | cluster_consult_explicit | ok | 17284 | agentsessionrouter-codebase |  |
| explicit_session_1 | claude_consult_explicit_session | ok | 7868 |  | session_11d18ee8-3799-443f-8f5f-ecd866db9e57 |
| explicit_session_2 | claude_consult_explicit_session | ok | 11661 |  | session_11d18ee8-3799-443f-8f5f-ecd866db9e57 |
| explicit_session_3 | claude_consult_explicit_session | ok | 6259 |  | session_11d18ee8-3799-443f-8f5f-ecd866db9e57 |
| explicit_session_4 | claude_consult_explicit_session | ok | 13757 |  | session_11d18ee8-3799-443f-8f5f-ecd866db9e57 |
| exact_topic_1 | claude_consult_existing_session | ok | 6002 |  | session_11d18ee8-3799-443f-8f5f-ecd866db9e57 |
| exact_topic_2 | claude_consult_existing_session | ok | 12924 |  | session_11d18ee8-3799-443f-8f5f-ecd866db9e57 |
| exact_topic_3 | claude_consult_existing_session | ok | 13076 |  | session_11d18ee8-3799-443f-8f5f-ecd866db9e57 |
| auto_1 | claude_consult_auto | ok | 2610 |  | session_570b63cb-efa6-4345-96bc-84d875385637 |
| auto_2 | claude_consult_auto | ok | 18832 |  | session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4 |

## Current Recommendations

```json
[
  {
    "priority": "high",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-full",
    "action": "Run cluster_prepare or expand/rebuild this factsheet.",
    "reason": "Cluster is stale; factsheet factsheet_d27eb28a-7fdc-4ef3-bf24-50501b8dbecd cannot be trusted as current cache."
  },
  {
    "priority": "high",
    "area": "cache",
    "cluster_id": "claude-code-live-workload",
    "action": "Run cluster_prepare or expand/rebuild this factsheet.",
    "reason": "Cluster is stale; factsheet factsheet_03616a74-e8b6-488b-9395-64e5af913314 cannot be trusted as current cache."
  },
  {
    "priority": "high",
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3",
    "action": "Run cluster_prepare or expand/rebuild this factsheet.",
    "reason": "Cluster is stale; factsheet factsheet_462264ce-f355-4b3d-bbc6-785a6c518d8f cannot be trusted as current cache."
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
    "area": "cache",
    "cluster_id": "agentsessionrouter-codebase-reprepared-2026-05-15-full",
    "action": "Refresh factsheet evidence; selectors or snippets changed.",
    "reason": "Strict evidence revalidation failed 1 time(s)."
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
    "reason": "Session event 'parse_failed' has 2 error row(s)."
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
    "reason": "2 SESSION_UPDATE_JSON parse failure(s) occurred in the recent window."
  },
  {
    "priority": "low",
    "area": "routing",
    "action": "Inspect route_health.samples for claude_consult_auto decisions; add explicit cluster_id/session_id or improve topic hints if these become slow.",
    "reason": "2 router_consult call(s) delegated to claude_consult auto-routing in the recent window."
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

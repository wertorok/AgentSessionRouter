# MCP Workload Matrix (stub)

Started: 2026-05-14T23:51:30.747Z
Finished: 2026-05-14T23:51:32.692Z
Project dir: /tmp/asr-mcp-matrix-stub-5vVxJj/project

Passed: 18
Failed: 0

## Checks

- PASS tool_discovery_all_modes (n/ams)
- PASS router_status_baseline (5ms)
- PASS router_monitor_baseline (2ms)
- PASS v1_claude_consult_new_session (45ms)
- PASS v1_claude_consult_explicit_resume_or_orphan_recovery (65ms)
- PASS v1_session_inspect (3ms)
- PASS v2_cluster_consult_fast_path_with_shadow (656ms)
- PASS shadow_comparison_judged_after_cluster_consult (4ms)
- PASS cluster_refresh_verify_only (12ms)
- PASS evidence_revalidation_success_selector_moved (52ms)
- PASS evidence_revalidation_failure_falls_back (71ms)
- PASS evidence_revalidation_failure_snippet_changed_falls_back (61ms)
- PASS static_policy_deny_falls_back (65ms)
- PASS missing_cluster_falls_back (48ms)
- PASS cluster_prepare_llm_verifier_promotes_or_rejects_semantically (52ms)
- PASS v2_llm_trusted_cluster_consult_with_deny_policy (252ms)
- PASS comparison_list_drilldown (2ms)
- PASS router_monitor_after_workload (2ms)

## DB Snapshot

```json
{
  "session_events": [
    {
      "event_type": "new_session",
      "count": 6
    },
    {
      "event_type": "health_probe_passed",
      "count": 1
    },
    {
      "event_type": "orphan_recovery",
      "count": 1
    },
    {
      "event_type": "unknown_claude_version",
      "count": 1
    }
  ],
  "cluster_events": [
    {
      "cluster_id": "missing-workload-cluster",
      "event_type": "cluster_fallback_to_claude_consult",
      "count": 1
    },
    {
      "cluster_id": "monitor-decay",
      "event_type": "cluster_created",
      "count": 1
    },
    {
      "cluster_id": "monitor-decay",
      "event_type": "cluster_fallback_to_claude_consult",
      "count": 1
    },
    {
      "cluster_id": "monitor-decay",
      "event_type": "cluster_refresh_required",
      "count": 1
    },
    {
      "cluster_id": "monitor-decay",
      "event_type": "evidence_revalidation_failed",
      "count": 1
    },
    {
      "cluster_id": "monitor-decay",
      "event_type": "factsheet_static_verified",
      "count": 1
    },
    {
      "cluster_id": "monitor-llm",
      "event_type": "cluster_consult",
      "count": 1
    },
    {
      "cluster_id": "monitor-llm",
      "event_type": "cluster_created",
      "count": 1
    },
    {
      "cluster_id": "monitor-llm",
      "event_type": "factsheet_llm_verified",
      "count": 1
    },
    {
      "cluster_id": "monitor-llm",
      "event_type": "llm_verifier",
      "count": 1
    },
    {
      "cluster_id": "monitor-snippet-decay",
      "event_type": "cluster_created",
      "count": 1
    },
    {
      "cluster_id": "monitor-snippet-decay",
      "event_type": "cluster_fallback_to_claude_consult",
      "count": 1
    },
    {
      "cluster_id": "monitor-snippet-decay",
      "event_type": "cluster_refresh_required",
      "count": 1
    },
    {
      "cluster_id": "monitor-snippet-decay",
      "event_type": "evidence_revalidation_failed",
      "count": 1
    },
    {
      "cluster_id": "monitor-snippet-decay",
      "event_type": "factsheet_static_verified",
      "count": 1
    },
    {
      "cluster_id": "monitor-static",
      "event_type": "cluster_consult",
      "count": 2
    },
    {
      "cluster_id": "monitor-static",
      "event_type": "cluster_created",
      "count": 1
    },
    {
      "cluster_id": "monitor-static",
      "event_type": "cluster_refresh",
      "count": 1
    },
    {
      "cluster_id": "monitor-static",
      "event_type": "cluster_refresh_required",
      "count": 1
    },
    {
      "cluster_id": "monitor-static",
      "event_type": "evidence_revalidated",
      "count": 1
    },
    {
      "cluster_id": "monitor-static",
      "event_type": "factsheet_static_verified",
      "count": 2
    },
    {
      "cluster_id": "monitor-static-deny",
      "event_type": "cluster_created",
      "count": 1
    },
    {
      "cluster_id": "monitor-static-deny",
      "event_type": "cluster_fallback_to_claude_consult",
      "count": 1
    },
    {
      "cluster_id": "monitor-static-deny",
      "event_type": "factsheet_static_verified",
      "count": 1
    }
  ],
  "comparisons": [
    {
      "cluster_id": "monitor-llm",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-14T23:51:32.459Z"
    },
    {
      "cluster_id": "monitor-static",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-14T23:51:32.082Z"
    },
    {
      "cluster_id": "monitor-static",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-14T23:51:31.513Z"
    }
  ],
  "clusters": [
    {
      "id": "monitor-decay",
      "status": "needs_prepare",
      "trust_state": "untrusted",
      "static_factsheet_policy": "allow"
    },
    {
      "id": "monitor-llm",
      "status": "active",
      "trust_state": "llm_verified",
      "static_factsheet_policy": "deny"
    },
    {
      "id": "monitor-snippet-decay",
      "status": "needs_prepare",
      "trust_state": "untrusted",
      "static_factsheet_policy": "allow"
    },
    {
      "id": "monitor-static",
      "status": "active",
      "trust_state": "static_verified",
      "static_factsheet_policy": "allow"
    },
    {
      "id": "monitor-static-deny",
      "status": "needs_prepare",
      "trust_state": "untrusted",
      "static_factsheet_policy": "deny"
    }
  ]
}
```
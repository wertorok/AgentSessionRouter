# MCP Workload Matrix (stub)

Started: 2026-05-16T10:15:24.262Z
Finished: 2026-05-16T10:15:26.555Z
Project dir: /tmp/asr-mcp-matrix-stub-3hyKor/project

Passed: 25
Failed: 0

## Checks

- PASS tool_discovery_all_modes (n/ams)
- PASS router_status_baseline (3ms)
- PASS router_monitor_baseline (3ms)
- PASS v1_claude_consult_new_session (43ms)
- PASS v1_claude_consult_explicit_resume_or_orphan_recovery (46ms)
- PASS v1_session_inspect (3ms)
- PASS router_dry_run_observe_only (6ms)
- PASS session_update_success_metadata_path (41ms)
- PASS session_update_parse_failure_threshold_archives (433ms)
- PASS session_update_archived_bootstrap_replacement (46ms)
- PASS router_consult_explicit_cluster_route (132ms)
- PASS v2_cluster_consult_fast_path_with_shadow (553ms)
- PASS shadow_comparison_judged_after_cluster_consult (4ms)
- PASS cluster_refresh_verify_only (11ms)
- PASS cluster_reprepare_from_latest_factsheet (9ms)
- PASS cluster_reprepare_coverage_drop_visible_in_monitor (15ms)
- PASS evidence_revalidation_success_selector_moved (66ms)
- PASS evidence_revalidation_failure_falls_back (63ms)
- PASS evidence_revalidation_failure_snippet_changed_falls_back (66ms)
- PASS static_policy_deny_falls_back (54ms)
- PASS missing_cluster_falls_back (50ms)
- PASS cluster_prepare_llm_verifier_promotes_or_rejects_semantically (41ms)
- PASS v2_llm_trusted_cluster_consult_with_deny_policy (250ms)
- PASS comparison_list_drilldown (1ms)
- PASS router_monitor_after_workload (4ms)

## DB Snapshot

```json
{
  "session_events": [
    {
      "event_type": "consult",
      "count": 10
    },
    {
      "event_type": "parse_failed",
      "count": 10
    },
    {
      "event_type": "new_session",
      "count": 8
    },
    {
      "event_type": "archive",
      "count": 1
    },
    {
      "event_type": "health_probe_passed",
      "count": 1
    },
    {
      "event_type": "parse_failed_threshold_exceeded",
      "count": 1
    },
    {
      "event_type": "router_route_decision",
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
      "cluster_id": "monitor-reprepare-drop",
      "event_type": "cluster_created",
      "count": 1
    },
    {
      "cluster_id": "monitor-reprepare-drop",
      "event_type": "cluster_reprepare",
      "count": 1
    },
    {
      "cluster_id": "monitor-reprepare-drop",
      "event_type": "factsheet_partially_static_verified",
      "count": 1
    },
    {
      "cluster_id": "monitor-reprepare-drop",
      "event_type": "factsheet_static_verified",
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
      "count": 3
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
      "count": 2
    },
    {
      "cluster_id": "monitor-static",
      "event_type": "cluster_reprepare",
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
      "count": 3
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
      "created_at": "2026-05-16T10:15:26.324Z"
    },
    {
      "cluster_id": "monitor-static",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-16T10:15:25.975Z"
    },
    {
      "cluster_id": "monitor-static",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-16T10:15:25.359Z"
    },
    {
      "cluster_id": "monitor-static",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-16T10:15:25.306Z"
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
      "id": "monitor-reprepare-drop",
      "status": "active",
      "trust_state": "partial_static",
      "static_factsheet_policy": "allow"
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
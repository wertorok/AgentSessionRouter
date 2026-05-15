# MCP Workload Matrix (stub)

Started: 2026-05-15T15:51:32.879Z
Finished: 2026-05-15T15:51:35.489Z
Project dir: /tmp/asr-mcp-matrix-stub-yGrs0e/project

Passed: 21
Failed: 0

## Checks

- PASS tool_discovery_all_modes (n/ams)
- PASS router_status_baseline (6ms)
- PASS router_monitor_baseline (4ms)
- PASS v1_claude_consult_new_session (61ms)
- PASS v1_claude_consult_explicit_resume_or_orphan_recovery (51ms)
- PASS v1_session_inspect (3ms)
- PASS session_update_success_metadata_path (48ms)
- PASS session_update_parse_failure_threshold_archives (624ms)
- PASS session_update_archived_bootstrap_replacement (89ms)
- PASS v2_cluster_consult_fast_path_with_shadow (630ms)
- PASS shadow_comparison_judged_after_cluster_consult (4ms)
- PASS cluster_refresh_verify_only (32ms)
- PASS evidence_revalidation_success_selector_moved (64ms)
- PASS evidence_revalidation_failure_falls_back (59ms)
- PASS evidence_revalidation_failure_snippet_changed_falls_back (54ms)
- PASS static_policy_deny_falls_back (54ms)
- PASS missing_cluster_falls_back (72ms)
- PASS cluster_prepare_llm_verifier_promotes_or_rejects_semantically (58ms)
- PASS v2_llm_trusted_cluster_consult_with_deny_policy (257ms)
- PASS comparison_list_drilldown (1ms)
- PASS router_monitor_after_workload (3ms)

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
      "created_at": "2026-05-15T15:51:35.261Z"
    },
    {
      "cluster_id": "monitor-static",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-15T15:51:34.884Z"
    },
    {
      "cluster_id": "monitor-static",
      "shadow_status": "ok",
      "preferred": "tie",
      "cluster_score": 3,
      "direct_score": 3,
      "created_at": "2026-05-15T15:51:34.285Z"
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
# Phase 7 Gate 4 Lead-Session Review Request

Generated from: `experiments/architectural-memory-dry-run-2026-05-16/dry-run-report.json`
Dry-run generated_at: 2026-05-16T20:37:05.154Z
Ambiguous candidates in this request: 36

Gate 4 resolves ambiguous candidates only. It does not promote memory, write clusters, or mutate runtime state.

For each candidate, lead session must return APPROVED, REJECTED, or SUSPENDED.

```json
[
  {
    "id": "AMB-SD-000007",
    "text": "Shadow must use dedicated lock namespace (shadow:${projectId}) separate from production locks",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000008",
    "text": "New shadow_comparisons table only; shadow data never mixes with cluster_events or session_events",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "project-architecture",
      "reason": "Mentions router-specific artifacts or implementation vocabulary.",
      "scope_condition": "Applies inside AgentSessionRouter unless future review generalizes it."
    }
  },
  {
    "id": "AMB-SD-000035",
    "text": "Cluster health metrics are router-internal only",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000036",
    "text": "External clients must not bypass sanity check based on exposed metrics",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "SUSPENDED",
      "effective_classification": null,
      "reason": "May encode an older router/fallback contract; require lead review before promotion.",
      "scope_condition": "Only valid if current router semantics still match this statement."
    }
  },
  {
    "id": "AMB-SD-000039",
    "text": "Orphaned session replacement must remain transparent; dead sessions are never silently reused",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000040",
    "text": "Exact-topic session deduplication must be preserved across explicit session_id routing",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "project-architecture",
      "reason": "Mentions router-specific artifacts or implementation vocabulary.",
      "scope_condition": "Applies inside AgentSessionRouter unless future review generalizes it."
    }
  },
  {
    "id": "AMB-SD-000041",
    "text": "Unhealthy cluster must never receive production auto routing traffic",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000050",
    "text": "Stale cluster fallback defaults to conservative routing strategy",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000051",
    "text": "Unverified facts must be re-validated against live metadata before use",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000052",
    "text": "Fallback path emits stale cluster signal, not silent degradation",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000053",
    "text": "Fallback halts on stale cluster, emits signal for operator to resolve",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000060",
    "text": "Secondary session routing must verify metadata health snapshot before using session facts",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000061",
    "text": "Stale-memory risk must be surfaced, not silently suppressed, for older sessions",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000062",
    "text": "Stale facts = halt with signal, never silent degradation",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "SUSPENDED",
      "effective_classification": null,
      "reason": "May encode an older router/fallback contract; require lead review before promotion.",
      "scope_condition": "Only valid if current router semantics still match this statement."
    }
  },
  {
    "id": "AMB-SD-000089",
    "text": "MAINTENANCE.md contains router answer-hygiene rule; never let shadow eval affect caller answers",
    "project_score": 2,
    "transferable_score": 2,
    "project_signals": [
      "project_file_path",
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language",
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "project-architecture",
      "reason": "Mentions router-specific artifacts or implementation vocabulary.",
      "scope_condition": "Applies inside AgentSessionRouter unless future review generalizes it."
    }
  },
  {
    "id": "AMB-SD-000090",
    "text": "MAINTENANCE.md is authoritative for router answer-hygiene rules; shadow eval must not affect caller answers",
    "project_score": 2,
    "transferable_score": 2,
    "project_signals": [
      "project_file_path",
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language",
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "project-architecture",
      "reason": "Mentions router-specific artifacts or implementation vocabulary.",
      "scope_condition": "Applies inside AgentSessionRouter unless future review generalizes it."
    }
  },
  {
    "id": "AMB-SD-000114",
    "text": "MAINTENANCE.md is authoritative; shadow eval must not affect caller answers",
    "project_score": 2,
    "transferable_score": 2,
    "project_signals": [
      "project_file_path",
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language",
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "project-architecture",
      "reason": "Mentions router-specific artifacts or implementation vocabulary.",
      "scope_condition": "Applies inside AgentSessionRouter unless future review generalizes it."
    }
  },
  {
    "id": "AMB-SD-000116",
    "text": "Reject cluster names containing SQL metacharacters (; \" --) at input validation boundary",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_contract_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000121",
    "text": "Consistent fallback routing for all parallel queries until cluster-level revalidation succeeds",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000122",
    "text": "Continue fallback routing for all remaining parallel queries until cluster revalidation",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000123",
    "text": "Maintain fallback during reprepare until successful completion",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_agent_or_router_pattern"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000167",
    "text": "Phase gate model with explicit artifact bundles required per phase",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000168",
    "text": "Codex must escalate architectural conflicts, ambiguous reqs, risk crossing, and design reversals to lead",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000175",
    "text": "Phase summaries are read-only by explicit workflow contract; human replies become new issues",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_contract_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000184",
    "text": "Security patches requiring human sign-off should be explicit exception in Human Touchpoint",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000186",
    "text": "Two-pass auto-classification with staging cluster for global population — not mandatory human review, not fully automatic",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_contract_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000187",
    "text": "Every principle stores applicability clause and lead session rejection mechanism to prevent dogmatization",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000191",
    "text": "Two-cluster memory via existing cluster mechanism: project-architecture + engineering-principles",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000192",
    "text": "Two-pass auto-classification: project vs. transferable candidate via staging cluster, Codex self-reviews",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "generic_contract_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000198",
    "text": "All phase gates are documentation milestones — no code required for decision record acceptance",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-SD-000202",
    "text": "Non-goals sentence must be completed: 'no hidden model-memory authority without a diffable artifact' is syntactically incomplete",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "current_project_session"
    ],
    "transferable_signals": [
      "normative_language"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "reason": "Reads as a transferable agent/router invariant rather than a repository-only fact.",
      "scope_condition": "Apply as advisory guidance; verify against the target project's context."
    }
  },
  {
    "id": "AMB-DOC-0008",
    "text": "Scorer/Rubric Rules (Gate 3): Gate 3 makes the Gate 2 classification explicit and auditable. It adds",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "version_or_phase_marker"
    ],
    "transferable_signals": [
      "spec_source"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "REJECTED",
      "effective_classification": null,
      "reason": "No clear project or transferable signal after Gate 3 scoring tie.",
      "scope_condition": null
    }
  },
  {
    "id": "AMB-DOC-0018",
    "text": "Decisions: - Use verified factsheet cache as source of truth. Do not use opaque Claude session state as the only source of truth.",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "repo_feature_name"
    ],
    "transferable_signals": [
      "spec_source"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "project-architecture",
      "reason": "Mentions router-specific artifacts or implementation vocabulary.",
      "scope_condition": "Applies inside AgentSessionRouter unless future review generalizes it."
    }
  },
  {
    "id": "AMB-DOC-0019",
    "text": "v2.7 Observe-Only Routing Snapshot: Verified on 2026-05-16:",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "version_or_phase_marker"
    ],
    "transferable_signals": [
      "spec_source"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "REJECTED",
      "effective_classification": null,
      "reason": "No clear project or transferable signal after Gate 3 scoring tie.",
      "scope_condition": null
    }
  },
  {
    "id": "AMB-DOC-0020",
    "text": "v2.6 Metadata-Rich Routing Snapshot: Verified on 2026-05-15:",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "version_or_phase_marker"
    ],
    "transferable_signals": [
      "spec_source"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "REJECTED",
      "effective_classification": null,
      "reason": "No clear project or transferable signal after Gate 3 scoring tie.",
      "scope_condition": null
    }
  },
  {
    "id": "AMB-DOC-0026",
    "text": "Cluster Factsheet Re-Prepare: Re-prepare affected cluster factsheets after any architectural PR that changes:",
    "project_score": 1,
    "transferable_score": 1,
    "project_signals": [
      "repo_feature_name"
    ],
    "transferable_signals": [
      "spec_source"
    ],
    "codex_proposed_resolution": {
      "proposed_decision": "APPROVED",
      "effective_classification": "project-architecture",
      "reason": "Mentions router-specific artifacts or implementation vocabulary.",
      "scope_condition": "Applies inside AgentSessionRouter unless future review generalizes it."
    }
  }
]
```


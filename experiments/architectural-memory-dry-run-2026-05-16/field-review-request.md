# Phase 7 Gate 9 Field Review Request

Generated from: `experiments/architectural-memory-dry-run-2026-05-16/field-population-draft.json`
Draft generated_at: 2026-05-16T21:59:45.925Z
Candidates in this request: 93

Gate 9 reviews populated fields only. It does not promote memory, write clusters, import records, or add a serving path.

For each candidate, lead session must return APPROVED_FIELDS, REQUEST_CHANGES, or SUSPEND.

```json
[
  {
    "id": "AMB-SD-000007",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Shadow must use dedicated lock namespace (shadow:${projectId}) separate from production locks",
    "applies_when": [
      "Apply as advisory guidance; verify against target project's namespace isolation pattern."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:7",
    "lead_reason": "Shadow namespace isolation via parameterized 'shadow:${projectId}' is a generic cluster isolation pattern, not an AgentSessionRouter-specific artifact.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000035",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Cluster health metrics are router-internal only",
    "applies_when": [
      "Apply as advisory observability principle; verify target project's internal metrics boundary."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:35",
    "lead_reason": "Uses generic 'router-internal' language without referencing AgentSessionRouter-specific emit mechanisms or signal names.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000039",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Orphaned session replacement must remain transparent; dead sessions are never silently reused",
    "applies_when": [
      "Apply universally to any session management system."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:39",
    "lead_reason": "Session lifecycle transparency — 'dead sessions are never silently reused' — is a universal invariant with no project-specific artifact references.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000041",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Unhealthy cluster must never receive production auto routing traffic",
    "applies_when": [
      "Apply as universal auto-routing safety constraint."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:41",
    "lead_reason": "Unhealthy cluster must never receive production traffic is a universal routing safety invariant; no project-specific artifact references.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000050",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Stale cluster fallback defaults to conservative routing strategy",
    "applies_when": [
      "Apply as default conservative fallback strategy for any cluster-based router."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:50",
    "lead_reason": "Conservative stale fallback is a universal routing pattern; no AgentSessionRouter-specific artifacts referenced.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000051",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Unverified facts must be re-validated against live metadata before use",
    "applies_when": [
      "Apply as universal data quality principle for any facts/metadata system."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:51",
    "lead_reason": "Facts re-validation is a universal data quality invariant; no AgentSessionRouter-specific artifact references in text.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000060",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Secondary session routing must verify metadata health snapshot before using session facts",
    "applies_when": [
      "Apply as universal routing safety principle for session-based routing."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:60",
    "lead_reason": "Metadata health verification before session facts use is a universal routing safety invariant.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000061",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Stale-memory risk must be surfaced, not silently suppressed, for older sessions",
    "applies_when": [
      "Apply universally to any session management system with stale memory risk."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:61",
    "lead_reason": "Stale-memory risk transparency is a universal safety principle; no project-specific artifact references.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000116",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Reject cluster names containing SQL metacharacters (; \" --) at input validation boundary",
    "applies_when": [
      "Apply as universal input validation security principle for any system handling SQL queries."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_5d398351-9c4a-4670-b70c-49398e6ba477;decision:116",
    "lead_reason": "SQL metacharacter rejection at input boundaries is a universal security principle; no project-specific artifact references.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000121",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Consistent fallback routing for all parallel queries until cluster-level revalidation succeeds",
    "applies_when": [
      "Apply as universal routing consistency principle for parallel query systems."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:121",
    "lead_reason": "Consistent fallback routing until revalidation is a universal distributed systems pattern; no project-specific artifacts.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000122",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Continue fallback routing for all remaining parallel queries until cluster revalidation",
    "applies_when": [
      "Apply as universal fallback continuation principle for parallel query systems."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:122",
    "lead_reason": "Continue fallback until cluster revalidation is a universal distributed systems pattern.",
    "counter_evidence": null
  },
  {
    "id": "AMB-SD-000123",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Maintain fallback during reprepare until successful completion",
    "applies_when": [
      "Apply as universal state-maintenance principle during resource repreparation."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:123",
    "lead_reason": "Maintain fallback during reprepare is a universal resilience pattern; no project-specific artifacts.",
    "counter_evidence": null
  },
  {
    "id": "AMB-DOC-0008",
    "memory_product": "engineering-principles",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "statement": "Scorer/Rubric Rules (Gate 3): Gate 3 makes the Gate 2 classification explicit and auditable. It adds",
    "applies_when": [
      "Apply as generic rubric/scorer design principle; verify against specific project context."
    ],
    "revisit_when": [
      "When the target project's architecture no longer matches applies_when.",
      "When router_monitor, adversarial review, or production evidence contradicts this principle."
    ],
    "provenance_source_ref": "docs:docs/CLUSTER_CACHE_SPEC.md#scorer-rubric-rules-gate-3",
    "lead_reason": "Doc-sourced; describes rubric design for a classification pipeline — generic pattern, not AgentSessionRouter-specific.",
    "counter_evidence": null
  },
  {
    "id": "PA-SD-000009",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "rand_assign committed to DB before either prompt fires for deterministic auditable assignment",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:9",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000010",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Single shadowJudge.ts function, not a class",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:10",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000012",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "shadowEvalRate config knob in DEFAULT_CONFIG not overridable via tool input",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:12",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000013",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Add cost_usd field to ClusterConsultSuccess and forward from Claude adapter response",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"project roadmap after v2.3.1\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:13",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000014",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Investigate A3 variance by testing with stripped factsheet before adding facts",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"project roadmap after v2.3.1\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:14",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000015",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Add shadow eval loss alert: cluster_consult loses to direct_resume 2+ times in rolling window",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"project roadmap after v2.3.1\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:15",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000016",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Document B1/B2 reasoning boundary explicitly in tools.ts cluster_consult tool comment and CLUSTER_CACHE_SPEC.md caller-facing section",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"project roadmap after v2.3.1\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:16",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 2,
      "primary_signal": "project_file_path",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000017",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "shadow answer column cap at 4096 chars with CHECK constraint and truncate-at-insert",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:17",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000018",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "judge failure records error string in judge_result JSON, not NULL",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:18",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000019",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "NOT IN CONTEXT from cluster_consult is a terminal signal; parent agent continues without retrying",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:19",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000021",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "claude_consult is the default entry point for all parent agents",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:21",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000022",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "cluster_consult is secondary; only used when a verified factsheet cluster already exists",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:22",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000023",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Auto routing is gated on A3 variance resolution and stable cluster_consult vs direct_resume quality gap across all tiers, not just aggregate",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:23",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000025",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "claude_consult is used directly when no verified factsheet cluster exists or when explicit session_id routing is required",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:25",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000027",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "route_health as a concept does not exist in v2.3.1; existing monitoring uses degradedMode and session_events quality metrics",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:27",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000028",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "A cluster requires re-prepare when any tracked file's hash or size differs from the stored cluster_file_hashes entry",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"v2.1 shadow eval architecture\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:28",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000029",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Re-prepare cluster on package.json/lockfile changes that alter import topology",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:29",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000030",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Re-prepare cluster when consult failure rates exceed sanity threshold",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:30",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000031",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Default consult entry point is the sanity/ready check, not full routing",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:31",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000032",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Full routing only proceeds after sanity endpoint confirms cluster health",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:32",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000033",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Auto routing requires confirmed metadata freshness from health snapshots",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:33",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000034",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Auto routing requires routing latency within acceptable tolerance",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:34",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000037",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Fallback to claude_consult when sanity endpoint fails or times out",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:37",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000038",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Bypass cluster when routing latency exceeds acceptable threshold",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:38",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000042",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "claude_consult fallback is mandatory when sanity check fails",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:42",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000043",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "route_health is derived from sanity check, metadata freshness, and latency tolerance",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:43",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000044",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "route_health=false forces mandatory claude_consult fallback",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:44",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000045",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Re-prepare on package.json/lockfile changes that alter import topology",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:45",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000046",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Re-prepare when consult failure rates exceed sanity threshold",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult cache maintenance sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:46",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000047",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "inspect active session-route mapping before chasing downstream route health metrics",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"router consult route telemetry sample\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_570b63cb-efa6-4345-96bc-84d875385637;decision:47",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000054",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Route conservative fallback when cluster factsheet evidence fails strict revalidation",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"cluster fallback claude-code-live-workload\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:54",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000056",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Operator signal is the snapshot's `verifiedAt` timestamp",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:56",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000057",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "prompt.ts consult export is the default entry point for route sample sessions",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:57",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000058",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Auto routing requires confirmed fresh cluster facts plus clear operator signal",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:58",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000059",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Do not reuse prior session route sample matrix for claude-code-live-workload without revalidation",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"cluster fallback claude-code-live-workload\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:59",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000063",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "route_health composite status gates routing readiness",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:63",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000115",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Use npm test for standard test runs",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"test\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_bff3152b-7854-41b0-814f-39461a95685a;decision:115",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000119",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Use fallback routing for race-test-cluster until factsheet revalidation passes",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"cluster fallback race-test-cluster\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:119",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000169",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Workers used only for parallel test authoring, doc drafting, benchmarks, and shadow eval",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:169",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000171",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Decision ledger in docs/DECISIONS.md provides continuity across stateless Codex sessions",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:171",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000172",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Escalation requires mechanical threshold triggers, not open-ended uncertainty",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:172",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000173",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase gates are deterministic pass/fail via gate_criteria.json checked by Codex",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:173",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000174",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Workers are firewalled from human contact by architecture, not policy",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:174",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000176",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Decision ledger entries include expiry, valid_while conditions, and reconsider_on triggers",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:176",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000177",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Escalation queue requires Codex proposed resolution to bound the response",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:177",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000178",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Codex proceeds alone when routeDecision.ts contracts unchanged, router_monitor green, tests pass, and change is additive",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:178",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 2,
      "primary_signal": "project_file_path",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000179",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "router_consult for route-level conflicts; cluster_consult for cache invalidation ambiguity",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:179",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000180",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Workers are existing test runners run in background, NOT separate Codex sessions",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:180",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000181",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase bundle uses existing docs (EXPERIMENTS.md, CLUSTER_CACHE_SPEC.md, SHADOW_EVAL_SPEC.md) plus PR descriptions as artifacts",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:181",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000182",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Single human touchpoint is the PR description; human reads only, mid-phase replies become new issues",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:182",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000185",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "docs/DECISIONS.md and phase state location should be named explicitly in the section",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:185",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "project_file_path",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000189",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase 7 distill is consistent with prior deferral — now has concrete trigger: Phase 4 handoff produces transferable insight",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:189",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000190",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Bootstrap via docs/ARCHITECTURE_LESSONS.md manual seed, then auto-populate via distill pipeline; fully manual forever rejected",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:190",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000194",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase 7 distill triggered at Phase 4 handoff when insight is marked transferable — consistent with prior deferral",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:194",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000195",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Hybrid bootstrap: docs/ARCHITECTURE_LESSONS.md manual seed, then auto-distill; fully manual forever rejected",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:195",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000196",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Bootstrap is Codex-derived from existing MAINTENANCE.md and CLUSTER_CACHE_SPEC.md content — no human seed curation",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:196",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000197",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Project isolation preserved via Option A: imported cluster template with canonical URL in MAINTENANCE.md; fallback to per-user global if URL undefined",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:197",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "project_file_path",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000199",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Durable decision artifacts are MAINTENANCE.md, docs/CLUSTER_CACHE_SPEC.md, docs/SHADOW_EVAL_SPEC.md, docs/EXPERIMENTS.md — docs/DECISIONS.md does not exist",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:199",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000200",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase number must be Phase 7 consistently across all docs or explicitly reconciled with MAINTENANCE.md",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:200",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 1,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000201",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "session_decisions must be confirmed as a readable persistent artifact or distill input redefined as phase summaries + existing docs only",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:201",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000203",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase 7 now consistent across section header and MAINTENANCE.md",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:203",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000204",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "session_decisions confirmed as SQLite table — not ambiguous artifact",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:204",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000205",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Non-goals sentence complete: no hidden model-memory authority clause resolved",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:205",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000206",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Gate 1 is documentation-only: spec defines data shapes, not extraction logic or storage",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:206",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000207",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "No LLM/extraction prompts, no cluster writes, no src/schema.ts changes, no applies_when evaluation",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:207",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000208",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Primary artifact is new subsection in CLUSTER_CACHE_SPEC.md; secondary is dry-run template in EXPERIMENTS.md",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:208",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000209",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Proof of gate close: 6 criteria including field-complete schemas, state machine completeness, no extraction logic, no cross-references to src/",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:209",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000210",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase 7 Gate 1 closed — Data/Model Spec in CLUSTER_CACHE_SPEC.md and dry-run template in EXPERIMENTS.md are complete and correct",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:210",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000211",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase 7 Gate 1 closed — no remaining issues",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:211",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000212",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Gate 2 is a deterministic skeleton report: verbatim decision_text as statement, auto-filled provenance, mechanical classification only, no LLM",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:212",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000213",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Script: scripts/architectural-memory-dry-run.mjs reads SQLite + docs, writes report to docs/EXPERIMENTS.md",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:213",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000214",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Gate 2 closes when script runs without error, all decision_text appears verbatim, no durable memory written, report in EXPERIMENTS.md",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:214",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000215",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase 7 Gate 2 closed — dry-run script operates correctly within Option B scope",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:215",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000216",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Gate 3 is both: extended dry-run script with scoring functions AND documented rubric in CLUSTER_CACHE_SPEC.md",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:216",
    "deterministic_signals": {
      "project_score": 3,
      "transferable_score": 0,
      "primary_signal": "project_file_path",
      "confidence": "high"
    }
  },
  {
    "id": "PA-SD-000217",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Mechanical scoring: project signals (+1 each) vs transferable signals (+1 each), difference determines classification, confidence from score gap",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:217",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000218",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "No LLM, no extraction — signals are keyword/path-based only",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:218",
    "deterministic_signals": {
      "project_score": 1,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000219",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Allowed statuses after Gate 3 scoring: project-architecture, engineering-principles, ambiguous, rejected_no_signal, rejected_too_short, rejected_duplicate",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:219",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000220",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Phase 7 Gate 3 closed — scoring rubric and implementation match scope; spec_source signal gap is non-blocking follow-up",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:220",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "current_project_session",
      "confidence": "medium"
    }
  },
  {
    "id": "PA-SD-000221",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "Gate 3 follow-up on spec_source was a false positive and is withdrawn",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"claude lead operatorless engineering workflow\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:221",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 0,
      "primary_signal": "current_project_session",
      "confidence": "high"
    }
  },
  {
    "id": "PA-DOC-0001",
    "memory_product": "project-architecture",
    "status": "proposed",
    "field_review_status": "pending_lead_review",
    "decision": "`cluster_consult`: Consults Claude using a verified factsheet. Phase 4 does not use fork sessions; fork support is Phase 5.",
    "rationale": "Derived rationale: this was recorded as a project-scoped implementation decision for topic \"`cluster_consult`\".",
    "rationale_note": "derived_from_phase7_dry_run_context",
    "project_scope": {
      "project_id": "AgentSessionRouter",
      "boundary_ref": "https://github.com/wertorok/AgentSessionRouter.git"
    },
    "provenance_source_ref": "docs:docs/CLUSTER_CACHE_SPEC.md#cluster-consult",
    "deterministic_signals": {
      "project_score": 2,
      "transferable_score": 1,
      "primary_signal": "repo_feature_name",
      "confidence": "medium"
    }
  }
]
```


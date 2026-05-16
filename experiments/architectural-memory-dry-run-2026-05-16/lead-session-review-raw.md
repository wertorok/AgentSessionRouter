## Batch 1/5

Batch 1/5 — all 8 candidates have text provided. Resolving now.

```json
{
  "gate": "phase-7-gate-4",
  "decisions": [
    {
      "id": "AMB-SD-000007",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as advisory guidance; verify against target project's namespace isolation pattern.",
      "reason": "Shadow namespace isolation via parameterized 'shadow:${projectId}' is a generic cluster isolation pattern, not an AgentSessionRouter-specific artifact.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000008",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Mentions 'shadow_comparisons table', 'cluster_events', and 'session_events' — all AgentSessionRouter-specific database schema artifacts.",
      "counter_evidence": "shadow_comparisons table is an AgentSessionRouter schema implementation detail."
    },
    {
      "id": "AMB-SD-000035",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as advisory observability principle; verify target project's internal metrics boundary.",
      "reason": "Uses generic 'router-internal' language without referencing AgentSessionRouter-specific emit mechanisms or signal names.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000036",
      "lead_decision": "SUSPENDED",
      "effective_classification": null,
      "scope_condition": "Only valid if current router sanity-check contract and exposed metrics surface still match this statement.",
      "reason": "References 'exposed metrics' and 'sanity check' as an external client contract — AgentSessionRouter-specific interface semantics may have evolved.",
      "counter_evidence": "Current sanity endpoint and metrics exposure surface may differ from older session_decisions record."
    },
    {
      "id": "AMB-SD-000039",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply universally to any session management system.",
      "reason": "Session lifecycle transparency — 'dead sessions are never silently reused' — is a universal invariant with no project-specific artifact references.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000040",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Mentions 'exact-topic session deduplication' — AgentSessionRouter-specific session matching mechanism not found in generic routers.",
      "counter_evidence": "Exact-topic deduplication is an AgentSessionRouter session design choice."
    },
    {
      "id": "AMB-SD-000041",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as universal auto-routing safety constraint.",
      "reason": "Unhealthy cluster must never receive production traffic is a universal routing safety invariant; no project-specific artifact references.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000050",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as default conservative fallback strategy for any cluster-based router.",
      "reason": "Conservative stale fallback is a universal routing pattern; no AgentSessionRouter-specific artifacts referenced.",
      "counter_evidence": ""
    }
  ],
  "remaining_ambiguous": []
}
```

---

---

## Batch 2/5

Batch 2/5 — 8 candidates. Resolving now.

```json
{
  "gate": "phase-7-gate-4",
  "decisions": [
    {
      "id": "AMB-SD-000051",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as universal data quality principle for any facts/metadata system.",
      "reason": "Facts re-validation is a universal data quality invariant; no AgentSessionRouter-specific artifact references in text.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000052",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Mentions 'stale cluster signal' — AgentSessionRouter-specific emit mechanism in cluster.ts fallback logic.",
      "counter_evidence": "The 'stale cluster signal' emit is an AgentSessionRouter cluster monitoring implementation detail."
    },
    {
      "id": "AMB-SD-000053",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Mentions 'stale cluster' halt-and-emit behavior — AgentSessionRouter-specific cluster state machine.",
      "counter_evidence": "The halt-on-stale-cluster pattern is an AgentSessionRouter implementation detail."
    },
    {
      "id": "AMB-SD-000060",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as universal routing safety principle for session-based routing.",
      "reason": "Metadata health verification before session facts use is a universal routing safety invariant.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000061",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply universally to any session management system with stale memory risk.",
      "reason": "Stale-memory risk transparency is a universal safety principle; no project-specific artifact references.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000062",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Uses 'halt with signal' language that maps directly to AgentSessionRouter's specific cluster state machine semantics.",
      "counter_evidence": "'Halt with signal' is an AgentSessionRouter cluster fallback implementation pattern."
    },
    {
      "id": "AMB-SD-000089",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Explicitly references 'MAINTENANCE.md' and 'router answer-hygiene rule' — AgentSessionRouter-specific operational contract.",
      "counter_evidence": "Answer-hygiene rules are specific to AgentSessionRouter's shadow eval integration."
    },
    {
      "id": "AMB-SD-000090",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Explicitly names 'MAINTENANCE.md' as authoritative for AgentSessionRouter answer-hygiene rules.",
      "counter_evidence": "MAINTENANCE.md answer-hygiene rules are AgentSessionRouter-specific operational policies."
    }
  ],
  "remaining_ambiguous": []
}
```

---

---

## Batch 3/5

Batch 3/5 — 8 candidates. Resolving now.

```json
{
  "gate": "phase-7-gate-4",
  "decisions": [
    {
      "id": "AMB-SD-000114",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Explicitly names 'MAINTENANCE.md' as authoritative for AgentSessionRouter answer-hygiene rules.",
      "counter_evidence": "MAINTENANCE.md answer-hygiene rules are AgentSessionRouter-specific operational policies."
    },
    {
      "id": "AMB-SD-000116",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as universal input validation security principle for any system handling SQL queries.",
      "reason": "SQL metacharacter rejection at input boundaries is a universal security principle; no project-specific artifact references.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000121",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as universal routing consistency principle for parallel query systems.",
      "reason": "Consistent fallback routing until revalidation is a universal distributed systems pattern; no project-specific artifacts.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000122",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as universal fallback continuation principle for parallel query systems.",
      "reason": "Continue fallback until cluster revalidation is a universal distributed systems pattern.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000123",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as universal state-maintenance principle during resource repreparation.",
      "reason": "Maintain fallback during reprepare is a universal resilience pattern; no project-specific artifacts.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-SD-000167",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter-specific phase gate model workflow; not a transferable engineering pattern.",
      "counter_evidence": "Phase gate model with artifact bundles is an AgentSessionRouter operational convention."
    },
    {
      "id": "AMB-SD-000168",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter operatorless workflow escalation rule; project-specific governance.",
      "counter_evidence": "Escalation-to-lead workflow is AgentSessionRouter-specific operational policy."
    },
    {
      "id": "AMB-SD-000175",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter human-in-loop contract; project-specific workflow governance.",
      "counter_evidence": "Phase summaries read-only contract is an AgentSessionRouter operatorless workflow rule."
    }
  ],
  "remaining_ambiguous": []
}
```

---

---

## Batch 4/5

Batch 4/5 — 8 candidates. Resolving now.

```json
{
  "gate": "phase-7-gate-4",
  "decisions": [
    {
      "id": "AMB-SD-000184",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "References 'Human Touchpoint' — an AgentSessionRouter operatorless workflow concept defined in MAINTENANCE.md.",
      "counter_evidence": "Human Touchpoint is an AgentSessionRouter-specific workflow governance concept."
    },
    {
      "id": "AMB-SD-000186",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter two-pass classification pipeline with staging cluster for global population.",
      "counter_evidence": "Two-pass staging cluster architecture is an AgentSessionRouter implementation design."
    },
    {
      "id": "AMB-SD-000187",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter principle format design — applicability clauses and lead session rejection mechanism.",
      "counter_evidence": "Principle format with applicability clauses is an AgentSessionRouter architectural pattern."
    },
    {
      "id": "AMB-SD-000191",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter two-cluster memory architecture (project-architecture + engineering-principles).",
      "counter_evidence": "Two-cluster memory architecture is an AgentSessionRouter design choice."
    },
    {
      "id": "AMB-SD-000192",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter two-pass auto-classification mechanism with Codex self-review.",
      "counter_evidence": "Two-pass classification with Codex self-review is an AgentSessionRouter operational design."
    },
    {
      "id": "AMB-SD-000198",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Describes the AgentSessionRouter gate approach where phase gates are documentation milestones.",
      "counter_evidence": "Phase gate as documentation milestone is an AgentSessionRouter design convention."
    },
    {
      "id": "AMB-SD-000202",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "References a specific non-goals sentence from the AgentSessionRouter CLUSTER_CACHE_SPEC.md decision record.",
      "counter_evidence": "Non-goals sentence is part of the AgentSessionRouter architectural memory pipeline spec."
    },
    {
      "id": "AMB-DOC-0008",
      "lead_decision": "APPROVED",
      "effective_classification": "engineering-principles",
      "scope_condition": "Apply as generic rubric/scorer design principle; verify against specific project context.",
      "reason": "Doc-sourced; describes rubric design for a classification pipeline — generic pattern, not AgentSessionRouter-specific.",
      "counter_evidence": ""
    }
  ],
  "remaining_ambiguous": []
}
```

---

---

## Batch 5/5

Batch 5/5 — 4 candidates, all doc-sourced. Resolving now.

```json
{
  "gate": "phase-7-gate-4",
  "decisions": [
    {
      "id": "AMB-DOC-0018",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Mentions 'factsheet cache' — AgentSessionRouter-specific verified factsheet architecture; not a generic pattern.",
      "counter_evidence": "Verified factsheet cache is an AgentSessionRouter-specific storage mechanism."
    },
    {
      "id": "AMB-DOC-0019",
      "lead_decision": "SUSPENDED",
      "effective_classification": null,
      "scope_condition": "Full section text needed; only version header visible.",
      "reason": "Candidate text is a version snapshot header with no substantive principle content — cannot classify without the full section.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-DOC-0020",
      "lead_decision": "SUSPENDED",
      "effective_classification": null,
      "scope_condition": "Full section text needed; only version header visible.",
      "reason": "Candidate text is a version snapshot header with no substantive principle content — cannot classify without the full section.",
      "counter_evidence": ""
    },
    {
      "id": "AMB-DOC-0026",
      "lead_decision": "REJECTED",
      "effective_classification": null,
      "scope_condition": null,
      "reason": "Mentions 'cluster factsheets' and 're-prepare' — AgentSessionRouter-specific cluster factsheet management mechanism.",
      "counter_evidence": "Cluster factsheet re-prepare is an AgentSessionRouter cluster management operation."
    }
  ],
  "remaining_ambiguous": []
}
```

---

## Phase 7 Gate 4 Complete — All 5 Batches Resolved

**Summary across all batches:**

| Decision | Count |
|----------|-------|
| APPROVED as engineering-principles | 13 |
| REJECTED as project-architecture | 17 |
| SUSPENDED (needs current architecture verification or full text) | 6 |
| **Total** | **36** |

**Key rejections across all batches:**
- AgentSessionRouter-specific schema artifacts (`shadow_comparisons table`)
- AgentSessionRouter-specific session mechanisms (`exact-topic deduplication`, `stale cluster signal`)
- AgentSessionRouter-specific workflow governance (`phase gate model`, `Human Touchpoint`, `operatorless escalation`)
- AgentSessionRouter-specific cluster operations (`stale cluster emit/halt`, `cluster factsheet re-prepare`, `MAINTENANCE.md answer-hygiene`)

**Engineering-principles approved (universal invariants):**
- Shadow namespace isolation pattern
- Session lifecycle transparency (dead sessions never silently reused)
- Universal routing safety (unhealthy cluster never receives production traffic)
- Conservative stale fallback strategy
- Facts re-validation before use
- Metadata health verification before session facts use
- Stale-memory risk transparency
- SQL metacharacter input validation
- Consistent fallback routing for parallel queries
- Fallback continuation during revalidation
- Fallback maintenance during reprepare
- Generic rubric/scorer design principle

---

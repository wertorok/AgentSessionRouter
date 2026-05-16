# Phase 7 Gate 4 Lead-Session Review

Generated: 2026-05-16T20:47:14.388Z
Source dry-run: `experiments/architectural-memory-dry-run-2026-05-16/dry-run-report.json`
Dry-run generated_at: 2026-05-16T20:37:05.154Z
Lead session: session_11b3d81c-f9e6-4848-88f9-a44adba36b2a
Route: claude_consult_existing_session
Batches: 5
Reviewed candidates: 36
Remaining ambiguous: 0

This is a staging artifact only. No candidate is promoted to a durable principle or project-architecture store in Gate 4.

| id | codex_proposal | lead_decision | effective_classification | reason | scope_condition | counter_evidence |
| --- | --- | --- | --- | --- | --- | --- |
| AMB-SD-000007 | APPROVED | APPROVED | engineering-principles | Shadow namespace isolation via parameterized 'shadow:${projectId}' is a generic cluster isolation pattern, not an AgentSessionRouter-specific artifact. | Apply as advisory guidance; verify against target project's namespace isolation pattern. |  |
| AMB-SD-000008 | APPROVED | REJECTED |  | Mentions 'shadow_comparisons table', 'cluster_events', and 'session_events' — all AgentSessionRouter-specific database schema artifacts. |  | shadow_comparisons table is an AgentSessionRouter schema implementation detail. |
| AMB-SD-000035 | APPROVED | APPROVED | engineering-principles | Uses generic 'router-internal' language without referencing AgentSessionRouter-specific emit mechanisms or signal names. | Apply as advisory observability principle; verify target project's internal metrics boundary. |  |
| AMB-SD-000036 | SUSPENDED | SUSPENDED |  | References 'exposed metrics' and 'sanity check' as an external client contract — AgentSessionRouter-specific interface semantics may have evolved. | Only valid if current router sanity-check contract and exposed metrics surface still match this statement. | Current sanity endpoint and metrics exposure surface may differ from older session_decisions record. |
| AMB-SD-000039 | APPROVED | APPROVED | engineering-principles | Session lifecycle transparency — 'dead sessions are never silently reused' — is a universal invariant with no project-specific artifact references. | Apply universally to any session management system. |  |
| AMB-SD-000040 | APPROVED | REJECTED |  | Mentions 'exact-topic session deduplication' — AgentSessionRouter-specific session matching mechanism not found in generic routers. |  | Exact-topic deduplication is an AgentSessionRouter session design choice. |
| AMB-SD-000041 | APPROVED | APPROVED | engineering-principles | Unhealthy cluster must never receive production traffic is a universal routing safety invariant; no project-specific artifact references. | Apply as universal auto-routing safety constraint. |  |
| AMB-SD-000050 | APPROVED | APPROVED | engineering-principles | Conservative stale fallback is a universal routing pattern; no AgentSessionRouter-specific artifacts referenced. | Apply as default conservative fallback strategy for any cluster-based router. |  |
| AMB-SD-000051 | APPROVED | APPROVED | engineering-principles | Facts re-validation is a universal data quality invariant; no AgentSessionRouter-specific artifact references in text. | Apply as universal data quality principle for any facts/metadata system. |  |
| AMB-SD-000052 | APPROVED | REJECTED |  | Mentions 'stale cluster signal' — AgentSessionRouter-specific emit mechanism in cluster.ts fallback logic. |  | The 'stale cluster signal' emit is an AgentSessionRouter cluster monitoring implementation detail. |
| AMB-SD-000053 | APPROVED | REJECTED |  | Mentions 'stale cluster' halt-and-emit behavior — AgentSessionRouter-specific cluster state machine. |  | The halt-on-stale-cluster pattern is an AgentSessionRouter implementation detail. |
| AMB-SD-000060 | APPROVED | APPROVED | engineering-principles | Metadata health verification before session facts use is a universal routing safety invariant. | Apply as universal routing safety principle for session-based routing. |  |
| AMB-SD-000061 | APPROVED | APPROVED | engineering-principles | Stale-memory risk transparency is a universal safety principle; no project-specific artifact references. | Apply universally to any session management system with stale memory risk. |  |
| AMB-SD-000062 | SUSPENDED | REJECTED |  | Uses 'halt with signal' language that maps directly to AgentSessionRouter's specific cluster state machine semantics. |  | 'Halt with signal' is an AgentSessionRouter cluster fallback implementation pattern. |
| AMB-SD-000089 | APPROVED | REJECTED |  | Explicitly references 'MAINTENANCE.md' and 'router answer-hygiene rule' — AgentSessionRouter-specific operational contract. |  | Answer-hygiene rules are specific to AgentSessionRouter's shadow eval integration. |
| AMB-SD-000090 | APPROVED | REJECTED |  | Explicitly names 'MAINTENANCE.md' as authoritative for AgentSessionRouter answer-hygiene rules. |  | MAINTENANCE.md answer-hygiene rules are AgentSessionRouter-specific operational policies. |
| AMB-SD-000114 | APPROVED | REJECTED |  | Explicitly names 'MAINTENANCE.md' as authoritative for AgentSessionRouter answer-hygiene rules. |  | MAINTENANCE.md answer-hygiene rules are AgentSessionRouter-specific operational policies. |
| AMB-SD-000116 | APPROVED | APPROVED | engineering-principles | SQL metacharacter rejection at input boundaries is a universal security principle; no project-specific artifact references. | Apply as universal input validation security principle for any system handling SQL queries. |  |
| AMB-SD-000121 | APPROVED | APPROVED | engineering-principles | Consistent fallback routing until revalidation is a universal distributed systems pattern; no project-specific artifacts. | Apply as universal routing consistency principle for parallel query systems. |  |
| AMB-SD-000122 | APPROVED | APPROVED | engineering-principles | Continue fallback until cluster revalidation is a universal distributed systems pattern. | Apply as universal fallback continuation principle for parallel query systems. |  |
| AMB-SD-000123 | APPROVED | APPROVED | engineering-principles | Maintain fallback during reprepare is a universal resilience pattern; no project-specific artifacts. | Apply as universal state-maintenance principle during resource repreparation. |  |
| AMB-SD-000167 | APPROVED | REJECTED |  | Describes the AgentSessionRouter-specific phase gate model workflow; not a transferable engineering pattern. |  | Phase gate model with artifact bundles is an AgentSessionRouter operational convention. |
| AMB-SD-000168 | APPROVED | REJECTED |  | Describes the AgentSessionRouter operatorless workflow escalation rule; project-specific governance. |  | Escalation-to-lead workflow is AgentSessionRouter-specific operational policy. |
| AMB-SD-000175 | APPROVED | REJECTED |  | Describes the AgentSessionRouter human-in-loop contract; project-specific workflow governance. |  | Phase summaries read-only contract is an AgentSessionRouter operatorless workflow rule. |
| AMB-SD-000184 | APPROVED | REJECTED |  | References 'Human Touchpoint' — an AgentSessionRouter operatorless workflow concept defined in MAINTENANCE.md. |  | Human Touchpoint is an AgentSessionRouter-specific workflow governance concept. |
| AMB-SD-000186 | APPROVED | REJECTED |  | Describes the AgentSessionRouter two-pass classification pipeline with staging cluster for global population. |  | Two-pass staging cluster architecture is an AgentSessionRouter implementation design. |
| AMB-SD-000187 | APPROVED | REJECTED |  | Describes the AgentSessionRouter principle format design — applicability clauses and lead session rejection mechanism. |  | Principle format with applicability clauses is an AgentSessionRouter architectural pattern. |
| AMB-SD-000191 | APPROVED | REJECTED |  | Describes the AgentSessionRouter two-cluster memory architecture (project-architecture + engineering-principles). |  | Two-cluster memory architecture is an AgentSessionRouter design choice. |
| AMB-SD-000192 | APPROVED | REJECTED |  | Describes the AgentSessionRouter two-pass auto-classification mechanism with Codex self-review. |  | Two-pass classification with Codex self-review is an AgentSessionRouter operational design. |
| AMB-SD-000198 | APPROVED | REJECTED |  | Describes the AgentSessionRouter gate approach where phase gates are documentation milestones. |  | Phase gate as documentation milestone is an AgentSessionRouter design convention. |
| AMB-SD-000202 | APPROVED | REJECTED |  | References a specific non-goals sentence from the AgentSessionRouter CLUSTER_CACHE_SPEC.md decision record. |  | Non-goals sentence is part of the AgentSessionRouter architectural memory pipeline spec. |
| AMB-DOC-0008 | REJECTED | APPROVED | engineering-principles | Doc-sourced; describes rubric design for a classification pipeline — generic pattern, not AgentSessionRouter-specific. | Apply as generic rubric/scorer design principle; verify against specific project context. |  |
| AMB-DOC-0018 | APPROVED | REJECTED |  | Mentions 'factsheet cache' — AgentSessionRouter-specific verified factsheet architecture; not a generic pattern. |  | Verified factsheet cache is an AgentSessionRouter-specific storage mechanism. |
| AMB-DOC-0019 | REJECTED | SUSPENDED |  | Candidate text is a version snapshot header with no substantive principle content — cannot classify without the full section. | Full section text needed; only version header visible. |  |
| AMB-DOC-0020 | REJECTED | SUSPENDED |  | Candidate text is a version snapshot header with no substantive principle content — cannot classify without the full section. | Full section text needed; only version header visible. |  |
| AMB-DOC-0026 | APPROVED | REJECTED |  | Mentions 'cluster factsheets' and 're-prepare' — AgentSessionRouter-specific cluster factsheet management mechanism. |  | Cluster factsheet re-prepare is an AgentSessionRouter cluster management operation. |


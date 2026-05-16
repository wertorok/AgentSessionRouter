# Phase 7 Gate 8 Field-Population Draft

Generated: 2026-05-16T21:59:45.925Z
Status: `draft_only`
Source factsheet: `experiments/architectural-memory-dry-run-2026-05-16/factsheet-dry-run.json`
Source verification: `experiments/architectural-memory-dry-run-2026-05-16/verification-report.json`

> Draft only. This artifact is not active memory, not imported, not served, and not promotion-approved.

## Summary

| bucket | count |
| --- | ---: |
| engineering_principles | 13 |
| project_architecture | 80 |
| excluded_unverified_or_failed | 23 |
| excluded_suspended | 3 |
| excluded_rejected | 24 |

## Source-of-Truth Targets

| memory product | target |
| --- | --- |
| engineering-principles | `docs/ENGINEERING_PRINCIPLES.md` |
| project-architecture | `docs/PROJECT_ARCHITECTURE.md` |

## Engineering Principles Draft

| id | statement | applies_when | revisit_when | field_review_status |
| --- | --- | --- | --- | --- |
| AMB-SD-000007 | Shadow must use dedicated lock namespace (shadow:${projectId}) separate from production locks | Apply as advisory guidance; verify against target project's namespace isolation pattern. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000035 | Cluster health metrics are router-internal only | Apply as advisory observability principle; verify target project's internal metrics boundary. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000039 | Orphaned session replacement must remain transparent; dead sessions are never silently reused | Apply universally to any session management system. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000041 | Unhealthy cluster must never receive production auto routing traffic | Apply as universal auto-routing safety constraint. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000050 | Stale cluster fallback defaults to conservative routing strategy | Apply as default conservative fallback strategy for any cluster-based router. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000051 | Unverified facts must be re-validated against live metadata before use | Apply as universal data quality principle for any facts/metadata system. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000060 | Secondary session routing must verify metadata health snapshot before using session facts | Apply as universal routing safety principle for session-based routing. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000061 | Stale-memory risk must be surfaced, not silently suppressed, for older sessions | Apply universally to any session management system with stale memory risk. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000116 | Reject cluster names containing SQL metacharacters (; " --) at input validation boundary | Apply as universal input validation security principle for any system handling SQL queries. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000121 | Consistent fallback routing for all parallel queries until cluster-level revalidation succeeds | Apply as universal routing consistency principle for parallel query systems. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000122 | Continue fallback routing for all remaining parallel queries until cluster revalidation | Apply as universal fallback continuation principle for parallel query systems. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-SD-000123 | Maintain fallback during reprepare until successful completion | Apply as universal state-maintenance principle during resource repreparation. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |
| AMB-DOC-0008 | Scorer/Rubric Rules (Gate 3): Gate 3 makes the Gate 2 classification explicit and auditable. It adds | Apply as generic rubric/scorer design principle; verify against specific project context. | When the target project's architecture no longer matches applies_when.; When router_monitor, adversarial review, or production evidence contradicts this principle. | pending_lead_review |

## Project Architecture Draft

| id | decision | rationale_note | project_id | boundary_ref | field_review_status |
| --- | --- | --- | --- | --- | --- |
| PA-SD-000009 | rand_assign committed to DB before either prompt fires for deterministic auditable assignment | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000010 | Single shadowJudge.ts function, not a class | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000012 | shadowEvalRate config knob in DEFAULT_CONFIG not overridable via tool input | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000013 | Add cost_usd field to ClusterConsultSuccess and forward from Claude adapter response | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000014 | Investigate A3 variance by testing with stripped factsheet before adding facts | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000015 | Add shadow eval loss alert: cluster_consult loses to direct_resume 2+ times in rolling window | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000016 | Document B1/B2 reasoning boundary explicitly in tools.ts cluster_consult tool comment and CLUSTER_CACHE_SPEC.md caller-facing section | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000017 | shadow answer column cap at 4096 chars with CHECK constraint and truncate-at-insert | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000018 | judge failure records error string in judge_result JSON, not NULL | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000019 | NOT IN CONTEXT from cluster_consult is a terminal signal; parent agent continues without retrying | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000021 | claude_consult is the default entry point for all parent agents | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000022 | cluster_consult is secondary; only used when a verified factsheet cluster already exists | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000023 | Auto routing is gated on A3 variance resolution and stable cluster_consult vs direct_resume quality gap across all tiers, not just aggregate | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000025 | claude_consult is used directly when no verified factsheet cluster exists or when explicit session_id routing is required | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000027 | route_health as a concept does not exist in v2.3.1; existing monitoring uses degradedMode and session_events quality metrics | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000028 | A cluster requires re-prepare when any tracked file's hash or size differs from the stored cluster_file_hashes entry | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000029 | Re-prepare cluster on package.json/lockfile changes that alter import topology | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000030 | Re-prepare cluster when consult failure rates exceed sanity threshold | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000031 | Default consult entry point is the sanity/ready check, not full routing | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000032 | Full routing only proceeds after sanity endpoint confirms cluster health | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000033 | Auto routing requires confirmed metadata freshness from health snapshots | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000034 | Auto routing requires routing latency within acceptable tolerance | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000037 | Fallback to claude_consult when sanity endpoint fails or times out | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000038 | Bypass cluster when routing latency exceeds acceptable threshold | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000042 | claude_consult fallback is mandatory when sanity check fails | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000043 | route_health is derived from sanity check, metadata freshness, and latency tolerance | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000044 | route_health=false forces mandatory claude_consult fallback | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000045 | Re-prepare on package.json/lockfile changes that alter import topology | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000046 | Re-prepare when consult failure rates exceed sanity threshold | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000047 | inspect active session-route mapping before chasing downstream route health metrics | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000054 | Route conservative fallback when cluster factsheet evidence fails strict revalidation | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000056 | Operator signal is the snapshot's `verifiedAt` timestamp | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000057 | prompt.ts consult export is the default entry point for route sample sessions | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000058 | Auto routing requires confirmed fresh cluster facts plus clear operator signal | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000059 | Do not reuse prior session route sample matrix for claude-code-live-workload without revalidation | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000063 | route_health composite status gates routing readiness | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000115 | Use npm test for standard test runs | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000119 | Use fallback routing for race-test-cluster until factsheet revalidation passes | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000169 | Workers used only for parallel test authoring, doc drafting, benchmarks, and shadow eval | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000171 | Decision ledger in docs/DECISIONS.md provides continuity across stateless Codex sessions | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000172 | Escalation requires mechanical threshold triggers, not open-ended uncertainty | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000173 | Phase gates are deterministic pass/fail via gate_criteria.json checked by Codex | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000174 | Workers are firewalled from human contact by architecture, not policy | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000176 | Decision ledger entries include expiry, valid_while conditions, and reconsider_on triggers | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000177 | Escalation queue requires Codex proposed resolution to bound the response | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000178 | Codex proceeds alone when routeDecision.ts contracts unchanged, router_monitor green, tests pass, and change is additive | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000179 | router_consult for route-level conflicts; cluster_consult for cache invalidation ambiguity | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000180 | Workers are existing test runners run in background, NOT separate Codex sessions | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000181 | Phase bundle uses existing docs (EXPERIMENTS.md, CLUSTER_CACHE_SPEC.md, SHADOW_EVAL_SPEC.md) plus PR descriptions as artifacts | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000182 | Single human touchpoint is the PR description; human reads only, mid-phase replies become new issues | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000185 | docs/DECISIONS.md and phase state location should be named explicitly in the section | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000189 | Phase 7 distill is consistent with prior deferral — now has concrete trigger: Phase 4 handoff produces transferable insight | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000190 | Bootstrap via docs/ARCHITECTURE_LESSONS.md manual seed, then auto-populate via distill pipeline; fully manual forever rejected | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000194 | Phase 7 distill triggered at Phase 4 handoff when insight is marked transferable — consistent with prior deferral | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000195 | Hybrid bootstrap: docs/ARCHITECTURE_LESSONS.md manual seed, then auto-distill; fully manual forever rejected | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000196 | Bootstrap is Codex-derived from existing MAINTENANCE.md and CLUSTER_CACHE_SPEC.md content — no human seed curation | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000197 | Project isolation preserved via Option A: imported cluster template with canonical URL in MAINTENANCE.md; fallback to per-user global if URL undefined | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000199 | Durable decision artifacts are MAINTENANCE.md, docs/CLUSTER_CACHE_SPEC.md, docs/SHADOW_EVAL_SPEC.md, docs/EXPERIMENTS.md — docs/DECISIONS.md does not exist | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000200 | Phase number must be Phase 7 consistently across all docs or explicitly reconciled with MAINTENANCE.md | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000201 | session_decisions must be confirmed as a readable persistent artifact or distill input redefined as phase summaries + existing docs only | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000203 | Phase 7 now consistent across section header and MAINTENANCE.md | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000204 | session_decisions confirmed as SQLite table — not ambiguous artifact | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000205 | Non-goals sentence complete: no hidden model-memory authority clause resolved | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000206 | Gate 1 is documentation-only: spec defines data shapes, not extraction logic or storage | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000207 | No LLM/extraction prompts, no cluster writes, no src/schema.ts changes, no applies_when evaluation | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000208 | Primary artifact is new subsection in CLUSTER_CACHE_SPEC.md; secondary is dry-run template in EXPERIMENTS.md | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000209 | Proof of gate close: 6 criteria including field-complete schemas, state machine completeness, no extraction logic, no cross-references to src/ | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000210 | Phase 7 Gate 1 closed — Data/Model Spec in CLUSTER_CACHE_SPEC.md and dry-run template in EXPERIMENTS.md are complete and correct | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000211 | Phase 7 Gate 1 closed — no remaining issues | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000212 | Gate 2 is a deterministic skeleton report: verbatim decision_text as statement, auto-filled provenance, mechanical classification only, no LLM | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000213 | Script: scripts/architectural-memory-dry-run.mjs reads SQLite + docs, writes report to docs/EXPERIMENTS.md | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000214 | Gate 2 closes when script runs without error, all decision_text appears verbatim, no durable memory written, report in EXPERIMENTS.md | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000215 | Phase 7 Gate 2 closed — dry-run script operates correctly within Option B scope | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000216 | Gate 3 is both: extended dry-run script with scoring functions AND documented rubric in CLUSTER_CACHE_SPEC.md | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000217 | Mechanical scoring: project signals (+1 each) vs transferable signals (+1 each), difference determines classification, confidence from score gap | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000218 | No LLM, no extraction — signals are keyword/path-based only | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000219 | Allowed statuses after Gate 3 scoring: project-architecture, engineering-principles, ambiguous, rejected_no_signal, rejected_too_short, rejected_duplicate | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000220 | Phase 7 Gate 3 closed — scoring rubric and implementation match scope; spec_source signal gap is non-blocking follow-up | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-SD-000221 | Gate 3 follow-up on spec_source was a false positive and is withdrawn | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |
| PA-DOC-0001 | `cluster_consult`: Consults Claude using a verified factsheet. Phase 4 does not use fork sessions; fork support is Phase 5. | derived_from_phase7_dry_run_context | AgentSessionRouter | https://github.com/wertorok/AgentSessionRouter.git | pending_lead_review |

## Notes

- Draft field population only. Do not import, serve, or promote this artifact.
- All entries remain proposed and field_review_status=pending_lead_review.
- Project-architecture rationale fields are conservative derived rationales and are marked with rationale_note.
- Engineering-principle applies_when fields are derived from lead scope_condition values.
- Promotion remains a future gate after lead field review and explicit activation.


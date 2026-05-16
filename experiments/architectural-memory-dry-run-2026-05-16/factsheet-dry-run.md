# Phase 7 Gate 5 Factsheet Dry-Run

Generated: 2026-05-16T20:50:24.130Z
Source dry-run: `experiments/architectural-memory-dry-run-2026-05-16/dry-run-report.json`
Source lead review: `experiments/architectural-memory-dry-run-2026-05-16/lead-session-review.json`

> Dry-run only. This is not durable memory, not a cluster factsheet, and not verifier-approved evidence.

## Summary

| bucket | count |
| --- | ---: |
| Gate 3 project-architecture carry-forward | 80 |
| Gate 4 approved project-architecture | 0 |
| Gate 4 approved engineering-principles | 13 |
| Gate 4 suspended | 3 |
| Gate 4 rejected | 20 |
| Gate 3 rejected/non-distillable | 4 |

## Gate 3 Project-Architecture Carry-Forward

These candidates passed deterministic Gate 3 scoring. They are carried forward for future verifier design, but are not promoted in Gate 5.

| id | topic | decision | provenance | confidence |
| --- | --- | --- | --- | --- |
| PA-SD-000009 | v2.1 shadow eval architecture | rand_assign committed to DB before either prompt fires for deterministic auditable assignment | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:9 | medium |
| PA-SD-000010 | v2.1 shadow eval architecture | Single shadowJudge.ts function, not a class | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:10 | high |
| PA-SD-000012 | v2.1 shadow eval architecture | shadowEvalRate config knob in DEFAULT_CONFIG not overridable via tool input | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:12 | medium |
| PA-SD-000013 | project roadmap after v2.3.1 | Add cost_usd field to ClusterConsultSuccess and forward from Claude adapter response | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:13 | medium |
| PA-SD-000014 | project roadmap after v2.3.1 | Investigate A3 variance by testing with stripped factsheet before adding facts | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:14 | high |
| PA-SD-000015 | project roadmap after v2.3.1 | Add shadow eval loss alert: cluster_consult loses to direct_resume 2+ times in rolling window | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:15 | high |
| PA-SD-000016 | project roadmap after v2.3.1 | Document B1/B2 reasoning boundary explicitly in tools.ts cluster_consult tool comment and CLUSTER_CACHE_SPEC.md caller-facing section | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:16 | medium |
| PA-SD-000017 | v2.1 shadow eval architecture | shadow answer column cap at 4096 chars with CHECK constraint and truncate-at-insert | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:17 | medium |
| PA-SD-000018 | v2.1 shadow eval architecture | judge failure records error string in judge_result JSON, not NULL | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:18 | medium |
| PA-SD-000019 | v2.1 shadow eval architecture | NOT IN CONTEXT from cluster_consult is a terminal signal; parent agent continues without retrying | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:19 | medium |
| PA-SD-000021 | v2.1 shadow eval architecture | claude_consult is the default entry point for all parent agents | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:21 | medium |
| PA-SD-000022 | v2.1 shadow eval architecture | cluster_consult is secondary; only used when a verified factsheet cluster already exists | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:22 | high |
| PA-SD-000023 | v2.1 shadow eval architecture | Auto routing is gated on A3 variance resolution and stable cluster_consult vs direct_resume quality gap across all tiers, not just aggregate | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:23 | high |
| PA-SD-000025 | v2.1 shadow eval architecture | claude_consult is used directly when no verified factsheet cluster exists or when explicit session_id routing is required | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:25 | medium |
| PA-SD-000027 | v2.1 shadow eval architecture | route_health as a concept does not exist in v2.3.1; existing monitoring uses degradedMode and session_events quality metrics | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:27 | high |
| PA-SD-000028 | v2.1 shadow eval architecture | A cluster requires re-prepare when any tracked file's hash or size differs from the stored cluster_file_hashes entry | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:28 | medium |
| PA-SD-000029 | router consult cache maintenance sample | Re-prepare cluster on package.json/lockfile changes that alter import topology | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:29 | high |
| PA-SD-000030 | router consult cache maintenance sample | Re-prepare cluster when consult failure rates exceed sanity threshold | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:30 | medium |
| PA-SD-000031 | router consult cache maintenance sample | Default consult entry point is the sanity/ready check, not full routing | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:31 | medium |
| PA-SD-000032 | router consult cache maintenance sample | Full routing only proceeds after sanity endpoint confirms cluster health | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:32 | medium |
| PA-SD-000033 | router consult cache maintenance sample | Auto routing requires confirmed metadata freshness from health snapshots | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:33 | medium |
| PA-SD-000034 | router consult cache maintenance sample | Auto routing requires routing latency within acceptable tolerance | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:34 | medium |
| PA-SD-000037 | router consult cache maintenance sample | Fallback to claude_consult when sanity endpoint fails or times out | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:37 | medium |
| PA-SD-000038 | router consult cache maintenance sample | Bypass cluster when routing latency exceeds acceptable threshold | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:38 | medium |
| PA-SD-000042 | router consult cache maintenance sample | claude_consult fallback is mandatory when sanity check fails | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:42 | medium |
| PA-SD-000043 | router consult cache maintenance sample | route_health is derived from sanity check, metadata freshness, and latency tolerance | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:43 | medium |
| PA-SD-000044 | router consult cache maintenance sample | route_health=false forces mandatory claude_consult fallback | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:44 | medium |
| PA-SD-000045 | router consult cache maintenance sample | Re-prepare on package.json/lockfile changes that alter import topology | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:45 | high |
| PA-SD-000046 | router consult cache maintenance sample | Re-prepare when consult failure rates exceed sanity threshold | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:46 | medium |
| PA-SD-000047 | router consult route telemetry sample | inspect active session-route mapping before chasing downstream route health metrics | session:session_570b63cb-efa6-4345-96bc-84d875385637;decision:47 | medium |
| PA-SD-000054 | cluster fallback claude-code-live-workload | Route conservative fallback when cluster factsheet evidence fails strict revalidation | session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:54 | medium |
| PA-SD-000056 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Operator signal is the snapshot's `verifiedAt` timestamp | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:56 | medium |
| PA-SD-000057 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | prompt.ts consult export is the default entry point for route sample sessions | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:57 | high |
| PA-SD-000058 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | Auto routing requires confirmed fresh cluster facts plus clear operator signal | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:58 | medium |
| PA-SD-000059 | cluster fallback claude-code-live-workload | Do not reuse prior session route sample matrix for claude-code-live-workload without revalidation | session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:59 | high |
| PA-SD-000063 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | route_health composite status gates routing readiness | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:63 | medium |
| PA-SD-000115 | test | Use npm test for standard test runs | session:session_bff3152b-7854-41b0-814f-39461a95685a;decision:115 | medium |
| PA-SD-000119 | cluster fallback race-test-cluster | Use fallback routing for race-test-cluster until factsheet revalidation passes | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:119 | medium |
| PA-SD-000169 | claude lead operatorless engineering workflow | Workers used only for parallel test authoring, doc drafting, benchmarks, and shadow eval | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:169 | medium |
| PA-SD-000171 | claude lead operatorless engineering workflow | Decision ledger in docs/DECISIONS.md provides continuity across stateless Codex sessions | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:171 | high |
| PA-SD-000172 | claude lead operatorless engineering workflow | Escalation requires mechanical threshold triggers, not open-ended uncertainty | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:172 | medium |
| PA-SD-000173 | claude lead operatorless engineering workflow | Phase gates are deterministic pass/fail via gate_criteria.json checked by Codex | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:173 | high |
| PA-SD-000174 | claude lead operatorless engineering workflow | Workers are firewalled from human contact by architecture, not policy | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:174 | medium |
| PA-SD-000176 | claude lead operatorless engineering workflow | Decision ledger entries include expiry, valid_while conditions, and reconsider_on triggers | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:176 | medium |
| PA-SD-000177 | claude lead operatorless engineering workflow | Escalation queue requires Codex proposed resolution to bound the response | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:177 | medium |
| PA-SD-000178 | claude lead operatorless engineering workflow | Codex proceeds alone when routeDecision.ts contracts unchanged, router_monitor green, tests pass, and change is additive | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:178 | medium |
| PA-SD-000179 | claude lead operatorless engineering workflow | router_consult for route-level conflicts; cluster_consult for cache invalidation ambiguity | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:179 | medium |
| PA-SD-000180 | claude lead operatorless engineering workflow | Workers are existing test runners run in background, NOT separate Codex sessions | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:180 | medium |
| PA-SD-000181 | claude lead operatorless engineering workflow | Phase bundle uses existing docs (EXPERIMENTS.md, CLUSTER_CACHE_SPEC.md, SHADOW_EVAL_SPEC.md) plus PR descriptions as artifacts | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:181 | high |
| PA-SD-000182 | claude lead operatorless engineering workflow | Single human touchpoint is the PR description; human reads only, mid-phase replies become new issues | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:182 | medium |
| PA-SD-000185 | claude lead operatorless engineering workflow | docs/DECISIONS.md and phase state location should be named explicitly in the section | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:185 | medium |
| PA-SD-000189 | claude lead operatorless engineering workflow | Phase 7 distill is consistent with prior deferral — now has concrete trigger: Phase 4 handoff produces transferable insight | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:189 | high |
| PA-SD-000190 | claude lead operatorless engineering workflow | Bootstrap via docs/ARCHITECTURE_LESSONS.md manual seed, then auto-populate via distill pipeline; fully manual forever rejected | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:190 | high |
| PA-SD-000194 | claude lead operatorless engineering workflow | Phase 7 distill triggered at Phase 4 handoff when insight is marked transferable — consistent with prior deferral | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:194 | high |
| PA-SD-000195 | claude lead operatorless engineering workflow | Hybrid bootstrap: docs/ARCHITECTURE_LESSONS.md manual seed, then auto-distill; fully manual forever rejected | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:195 | high |
| PA-SD-000196 | claude lead operatorless engineering workflow | Bootstrap is Codex-derived from existing MAINTENANCE.md and CLUSTER_CACHE_SPEC.md content — no human seed curation | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:196 | high |
| PA-SD-000197 | claude lead operatorless engineering workflow | Project isolation preserved via Option A: imported cluster template with canonical URL in MAINTENANCE.md; fallback to per-user global if URL undefined | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:197 | medium |
| PA-SD-000199 | claude lead operatorless engineering workflow | Durable decision artifacts are MAINTENANCE.md, docs/CLUSTER_CACHE_SPEC.md, docs/SHADOW_EVAL_SPEC.md, docs/EXPERIMENTS.md — docs/DECISIONS.md does not exist | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:199 | high |
| PA-SD-000200 | claude lead operatorless engineering workflow | Phase number must be Phase 7 consistently across all docs or explicitly reconciled with MAINTENANCE.md | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:200 | high |
| PA-SD-000201 | claude lead operatorless engineering workflow | session_decisions must be confirmed as a readable persistent artifact or distill input redefined as phase summaries + existing docs only | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:201 | medium |
| PA-SD-000203 | claude lead operatorless engineering workflow | Phase 7 now consistent across section header and MAINTENANCE.md | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:203 | high |
| PA-SD-000204 | claude lead operatorless engineering workflow | session_decisions confirmed as SQLite table — not ambiguous artifact | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:204 | high |
| PA-SD-000205 | claude lead operatorless engineering workflow | Non-goals sentence complete: no hidden model-memory authority clause resolved | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:205 | medium |
| PA-SD-000206 | claude lead operatorless engineering workflow | Gate 1 is documentation-only: spec defines data shapes, not extraction logic or storage | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:206 | high |
| PA-SD-000207 | claude lead operatorless engineering workflow | No LLM/extraction prompts, no cluster writes, no src/schema.ts changes, no applies_when evaluation | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:207 | high |
| PA-SD-000208 | claude lead operatorless engineering workflow | Primary artifact is new subsection in CLUSTER_CACHE_SPEC.md; secondary is dry-run template in EXPERIMENTS.md | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:208 | high |
| PA-SD-000209 | claude lead operatorless engineering workflow | Proof of gate close: 6 criteria including field-complete schemas, state machine completeness, no extraction logic, no cross-references to src/ | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:209 | medium |
| PA-SD-000210 | claude lead operatorless engineering workflow | Phase 7 Gate 1 closed — Data/Model Spec in CLUSTER_CACHE_SPEC.md and dry-run template in EXPERIMENTS.md are complete and correct | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:210 | high |
| PA-SD-000211 | claude lead operatorless engineering workflow | Phase 7 Gate 1 closed — no remaining issues | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:211 | high |
| PA-SD-000212 | claude lead operatorless engineering workflow | Gate 2 is a deterministic skeleton report: verbatim decision_text as statement, auto-filled provenance, mechanical classification only, no LLM | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:212 | medium |
| PA-SD-000213 | claude lead operatorless engineering workflow | Script: scripts/architectural-memory-dry-run.mjs reads SQLite + docs, writes report to docs/EXPERIMENTS.md | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:213 | high |
| PA-SD-000214 | claude lead operatorless engineering workflow | Gate 2 closes when script runs without error, all decision_text appears verbatim, no durable memory written, report in EXPERIMENTS.md | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:214 | high |
| PA-SD-000215 | claude lead operatorless engineering workflow | Phase 7 Gate 2 closed — dry-run script operates correctly within Option B scope | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:215 | medium |
| PA-SD-000216 | claude lead operatorless engineering workflow | Gate 3 is both: extended dry-run script with scoring functions AND documented rubric in CLUSTER_CACHE_SPEC.md | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:216 | high |
| PA-SD-000217 | claude lead operatorless engineering workflow | Mechanical scoring: project signals (+1 each) vs transferable signals (+1 each), difference determines classification, confidence from score gap | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:217 | medium |
| PA-SD-000218 | claude lead operatorless engineering workflow | No LLM, no extraction — signals are keyword/path-based only | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:218 | medium |
| PA-SD-000219 | claude lead operatorless engineering workflow | Allowed statuses after Gate 3 scoring: project-architecture, engineering-principles, ambiguous, rejected_no_signal, rejected_too_short, rejected_duplicate | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:219 | medium |
| PA-SD-000220 | claude lead operatorless engineering workflow | Phase 7 Gate 3 closed — scoring rubric and implementation match scope; spec_source signal gap is non-blocking follow-up | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:220 | medium |
| PA-SD-000221 | claude lead operatorless engineering workflow | Gate 3 follow-up on spec_source was a false positive and is withdrawn | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:221 | high |
| PA-DOC-0001 | `cluster_consult` | `cluster_consult`: Consults Claude using a verified factsheet. Phase 4 does not use fork sessions; fork support is Phase 5. | docs:docs/CLUSTER_CACHE_SPEC.md#cluster-consult | medium |

## Gate 4 Approved Project-Architecture

| id | candidate_text | lead_decision | effective_classification | reason | scope_condition | provenance |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - | - |

## Gate 4 Approved Engineering-Principles

| id | candidate_text | lead_decision | effective_classification | reason | scope_condition | provenance |
| --- | --- | --- | --- | --- | --- | --- |
| AMB-SD-000007 | Shadow must use dedicated lock namespace (shadow:${projectId}) separate from production locks | APPROVED | engineering-principles | Shadow namespace isolation via parameterized 'shadow:${projectId}' is a generic cluster isolation pattern, not an AgentSessionRouter-specific artifact. | Apply as advisory guidance; verify against target project's namespace isolation pattern. | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:7 |
| AMB-SD-000035 | Cluster health metrics are router-internal only | APPROVED | engineering-principles | Uses generic 'router-internal' language without referencing AgentSessionRouter-specific emit mechanisms or signal names. | Apply as advisory observability principle; verify target project's internal metrics boundary. | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:35 |
| AMB-SD-000039 | Orphaned session replacement must remain transparent; dead sessions are never silently reused | APPROVED | engineering-principles | Session lifecycle transparency — 'dead sessions are never silently reused' — is a universal invariant with no project-specific artifact references. | Apply universally to any session management system. | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:39 |
| AMB-SD-000041 | Unhealthy cluster must never receive production auto routing traffic | APPROVED | engineering-principles | Unhealthy cluster must never receive production traffic is a universal routing safety invariant; no project-specific artifact references. | Apply as universal auto-routing safety constraint. | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:41 |
| AMB-SD-000050 | Stale cluster fallback defaults to conservative routing strategy | APPROVED | engineering-principles | Conservative stale fallback is a universal routing pattern; no AgentSessionRouter-specific artifacts referenced. | Apply as default conservative fallback strategy for any cluster-based router. | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:50 |
| AMB-SD-000051 | Unverified facts must be re-validated against live metadata before use | APPROVED | engineering-principles | Facts re-validation is a universal data quality invariant; no AgentSessionRouter-specific artifact references in text. | Apply as universal data quality principle for any facts/metadata system. | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:51 |
| AMB-SD-000060 | Secondary session routing must verify metadata health snapshot before using session facts | APPROVED | engineering-principles | Metadata health verification before session facts use is a universal routing safety invariant. | Apply as universal routing safety principle for session-based routing. | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:60 |
| AMB-SD-000061 | Stale-memory risk must be surfaced, not silently suppressed, for older sessions | APPROVED | engineering-principles | Stale-memory risk transparency is a universal safety principle; no project-specific artifact references. | Apply universally to any session management system with stale memory risk. | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:61 |
| AMB-SD-000116 | Reject cluster names containing SQL metacharacters (; " --) at input validation boundary | APPROVED | engineering-principles | SQL metacharacter rejection at input boundaries is a universal security principle; no project-specific artifact references. | Apply as universal input validation security principle for any system handling SQL queries. | session:session_5d398351-9c4a-4670-b70c-49398e6ba477;decision:116 |
| AMB-SD-000121 | Consistent fallback routing for all parallel queries until cluster-level revalidation succeeds | APPROVED | engineering-principles | Consistent fallback routing until revalidation is a universal distributed systems pattern; no project-specific artifacts. | Apply as universal routing consistency principle for parallel query systems. | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:121 |
| AMB-SD-000122 | Continue fallback routing for all remaining parallel queries until cluster revalidation | APPROVED | engineering-principles | Continue fallback until cluster revalidation is a universal distributed systems pattern. | Apply as universal fallback continuation principle for parallel query systems. | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:122 |
| AMB-SD-000123 | Maintain fallback during reprepare until successful completion | APPROVED | engineering-principles | Maintain fallback during reprepare is a universal resilience pattern; no project-specific artifacts. | Apply as universal state-maintenance principle during resource repreparation. | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:123 |
| AMB-DOC-0008 | Scorer/Rubric Rules (Gate 3): Gate 3 makes the Gate 2 classification explicit and auditable. It adds | APPROVED | engineering-principles | Doc-sourced; describes rubric design for a classification pipeline — generic pattern, not AgentSessionRouter-specific. | Apply as generic rubric/scorer design principle; verify against specific project context. | docs:docs/CLUSTER_CACHE_SPEC.md#scorer-rubric-rules-gate-3 |

## Suspended

| id | candidate_text | lead_decision | effective_classification | reason | scope_condition | provenance |
| --- | --- | --- | --- | --- | --- | --- |
| AMB-SD-000036 | External clients must not bypass sanity check based on exposed metrics | SUSPENDED |  | References 'exposed metrics' and 'sanity check' as an external client contract — AgentSessionRouter-specific interface semantics may have evolved. | Only valid if current router sanity-check contract and exposed metrics surface still match this statement. | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:36 |
| AMB-DOC-0019 | v2.7 Observe-Only Routing Snapshot: Verified on 2026-05-16: | SUSPENDED |  | Candidate text is a version snapshot header with no substantive principle content — cannot classify without the full section. | Full section text needed; only version header visible. | docs:MAINTENANCE.md#v2-7-observe-only-routing-snapshot |
| AMB-DOC-0020 | v2.6 Metadata-Rich Routing Snapshot: Verified on 2026-05-15: | SUSPENDED |  | Candidate text is a version snapshot header with no substantive principle content — cannot classify without the full section. | Full section text needed; only version header visible. | docs:MAINTENANCE.md#v2-6-metadata-rich-routing-snapshot |

## Rejected Audit

| id | candidate_text | lead_decision | effective_classification | reason | scope_condition | provenance |
| --- | --- | --- | --- | --- | --- | --- |
| AMB-SD-000008 | New shadow_comparisons table only; shadow data never mixes with cluster_events or session_events | REJECTED |  | Mentions 'shadow_comparisons table', 'cluster_events', and 'session_events' — all AgentSessionRouter-specific database schema artifacts. |  | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:8 |
| AMB-SD-000040 | Exact-topic session deduplication must be preserved across explicit session_id routing | REJECTED |  | Mentions 'exact-topic session deduplication' — AgentSessionRouter-specific session matching mechanism not found in generic routers. |  | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:40 |
| AMB-SD-000052 | Fallback path emits stale cluster signal, not silent degradation | REJECTED |  | Mentions 'stale cluster signal' — AgentSessionRouter-specific emit mechanism in cluster.ts fallback logic. |  | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:52 |
| AMB-SD-000053 | Fallback halts on stale cluster, emits signal for operator to resolve | REJECTED |  | Mentions 'stale cluster' halt-and-emit behavior — AgentSessionRouter-specific cluster state machine. |  | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:53 |
| AMB-SD-000062 | Stale facts = halt with signal, never silent degradation | REJECTED |  | Uses 'halt with signal' language that maps directly to AgentSessionRouter's specific cluster state machine semantics. |  | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:62 |
| AMB-SD-000089 | MAINTENANCE.md contains router answer-hygiene rule; never let shadow eval affect caller answers | REJECTED |  | Explicitly references 'MAINTENANCE.md' and 'router answer-hygiene rule' — AgentSessionRouter-specific operational contract. |  | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:89 |
| AMB-SD-000090 | MAINTENANCE.md is authoritative for router answer-hygiene rules; shadow eval must not affect caller answers | REJECTED |  | Explicitly names 'MAINTENANCE.md' as authoritative for AgentSessionRouter answer-hygiene rules. |  | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:90 |
| AMB-SD-000114 | MAINTENANCE.md is authoritative; shadow eval must not affect caller answers | REJECTED |  | Explicitly names 'MAINTENANCE.md' as authoritative for AgentSessionRouter answer-hygiene rules. |  | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:114 |
| AMB-SD-000167 | Phase gate model with explicit artifact bundles required per phase | REJECTED |  | Describes the AgentSessionRouter-specific phase gate model workflow; not a transferable engineering pattern. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:167 |
| AMB-SD-000168 | Codex must escalate architectural conflicts, ambiguous reqs, risk crossing, and design reversals to lead | REJECTED |  | Describes the AgentSessionRouter operatorless workflow escalation rule; project-specific governance. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:168 |
| AMB-SD-000175 | Phase summaries are read-only by explicit workflow contract; human replies become new issues | REJECTED |  | Describes the AgentSessionRouter human-in-loop contract; project-specific workflow governance. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:175 |
| AMB-SD-000184 | Security patches requiring human sign-off should be explicit exception in Human Touchpoint | REJECTED |  | References 'Human Touchpoint' — an AgentSessionRouter operatorless workflow concept defined in MAINTENANCE.md. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:184 |
| AMB-SD-000186 | Two-pass auto-classification with staging cluster for global population — not mandatory human review, not fully automatic | REJECTED |  | Describes the AgentSessionRouter two-pass classification pipeline with staging cluster for global population. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:186 |
| AMB-SD-000187 | Every principle stores applicability clause and lead session rejection mechanism to prevent dogmatization | REJECTED |  | Describes the AgentSessionRouter principle format design — applicability clauses and lead session rejection mechanism. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:187 |
| AMB-SD-000191 | Two-cluster memory via existing cluster mechanism: project-architecture + engineering-principles | REJECTED |  | Describes the AgentSessionRouter two-cluster memory architecture (project-architecture + engineering-principles). |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:191 |
| AMB-SD-000192 | Two-pass auto-classification: project vs. transferable candidate via staging cluster, Codex self-reviews | REJECTED |  | Describes the AgentSessionRouter two-pass auto-classification mechanism with Codex self-review. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:192 |
| AMB-SD-000198 | All phase gates are documentation milestones — no code required for decision record acceptance | REJECTED |  | Describes the AgentSessionRouter gate approach where phase gates are documentation milestones. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:198 |
| AMB-SD-000202 | Non-goals sentence must be completed: 'no hidden model-memory authority without a diffable artifact' is syntactically incomplete | REJECTED |  | References a specific non-goals sentence from the AgentSessionRouter CLUSTER_CACHE_SPEC.md decision record. |  | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:202 |
| AMB-DOC-0018 | Decisions: - Use verified factsheet cache as source of truth. Do not use opaque Claude session state as the only source of truth. | REJECTED |  | Mentions 'factsheet cache' — AgentSessionRouter-specific verified factsheet architecture; not a generic pattern. |  | docs:docs/EXPERIMENTS.md#decisions |
| AMB-DOC-0026 | Cluster Factsheet Re-Prepare: Re-prepare affected cluster factsheets after any architectural PR that changes: | REJECTED |  | Mentions 'cluster factsheets' and 're-prepare' — AgentSessionRouter-specific cluster factsheet management mechanism. |  | docs:MAINTENANCE.md#cluster-factsheet-re-prepare |

## Gate 3 Non-Distillable Audit

| id | source_ref | text | rejection_code | reason |
| --- | --- | --- | --- | --- |
| DOC-0010 | docs:docs/EXPERIMENTS.md#project-architecture-candidates | Project-Architecture Candidates | rejected_duplicate | candidate text exactly duplicates an earlier candidate in this dry run |
| DOC-0011 | docs:docs/EXPERIMENTS.md#engineering-principle-candidates | Engineering-Principle Candidates | rejected_duplicate | candidate text exactly duplicates an earlier candidate in this dry run |
| DOC-0013 | docs:docs/EXPERIMENTS.md#source-inventory | Source Inventory | rejected_too_short | candidate text is shorter than 20 characters |
| DOC-0017 | docs:docs/EXPERIMENTS.md#rejected-candidates | Rejected Candidates | rejected_too_short | candidate text is shorter than 20 characters |

## Notes

- This artifact compiles reviewed/staged candidates only.
- It is not a durable memory store and must not be served as authoritative factsheet evidence.
- No LLM verifier or factsheet verifier ran in Gate 5.


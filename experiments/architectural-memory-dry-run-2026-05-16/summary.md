### Architectural Memory Dry-Run (Gate 2)

This is a deterministic, LLM-free dry run. It writes no cluster data, no principle store, and no durable architectural memory beyond this report artifact.

Full artifact: `experiments/architectural-memory-dry-run-2026-05-16/`

Generated: 2026-05-16T20:25:03.796Z
Project: AgentSessionRouter
Source rows reviewed: 112
Source docs reviewed: 4
Skipped as non-distillable: 0

#### Source Inventory

| source | type | record_count | last_modified |
| --- | --- | ---: | --- |
| session_decisions | table | 112 | - |
| session_events.raw_response_path | column | 95 (95 existing, 0 missing) | - |
| docs/CLUSTER_CACHE_SPEC.md | file | 67 headings | 2026-05-16T20:09:27.662Z |
| docs/SHADOW_EVAL_SPEC.md | file | 16 headings | 2026-05-15T19:34:39.680Z |
| docs/EXPERIMENTS.md | file | 31 headings | 2026-05-16T20:23:24.213Z |
| MAINTENANCE.md | file | 24 headings | 2026-05-16T19:12:40.905Z |

#### Project-Architecture Skeleton Candidates

| id | topic | decision (verbatim) | provenance.source_type | provenance.source_ref | status |
| --- | --- | --- | --- | --- | --- |
| PA-SD-000007 | v2.1 shadow eval architecture | Shadow must use dedicated lock namespace (shadow:${projectId}) separate from production locks | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:7 | proposed |
| PA-SD-000008 | v2.1 shadow eval architecture | New shadow_comparisons table only; shadow data never mixes with cluster_events or session_events | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:8 | proposed |
| PA-SD-000009 | v2.1 shadow eval architecture | rand_assign committed to DB before either prompt fires for deterministic auditable assignment | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:9 | proposed |
| PA-SD-000010 | v2.1 shadow eval architecture | Single shadowJudge.ts function, not a class | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:10 | proposed |
| PA-SD-000011 | v2.1 shadow eval architecture | ShadowEvalService is fire-and-forget; errors logged and swallowed, never propagate to caller | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:11 | proposed |
| PA-SD-000012 | v2.1 shadow eval architecture | shadowEvalRate config knob in DEFAULT_CONFIG not overridable via tool input | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:12 | proposed |
| PA-SD-000013 | project roadmap after v2.3.1 | Add cost_usd field to ClusterConsultSuccess and forward from Claude adapter response | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:13 | proposed |
| PA-SD-000014 | project roadmap after v2.3.1 | Investigate A3 variance by testing with stripped factsheet before adding facts | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:14 | proposed |
| PA-SD-000015 | project roadmap after v2.3.1 | Add shadow eval loss alert: cluster_consult loses to direct_resume 2+ times in rolling window | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:15 | proposed |
| PA-SD-000016 | project roadmap after v2.3.1 | Document B1/B2 reasoning boundary explicitly in tools.ts cluster_consult tool comment and CLUSTER_CACHE_SPEC.md caller-facing section | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:16 | proposed |
| PA-SD-000017 | v2.1 shadow eval architecture | shadow answer column cap at 4096 chars with CHECK constraint and truncate-at-insert | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:17 | proposed |
| PA-SD-000018 | v2.1 shadow eval architecture | judge failure records error string in judge_result JSON, not NULL | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:18 | proposed |
| PA-SD-000019 | v2.1 shadow eval architecture | NOT IN CONTEXT from cluster_consult is a terminal signal; parent agent continues without retrying | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:19 | proposed |
| PA-SD-000021 | v2.1 shadow eval architecture | claude_consult is the default entry point for all parent agents | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:21 | proposed |
| PA-SD-000022 | v2.1 shadow eval architecture | cluster_consult is secondary; only used when a verified factsheet cluster already exists | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:22 | proposed |
| PA-SD-000023 | v2.1 shadow eval architecture | Auto routing is gated on A3 variance resolution and stable cluster_consult vs direct_resume quality gap across all tiers, not just aggregate | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:23 | proposed |
| PA-SD-000024 | v2.1 shadow eval architecture | Cluster health is router-internal; external contract is only answer quality or NOT IN CONTEXT, not trust state | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:24 | proposed |
| PA-SD-000025 | v2.1 shadow eval architecture | claude_consult is used directly when no verified factsheet cluster exists or when explicit session_id routing is required | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:25 | proposed |
| PA-SD-000027 | v2.1 shadow eval architecture | route_health as a concept does not exist in v2.3.1; existing monitoring uses degradedMode and session_events quality metrics | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:27 | proposed |
| PA-SD-000028 | v2.1 shadow eval architecture | A cluster requires re-prepare when any tracked file's hash or size differs from the stored cluster_file_hashes entry | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:28 | proposed |
| PA-SD-000029 | router consult cache maintenance sample | Re-prepare cluster on package.json/lockfile changes that alter import topology | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:29 | proposed |
| PA-SD-000030 | router consult cache maintenance sample | Re-prepare cluster when consult failure rates exceed sanity threshold | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:30 | proposed |
| PA-SD-000031 | router consult cache maintenance sample | Default consult entry point is the sanity/ready check, not full routing | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:31 | proposed |
| PA-SD-000032 | router consult cache maintenance sample | Full routing only proceeds after sanity endpoint confirms cluster health | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:32 | proposed |
| PA-SD-000033 | router consult cache maintenance sample | Auto routing requires confirmed metadata freshness from health snapshots | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:33 | proposed |
| PA-SD-000034 | router consult cache maintenance sample | Auto routing requires routing latency within acceptable tolerance | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:34 | proposed |
| PA-SD-000035 | router consult cache maintenance sample | Cluster health metrics are router-internal only | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:35 | proposed |
| PA-SD-000036 | router consult cache maintenance sample | External clients must not bypass sanity check based on exposed metrics | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:36 | proposed |
| PA-SD-000037 | router consult cache maintenance sample | Fallback to claude_consult when sanity endpoint fails or times out | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:37 | proposed |
| PA-SD-000038 | router consult cache maintenance sample | Bypass cluster when routing latency exceeds acceptable threshold | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:38 | proposed |
| PA-SD-000039 | v2.1 shadow eval architecture | Orphaned session replacement must remain transparent; dead sessions are never silently reused | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:39 | proposed |
| PA-SD-000040 | v2.1 shadow eval architecture | Exact-topic session deduplication must be preserved across explicit session_id routing | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:40 | proposed |
| PA-SD-000041 | router consult cache maintenance sample | Unhealthy cluster must never receive production auto routing traffic | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:41 | proposed |
| PA-SD-000042 | router consult cache maintenance sample | claude_consult fallback is mandatory when sanity check fails | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:42 | proposed |
| PA-SD-000043 | router consult cache maintenance sample | route_health is derived from sanity check, metadata freshness, and latency tolerance | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:43 | proposed |
| PA-SD-000044 | router consult cache maintenance sample | route_health=false forces mandatory claude_consult fallback | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:44 | proposed |
| PA-SD-000045 | router consult cache maintenance sample | Re-prepare on package.json/lockfile changes that alter import topology | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:45 | proposed |
| PA-SD-000046 | router consult cache maintenance sample | Re-prepare when consult failure rates exceed sanity threshold | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:46 | proposed |
| PA-SD-000047 | router consult route telemetry sample | inspect active session-route mapping before chasing downstream route health metrics | session_decision | session:session_570b63cb-efa6-4345-96bc-84d875385637;decision:47 | proposed |
| PA-SD-000050 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Stale cluster fallback defaults to conservative routing strategy | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:50 | proposed |
| PA-SD-000051 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Unverified facts must be re-validated against live metadata before use | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:51 | proposed |
| PA-SD-000052 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | Fallback path emits stale cluster signal, not silent degradation | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:52 | proposed |
| PA-SD-000053 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | Fallback halts on stale cluster, emits signal for operator to resolve | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:53 | proposed |
| PA-SD-000054 | cluster fallback claude-code-live-workload | Route conservative fallback when cluster factsheet evidence fails strict revalidation | session_decision | session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:54 | proposed |
| PA-SD-000055 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Stale cluster fallback requires metadata health snapshot verification before routing | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:55 | proposed |
| PA-SD-000056 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Operator signal is the snapshot's `verifiedAt` timestamp | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:56 | proposed |
| PA-SD-000057 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | prompt.ts consult export is the default entry point for route sample sessions | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:57 | proposed |
| PA-SD-000058 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | Auto routing requires confirmed fresh cluster facts plus clear operator signal | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:58 | proposed |
| PA-SD-000059 | cluster fallback claude-code-live-workload | Do not reuse prior session route sample matrix for claude-code-live-workload without revalidation | session_decision | session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:59 | proposed |
| PA-SD-000060 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Secondary session routing must verify metadata health snapshot before using session facts | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:60 | proposed |
| PA-SD-000061 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Stale-memory risk must be surfaced, not silently suppressed, for older sessions | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:61 | proposed |
| PA-SD-000062 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | Stale facts = halt with signal, never silent degradation | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:62 | proposed |
| PA-SD-000063 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | route_health composite status gates routing readiness | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:63 | proposed |
| PA-SD-000089 | router consult shadow eval sample | MAINTENANCE.md contains router answer-hygiene rule; never let shadow eval affect caller answers | session_decision | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:89 | proposed |
| PA-SD-000090 | router consult shadow eval sample | MAINTENANCE.md is authoritative for router answer-hygiene rules; shadow eval must not affect caller answers | session_decision | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:90 | proposed |
| PA-SD-000114 | router consult shadow eval sample | MAINTENANCE.md is authoritative; shadow eval must not affect caller answers | session_decision | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:114 | proposed |
| PA-SD-000115 | test | Use npm test for standard test runs | session_decision | session:session_bff3152b-7854-41b0-814f-39461a95685a;decision:115 | proposed |
| PA-SD-000116 | cluster fallback '; DROP TABLE sessions; -- | Reject cluster names containing SQL metacharacters (; " --) at input validation boundary | session_decision | session:session_5d398351-9c4a-4670-b70c-49398e6ba477;decision:116 | proposed |
| PA-SD-000119 | cluster fallback race-test-cluster | Use fallback routing for race-test-cluster until factsheet revalidation passes | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:119 | proposed |
| PA-SD-000120 | cluster fallback race-test-cluster | All parallel queries (0, 1, n) must use fallback routing until race-test-cluster revalidation succeeds | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:120 | proposed |
| PA-SD-000121 | cluster fallback race-test-cluster | Consistent fallback routing for all parallel queries until cluster-level revalidation succeeds | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:121 | proposed |
| PA-SD-000122 | cluster fallback race-test-cluster | Continue fallback routing for all remaining parallel queries until cluster revalidation | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:122 | proposed |
| PA-SD-000123 | cluster fallback race-test-cluster | Maintain fallback during reprepare until successful completion | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:123 | proposed |
| PA-SD-000167 | claude lead operatorless engineering workflow | Phase gate model with explicit artifact bundles required per phase | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:167 | proposed |
| PA-SD-000168 | claude lead operatorless engineering workflow | Codex must escalate architectural conflicts, ambiguous reqs, risk crossing, and design reversals to lead | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:168 | proposed |
| PA-SD-000169 | claude lead operatorless engineering workflow | Workers used only for parallel test authoring, doc drafting, benchmarks, and shadow eval | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:169 | proposed |
| PA-SD-000170 | claude lead operatorless engineering workflow | Monitor signals (route_decisions_total, cluster_attention_events, shadow_eval_delta, continuity_scorer) are the observability contract Codex must not break | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:170 | proposed |
| PA-SD-000171 | claude lead operatorless engineering workflow | Decision ledger in docs/DECISIONS.md provides continuity across stateless Codex sessions | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:171 | proposed |
| PA-SD-000172 | claude lead operatorless engineering workflow | Escalation requires mechanical threshold triggers, not open-ended uncertainty | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:172 | proposed |
| PA-SD-000173 | claude lead operatorless engineering workflow | Phase gates are deterministic pass/fail via gate_criteria.json checked by Codex | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:173 | proposed |
| PA-SD-000174 | claude lead operatorless engineering workflow | Workers are firewalled from human contact by architecture, not policy | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:174 | proposed |
| PA-SD-000175 | claude lead operatorless engineering workflow | Phase summaries are read-only by explicit workflow contract; human replies become new issues | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:175 | proposed |
| PA-SD-000176 | claude lead operatorless engineering workflow | Decision ledger entries include expiry, valid_while conditions, and reconsider_on triggers | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:176 | proposed |
| PA-SD-000177 | claude lead operatorless engineering workflow | Escalation queue requires Codex proposed resolution to bound the response | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:177 | proposed |
| PA-SD-000178 | claude lead operatorless engineering workflow | Codex proceeds alone when routeDecision.ts contracts unchanged, router_monitor green, tests pass, and change is additive | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:178 | proposed |
| PA-SD-000179 | claude lead operatorless engineering workflow | router_consult for route-level conflicts; cluster_consult for cache invalidation ambiguity | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:179 | proposed |
| PA-SD-000180 | claude lead operatorless engineering workflow | Workers are existing test runners run in background, NOT separate Codex sessions | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:180 | proposed |
| PA-SD-000181 | claude lead operatorless engineering workflow | Phase bundle uses existing docs (EXPERIMENTS.md, CLUSTER_CACHE_SPEC.md, SHADOW_EVAL_SPEC.md) plus PR descriptions as artifacts | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:181 | proposed |
| PA-SD-000182 | claude lead operatorless engineering workflow | Single human touchpoint is the PR description; human reads only, mid-phase replies become new issues | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:182 | proposed |
| PA-SD-000183 | claude lead operatorless engineering workflow | Phase Loop Step 2 should be scoped post-read rather than pre-change to avoid read-before-reading | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:183 | proposed |
| PA-SD-000184 | claude lead operatorless engineering workflow | Security patches requiring human sign-off should be explicit exception in Human Touchpoint | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:184 | proposed |
| PA-SD-000185 | claude lead operatorless engineering workflow | docs/DECISIONS.md and phase state location should be named explicitly in the section | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:185 | proposed |
| PA-SD-000186 | claude lead operatorless engineering workflow | Two-pass auto-classification with staging cluster for global population — not mandatory human review, not fully automatic | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:186 | proposed |
| PA-SD-000187 | claude lead operatorless engineering workflow | Every principle stores applicability clause and lead session rejection mechanism to prevent dogmatization | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:187 | proposed |
| PA-SD-000188 | claude lead operatorless engineering workflow | Principles are append-only with scope conditions and suspension log, not traditional versioned rows | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:188 | proposed |
| PA-SD-000189 | claude lead operatorless engineering workflow | Phase 7 distill is consistent with prior deferral — now has concrete trigger: Phase 4 handoff produces transferable insight | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:189 | proposed |
| PA-SD-000190 | claude lead operatorless engineering workflow | Bootstrap via docs/ARCHITECTURE_LESSONS.md manual seed, then auto-populate via distill pipeline; fully manual forever rejected | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:190 | proposed |
| PA-SD-000191 | claude lead operatorless engineering workflow | Two-cluster memory via existing cluster mechanism: project-architecture + engineering-principles | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:191 | proposed |
| PA-SD-000192 | claude lead operatorless engineering workflow | Two-pass auto-classification: project vs. transferable candidate via staging cluster, Codex self-reviews | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:192 | proposed |
| PA-SD-000193 | claude lead operatorless engineering workflow | Append-only principle format with scope conditions, supersession pointers, and suspension log — no traditional versioning | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:193 | proposed |
| PA-SD-000194 | claude lead operatorless engineering workflow | Phase 7 distill triggered at Phase 4 handoff when insight is marked transferable — consistent with prior deferral | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:194 | proposed |
| PA-SD-000195 | claude lead operatorless engineering workflow | Hybrid bootstrap: docs/ARCHITECTURE_LESSONS.md manual seed, then auto-distill; fully manual forever rejected | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:195 | proposed |
| PA-SD-000196 | claude lead operatorless engineering workflow | Bootstrap is Codex-derived from existing MAINTENANCE.md and CLUSTER_CACHE_SPEC.md content — no human seed curation | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:196 | proposed |
| PA-SD-000197 | claude lead operatorless engineering workflow | Project isolation preserved via Option A: imported cluster template with canonical URL in MAINTENANCE.md; fallback to per-user global if URL undefined | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:197 | proposed |
| PA-SD-000198 | claude lead operatorless engineering workflow | All phase gates are documentation milestones — no code required for decision record acceptance | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:198 | proposed |
| PA-SD-000199 | claude lead operatorless engineering workflow | Durable decision artifacts are MAINTENANCE.md, docs/CLUSTER_CACHE_SPEC.md, docs/SHADOW_EVAL_SPEC.md, docs/EXPERIMENTS.md — docs/DECISIONS.md does not exist | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:199 | proposed |
| PA-SD-000200 | claude lead operatorless engineering workflow | Phase number must be Phase 7 consistently across all docs or explicitly reconciled with MAINTENANCE.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:200 | proposed |
| PA-SD-000201 | claude lead operatorless engineering workflow | session_decisions must be confirmed as a readable persistent artifact or distill input redefined as phase summaries + existing docs only | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:201 | proposed |
| PA-SD-000202 | claude lead operatorless engineering workflow | Non-goals sentence must be completed: 'no hidden model-memory authority without a diffable artifact' is syntactically incomplete | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:202 | proposed |
| PA-SD-000203 | claude lead operatorless engineering workflow | Phase 7 now consistent across section header and MAINTENANCE.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:203 | proposed |
| PA-SD-000204 | claude lead operatorless engineering workflow | session_decisions confirmed as SQLite table — not ambiguous artifact | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:204 | proposed |
| PA-SD-000205 | claude lead operatorless engineering workflow | Non-goals sentence complete: no hidden model-memory authority clause resolved | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:205 | proposed |
| PA-SD-000206 | claude lead operatorless engineering workflow | Gate 1 is documentation-only: spec defines data shapes, not extraction logic or storage | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:206 | proposed |
| PA-SD-000207 | claude lead operatorless engineering workflow | No LLM/extraction prompts, no cluster writes, no src/schema.ts changes, no applies_when evaluation | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:207 | proposed |
| PA-SD-000208 | claude lead operatorless engineering workflow | Primary artifact is new subsection in CLUSTER_CACHE_SPEC.md; secondary is dry-run template in EXPERIMENTS.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:208 | proposed |
| PA-SD-000209 | claude lead operatorless engineering workflow | Proof of gate close: 6 criteria including field-complete schemas, state machine completeness, no extraction logic, no cross-references to src/ | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:209 | proposed |
| PA-SD-000210 | claude lead operatorless engineering workflow | Phase 7 Gate 1 closed — Data/Model Spec in CLUSTER_CACHE_SPEC.md and dry-run template in EXPERIMENTS.md are complete and correct | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:210 | proposed |
| PA-SD-000211 | claude lead operatorless engineering workflow | Phase 7 Gate 1 closed — no remaining issues | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:211 | proposed |
| PA-SD-000212 | claude lead operatorless engineering workflow | Gate 2 is a deterministic skeleton report: verbatim decision_text as statement, auto-filled provenance, mechanical classification only, no LLM | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:212 | proposed |
| PA-SD-000213 | claude lead operatorless engineering workflow | Script: scripts/architectural-memory-dry-run.mjs reads SQLite + docs, writes report to docs/EXPERIMENTS.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:213 | proposed |
| PA-SD-000214 | claude lead operatorless engineering workflow | Gate 2 closes when script runs without error, all decision_text appears verbatim, no durable memory written, report in EXPERIMENTS.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:214 | proposed |
| PA-SD-000215 | claude lead operatorless engineering workflow | Phase 7 Gate 2 closed — dry-run script operates correctly within Option B scope | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:215 | proposed |
| PA-DOC-0001 | `cluster_consult` | `cluster_consult`: Consults Claude using a verified factsheet. Phase 4 does not use fork sessions; fork support is Phase 5. | spec | docs:docs/CLUSTER_CACHE_SPEC.md#cluster-consult | proposed |
| PA-DOC-0002 | Decisions | Decisions: - Use verified factsheet cache as source of truth. Do not use opaque Claude session state as the only source of truth. | spec | docs:docs/EXPERIMENTS.md#decisions | proposed |
| PA-DOC-0003 | Consultation Routing Invariant | Consultation Routing Invariant: The normal parent-agent entry point is `router_consult`. | spec | docs:MAINTENANCE.md#consultation-routing-invariant | proposed |
| PA-DOC-0004 | Cluster Factsheet Re-Prepare | Cluster Factsheet Re-Prepare: Re-prepare affected cluster factsheets after any architectural PR that changes: | spec | docs:MAINTENANCE.md#cluster-factsheet-re-prepare | proposed |
| PA-DOC-0005 | When Codex Consults The Claude Lead Session | When Codex Consults The Claude Lead Session: Consult through `router_consult` when any are true: | spec | docs:MAINTENANCE.md#when-codex-consults-the-claude-lead-session | proposed |

#### Engineering-Principle Skeleton Candidates

| id | statement (verbatim/skeleton) | applies_when | provenance.source_type | provenance.source_ref | status |
| --- | --- | --- | --- | --- | --- |
| EP-DOC-0001 | Decision: Architectural Memory Pipeline (Proposed, Not Implemented): Status: proposed. This section records the architectural decision only; it does | TBD by Gate 3 reviewer rules | spec | docs:docs/CLUSTER_CACHE_SPEC.md#decision-architectural-memory-pipeline-proposed-not-implemented | proposed |
| EP-DOC-0002 | A. `project-architecture` Record: Project-architecture records capture decisions that are useful inside one | TBD by Gate 3 reviewer rules | spec | docs:docs/CLUSTER_CACHE_SPEC.md#a-project-architecture-record | proposed |
| EP-DOC-0003 | B. `engineering-principles` Record: Engineering-principle records capture transferable guidance. They are advisory | TBD by Gate 3 reviewer rules | spec | docs:docs/CLUSTER_CACHE_SPEC.md#b-engineering-principles-record | proposed |
| EP-DOC-0004 | C. Staging State Machine: Staging is the review state before a candidate becomes authoritative. Rejected | TBD by Gate 3 reviewer rules | spec | docs:docs/CLUSTER_CACHE_SPEC.md#c-staging-state-machine | proposed |
| EP-DOC-0005 | Project-Architecture Candidates | TBD by Gate 3 reviewer rules | spec | docs:docs/CLUSTER_CACHE_SPEC.md#project-architecture-candidates | proposed |
| EP-DOC-0006 | Engineering-Principle Candidates | TBD by Gate 3 reviewer rules | spec | docs:docs/CLUSTER_CACHE_SPEC.md#engineering-principle-candidates | proposed |
| EP-DOC-0007 | Notes: - signal_quality: <high\|medium\|low> | TBD by Gate 3 reviewer rules | spec | docs:docs/CLUSTER_CACHE_SPEC.md#notes | proposed |
| EP-DOC-0008 | 4. Isolation Rules: - Shadow eval is disabled by default. | TBD by Gate 3 reviewer rules | spec | docs:docs/SHADOW_EVAL_SPEC.md#4-isolation-rules | proposed |
| EP-DOC-0009 | Project-Architecture Candidates | TBD by Gate 3 reviewer rules | spec | docs:docs/EXPERIMENTS.md#project-architecture-candidates | proposed |
| EP-DOC-0010 | Engineering-Principle Candidates | TBD by Gate 3 reviewer rules | spec | docs:docs/EXPERIMENTS.md#engineering-principle-candidates | proposed |
| EP-DOC-0011 | Architectural Memory Dry-Run (Gate 2): This is a deterministic, LLM-free dry run. It writes no cluster data, no principle store, and no durable architectural memory beyond this report artifact. | TBD by Gate 3 reviewer rules | spec | docs:docs/EXPERIMENTS.md#architectural-memory-dry-run-gate-2 | proposed |
| EP-DOC-0012 | Source Inventory | TBD by Gate 3 reviewer rules | spec | docs:docs/EXPERIMENTS.md#source-inventory | proposed |
| EP-DOC-0013 | Project-Architecture Skeleton Candidates | TBD by Gate 3 reviewer rules | spec | docs:docs/EXPERIMENTS.md#project-architecture-skeleton-candidates | proposed |
| EP-DOC-0014 | Engineering-Principle Skeleton Candidates | TBD by Gate 3 reviewer rules | spec | docs:docs/EXPERIMENTS.md#engineering-principle-skeleton-candidates | proposed |
| EP-DOC-0015 | v2.7 Observe-Only Routing Snapshot: Verified on 2026-05-16: | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#v2-7-observe-only-routing-snapshot | proposed |
| EP-DOC-0016 | v2.6 Metadata-Rich Routing Snapshot: Verified on 2026-05-15: | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#v2-6-metadata-rich-routing-snapshot | proposed |
| EP-DOC-0017 | Live Route Sampling: Use `npm run router:sample` when you need a real route-behavior sample across | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#live-route-sampling | proposed |
| EP-DOC-0018 | Session Continuity Benchmark: Use `npm run session:continuity` to measure whether the router preserves context | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#session-continuity-benchmark | proposed |
| EP-DOC-0019 | Session Routing Collision Analysis: Use `npm run session:collision` to inspect fuzzy routing risk without spending | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#session-routing-collision-analysis | proposed |
| EP-DOC-0020 | Route Calibration Report: Use `npm run route:calibration` to turn accumulated `router_route_decision` | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#route-calibration-report | proposed |
| EP-DOC-0021 | Operatorless Engineering Workflow: The default workflow is agent-led. The human owner is not the dispatcher for | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#operatorless-engineering-workflow | proposed |
| EP-DOC-0022 | When Codex Proceeds Alone: Proceed without consulting the lead session when all are true: | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#when-codex-proceeds-alone | proposed |
| EP-DOC-0023 | Phase-End Bundle: Every completed phase should leave a compact evidence bundle in the repo or | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#phase-end-bundle | proposed |
| EP-DOC-0024 | Human Touchpoint: The human touchpoint is the phase-end summary. Mid-phase human interruption is | TBD by Gate 3 reviewer rules | spec | docs:MAINTENANCE.md#human-touchpoint | proposed |

#### Rejected Candidates

| source_ref | rejection_code | reason |
| --- | --- | --- |
| - | - | none; Gate 2 does not evaluate candidate quality |

#### Notes

- signal_quality: medium
- duplicate_candidates: 0
- reviewer_observations: Gate 2 is deterministic and LLM-free. Candidates are skeletons only; no quality review, applies_when population, or durable memory promotion occurred.


# AgentSessionRouter Experiments

## 2026-05-12: Cluster Skeleton, Tool Profiles, and Fork Reuse

### Baseline Failure

Original broad issue-planning consult:

- Duration: 264.8s
- Input tokens: 56,051
- Output tokens: 4,237
- Tool calls: `Agent`, `Glob`, `Read`
- Cause: Claude Code treated the planning request as a codebase exploration task, launched an Explore subagent, globbed the project, and read many files.

Key finding: correct MCP `cwd` prevented cross-project bleed, but did not prevent redundant in-project discovery.

### Prompt Prohibition Only

Curated project skeleton plus explicit instruction not to use `Agent`, `Glob`, `Read`, or directory exploration:

- Duration: 42.6s
- Input tokens: 187
- Cache creation input tokens: 41,059
- Output tokens: 1,881
- Tool calls: none
- Cost: 0.3046 USD

Finding: prompt prohibition works, but normal Claude Code mode still pays a large baseline/cache-creation cost.

Risk found: incomplete skeleton caused hallucinated API/config fields.

### `--tools ""` With Current Skeleton

Same incomplete skeleton, hard tool disable:

- Duration: 68.0s
- Input tokens: 17,208
- Cache creation input tokens: 0
- Output tokens: 1,803
- Tool calls: none
- Cost: 0.1311 USD

Finding: `--tools ""` works with the current auth setup and removes the large Claude Code cache-creation baseline.

Risk found: incomplete skeleton still causes hallucinated fields.

### `--tools ""` With Verified Factsheet

Verified factsheet plus hard tool disable:

- Duration: 28.0s
- Input tokens: 17,587
- Cache creation input tokens: 0
- Output tokens: 1,168
- Tool calls: none
- Cost: 0.1171 USD

Finding: a verified factsheet removes most hallucinated API/config claims. If facts are missing, Claude tends to answer `NOT IN CONTEXT` instead of inventing when instructed.

### `--bare` Auth Probe

Command:

```bash
claude -p --bare --tools "" --output-format json "Return exactly: BARE_OK"
```

Result:

- Duration: 1.7s
- Cache creation input tokens: 258
- Cost: 0.0026 USD
- Status: success

Finding: `--bare` works in this environment despite its documented caveat that it does not read OAuth/keychain credentials. This likely depends on the local auth setup.

### `--bare --tools ""` With Verified Factsheet

- Duration: 36.8s
- Input tokens: 1,170
- Cache creation input tokens: 0
- Output tokens: 1,220
- Tool calls: none
- Cost: 0.0364 USD

Finding: `--bare --tools ""` is the best fresh-call profile observed so far for a complete factsheet.

### `--bare --tools "" --resume BASELINE --fork-session`

Fork from the bare verified-factsheet session, then send only a short follow-up question:

- Duration: 11.5s
- Input tokens: 2,002
- Cache creation input tokens: 0
- Output tokens: 458
- Tool calls: none
- Cost: 0.0215 USD

Finding: `--fork-session` exists and works. The fork retained factsheet context without resending the full factsheet.

Risk found: if the follow-up question is under-scoped, the fork can still introduce a plausible but unrequested next step. Forked consults need strict scope and output contracts.

### Non-Bare `--tools "" --resume BASELINE --fork-session`

Fork from the non-bare verified-factsheet session:

- Duration: 12.2s
- Input tokens: 37
- Cache creation input tokens: 18,299
- Output tokens: 539
- Tool calls: none
- Cost: 0.1280 USD

Finding: non-bare fork keeps a large Claude Code baseline cost. It is faster than fresh, but not cheaper than bare.

### MCP Phase 2 LLM Verifier Implementation

One live `cluster_prepare` run through the implemented LLM verifier path:

- Profile: `focused` (`--tools ""`)
- Duration: 21.9s
- Input tokens: 13,407
- Output tokens: 325
- Result: `partial_llm`
- Verified facts: 1
- Rejected facts: 1

Scenario: static verifier accepted both facts because both selectors appeared in the file, including a false `claude.policy` claim present only in a comment. The LLM verifier promoted the real `extraArgs` fact and rejected the false `claude.policy` field claim.

Finding: the LLM verifier closes the semantic gap left by static evidence checks and correctly distinguishes selector presence from supported API/config truth.

### MCP Phase 3 Profile Probe Implementation

One live profile availability probe through the implemented profile module:

- `focused` (`--tools ""`): available, 6.6s, 37 input tokens, 36 output tokens
- `bare` (`--bare --tools ""`): available, 2.3s, 0 input tokens, 29 output tokens
- Selection for requested `bare`: selected `bare`, no downgrade

Finding: this machine supports both no-tools profiles. The router can now detect profile availability before LLM verification and deterministically downgrade `bare -> focused` when bare is unavailable, without escalating to `agent`.

### MCP Phase 4 Cluster Consult Without Fork

One live `cluster_prepare` + `cluster_consult` run through the implemented non-fork cluster path:

Prepare:

- Profile: `bare` (`--bare --tools ""`)
- Duration: 4.7s
- Input tokens: 345
- Output tokens: 221
- Result: `llm_verified`
- Verified facts: 1
- Rejected facts: 0

Profile probe:

- `bare`: available, 1.5s, 146 input tokens, 34 output tokens
- `focused`: available, 3.5s, 13,783 input tokens, 18 output tokens
- Selection for requested `bare`: selected `bare`, no downgrade

Consult:

- Factsheet status: `llm_verified`
- Profile: `bare`
- Duration: 6.1s
- Input tokens: 489
- Output tokens: 104
- Used fork: false
- Events: `cluster_created`, `factsheet_llm_verified`, `llm_verifier`, `cluster_consult`

Answer correctly used the factsheet passed via `--append-system-prompt` and identified `extraArgs` as the verified config field.

Finding: Phase 4 turns the factsheet cache into a usable consult path. Fresh non-fork `bare` cluster consults can answer from an `llm_verified` factsheet with low latency and without project discovery.

### Quality Comparison Matrix

Full artifact: `experiments/quality-comparison-2026-05-12/`

Controlled run:

- 10 AgentSessionRouter questions
- 3 methods: `direct_fresh`, `direct_resume`, `cluster_consult`
- 3 runs per question/method
- 90 total invocations
- 0 invocation failures
- Factsheet prep: `llm_verified`, 25 verified facts, 0 rejected facts

Summary:

| Method | Mean quality | Mean estimated cost | Mean duration |
|--------|--------------|---------------------|---------------|
| `direct_fresh` | 2.67 | $0.1745 | 19.7s |
| `direct_resume` | 2.77 | $0.0702 | 10.9s |
| `cluster_consult` | 2.73 | $0.0164 | 4.7s |

Category quality:

| Category | direct_fresh | direct_resume | cluster_consult |
|----------|--------------|---------------|-----------------|
| Factual lookup | 2.80 | 2.80 | 3.00 |
| Architectural reasoning | 2.89 | 2.89 | 2.44 |
| Open planning | 2.00 | 2.50 | 2.50 |

Finding: after calibrating the scorer so `NOT IN CONTEXT` caveats do not automatically down-score otherwise substantive answers, `cluster_consult` delivered 98.8% of `direct_resume` mean quality at 23.3% of its estimated per-invocation cost. It is strongest for bounded factual/config questions when the factsheet covers the answer. `direct_fresh` is dominated: lower quality and higher cost than `direct_resume`.

Additional interpretation from the per-question breakdown:

- `cluster_consult` had 6 `NOT IN CONTEXT` mentions; some were caveats appended to useful answers rather than pure refusals.
- No confirmed nonexistent field/event/function hallucinations were identified by the deterministic audit.
- The largest remaining cluster gap was B2 in the baseline factsheet: orphan recovery required connecting more code-path facts than the original factsheet contained.

Recommendation: prioritize Phase 7 distillation/factsheet expansion and a later reasoning-factsheet pass over Phase 5 fork. Fork can reduce already-low cluster cost, but the measured gap is quality/factsheet coverage, not latency.

### Targeted Factsheet Expansion

Full artifact: `experiments/factsheet-expansion-2026-05-13/`

Targeted run after expanding the benchmark factsheet with verifier rationale, complete orphan-recovery paths, and spec-backed `cluster_refresh` extension options:

- 3 questions: B1, B2, C1
- 1 method: `cluster_consult`
- 3 runs per question
- 9 total invocations
- 0 invocation failures
- Factsheet prep: `llm_verified`, 33 verified facts, 0 rejected facts
- Factsheet prep cost estimate: $0.1688

Summary:

| Method | Mean quality | Mean estimated cost | Mean duration |
|--------|--------------|---------------------|---------------|
| `cluster_consult` | 2.89 | $0.0240 | 7.2s |

Per-question quality:

| Question | Before expansion | After expansion | Finding |
|----------|------------------|-----------------|---------|
| B1 verifier rationale | 2/3/3 (2.67) | 3/2/3 (2.67) | Already mostly covered after scoring calibration; still has minor variance. |
| B2 orphan recovery path | 2/1/2 (1.67) | 3/3/3 (3.00) | Expansion closed the code-path gap. |
| C1 refresh improvements | 3/2/3 (2.67) | 3/3/3 (3.00) | Spec-backed future-mode facts made suggestions stable. |

Finding: factsheet expansion removed all low-score rows in the targeted set and stabilized B2/C1 at 3/3/3. B1 still has one score-2 answer, so any further improvement should target clearer derived rationale facts or prompt wording rather than fork optimization.

### Session Continuity Scorer Calibration

Continuity artifacts:

- `experiments/session-continuity-2026-05-15/`
- `experiments/session-continuity-2026-05-15-v5/`
- `experiments/session-continuity-2026-05-16/`
- `experiments/session-continuity-2026-05-16-rerun/`
- `experiments/session-continuity-2026-05-17-gate13-baseline-a8fa199/`

Known scorer artifact: the T5 synthesis row can score `2` even when the answer is substantively correct. This is the third known scorer-calibration class after `NOT IN CONTEXT` caveats and honest-refusal handling: the scorer narrowly matches wording instead of the full semantic answer. The T5 scorer requires the final synthesis answer to match one of these wording patterns for the `session-benchmark` requirement:

- `same session`
- `durable session`
- `multi-turn`
- `continuity`

Some correct answers instead propose a stale-factsheet/fallback benchmark. That answers the architectural question and references `ALPHA-17`, `BETA-29`, and why `cluster_consult` vs `direct_fresh` is insufficient, but misses the narrow wording pattern. This is a wording-match limit in the benchmark scorer, not a system-quality failure.

Established baseline for `router_exact_topic` after the latest pre-refactor continuity run:

| Run | `router_exact_topic` T2/T4/T5 | Interpretation |
| --- | --- | --- |
| `2026-05-15` | `3/3/3` | One run where T5 used the expected continuity/session wording. |
| `2026-05-15-v5` | `3/3/2` | Pre-refactor baseline; T5 missed only `session-benchmark` wording. |
| `2026-05-16` | `3/3/2` | Post-refactor proof; same T5 scorer artifact, memory probes intact. |
| `2026-05-16-rerun` | `3/3/2` | Isolated rerun confirmed this is stable scorer behavior, not extract-regression variance. |
| `2026-05-17-gate13-baseline-a8fa199` | `3/3/2` | Gate 13 pre-serving baseline on the disabled scaffold. Runtime serving remained off. |

Operational rule: compare future `router_exact_topic` synthesis runs against `3/3/2` as the current correct baseline unless the T5 scorer rubric is deliberately changed. Do not treat `3/3/2` as a regression by itself and do not try to restore a `3/3/3` baseline by changing router behavior. Treat it as a regression only if memory probes fall below `3/3`, route reuse stops using one session, or T5 loses the substantive `ALPHA-17`/`BETA-29` reasoning rather than just the exact `session-benchmark` wording.

### Gate 13 Architectural Memory Proof Of Value

Artifact:

- `experiments/gate13-proof-of-value-2026-05-17-20a02c4/`

This experiment tests whether seeded engineering-principle memory is useful,
not whether it regresses session continuity. Runtime serving remained disabled.
Two isolated durable lead sessions were created: one received a manual
test-mode seed of 7 active engineering-principles, the other received no seed.
Eight architecture-review questions were answered by both sessions and judged
blind.

Aggregate result:

| Metric | Result |
| --- | ---: |
| Questions | 8 |
| Seeded wins | 8 |
| Control wins | 0 |
| Ties | 0 |
| Seeded cited expected principle | 8 |
| Control cited expected principle | 0 |
| Principle helped and seeded won | 8 |

Finding: test-mode seeded architectural memory showed measurable value on this
targeted set. It made the lead answers auditable by grounding decisions in
specific active principles, while the unseeded control generally reached the
same high-level decision through generic reasoning. This is a proof-of-value
signal only; Gate 13 enablement still requires the separate post-serving
`session:continuity` regression proof.

Tool-choice note: shadow-style A/B judging is appropriate for this proof of
value because it is a fan-out comparison of two independent answers to the same
question. It is not appropriate for the Gate 13 quiet-quality-regression
guardrail, where the axis is chain memory and `session:continuity` is the
correct instrument.

### Gate 13 Controlled Enablement Smoke

Artifact:

- `experiments/gate13-controlled-enablement-2026-05-17/live-verification.json`

This is the first runtime enablement of architectural-memory serving. It is not
the post-serving quality proof. The smoke checks that the serving path is
enabled only for one-time lead-session creation and that the six cost/safety
guardrails are visible on the live system.

Observed live result:

| Check | Result |
| --- | --- |
| `runtime_import_serving_enabled` | `true` |
| First lead-session call | new durable session created and seeded |
| Actual injected seed tokens | 872 |
| Selected records | 8 total: max-7 engineering-principle path plus project add-on within cap |
| Selection LLM tokens | 0 |
| Per-consult architectural-memory tokens after seed | 0 |
| Second exact-topic call | reused same session, no seed reinjection |
| `seed_signature` dedup | confirmed by unchanged session and absent second seed |

Next required proof remains separate: run at least 3 post-serving
`session:continuity` repetitions against the stored pre-serving baseline before
claiming quality approval.

### Gate 13 Post-Serving Targeted Continuity

Artifact:

- `experiments/gate13-post-serving-continuity-2026-05-17/`

This run checks the quiet-quality-regression guardrail after controlled
enablement. It uses a separate baseline worktree at commit `20a02c4` and the
current controlled-enabled commit `8ec92c7`, with identical architectural
metadata. The metadata is proof-of-value aligned so the post-serving seed
contains the principles that were useful in the A/B proof instead of measuring
an unrelated topic seed.

Aggregate result:

| Metric | Baseline `20a02c4` | Current `8ec92c7` |
| --- | ---: | ---: |
| Repetitions | 3 | 3 |
| Calls | 15 | 15 |
| Failed calls | 0 | 0 |
| Seeded calls | 0 | 3 |
| Seed token counts | n/a | 892, 892, 892 |
| Avg score all turns | 2.80 | 2.87 |
| Avg memory probes | 3.00 | 3.00 |
| Avg memory+synthesis | 2.67 | 2.78 |
| T5 scores | 2, 2, 2 | 3, 2, 2 |

Finding: no continuity regression from seed-at-session-creation serving.
Persistent memory probes stayed perfect across all baseline and post-serving
repetitions. The seeded run selected `AMB-RESCUE-0002`, `AMB-DOC-0008`,
`AMB-RESCUE-0003`, `AMB-RESCUE-0004`, `AMB-SD-000050`,
`AMB-RESCUE-0001`, and `AMB-RESCUE-0005`; this deliberately covers the
proof-of-value principles around stale evidence, verified artifacts,
caller-facing telemetry isolation, runtime principle counter-evidence,
provenance, and auditable classification.

Known gap: `single-run-insufficient` and `extract != improve` are documented as
process guardrails, but they are not currently active engineering-principle
records. Runtime serving cannot select them until they are promoted into the
active memory corpus.

### Architectural Memory Distill Dry-Run Template

This is a placeholder report shape for Phase 7 Gate 1. It documents what a
future dry-run output should look like; it is not the output of a real distill
run and does not imply that extraction logic exists.

```markdown
# Architectural Memory Distill Dry-Run Report

Generated: 2026-05-16T00:00:00Z
Project: AgentSessionRouter
Source rows reviewed: 0
Source docs reviewed: 0
Skipped as non-distillable: 0

## Project-Architecture Candidates

| id | topic | decision | provenance.source_type | provenance.source_ref | status |
| --- | --- | --- | --- | --- | --- |
| PA-0001 | placeholder topic | placeholder decision | session_decision | session:<id> | proposed |

## Engineering-Principle Candidates

| id | statement | applies_when | provenance.source_type | provenance.source_ref | status |
| --- | --- | --- | --- | --- | --- |
| EP-0001 | placeholder advisory principle | placeholder scope condition | spec | docs:<path> | proposed |

## Rejected Candidates

| source_ref | rejection_code | reason |
| --- | --- | --- |
| session:<id> | rejected_project_noise | placeholder reason |

## Notes

- signal_quality: placeholder
- duplicate_candidates: 0
- reviewer_observations: placeholder
```

### Architectural Memory Dry-Run (Gate 2 + Gate 3 Scoring)

This is a deterministic, LLM-free dry run. It writes no cluster data, no principle store, and no durable architectural memory beyond this report artifact. Gate 3 scoring is mechanical signal counting only; it does not evaluate semantic quality or promote memory.

Full artifact: `experiments/architectural-memory-dry-run-2026-05-16/`

Generated: 2026-05-16T20:37:05.154Z
Project: AgentSessionRouter
Source rows reviewed: 118
Source docs reviewed: 4
Skipped as non-distillable: 4
Ambiguous candidates for future lead review: 36

#### Source Inventory

| source | type | record_count | last_modified |
| --- | --- | ---: | --- |
| session_decisions | table | 118 | - |
| session_events.raw_response_path | column | 98 (98 existing, 0 missing) | - |
| docs/CLUSTER_CACHE_SPEC.md | file | 68 headings | 2026-05-16T20:28:34.674Z |
| docs/SHADOW_EVAL_SPEC.md | file | 16 headings | 2026-05-15T19:34:39.680Z |
| docs/EXPERIMENTS.md | file | 32 headings | 2026-05-16T20:36:14.719Z |
| MAINTENANCE.md | file | 24 headings | 2026-05-16T19:12:40.905Z |

#### Project-Architecture Skeleton Candidates

| id | topic | decision (verbatim) | provenance.source_type | provenance.source_ref | status | project_score | transferable_score | primary_signal | confidence |
| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
| PA-SD-000009 | v2.1 shadow eval architecture | rand_assign committed to DB before either prompt fires for deterministic auditable assignment | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:9 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000010 | v2.1 shadow eval architecture | Single shadowJudge.ts function, not a class | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:10 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000012 | v2.1 shadow eval architecture | shadowEvalRate config knob in DEFAULT_CONFIG not overridable via tool input | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:12 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000013 | project roadmap after v2.3.1 | Add cost_usd field to ClusterConsultSuccess and forward from Claude adapter response | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:13 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000014 | project roadmap after v2.3.1 | Investigate A3 variance by testing with stripped factsheet before adding facts | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:14 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000015 | project roadmap after v2.3.1 | Add shadow eval loss alert: cluster_consult loses to direct_resume 2+ times in rolling window | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:15 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000016 | project roadmap after v2.3.1 | Document B1/B2 reasoning boundary explicitly in tools.ts cluster_consult tool comment and CLUSTER_CACHE_SPEC.md caller-facing section | session_decision | session:session_e65145e0-1911-4a87-ad7d-8477254bdbb2;decision:16 | proposed | 3 | 2 | project_file_path | medium |
| PA-SD-000017 | v2.1 shadow eval architecture | shadow answer column cap at 4096 chars with CHECK constraint and truncate-at-insert | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:17 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000018 | v2.1 shadow eval architecture | judge failure records error string in judge_result JSON, not NULL | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:18 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000019 | v2.1 shadow eval architecture | NOT IN CONTEXT from cluster_consult is a terminal signal; parent agent continues without retrying | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:19 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000021 | v2.1 shadow eval architecture | claude_consult is the default entry point for all parent agents | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:21 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000022 | v2.1 shadow eval architecture | cluster_consult is secondary; only used when a verified factsheet cluster already exists | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:22 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000023 | v2.1 shadow eval architecture | Auto routing is gated on A3 variance resolution and stable cluster_consult vs direct_resume quality gap across all tiers, not just aggregate | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:23 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000025 | v2.1 shadow eval architecture | claude_consult is used directly when no verified factsheet cluster exists or when explicit session_id routing is required | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:25 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000027 | v2.1 shadow eval architecture | route_health as a concept does not exist in v2.3.1; existing monitoring uses degradedMode and session_events quality metrics | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:27 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000028 | v2.1 shadow eval architecture | A cluster requires re-prepare when any tracked file's hash or size differs from the stored cluster_file_hashes entry | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:28 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000029 | router consult cache maintenance sample | Re-prepare cluster on package.json/lockfile changes that alter import topology | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:29 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000030 | router consult cache maintenance sample | Re-prepare cluster when consult failure rates exceed sanity threshold | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:30 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000031 | router consult cache maintenance sample | Default consult entry point is the sanity/ready check, not full routing | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:31 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000032 | router consult cache maintenance sample | Full routing only proceeds after sanity endpoint confirms cluster health | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:32 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000033 | router consult cache maintenance sample | Auto routing requires confirmed metadata freshness from health snapshots | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:33 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000034 | router consult cache maintenance sample | Auto routing requires routing latency within acceptable tolerance | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:34 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000037 | router consult cache maintenance sample | Fallback to claude_consult when sanity endpoint fails or times out | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:37 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000038 | router consult cache maintenance sample | Bypass cluster when routing latency exceeds acceptable threshold | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:38 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000042 | router consult cache maintenance sample | claude_consult fallback is mandatory when sanity check fails | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:42 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000043 | router consult cache maintenance sample | route_health is derived from sanity check, metadata freshness, and latency tolerance | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:43 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000044 | router consult cache maintenance sample | route_health=false forces mandatory claude_consult fallback | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:44 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000045 | router consult cache maintenance sample | Re-prepare on package.json/lockfile changes that alter import topology | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:45 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000046 | router consult cache maintenance sample | Re-prepare when consult failure rates exceed sanity threshold | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:46 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000047 | router consult route telemetry sample | inspect active session-route mapping before chasing downstream route health metrics | session_decision | session:session_570b63cb-efa6-4345-96bc-84d875385637;decision:47 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000054 | cluster fallback claude-code-live-workload | Route conservative fallback when cluster factsheet evidence fails strict revalidation | session_decision | session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:54 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000056 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | Operator signal is the snapshot's `verifiedAt` timestamp | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:56 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000057 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | prompt.ts consult export is the default entry point for route sample sessions | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:57 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000058 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | Auto routing requires confirmed fresh cluster facts plus clear operator signal | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:58 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000059 | cluster fallback claude-code-live-workload | Do not reuse prior session route sample matrix for claude-code-live-workload without revalidation | session_decision | session:session_9e3540b3-5451-442f-af26-03c888b7e859;decision:59 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000063 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | route_health composite status gates routing readiness | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:63 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000115 | test | Use npm test for standard test runs | session_decision | session:session_bff3152b-7854-41b0-814f-39461a95685a;decision:115 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000119 | cluster fallback race-test-cluster | Use fallback routing for race-test-cluster until factsheet revalidation passes | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:119 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000169 | claude lead operatorless engineering workflow | Workers used only for parallel test authoring, doc drafting, benchmarks, and shadow eval | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:169 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000171 | claude lead operatorless engineering workflow | Decision ledger in docs/DECISIONS.md provides continuity across stateless Codex sessions | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:171 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000172 | claude lead operatorless engineering workflow | Escalation requires mechanical threshold triggers, not open-ended uncertainty | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:172 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000173 | claude lead operatorless engineering workflow | Phase gates are deterministic pass/fail via gate_criteria.json checked by Codex | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:173 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000174 | claude lead operatorless engineering workflow | Workers are firewalled from human contact by architecture, not policy | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:174 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000176 | claude lead operatorless engineering workflow | Decision ledger entries include expiry, valid_while conditions, and reconsider_on triggers | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:176 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000177 | claude lead operatorless engineering workflow | Escalation queue requires Codex proposed resolution to bound the response | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:177 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000178 | claude lead operatorless engineering workflow | Codex proceeds alone when routeDecision.ts contracts unchanged, router_monitor green, tests pass, and change is additive | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:178 | proposed | 3 | 2 | project_file_path | medium |
| PA-SD-000179 | claude lead operatorless engineering workflow | router_consult for route-level conflicts; cluster_consult for cache invalidation ambiguity | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:179 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000180 | claude lead operatorless engineering workflow | Workers are existing test runners run in background, NOT separate Codex sessions | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:180 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000181 | claude lead operatorless engineering workflow | Phase bundle uses existing docs (EXPERIMENTS.md, CLUSTER_CACHE_SPEC.md, SHADOW_EVAL_SPEC.md) plus PR descriptions as artifacts | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:181 | proposed | 3 | 0 | project_file_path | high |
| PA-SD-000182 | claude lead operatorless engineering workflow | Single human touchpoint is the PR description; human reads only, mid-phase replies become new issues | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:182 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000185 | claude lead operatorless engineering workflow | docs/DECISIONS.md and phase state location should be named explicitly in the section | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:185 | proposed | 2 | 1 | project_file_path | medium |
| PA-SD-000189 | claude lead operatorless engineering workflow | Phase 7 distill is consistent with prior deferral — now has concrete trigger: Phase 4 handoff produces transferable insight | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:189 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000190 | claude lead operatorless engineering workflow | Bootstrap via docs/ARCHITECTURE_LESSONS.md manual seed, then auto-populate via distill pipeline; fully manual forever rejected | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:190 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000194 | claude lead operatorless engineering workflow | Phase 7 distill triggered at Phase 4 handoff when insight is marked transferable — consistent with prior deferral | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:194 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000195 | claude lead operatorless engineering workflow | Hybrid bootstrap: docs/ARCHITECTURE_LESSONS.md manual seed, then auto-distill; fully manual forever rejected | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:195 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000196 | claude lead operatorless engineering workflow | Bootstrap is Codex-derived from existing MAINTENANCE.md and CLUSTER_CACHE_SPEC.md content — no human seed curation | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:196 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000197 | claude lead operatorless engineering workflow | Project isolation preserved via Option A: imported cluster template with canonical URL in MAINTENANCE.md; fallback to per-user global if URL undefined | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:197 | proposed | 2 | 1 | project_file_path | medium |
| PA-SD-000199 | claude lead operatorless engineering workflow | Durable decision artifacts are MAINTENANCE.md, docs/CLUSTER_CACHE_SPEC.md, docs/SHADOW_EVAL_SPEC.md, docs/EXPERIMENTS.md — docs/DECISIONS.md does not exist | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:199 | proposed | 3 | 0 | project_file_path | high |
| PA-SD-000200 | claude lead operatorless engineering workflow | Phase number must be Phase 7 consistently across all docs or explicitly reconciled with MAINTENANCE.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:200 | proposed | 3 | 1 | project_file_path | high |
| PA-SD-000201 | claude lead operatorless engineering workflow | session_decisions must be confirmed as a readable persistent artifact or distill input redefined as phase summaries + existing docs only | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:201 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000203 | claude lead operatorless engineering workflow | Phase 7 now consistent across section header and MAINTENANCE.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:203 | proposed | 3 | 0 | project_file_path | high |
| PA-SD-000204 | claude lead operatorless engineering workflow | session_decisions confirmed as SQLite table — not ambiguous artifact | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:204 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000205 | claude lead operatorless engineering workflow | Non-goals sentence complete: no hidden model-memory authority clause resolved | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:205 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000206 | claude lead operatorless engineering workflow | Gate 1 is documentation-only: spec defines data shapes, not extraction logic or storage | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:206 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000207 | claude lead operatorless engineering workflow | No LLM/extraction prompts, no cluster writes, no src/schema.ts changes, no applies_when evaluation | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:207 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000208 | claude lead operatorless engineering workflow | Primary artifact is new subsection in CLUSTER_CACHE_SPEC.md; secondary is dry-run template in EXPERIMENTS.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:208 | proposed | 2 | 0 | project_file_path | high |
| PA-SD-000209 | claude lead operatorless engineering workflow | Proof of gate close: 6 criteria including field-complete schemas, state machine completeness, no extraction logic, no cross-references to src/ | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:209 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000210 | claude lead operatorless engineering workflow | Phase 7 Gate 1 closed — Data/Model Spec in CLUSTER_CACHE_SPEC.md and dry-run template in EXPERIMENTS.md are complete and correct | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:210 | proposed | 3 | 0 | project_file_path | high |
| PA-SD-000211 | claude lead operatorless engineering workflow | Phase 7 Gate 1 closed — no remaining issues | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:211 | proposed | 2 | 0 | current_project_session | high |
| PA-SD-000212 | claude lead operatorless engineering workflow | Gate 2 is a deterministic skeleton report: verbatim decision_text as statement, auto-filled provenance, mechanical classification only, no LLM | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:212 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000213 | claude lead operatorless engineering workflow | Script: scripts/architectural-memory-dry-run.mjs reads SQLite + docs, writes report to docs/EXPERIMENTS.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:213 | proposed | 3 | 0 | project_file_path | high |
| PA-SD-000214 | claude lead operatorless engineering workflow | Gate 2 closes when script runs without error, all decision_text appears verbatim, no durable memory written, report in EXPERIMENTS.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:214 | proposed | 3 | 0 | project_file_path | high |
| PA-SD-000215 | claude lead operatorless engineering workflow | Phase 7 Gate 2 closed — dry-run script operates correctly within Option B scope | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:215 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000216 | claude lead operatorless engineering workflow | Gate 3 is both: extended dry-run script with scoring functions AND documented rubric in CLUSTER_CACHE_SPEC.md | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:216 | proposed | 3 | 0 | project_file_path | high |
| PA-SD-000217 | claude lead operatorless engineering workflow | Mechanical scoring: project signals (+1 each) vs transferable signals (+1 each), difference determines classification, confidence from score gap | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:217 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000218 | claude lead operatorless engineering workflow | No LLM, no extraction — signals are keyword/path-based only | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:218 | proposed | 1 | 0 | current_project_session | medium |
| PA-SD-000219 | claude lead operatorless engineering workflow | Allowed statuses after Gate 3 scoring: project-architecture, engineering-principles, ambiguous, rejected_no_signal, rejected_too_short, rejected_duplicate | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:219 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000220 | claude lead operatorless engineering workflow | Phase 7 Gate 3 closed — scoring rubric and implementation match scope; spec_source signal gap is non-blocking follow-up | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:220 | proposed | 2 | 1 | current_project_session | medium |
| PA-SD-000221 | claude lead operatorless engineering workflow | Gate 3 follow-up on spec_source was a false positive and is withdrawn | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:221 | proposed | 2 | 0 | current_project_session | high |
| PA-DOC-0001 | `cluster_consult` | `cluster_consult`: Consults Claude using a verified factsheet. Phase 4 does not use fork sessions; fork support is Phase 5. | spec | docs:docs/CLUSTER_CACHE_SPEC.md#cluster-consult | proposed | 2 | 1 | repo_feature_name | medium |

#### Engineering-Principle Skeleton Candidates

| id | statement (verbatim/skeleton) | applies_when | provenance.source_type | provenance.source_ref | status | project_score | transferable_score | primary_signal | confidence |
| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
| EP-SD-000011 | ShadowEvalService is fire-and-forget; errors logged and swallowed, never propagate to caller | TBD by Gate 4 lead-session review | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:11 | proposed | 1 | 2 | normative_language | medium |
| EP-SD-000024 | Cluster health is router-internal; external contract is only answer quality or NOT IN CONTEXT, not trust state | TBD by Gate 4 lead-session review | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:24 | proposed | 1 | 2 | generic_agent_or_router_pattern | medium |
| EP-SD-000055 | Stale cluster fallback requires metadata health snapshot verification before routing | TBD by Gate 4 lead-session review | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:55 | proposed | 1 | 2 | generic_agent_or_router_pattern | medium |
| EP-SD-000120 | All parallel queries (0, 1, n) must use fallback routing until race-test-cluster revalidation succeeds | TBD by Gate 4 lead-session review | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:120 | proposed | 1 | 2 | normative_language | medium |
| EP-SD-000170 | Monitor signals (route_decisions_total, cluster_attention_events, shadow_eval_delta, continuity_scorer) are the observability contract Codex must not break | TBD by Gate 4 lead-session review | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:170 | proposed | 2 | 3 | normative_language | medium |
| EP-SD-000183 | Phase Loop Step 2 should be scoped post-read rather than pre-change to avoid read-before-reading | TBD by Gate 4 lead-session review | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:183 | proposed | 1 | 2 | normative_language | medium |
| EP-SD-000188 | Principles are append-only with scope conditions and suspension log, not traditional versioned rows | TBD by Gate 4 lead-session review | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:188 | proposed | 1 | 2 | normative_language | medium |
| EP-SD-000193 | Append-only principle format with scope conditions, supersession pointers, and suspension log — no traditional versioning | TBD by Gate 4 lead-session review | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:193 | proposed | 1 | 2 | normative_language | medium |
| EP-DOC-0002 | Decision: Architectural Memory Pipeline (Proposed, Not Implemented): Status: proposed. This section records the architectural decision only; it does | TBD by Gate 4 lead-session review | spec | docs:docs/CLUSTER_CACHE_SPEC.md#decision-architectural-memory-pipeline-proposed-not-implemented | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0003 | A. `project-architecture` Record: Project-architecture records capture decisions that are useful inside one | TBD by Gate 4 lead-session review | spec | docs:docs/CLUSTER_CACHE_SPEC.md#a-project-architecture-record | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0004 | B. `engineering-principles` Record: Engineering-principle records capture transferable guidance. They are advisory | TBD by Gate 4 lead-session review | spec | docs:docs/CLUSTER_CACHE_SPEC.md#b-engineering-principles-record | proposed | 0 | 3 | normative_language | high |
| EP-DOC-0005 | C. Staging State Machine: Staging is the review state before a candidate becomes authoritative. Rejected | TBD by Gate 4 lead-session review | spec | docs:docs/CLUSTER_CACHE_SPEC.md#c-staging-state-machine | proposed | 0 | 3 | generic_contract_language | high |
| EP-DOC-0006 | Project-Architecture Candidates | TBD by Gate 4 lead-session review | spec | docs:docs/CLUSTER_CACHE_SPEC.md#project-architecture-candidates | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0007 | Engineering-Principle Candidates | TBD by Gate 4 lead-session review | spec | docs:docs/CLUSTER_CACHE_SPEC.md#engineering-principle-candidates | proposed | 0 | 3 | normative_language | high |
| EP-DOC-0009 | 4. Isolation Rules: - Shadow eval is disabled by default. | TBD by Gate 4 lead-session review | spec | docs:docs/SHADOW_EVAL_SPEC.md#4-isolation-rules | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0012 | Architectural Memory Dry-Run (Gate 2 + Gate 3 Scoring): This is a deterministic, LLM-free dry run. It writes no cluster data, no principle store, and no durable architectural memory beyond this report artifact. Gate 3 scoring is mechanical signal counting only; it does not evaluate semantic quality or promote memory. | TBD by Gate 4 lead-session review | spec | docs:docs/EXPERIMENTS.md#architectural-memory-dry-run-gate-2-gate-3-scoring | proposed | 1 | 2 | normative_language | medium |
| EP-DOC-0014 | Project-Architecture Skeleton Candidates | TBD by Gate 4 lead-session review | spec | docs:docs/EXPERIMENTS.md#project-architecture-skeleton-candidates | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0015 | Engineering-Principle Skeleton Candidates | TBD by Gate 4 lead-session review | spec | docs:docs/EXPERIMENTS.md#engineering-principle-skeleton-candidates | proposed | 0 | 3 | normative_language | high |
| EP-DOC-0016 | Ambiguous Candidates | TBD by Gate 4 lead-session review | spec | docs:docs/EXPERIMENTS.md#ambiguous-candidates | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0021 | Consultation Routing Invariant: The normal parent-agent entry point is `router_consult`. | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#consultation-routing-invariant | proposed | 1 | 3 | normative_language | high |
| EP-DOC-0022 | Live Route Sampling: Use `npm run router:sample` when you need a real route-behavior sample across | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#live-route-sampling | proposed | 0 | 3 | generic_agent_or_router_pattern | high |
| EP-DOC-0023 | Session Continuity Benchmark: Use `npm run session:continuity` to measure whether the router preserves context | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#session-continuity-benchmark | proposed | 1 | 2 | generic_agent_or_router_pattern | medium |
| EP-DOC-0024 | Session Routing Collision Analysis: Use `npm run session:collision` to inspect fuzzy routing risk without spending | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#session-routing-collision-analysis | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0025 | Route Calibration Report: Use `npm run route:calibration` to turn accumulated `router_route_decision` | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#route-calibration-report | proposed | 0 | 3 | generic_agent_or_router_pattern | high |
| EP-DOC-0027 | Operatorless Engineering Workflow: The default workflow is agent-led. The human owner is not the dispatcher for | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#operatorless-engineering-workflow | proposed | 0 | 3 | generic_agent_or_router_pattern | high |
| EP-DOC-0028 | When Codex Proceeds Alone: Proceed without consulting the lead session when all are true: | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#when-codex-proceeds-alone | proposed | 0 | 2 | spec_source | high |
| EP-DOC-0029 | When Codex Consults The Claude Lead Session: Consult through `router_consult` when any are true: | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#when-codex-consults-the-claude-lead-session | proposed | 1 | 2 | generic_agent_or_router_pattern | medium |
| EP-DOC-0030 | Phase-End Bundle: Every completed phase should leave a compact evidence bundle in the repo or | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#phase-end-bundle | proposed | 0 | 3 | normative_language | high |
| EP-DOC-0031 | Human Touchpoint: The human touchpoint is the phase-end summary. Mid-phase human interruption is | TBD by Gate 4 lead-session review | spec | docs:MAINTENANCE.md#human-touchpoint | proposed | 0 | 2 | spec_source | high |

#### Ambiguous Candidates

| id | text (verbatim/skeleton) | provenance.source_type | provenance.source_ref | project_score | transferable_score | primary_signal | confidence |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| AMB-SD-000007 | Shadow must use dedicated lock namespace (shadow:${projectId}) separate from production locks | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:7 | 1 | 1 | current_project_session | low |
| AMB-SD-000008 | New shadow_comparisons table only; shadow data never mixes with cluster_events or session_events | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:8 | 1 | 1 | current_project_session | low |
| AMB-SD-000035 | Cluster health metrics are router-internal only | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:35 | 1 | 1 | current_project_session | low |
| AMB-SD-000036 | External clients must not bypass sanity check based on exposed metrics | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:36 | 1 | 1 | current_project_session | low |
| AMB-SD-000039 | Orphaned session replacement must remain transparent; dead sessions are never silently reused | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:39 | 1 | 1 | current_project_session | low |
| AMB-SD-000040 | Exact-topic session deduplication must be preserved across explicit session_id routing | session_decision | session:session_11d18ee8-3799-443f-8f5f-ecd866db9e57;decision:40 | 1 | 1 | current_project_session | low |
| AMB-SD-000041 | Unhealthy cluster must never receive production auto routing traffic | session_decision | session:session_e6f7ab2c-d59c-49c1-b223-4ec7477b77e4;decision:41 | 1 | 1 | current_project_session | low |
| AMB-SD-000050 | Stale cluster fallback defaults to conservative routing strategy | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:50 | 1 | 1 | current_project_session | low |
| AMB-SD-000051 | Unverified facts must be re-validated against live metadata before use | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:51 | 1 | 1 | current_project_session | low |
| AMB-SD-000052 | Fallback path emits stale cluster signal, not silent degradation | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:52 | 1 | 1 | current_project_session | low |
| AMB-SD-000053 | Fallback halts on stale cluster, emits signal for operator to resolve | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:53 | 1 | 1 | current_project_session | low |
| AMB-SD-000060 | Secondary session routing must verify metadata health snapshot before using session facts | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:60 | 1 | 1 | current_project_session | low |
| AMB-SD-000061 | Stale-memory risk must be surfaced, not silently suppressed, for older sessions | session_decision | session:session_e04a3fed-2a53-44f2-92ea-695d2e3e193e;decision:61 | 1 | 1 | current_project_session | low |
| AMB-SD-000062 | Stale facts = halt with signal, never silent degradation | session_decision | session:session_63fec26d-9e40-4981-80ce-5b7311daa01c;decision:62 | 1 | 1 | current_project_session | low |
| AMB-SD-000089 | MAINTENANCE.md contains router answer-hygiene rule; never let shadow eval affect caller answers | session_decision | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:89 | 2 | 2 | project_file_path | low |
| AMB-SD-000090 | MAINTENANCE.md is authoritative for router answer-hygiene rules; shadow eval must not affect caller answers | session_decision | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:90 | 2 | 2 | project_file_path | low |
| AMB-SD-000114 | MAINTENANCE.md is authoritative; shadow eval must not affect caller answers | session_decision | session:session_e5feff70-5233-4395-906d-0ecb13bbbb69;decision:114 | 2 | 2 | project_file_path | low |
| AMB-SD-000116 | Reject cluster names containing SQL metacharacters (; " --) at input validation boundary | session_decision | session:session_5d398351-9c4a-4670-b70c-49398e6ba477;decision:116 | 1 | 1 | current_project_session | low |
| AMB-SD-000121 | Consistent fallback routing for all parallel queries until cluster-level revalidation succeeds | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:121 | 1 | 1 | current_project_session | low |
| AMB-SD-000122 | Continue fallback routing for all remaining parallel queries until cluster revalidation | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:122 | 1 | 1 | current_project_session | low |
| AMB-SD-000123 | Maintain fallback during reprepare until successful completion | session_decision | session:session_116e5b9d-bebf-41a0-a173-2c94e094238a;decision:123 | 1 | 1 | current_project_session | low |
| AMB-SD-000167 | Phase gate model with explicit artifact bundles required per phase | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:167 | 1 | 1 | current_project_session | low |
| AMB-SD-000168 | Codex must escalate architectural conflicts, ambiguous reqs, risk crossing, and design reversals to lead | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:168 | 1 | 1 | current_project_session | low |
| AMB-SD-000175 | Phase summaries are read-only by explicit workflow contract; human replies become new issues | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:175 | 1 | 1 | current_project_session | low |
| AMB-SD-000184 | Security patches requiring human sign-off should be explicit exception in Human Touchpoint | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:184 | 1 | 1 | current_project_session | low |
| AMB-SD-000186 | Two-pass auto-classification with staging cluster for global population — not mandatory human review, not fully automatic | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:186 | 1 | 1 | current_project_session | low |
| AMB-SD-000187 | Every principle stores applicability clause and lead session rejection mechanism to prevent dogmatization | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:187 | 1 | 1 | current_project_session | low |
| AMB-SD-000191 | Two-cluster memory via existing cluster mechanism: project-architecture + engineering-principles | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:191 | 1 | 1 | current_project_session | low |
| AMB-SD-000192 | Two-pass auto-classification: project vs. transferable candidate via staging cluster, Codex self-reviews | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:192 | 1 | 1 | current_project_session | low |
| AMB-SD-000198 | All phase gates are documentation milestones — no code required for decision record acceptance | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:198 | 1 | 1 | current_project_session | low |
| AMB-SD-000202 | Non-goals sentence must be completed: 'no hidden model-memory authority without a diffable artifact' is syntactically incomplete | session_decision | session:session_11b3d81c-f9e6-4848-88f9-a44adba36b2a;decision:202 | 1 | 1 | current_project_session | low |
| AMB-DOC-0008 | Scorer/Rubric Rules (Gate 3): Gate 3 makes the Gate 2 classification explicit and auditable. It adds | spec | docs:docs/CLUSTER_CACHE_SPEC.md#scorer-rubric-rules-gate-3 | 1 | 1 | version_or_phase_marker | low |
| AMB-DOC-0018 | Decisions: - Use verified factsheet cache as source of truth. Do not use opaque Claude session state as the only source of truth. | spec | docs:docs/EXPERIMENTS.md#decisions | 1 | 1 | repo_feature_name | low |
| AMB-DOC-0019 | v2.7 Observe-Only Routing Snapshot: Verified on 2026-05-16: | spec | docs:MAINTENANCE.md#v2-7-observe-only-routing-snapshot | 1 | 1 | version_or_phase_marker | low |
| AMB-DOC-0020 | v2.6 Metadata-Rich Routing Snapshot: Verified on 2026-05-15: | spec | docs:MAINTENANCE.md#v2-6-metadata-rich-routing-snapshot | 1 | 1 | version_or_phase_marker | low |
| AMB-DOC-0026 | Cluster Factsheet Re-Prepare: Re-prepare affected cluster factsheets after any architectural PR that changes: | spec | docs:MAINTENANCE.md#cluster-factsheet-re-prepare | 1 | 1 | repo_feature_name | low |

#### Rejected Candidates

| id | source_ref | text (verbatim/skeleton) | rejection_code | reason | project_score | transferable_score |
| --- | --- | --- | --- | --- | ---: | ---: |
| DOC-0010 | docs:docs/EXPERIMENTS.md#project-architecture-candidates | Project-Architecture Candidates | rejected_duplicate | candidate text exactly duplicates an earlier candidate in this dry run | 0 | 2 |
| DOC-0011 | docs:docs/EXPERIMENTS.md#engineering-principle-candidates | Engineering-Principle Candidates | rejected_duplicate | candidate text exactly duplicates an earlier candidate in this dry run | 0 | 3 |
| DOC-0013 | docs:docs/EXPERIMENTS.md#source-inventory | Source Inventory | rejected_too_short | candidate text is shorter than 20 characters | 0 | 2 |
| DOC-0017 | docs:docs/EXPERIMENTS.md#rejected-candidates | Rejected Candidates | rejected_too_short | candidate text is shorter than 20 characters | 0 | 2 |

#### Notes

- signal_quality: medium
- duplicate_candidates: 2
- classification_confidence: {"medium":60,"high":49,"low":36}
- signal_summary: {"project":{"current_project_session":118,"project_file_path":26,"repo_feature_name":26,"version_or_phase_marker":22},"transferable":{"generic_agent_or_router_pattern":32,"generic_contract_language":16,"normative_language":37,"spec_source":27,"no_project_specific_signal":17}}
- reviewer_observations: Gate 3 is deterministic and LLM-free. Scoring is mechanical signal counting only; no extraction, semantic quality review, applies_when population, or durable memory promotion occurred.


## Decisions

- Use verified factsheet cache as source of truth. Do not use opaque Claude session state as the only source of truth.
- Treat fork as an acceleration layer over a verified factsheet baseline, not as the durable knowledge store.
- Preferred profiles:
  - `bare`: `--bare --tools ""` for complete verified factsheets and low-risk planning.
  - `focused`: `--tools ""` or explicit allowed/denied tool args when `--bare` is unavailable.
  - `agent`: full Claude Code exploration only when factsheet is missing or invalid.
- Replace human review with automated verification: explore -> distill -> verify -> cache; on failure, run focused refresh or mark cluster untrusted.

## Open Risks

- `--bare` auth compatibility may vary by machine because it bypasses OAuth/keychain reads.
- Factsheet incompleteness leads either to `NOT IN CONTEXT` or hallucination, depending on prompt strictness.
- Forked sessions can carry opaque state and must stay cluster-scoped.
- Cache invalidation must be scoped to files that support the factsheet, not the whole repository.

## Proposed Next Design

Cluster cache/fork layer:

- `clusters`: id, project id, name, tool profile, baseline session id, trust state.
- `cluster_factsheets`: cluster id, version, content, git rev, evidence hashes, created at.
- `cluster_files`: cluster id, path, hash, last verified.
- `cluster_prepare`: explore, distill, verify, and save factsheet.
- `cluster_get`: inspect cluster metadata and factsheet.
- `cluster_consult`: invoke Claude with factsheet and optionally fork from baseline.
- `cluster_refresh`: revalidate factsheet against current file hashes.
- `cluster_list`: list project clusters.

Invalidation rule:

- On consult, check hashes only for files cited by the current factsheet.
- If mismatch is found, do not silently auto-refresh. Return a refresh-required diagnostic or run a configured automated refresh policy.

The resulting draft specification is in `docs/CLUSTER_CACHE_SPEC.md`.

# Quality & Cost Comparison

After 90 invocations across 10 questions and 3 methods: cluster_consult delivered 79.0% of direct_resume's mean quality at 23.9% of its estimated per-invocation cost. The strongest quality regressions are visible in any question rows scored 0 or 1 below. Recommendation: use cluster_consult for bounded factual/config questions only when the factsheet covers the needed facts; prefer direct_resume for questions that require broad code-path discovery until Phase 7 distillation expands factsheet coverage.

## Run Metadata

- Date: 2026-05-15-rerun
- Repo cwd: /root/projects/AgentSessionRouter
- Runs per method/question: 3
- Claude version start: 2.1.92 (Claude Code)
- Claude version end: 2.1.92 (Claude Code)
- Models observed in direct Claude JSON: MiniMax-M2.7
- Pricing used for `cost_usd`: Anthropic Claude Sonnet 4.6 standard token pricing, checked 2026-05-12, https://platform.claude.com/docs/en/about-claude/pricing
- `reported_total_cost_usd` is retained separately when Claude Code reports it.

## Factsheet Prep

- cluster_id: agentsessionrouter-codebase-rerun
- trust_state: partial_llm
- verified_facts: 28
- rejected_facts: 5
- duration_ms: 89657
- tokens_in: 37
- tokens_out: 3377
- estimated cost_usd: $0.0508

Direct resume setup:

- session_id: b299724c-1497-410c-96dd-2f782477c674
- estimated cost_usd: $0.2508
- reported_total_cost_usd: $0.4180

## 1. Cost Summary

| Method | Total cost | Mean cost/question | Mean tokens_in | Mean duration | Failures |
|--------|-----------:|-------------------:|---------------:|--------------:|---------:|
| direct_fresh | $7.0753 | $0.2358 | 240662.7 | 57592.9ms | 0 |
| direct_resume | $1.9114 | $0.0637 | 134670.4 | 9923.6ms | 0 |
| cluster_consult | $0.4562 | $0.0152 | 3240.1 | 13814.0ms | 0 |

Factsheet prep cost $0.0508. cluster_consult saves $0.0485 per invocation vs direct_resume by this estimate. Breakeven at 2 cluster_consult invocations.

Claude Code reported actual `total_cost_usd` for direct CLI calls, but the MCP adapter currently does not expose it for cluster_consult. Reported totals where available:

- direct_fresh: $11.7922
- direct_resume: $3.1856
- cluster_consult: $0.0000

Quality scoring used a deterministic method-agnostic rubric over answer text and question id. Full responses and raw direct Claude streams are saved for audit.

## 2. Quality Summary

| Method | Mean quality | Quality variance | Wrong answers (0s) | Perfect (3s) |
|--------|-------------:|-----------------:|-------------------:|-------------:|
| direct_fresh | 2.50 | 0.65 | 2 | 19 |
| direct_resume | 2.70 | 0.28 | 0 | 22 |
| cluster_consult | 2.13 | 0.92 | 3 | 13 |

| Category | direct_fresh | direct_resume | cluster_consult |
|----------|-------------:|-------------:|-------------:|
| A_factual | 2.40 | 2.73 | 1.73 |
| B_reasoning | 2.78 | 3.00 | 2.56 |
| C_open | 2.33 | 2.17 | 2.50 |

Per-question scores are shown as run1/run2/run3 with the mean in parentheses:

| Question | Category | direct_fresh | direct_resume | cluster_consult | Factsheet coverage |
|----------|----------|--------------|--------------|--------------|--------------------|
| A1 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 1/1/1 (1.00) | Not covered: clusters-table-fields was rejected by verifier (llm_verifier:UNVERIFIED Evidence snippet cuts off after 'tool_profile_default' - cannot verify all claimed fields (baseline_session_id, status, trust_state, created_at, last_used) are present in CREATE TABLE statement). |
| A2 | A_factual | 3/2/2 (2.33) | 3/3/3 (3.00) | 2/2/2 (2.00) | Partially covered: current factsheet lacks cluster event facts for evidence_revalidation_failed, evidence_revalidated, cluster_fallback_to_claude_consult, cluster_fallback_failed, bare_probe_failed. |
| A3 | A_factual | 0/0/2 (0.67) | 2/2/1 (1.67) | 0/0/0 (0.00) | Partially covered: factsheet contains low-level stale behavior, but not caller-facing revalidation/fallback semantics. |
| A4 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. Bare profile args are present in verified facts. |
| A5 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 2/3/3 (2.67) | Covered. dormant_after_days default is present in verified facts. |
| B1 | B_reasoning | 3/3/3 (3.00) | 3/3/3 (3.00) | 2/3/3 (2.67) | Partially covered. The profile restriction is present, but rationale is only partially represented as derived design intent. |
| B2 | B_reasoning | 2/3/2 (2.33) | 3/3/3 (3.00) | 2/2/2 (2.00) | Partially covered. Orphan recovery facts are present, but the complete walkthrough depends on connecting several code paths. |
| B3 | B_reasoning | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. Trust-state transitions are present in verified facts. |
| C1 | C_open | 3/2/2 (2.33) | 3/2/2 (2.33) | 3/3/3 (3.00) | Partially covered. Current cluster_refresh semantics are present, but future design suggestions are not factsheet-native. |
| C2 | C_open | 2/2/3 (2.33) | 2/2/2 (2.00) | 2/2/2 (2.00) | Weakly covered. A known bare/no-tools risk is present, but broad untested failure-mode ideation is outside the factsheet. |

NOT IN CONTEXT counts:

- direct_fresh: 1 (C2r2)
- direct_resume: 0
- cluster_consult: 7 (A1r1, C2r1, A1r2, C2r2, A1r3, B2r3, C2r3)

Interpretation: NOT IN CONTEXT is audited separately from answer quality. A pure refusal indicates missing factsheet coverage; a caveat appended to a substantive answer is scored by the answer content.

## 3. Quality vs Cost Frontier

| Method | Mean quality | Mean cost | Dominated? |
|--------|-------------:|----------:|------------|
| direct_fresh | 2.50 | $0.2358 | yes |
| direct_resume | 2.70 | $0.0637 | no |
| cluster_consult | 2.13 | $0.0152 | no |

## 4. Failure Modes Observed

- A3 direct_fresh run 1: score=0; wrong or unsupported; matched 1/6
- A3 direct_fresh run 2: score=0; wrong or unsupported; matched 1/6
- A3 cluster_consult run 1: score=0; wrong or unsupported; matched 1/6
- A3 cluster_consult run 2: score=0; wrong or unsupported; matched 1/6
- A3 cluster_consult run 3: score=0; wrong or unsupported; matched 1/6

Low-score rows (score <= 1):

- A3 direct_fresh run 1: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6
- A3 direct_fresh run 2: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6
- A3 direct_resume run 3: score=1; low_quality_or_shallow; captures only part of caller-facing stale behavior; matched 3/6
- A1 cluster_consult run 1: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- A3 cluster_consult run 1: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6
- A1 cluster_consult run 2: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- A3 cluster_consult run 2: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6
- A1 cluster_consult run 3: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- A3 cluster_consult run 3: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6

Confirmed hallucination log:

- No confirmed nonexistent field/event/function hallucinations were identified by the deterministic audit. Remaining cluster_consult regressions were coverage gaps, NOT IN CONTEXT refusals/caveats, or partial reasoning-path reconstruction.

## 5. Variance Analysis

- direct_fresh A2: scores 3, 2, 2
- direct_fresh A3: scores 0, 0, 2
- direct_fresh B2: scores 2, 3, 2
- direct_fresh C1: scores 3, 2, 2
- direct_fresh C2: scores 2, 2, 3
- direct_resume A3: scores 2, 2, 1
- direct_resume C1: scores 3, 2, 2
- cluster_consult A5: scores 2, 3, 3
- cluster_consult B1: scores 2, 3, 3

## 6. Recommendations

1. cluster_consult is acceptable for question categories where the factsheet contains explicit, narrow facts and the answer can honestly say NOT IN CONTEXT for gaps.
2. Prefer direct_resume when a question requires walking code paths not explicitly captured in the factsheet, especially orphan/session behavior and open-ended design questions.
3. Any repeated NOT IN CONTEXT or low-score cluster rows are candidates for a Phase 8 factsheet-gap queue or Phase 7 distillation work.
4. Fork is unlikely to matter if cluster_consult cost is already far below direct_resume; Phase 5 should wait unless latency is the bottleneck.
5. Expand factsheet scope only after observing which low-score questions were caused by missing facts rather than weak reasoning.

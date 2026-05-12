# Quality & Cost Comparison

After 90 invocations across 10 questions and 3 methods: cluster_consult delivered 89.2% of direct_resume's mean quality at 23.3% of its estimated per-invocation cost. The strongest quality regressions are visible in any question rows scored 0 or 1 below. Recommendation: use cluster_consult for bounded factual/config questions only when the factsheet covers the needed facts; prefer direct_resume for questions that require broad code-path discovery until Phase 7 distillation expands factsheet coverage.

## Run Metadata

- Date: 2026-05-12
- Repo cwd: /root/projects/AgentSessionRouter
- Runs per method/question: 3
- Claude version start: 2.1.92 (Claude Code)
- Claude version end: 2.1.92 (Claude Code)
- Models observed in direct Claude JSON: MiniMax-M2.7
- Pricing used for `cost_usd`: Anthropic Claude Sonnet 4.6 standard token pricing, checked 2026-05-12, https://platform.claude.com/docs/en/about-claude/pricing
- `reported_total_cost_usd` is retained separately when Claude Code reports it.

## Factsheet Prep

- cluster_id: agentsessionrouter-codebase
- trust_state: llm_verified
- verified_facts: 25
- rejected_facts: 0
- duration_ms: 53753
- tokens_in: 30977
- tokens_out: 3019
- estimated cost_usd: $0.1382

Direct resume setup:

- session_id: 80e168c3-f7d3-48fb-8e86-0c3c3b4ba74a
- estimated cost_usd: $0.3379
- reported_total_cost_usd: $0.5632

## 1. Cost Summary

| Method | Total cost | Mean cost/question | Mean tokens_in | Mean duration | Failures |
|--------|-----------:|-------------------:|---------------:|--------------:|---------:|
| direct_fresh | $5.2345 | $0.1745 | 195281.2 | 19661.0ms | 0 |
| direct_resume | $2.1062 | $0.0702 | 107968.2 | 10877.6ms | 0 |
| cluster_consult | $0.4910 | $0.0164 | 3782.9 | 4732.6ms | 0 |

Factsheet prep cost $0.1382. cluster_consult saves $0.0538 per invocation vs direct_resume by this estimate. Breakeven at 3 cluster_consult invocations.

Claude Code reported actual `total_cost_usd` for direct CLI calls, but the MCP adapter currently does not expose it for cluster_consult. Reported totals where available:

- direct_fresh: $8.7242
- direct_resume: $3.5104
- cluster_consult: $0.0000

Quality scoring used a deterministic method-agnostic rubric over answer text and question id. Full responses and raw direct Claude streams are saved for audit.

## 2. Quality Summary

| Method | Mean quality | Quality variance | Wrong answers (0s) | Perfect (3s) |
|--------|-------------:|-----------------:|-------------------:|-------------:|
| direct_fresh | 2.67 | 0.36 | 0 | 22 |
| direct_resume | 2.77 | 0.18 | 0 | 23 |
| cluster_consult | 2.47 | 0.72 | 0 | 21 |

| Category | direct_fresh | direct_resume | cluster_consult |
|----------|-------------:|--------------:|----------------:|
| A_factual | 2.80 | 2.80 | 3.00 |
| B_reasoning | 2.89 | 2.89 | 2.11 |
| C_open | 2.00 | 2.50 | 1.67 |

Per-question scores are shown as run1/run2/run3 with the mean in parentheses:

| Question | Category | direct_fresh | direct_resume | cluster_consult | Factsheet coverage |
|----------|----------|--------------|---------------|-----------------|--------------------|
| A1 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. Exact schema fields are present in verified facts. |
| A2 | A_factual | 2/2/3 (2.33) | 3/2/2 (2.33) | 3/3/3 (3.00) | Covered. Cluster event sources are present in verified facts. |
| A3 | A_factual | 2/3/3 (2.67) | 3/3/2 (2.67) | 3/3/3 (3.00) | Covered. Stale cluster_consult behavior is present in verified facts. |
| A4 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. Bare profile args are present in verified facts. |
| A5 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. dormant_after_days default is present in verified facts. |
| B1 | B_reasoning | 3/3/3 (3.00) | 3/3/3 (3.00) | 1/3/1 (1.67) | Partially covered. The profile restriction is present, but rationale is only partially represented as derived design intent. |
| B2 | B_reasoning | 2/3/3 (2.67) | 2/3/3 (2.67) | 2/1/2 (1.67) | Partially covered. Orphan recovery facts are present, but the complete walkthrough depends on connecting several code paths. |
| B3 | B_reasoning | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. Trust-state transitions are present in verified facts. |
| C1 | C_open | 3/3/2 (2.67) | 3/3/3 (3.00) | 3/1/3 (2.33) | Partially covered. Current cluster_refresh semantics are present, but future design suggestions are not factsheet-native. |
| C2 | C_open | 1/1/2 (1.33) | 2/2/2 (2.00) | 1/1/1 (1.00) | Weakly covered. A known bare/no-tools risk is present, but broad untested failure-mode ideation is outside the factsheet. |

NOT IN CONTEXT counts:

- direct_fresh: 0
- direct_resume: 0
- cluster_consult: 6 (B1r1, C2r1, C1r2, C2r2, B1r3, C2r3)

Interpretation: a low score caused by an honest NOT IN CONTEXT refusal is different from a hallucination. It means the method correctly refused to answer from insufficient factsheet coverage.

## 3. Quality vs Cost Frontier

| Method | Mean quality | Mean cost | Dominated? |
|--------|-------------:|----------:|------------|
| direct_fresh | 2.67 | $0.1745 | yes |
| direct_resume | 2.77 | $0.0702 | no |
| cluster_consult | 2.47 | $0.0164 | no |

## 4. Failure Modes Observed

- No invocation failures or score-0 answers.

Low-score rows (score <= 1):

- C2 direct_fresh run 1: score=1; low_quality_or_shallow; partly relevant but shallow
- C2 direct_fresh run 2: score=1; low_quality_or_shallow; partly relevant but shallow
- B1 cluster_consult run 1: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- C2 cluster_consult run 1: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- B2 cluster_consult run 2: score=1; low_quality_or_shallow; partial orphan recovery path; matched 3/6
- C1 cluster_consult run 2: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- C2 cluster_consult run 2: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- B1 cluster_consult run 3: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- C2 cluster_consult run 3: score=1; honest_refusal; honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact

Confirmed hallucination log:

- No confirmed nonexistent field/event/function hallucinations were identified by the deterministic audit. The main cluster_consult regressions were honest NOT IN CONTEXT refusals or partial reasoning-path reconstruction.

## 5. Variance Analysis

- direct_fresh A2: scores 2, 2, 3
- direct_fresh A3: scores 2, 3, 3
- direct_fresh B2: scores 2, 3, 3
- direct_fresh C1: scores 3, 3, 2
- direct_fresh C2: scores 1, 1, 2
- direct_resume A2: scores 3, 2, 2
- direct_resume A3: scores 3, 3, 2
- direct_resume B2: scores 2, 3, 3
- cluster_consult B1: scores 1, 3, 1
- cluster_consult B2: scores 2, 1, 2
- cluster_consult C1: scores 3, 1, 3

## 6. Recommendations

1. cluster_consult is acceptable for question categories where the factsheet contains explicit, narrow facts and the answer can honestly say NOT IN CONTEXT for gaps.
2. Prefer direct_resume when a question requires walking code paths not explicitly captured in the factsheet, especially orphan/session behavior and open-ended design questions.
3. Any repeated NOT IN CONTEXT or low-score cluster rows are candidates for a Phase 8 factsheet-gap queue or Phase 7 distillation work.
4. Fork is unlikely to matter if cluster_consult cost is already far below direct_resume; Phase 5 should wait unless latency is the bottleneck.
5. Expand factsheet scope only after observing which low-score questions were caused by missing facts rather than weak reasoning.

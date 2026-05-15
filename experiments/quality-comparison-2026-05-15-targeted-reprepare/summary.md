# Quality & Cost Comparison

After 20 invocations across 5 questions and 2 methods: cluster_consult delivered 100.0% of direct_resume's mean quality at 25.9% of its estimated per-invocation cost. The strongest quality regressions are visible in any question rows scored 0 or 1 below. Recommendation: use cluster_consult for bounded factual/config questions only when the factsheet covers the needed facts; prefer direct_resume for questions that require broad code-path discovery until Phase 7 distillation expands factsheet coverage.

## Run Metadata

- Date: 2026-05-15-targeted-reprepare
- Repo cwd: /root/projects/AgentSessionRouter
- Runs per method/question: 2
- Claude version start: 2.1.92 (Claude Code)
- Claude version end: 2.1.92 (Claude Code)
- Models observed in direct Claude JSON: MiniMax-M2.7
- Pricing used for `cost_usd`: Anthropic Claude Sonnet 4.6 standard token pricing, checked 2026-05-12, https://platform.claude.com/docs/en/about-claude/pricing
- `reported_total_cost_usd` is retained separately when Claude Code reports it.

## Factsheet Prep

- cluster_id: agentsessionrouter-codebase-reprepared-2026-05-15-targeted
- trust_state: partial_llm
- verified_facts: 22
- rejected_facts: 3
- duration_ms: 125459
- tokens_in: 8961
- tokens_out: 2495
- estimated cost_usd: $0.0643

Direct resume setup:

- session_id: 0a98a6ed-25c1-48bd-9e45-4b46fc252c99
- estimated cost_usd: $0.2104
- reported_total_cost_usd: $0.8466

## 1. Cost Summary

| Method | Total cost | Mean cost/question | Mean tokens_in | Mean duration | Failures |
|--------|-----------:|-------------------:|---------------:|--------------:|---------:|
| direct_resume | $0.7090 | $0.0709 | 133329.5 | 17389.8ms | 0 |
| cluster_consult | $0.1840 | $0.0184 | 4211.3 | 12814.9ms | 0 |

Factsheet prep cost $0.0643. cluster_consult saves $0.0525 per invocation vs direct_resume by this estimate. Breakeven at 2 cluster_consult invocations.

Claude Code reported actual `total_cost_usd` for direct CLI calls, but the MCP adapter currently does not expose it for cluster_consult. Reported totals where available:

- direct_resume: $1.1817
- cluster_consult: $0.0000

Quality scoring used a deterministic method-agnostic rubric over answer text and question id. Full responses and raw direct Claude streams are saved for audit.

## 2. Quality Summary

| Method | Mean quality | Quality variance | Wrong answers (0s) | Perfect (3s) |
|--------|-------------:|-----------------:|-------------------:|-------------:|
| direct_resume | 2.20 | 0.96 | 0 | 6 |
| cluster_consult | 2.20 | 0.56 | 0 | 4 |

| Category | direct_resume | cluster_consult |
|----------|-------------:|-------------:|
| A_factual | 2.00 | 2.25 |
| B_reasoning | 3.00 | 2.00 |

Per-question scores are shown as run1/run2/run3 with the mean in parentheses:

| Question | Category | direct_resume | cluster_consult | Factsheet coverage |
|----------|----------|--------------|--------------|--------------------|
| A1 | A_factual | 3/3 (3.00) | 3/3 (3.00) | Covered only if `clusters-table-fields` survives verifier; otherwise this is an explicit factsheet gap. |
| A2 | A_factual | 1/1 (1.00) | 2/2 (2.00) | Partially covered unless fallback/revalidation/bare-probe cluster event facts are present. |
| A3 | A_factual | 1/1 (1.00) | 1/1 (1.00) | Covered only if caller-facing stale behavior through `consultClusterForCaller` is present, not just low-level `consultCluster` internals. |
| A5 | A_factual | 3/3 (3.00) | 3/3 (3.00) | Covered. dormant_after_days default is present in verified facts. |
| B2 | B_reasoning | 3/3 (3.00) | 2/2 (2.00) | Partially covered. Orphan recovery facts are present, but the complete walkthrough depends on connecting several code paths. |

NOT IN CONTEXT counts:

- direct_resume: 0
- cluster_consult: 0

Interpretation: NOT IN CONTEXT is audited separately from answer quality. A pure refusal indicates missing factsheet coverage; a caveat appended to a substantive answer is scored by the answer content.

## 3. Quality vs Cost Frontier

| Method | Mean quality | Mean cost | Dominated? |
|--------|-------------:|----------:|------------|
| direct_resume | 2.20 | $0.0709 | yes |
| cluster_consult | 2.20 | $0.0184 | no |

## 4. Failure Modes Observed

- No invocation failures or score-0 answers.

Low-score rows (score <= 1):

- A2 direct_resume run 1: score=1; low_quality_or_shallow; missing some cluster event types; matched 10/19
- A3 direct_resume run 1: score=1; low_quality_or_shallow; captures only part of caller-facing stale behavior; matched 3/6
- A2 direct_resume run 2: score=1; low_quality_or_shallow; missing some cluster event types; matched 10/19
- A3 direct_resume run 2: score=1; low_quality_or_shallow; captures only part of caller-facing stale behavior; matched 3/6
- A3 cluster_consult run 1: score=1; low_quality_or_shallow; captures only part of caller-facing stale behavior; matched 3/6
- A3 cluster_consult run 2: score=1; low_quality_or_shallow; captures only part of caller-facing stale behavior; matched 3/6

Confirmed hallucination log:

- No confirmed nonexistent field/event/function hallucinations were identified by the deterministic audit. Remaining cluster_consult regressions were coverage gaps, NOT IN CONTEXT refusals/caveats, or partial reasoning-path reconstruction.

## 5. Variance Analysis

- No within-method score variance observed.

## 6. Recommendations

1. cluster_consult is acceptable for question categories where the factsheet contains explicit, narrow facts and the answer can honestly say NOT IN CONTEXT for gaps.
2. Prefer direct_resume when a question requires walking code paths not explicitly captured in the factsheet, especially orphan/session behavior and open-ended design questions.
3. Any repeated NOT IN CONTEXT or low-score cluster rows are candidates for a Phase 8 factsheet-gap queue or Phase 7 distillation work.
4. Fork is unlikely to matter if cluster_consult cost is already far below direct_resume; Phase 5 should wait unless latency is the bottleneck.
5. Expand factsheet scope only after observing which low-score questions were caused by missing facts rather than weak reasoning.

# Quality & Cost Comparison

After 1 invocations across 1 questions and 1 method(s): cluster_consult completed with the quality and cost results below. This targeted run is meant to validate factsheet coverage changes, not replace the full 90-invocation comparison.

## Run Metadata

- Date: 2026-05-15-router-reprepare
- Repo cwd: /root/projects/AgentSessionRouter
- Runs per method/question: 1
- Claude version start: 2.1.92 (Claude Code)
- Claude version end: 2.1.92 (Claude Code)
- Models observed in direct Claude JSON: MiniMax-M2.7
- Pricing used for `cost_usd`: Anthropic Claude Sonnet 4.6 standard token pricing, checked 2026-05-12, https://platform.claude.com/docs/en/about-claude/pricing
- `reported_total_cost_usd` is retained separately when Claude Code reports it.

## Factsheet Prep

- cluster_id: agentsessionrouter-codebase
- trust_state: partial_llm
- verified_facts: 48
- rejected_facts: 1
- duration_ms: 72827
- tokens_in: 34642
- tokens_out: 4903
- estimated cost_usd: $0.2958

Direct resume setup:

- not run in this targeted method set

## 1. Cost Summary

| Method | Total cost | Mean cost/question | Mean tokens_in | Mean duration | Failures |
|--------|-----------:|-------------------:|---------------:|--------------:|---------:|
| cluster_consult | $0.1163 | $0.1163 | 16729.0 | 10068.0ms | 0 |

Factsheet prep cost $0.2958. Breakeven requires a comparison method and is not computed for this targeted method set.

Claude Code reported actual `total_cost_usd` where the adapter exposed it. `cluster_consult` now forwards that value through MCP metrics when Claude Code provides it. Reported totals where available:

- cluster_consult: $0.1163

Quality scoring used a deterministic method-agnostic rubric over answer text and question id. Full responses and raw direct Claude streams are saved for audit.

## 2. Quality Summary

| Method | Mean quality | Quality variance | Wrong answers (0s) | Perfect (3s) |
|--------|-------------:|-----------------:|-------------------:|-------------:|
| cluster_consult | 3.00 | 0.00 | 0 | 1 |

| Category | cluster_consult |
|----------|-------------:|
| A_factual | 3.00 |

Per-question scores are shown as run1/run2/run3 with the mean in parentheses:

| Question | Category | cluster_consult | Factsheet coverage |
|----------|----------|--------------|--------------------|
| A3 | A_factual | 3 (3.00) | Covered only if caller-facing stale behavior through `consultClusterForCaller` is present, not just low-level `consultCluster` internals. |

NOT IN CONTEXT counts:

- cluster_consult: 0

Interpretation: NOT IN CONTEXT is audited separately from answer quality. A pure refusal indicates missing factsheet coverage; a caveat appended to a substantive answer is scored by the answer content.

## 3. Quality vs Cost Frontier

| Method | Mean quality | Mean cost | Dominated? |
|--------|-------------:|----------:|------------|
| cluster_consult | 3.00 | $0.1163 | no |

## 4. Failure Modes Observed

- No invocation failures or score-0 answers.

Low-score rows (score <= 1):

- None.

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

# Quality & Cost Comparison

After 90 invocations across 10 questions and 3 methods: cluster_consult delivered 109.2% of direct_resume's mean quality at 41.0% of its estimated per-invocation cost. The strongest quality regressions are visible in any question rows scored 0 or 1 below. Recommendation: use cluster_consult for bounded factual/config questions only when the factsheet covers the needed facts; prefer direct_resume for questions that require broad code-path discovery until Phase 7 distillation expands factsheet coverage.

## Run Metadata

- Date: 2026-05-15-full-reprepare
- Repo cwd: /root/projects/AgentSessionRouter
- Runs per method/question: 3
- Claude version start: 2.1.92 (Claude Code)
- Claude version end: 2.1.92 (Claude Code)
- Models observed in direct Claude JSON: MiniMax-M2.7
- Pricing used for `cost_usd`: Anthropic Claude Sonnet 4.6 standard token pricing, checked 2026-05-12, https://platform.claude.com/docs/en/about-claude/pricing
- `reported_total_cost_usd` is retained separately when Claude Code reports it.

## Factsheet Prep

- cluster_id: agentsessionrouter-codebase-reprepared-2026-05-15-full
- trust_state: partial_llm
- verified_facts: 45
- rejected_facts: 1
- duration_ms: 72541
- tokens_in: 0
- tokens_out: 3655
- estimated cost_usd: $0.0548

Direct resume setup:

- session_id: 1bc568d1-5a5f-4314-b4be-00aca006f5e1
- estimated cost_usd: $0.2780
- reported_total_cost_usd: $0.4633

## 1. Cost Summary

| Method | Total cost | Mean cost/question | Mean tokens_in | Mean duration | Failures |
|--------|-----------:|-------------------:|---------------:|--------------:|---------:|
| direct_fresh | $7.0378 | $0.2346 | 222895.5 | 55007.3ms | 0 |
| direct_resume | $2.6763 | $0.0892 | 168947.8 | 37767.8ms | 1 |
| cluster_consult | $1.0964 | $0.0365 | 10227.0 | 14134.6ms | 0 |

Factsheet prep cost $0.0548. cluster_consult saves $0.0527 per invocation vs direct_resume by this estimate. Breakeven at 2 cluster_consult invocations.

Claude Code reported actual `total_cost_usd` for direct CLI calls, but the MCP adapter currently does not expose it for cluster_consult. Reported totals where available:

- direct_fresh: $11.7296
- direct_resume: $4.4604
- cluster_consult: $0.0000

Quality scoring used a deterministic method-agnostic rubric over answer text and question id. Full responses and raw direct Claude streams are saved for audit.

## 2. Quality Summary

| Method | Mean quality | Quality variance | Wrong answers (0s) | Perfect (3s) |
|--------|-------------:|-----------------:|-------------------:|-------------:|
| direct_fresh | 2.43 | 0.85 | 3 | 19 |
| direct_resume | 2.53 | 0.45 | 1 | 18 |
| cluster_consult | 2.77 | 0.25 | 0 | 24 |

| Category | direct_fresh | direct_resume | cluster_consult |
|----------|-------------:|-------------:|-------------:|
| A_factual | 2.40 | 2.60 | 2.87 |
| B_reasoning | 2.78 | 3.00 | 2.67 |
| C_open | 2.00 | 1.67 | 2.67 |

Per-question scores are shown as run1/run2/run3 with the mean in parentheses:

| Question | Category | direct_fresh | direct_resume | cluster_consult | Factsheet coverage |
|----------|----------|--------------|--------------|--------------|--------------------|
| A1 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered only if `clusters-table-fields` survives verifier; otherwise this is an explicit factsheet gap. |
| A2 | A_factual | 3/3/3 (3.00) | 2/2/2 (2.00) | 3/3/3 (3.00) | Partially covered unless fallback/revalidation/bare-probe cluster event facts are present. |
| A3 | A_factual | 0/0/0 (0.00) | 2/2/2 (2.00) | 3/1/3 (2.33) | Covered only if caller-facing stale behavior through `consultClusterForCaller` is present, not just low-level `consultCluster` internals. |
| A4 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. Bare profile args are present in verified facts. |
| A5 | A_factual | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. dormant_after_days default is present in verified facts. |
| B1 | B_reasoning | 2/3/3 (2.67) | 3/3/3 (3.00) | 3/2/2 (2.33) | Expanded. Verifier restriction plus the no-tools/no-inference rationale are present in verified facts. |
| B2 | B_reasoning | 3/3/2 (2.67) | 3/3/3 (3.00) | 2/3/3 (2.67) | Expanded. Explicit, exact-topic, and auto-routed orphan recovery paths plus was_orphan_recovery are present in verified facts. |
| B3 | B_reasoning | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) | Covered. Trust-state transitions are present in verified facts. |
| C1 | C_open | 2/2/2 (2.00) | 2/2/2 (2.00) | 3/3/3 (3.00) | Expanded. Current refresh semantics plus spec-backed future modes and policy options are present in verified facts. |
| C2 | C_open | 2/2/2 (2.00) | 2/0/2 (1.33) | 3/2/2 (2.33) | Weakly covered. A known bare/no-tools risk is present, but broad untested failure-mode ideation is outside the factsheet. |

NOT IN CONTEXT counts:

- direct_fresh: 0
- direct_resume: 0
- cluster_consult: 3 (B2r1, C2r1, C2r2)

Interpretation: NOT IN CONTEXT is audited separately from answer quality. A pure refusal indicates missing factsheet coverage; a caveat appended to a substantive answer is scored by the answer content.

## 3. Quality vs Cost Frontier

| Method | Mean quality | Mean cost | Dominated? |
|--------|-------------:|----------:|------------|
| direct_fresh | 2.43 | $0.2346 | yes |
| direct_resume | 2.53 | $0.0892 | yes |
| cluster_consult | 2.77 | $0.0365 | no |

## 4. Failure Modes Observed

- A3 direct_fresh run 1: score=0; wrong or unsupported; matched 1/6
- A3 direct_fresh run 2: score=0; wrong or unsupported; matched 1/6
- A3 direct_fresh run 3: score=0; wrong or unsupported; matched 1/6
- C2 direct_resume run 2: score=0; claude exited 1: {"type":"system","subtype":"hook_started","hook_id":"733fb53a-ea15-4d3f-9f66-13fcc08b7d67","hook_name":"SessionStart:resume","hook_event":"SessionStart","uuid":"ba75c035-0f53-41de-8397-b29e0c6480c3","session_id":"f146380d-cb96-4de0-b997-bce707...

Low-score rows (score <= 1):

- A3 direct_fresh run 1: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6
- A3 direct_fresh run 2: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6
- A3 direct_fresh run 3: score=0; low_quality_or_shallow; wrong or unsupported; matched 1/6
- C2 direct_resume run 2: score=0; low_quality_or_shallow; Invocation failed: claude exited 1: {"type":"system","subtype":"hook_started","hook_id":"733fb53a-ea15-4d3f-9f66-13fcc08b7d67","hook_name":"SessionStart:resume","hook_event":"SessionStart","uuid":"ba
- A3 cluster_consult run 2: score=1; low_quality_or_shallow; captures only part of caller-facing stale behavior; matched 3/6

Confirmed hallucination log:

- No confirmed nonexistent field/event/function hallucinations were identified by the deterministic audit. Remaining cluster_consult regressions were coverage gaps, NOT IN CONTEXT refusals/caveats, or partial reasoning-path reconstruction.

## 5. Variance Analysis

- direct_fresh B1: scores 2, 3, 3
- direct_fresh B2: scores 3, 3, 2
- direct_resume C2: scores 2, 0, 2
- cluster_consult A3: scores 3, 1, 3
- cluster_consult B1: scores 3, 2, 2
- cluster_consult B2: scores 2, 3, 3
- cluster_consult C2: scores 3, 2, 2

## 6. Recommendations

1. cluster_consult is acceptable for question categories where the factsheet contains explicit, narrow facts and the answer can honestly say NOT IN CONTEXT for gaps.
2. Prefer direct_resume when a question requires walking code paths not explicitly captured in the factsheet, especially orphan/session behavior and open-ended design questions.
3. Any repeated NOT IN CONTEXT or low-score cluster rows are candidates for a Phase 8 factsheet-gap queue or Phase 7 distillation work.
4. Fork is unlikely to matter if cluster_consult cost is already far below direct_resume; Phase 5 should wait unless latency is the bottleneck.
5. Expand factsheet scope only after observing which low-score questions were caused by missing facts rather than weak reasoning.

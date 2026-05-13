# v2.0 Release Notes

Release date: 2026-05-13

Tag: `v2.0`

Repository: `wertorok/AgentSessionRouter`

## Summary

`v2.0` marks the measured cluster-cache milestone for AgentSessionRouter.

This release contains two independently useful layers:

- `v1` session router: durable, project-scoped Claude session routing with SQLite registry memory.
- `v2` cluster cache: verified factsheets per cluster, restricted Claude tool profiles, LLM verification, and stale factsheet refusal.

The release is production-ready for covered cluster domains. It is not a claim that every open-ended or cross-domain question should go through `cluster_consult`. Questions outside factsheet coverage should use `claude_consult` with an established session or fresh exploration.

## Measured Results

Full benchmark artifact:

- `experiments/quality-comparison-2026-05-12/`

Benchmark shape:

- 10 AgentSessionRouter questions
- 3 methods: `direct_fresh`, `direct_resume`, `cluster_consult`
- 3 runs per question/method
- 90 total invocations
- 0 invocation failures
- Claude Code version: `2.1.92`
- Factsheet prep: `llm_verified`, 25 verified facts, 0 rejected facts

Summary:

| Method | Mean quality | Mean estimated cost | Mean duration |
|--------|--------------|---------------------|---------------|
| `direct_fresh` | 2.67 | $0.1745 | 19.7s |
| `direct_resume` | 2.77 | $0.0702 | 10.9s |
| `cluster_consult` | 2.73 | $0.0164 | 4.7s |

Key result:

- `cluster_consult` delivered `98.8%` of `direct_resume` mean quality at `23.3%` of estimated per-invocation cost.
- On factual lookup questions, `cluster_consult` scored `3.00` vs `2.80` for `direct_resume`.
- `direct_fresh` was dominated by `direct_resume`: lower quality and higher cost.

Cost note: exact costs depend on Claude account, model, CLI version, and prompt shape. The benchmark uses the pricing documented in `experiments/quality-comparison-2026-05-12/pricing.json`.

## Targeted Factsheet Expansion

Targeted artifact:

- `experiments/factsheet-expansion-2026-05-13/`

After the full benchmark, the factsheet was expanded with:

- verifier rationale for B1
- complete orphan-recovery paths for B2
- spec-backed `cluster_refresh` extension options for C1

Targeted run:

- 3 questions: B1, B2, C1
- 1 method: `cluster_consult`
- 3 runs per question
- 9 total invocations
- 0 invocation failures
- Factsheet prep: `llm_verified`, 33 verified facts, 0 rejected facts

Summary:

| Method | Mean quality | Mean estimated cost | Mean duration |
|--------|--------------|---------------------|---------------|
| `cluster_consult` | 2.89 | $0.0240 | 7.2s |

Before vs after expansion:

| Question | Before expansion | After expansion | Result |
|----------|------------------|-----------------|--------|
| B1 verifier rationale | 2/3/3 (2.67) | 3/2/3 (2.67) | Still minor prompt variance |
| B2 orphan recovery path | 2/1/2 (1.67) | 3/3/3 (3.00) | Code-path gap closed |
| C1 refresh improvements | 3/2/3 (2.67) | 3/3/3 (3.00) | Stabilized |

Finding: adding missing verified facts can convert unstable or partial cluster answers into stable perfect answers.

## Safety Findings

Confirmed by deterministic audit over benchmark responses:

- 0 invocation failures in the 90-run benchmark
- 0 score-zero answers in the 90-run benchmark
- 0 confirmed hallucinated nonexistent field/event/function names in the audited response set

Important scope note: this does not prove that all possible hallucinations are impossible. It means the measured benchmark did not find confirmed hallucinations of the audited field/event/function class.

`NOT IN CONTEXT` is tracked as an audit signal, not automatically as a wrong answer:

- A pure refusal means the factsheet did not cover the question.
- A substantive answer with a `NOT IN CONTEXT` caveat is scored by the answer content.

## What Is Included

Implemented v1 tools:

- `claude_sessions_list`
- `claude_session_inspect`
- `claude_consult`
- `claude_session_archive`
- `claude_router_reset`

Implemented v2 tools:

- `cluster_prepare`
- `cluster_get`
- `cluster_consult`
- `cluster_refresh`
- `cluster_list`

Implemented v2 behavior:

- static factsheet verification
- LLM verifier loop
- `bare`, `focused`, and `agent` tool profile definitions
- profile probing and deterministic `bare -> focused` downgrade
- no silent escalation from no-tools profiles to `agent`
- non-fork `cluster_consult`
- `verify_only` cluster refresh
- stale factsheet refusal through `CLUSTER_FACTSHEET_STALE`
- benchmark harness with full and targeted modes

## Method Selection

Use `cluster_consult` when:

- the question is factual
- the needed facts are in a verified cluster factsheet
- speed and bounded cost matter
- `NOT IN CONTEXT` is acceptable when the factsheet lacks a fact

Use `claude_consult` with an established session when:

- the question needs reasoning across code paths
- the question is open-ended
- the answer needs tradeoffs or future design discussion
- the decision is architecturally critical

Use fresh Claude exploration when:

- no relevant session or cluster exists
- the subsystem is new
- the question crosses multiple domains and needs discovery first

## Known Non-Goals And Limitations

- Fork baselines are not implemented in this release.
- Distillation from v1 sessions into factsheets is not implemented yet.
- Auto-routing from a user question to a cluster is not implemented yet.
- `cluster_consult` is production-ready for covered cluster domains, not for arbitrary project discovery.
- `--bare` auth compatibility may vary by machine.
- Factsheet quality depends on evidence coverage and verifier behavior.

## Recommended Next Work

Priority order after `v2.0`:

1. Phase 7: distill factsheets from existing v1 sessions.
2. Prompt wording stability for B1-style minor variance.
3. Optional reasoning-factsheet layer for derived rationale facts.
4. Defer Phase 5 fork until latency or cost becomes the bottleneck.

## Validation

Before tagging:

- `git diff --check`
- `node --check scripts/quality-comparison.mjs`
- `npm run build`
- `npm test` - 50 tests passed
- `npm run smoke:postinstall`

Release commit:

- `fe92606 test(cluster): validate factsheet expansion`

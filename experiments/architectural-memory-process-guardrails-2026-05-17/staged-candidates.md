# Gate 13 Follow-Up: Process Guardrail Promotion Candidates

Generated: 2026-05-17

Purpose: promote two documented process guardrails into active transferable engineering-principle records. This follows the Gate 12.5 path: staged candidate, lead-session review, explicit promotion, then targeted seed selection verification.

Runtime serving is already enabled. This phase does not change serving code or toggles; it only changes the active source-of-truth corpus if lead review approves the candidates.

## Candidates

| id | proposed_classification | statement | applies_when | revisit_when | counter_evidence | provenance |
| --- | --- | --- | --- | --- | --- | --- |
| AMB-RESCUE-0006 | engineering-principles | Single successful runs do not prove behavior that can vary; quality, latency, routing, scorer, and benchmark claims require a baseline plus repeated runs before promotion. | Apply when using tests, benchmarks, evaluations, or monitor observations to approve quality, latency, routing decisions, scorer behavior, model answers, or any behavior affected by stochastic, external, concurrency, timing, or context variance. | When the behavior is deterministic by construction and covered exhaustively.; When the change is a pure documentation edit.; When the cost of repetition exceeds the risk and the claim is explicitly downgraded to a smoke check. | If a change is provably deterministic and has exhaustive coverage, one confirming run may be sufficient; never use a single run as proof for quality, latency, routing behavior, model behavior, or any path with known variance. | operator-review:AgentSessionRouter-v2.x; docs:docs/CLUSTER_CACHE_SPEC.md#structural-risk-constraint-do-not-recreate-v2-discovery-failure; docs:docs/EXPERIMENTS.md#gate-13-post-serving-targeted-continuity |
| AMB-RESCUE-0007 | engineering-principles | Extract is not improve: behavior-preserving refactors must be separated from logic changes, and any behavior change needs its own proof after the mechanical move. | Apply when splitting files, extracting modules, moving code, renaming internals, or performing any refactor described as behavior-preserving. | When the current behavior is wrong, unsafe, or impossible to preserve.; When a required behavior fix is intentionally scoped as a separate change immediately after extraction.; When tests reveal the extraction was not mechanical. | If the existing behavior is a confirmed bug or security risk, do not preserve it blindly; label the change as behavioral, isolate it from mechanical extraction where practical, and prove it with targeted regression/adversarial checks. | operator-review:AgentSessionRouter-v2.x; docs:MAINTENANCE.md#deferred-technical-debt; docs:MAINTENANCE.md#post-refactor-proof-2026-05-16 |

## Lead Review Request

Review each candidate for:

- transferability beyond AgentSessionRouter
- operational sharpness, not a vague truism
- non-empty and meaningful counter-evidence
- suitability for runtime serving after active promotion

Return APPROVED only if the candidate is transferable and safe to serve as bounded guidance.

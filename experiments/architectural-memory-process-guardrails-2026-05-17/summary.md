# Gate 13 Process Guardrail Promotion

Generated: 2026-05-17

## Result

Two process guardrails that were documented but not runtime-seedable have been promoted into the active engineering-principles corpus:

| Record | Statement | Lead review |
| --- | --- | --- |
| `AMB-RESCUE-0006` | Single successful runs do not prove behavior that can vary; quality, latency, routing, scorer, and benchmark claims require a baseline plus repeated runs before promotion. | APPROVED |
| `AMB-RESCUE-0007` | A refactor label must not smuggle semantic change: if code movement, extraction, or renaming changes behavior, treat that behavior change as a separate claim and prove it separately. | first wording REJECTED, revision 2 APPROVED |

Runtime serving toggle and serving code were not changed.

## Lead Review

- First review artifact: `lead-review.json`
- Revision-2 artifact: `lead-review-revision-2.json`

The lead session approved `AMB-RESCUE-0006` immediately. It rejected the first `AMB-RESCUE-0007` wording as too close to AgentSessionRouter-specific refactoring governance. Revision 2 generalized the transferable core to "do not smuggle semantic behavior change under a refactor/mechanical label"; the lead session then approved it as `engineering-principles`.

## Seed Selection Verification

Artifact: `seed-selection-verification.json`

| Case | Expected record | Selected | Seed tokens |
| --- | --- | ---: | ---: |
| `single-run-insufficient-selection` | `AMB-RESCUE-0006` | true | 927 |
| `extract-not-improve-selection` | `AMB-RESCUE-0007` | true | 894 |

Both verification calls created new lead sessions through `router_consult`. The seed prefilter selected the expected promoted record for relevant benchmark/refactor topics, under the 1,200 token cap and without per-consult retrieval.

## Remaining Gap

`process-guardrail-gap-analysis.md` lists MAINTENANCE.md disciplines that are still docs-only and will not be seeded unless they go through the same staged candidate + lead review + targeted verification path.

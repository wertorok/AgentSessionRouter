# Gate 13 Process Guardrail Seed Selection Verification

Generated: 2026-05-17T07:25:08.390Z

All expected selected: true

| case | selected expected | seed tokens | seed records |
| --- | ---: | ---: | --- |
| single-run-insufficient-selection | true | 927 | AMB-RESCUE-0006, AMB-DOC-0008, PA-SD-000181, PA-SD-000199, PA-SD-000208, AMB-RESCUE-0003, AMB-SD-000041, AMB-SD-000050 |
| extract-not-improve-selection | true | 894 | AMB-RESCUE-0007, AMB-DOC-0008, AMB-RESCUE-0004, AMB-RESCUE-0006, PA-SD-000199, PA-SD-000200, PA-SD-000209 |

## Answer Previews

### single-run-insufficient-selection

**No.** Per AMB-RESCUE-0006, single successful runs do not prove behavior that can vary. Quality, latency, routing, scorer, and benchmark claims require a baseline plus repeated runs before promotion.

The counter-exception (provably deterministic + exhaustive coverage) almost never applies to benchmark, scorer, or routing behavior — those are inherently subject to variance. Treat one passing run as a signal to investigate further, not as proof suitable for promotion.

### extract-not-improve-selection

**Direct answer:** Separate it. AMB-RESCUE-0007 is explicit — a refactor label must not smuggle semantic change. If code movement, extraction, or renaming changes behavior, treat that behavior change as a separate claim and prove it separately. The counter-field on AMB-RESCUE-0007 does not protect you here: it only says "don't preserve it blindly if the existing behavior is wrong or unsafe" — that means you acknowledge the wrongness explicitly and label it as a behavior change, not that you absorb it into a refactor PR.

Practical rule from the seeded record: mechanical-only PRs get mechanical-only review. Any logic modification, even if framed as "also while we're in there," is a second cla

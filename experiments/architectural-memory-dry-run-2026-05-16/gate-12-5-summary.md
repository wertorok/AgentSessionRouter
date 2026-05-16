# Phase 7 Gate 12.5 Summary: Classification Correction

Gate 12.5 corrected the active architectural-memory classification after
inspection found that the deterministic distill classifier judged wording and
artifact specificity more than semantic transferability.

## Problems Found

1. Fundamental transferable principles were rejected because they referenced
   AgentSessionRouter-specific artifacts.
2. Some active engineering-principle records were actually project-specific
   AgentSessionRouter operational rules.
3. Active engineering-principle records lacked explicit `counter_evidence`
   fields. That is acceptable for docs-active records, but not for any future
   runtime serving path.

## Lead Approval

The durable Claude lead session approved the Gate 12.5 scope and separately
approved the exact reclassification plan before execution.
Post-implementation compact review also returned `APPROVE_SCOPE` and closed
Gate 12.5.

## Result

| Metric | Count |
| --- | ---: |
| Engineering principles before | 13 |
| Engineering principles after | 13 |
| Project architecture before | 75 |
| Project architecture after | 80 |
| Moved from engineering-principles to project-architecture | 5 |
| Rescued from rejected audit into engineering-principles | 5 |
| Active records after correction | 93 |

## Moved To Project Architecture

- `AMB-SD-000007`: exact `shadow:${projectId}` lock namespace rule.
- `AMB-SD-000116`: exact cluster-name SQL metacharacter validation rule.
- `AMB-SD-000121`: AgentSessionRouter parallel fallback until cluster-level
  revalidation.
- `AMB-SD-000122`: duplicate/variant fallback during cluster revalidation.
- `AMB-SD-000123`: fallback during `cluster_reprepare` implementation
  mechanic.

## Rescued Engineering Principles

- `AMB-RESCUE-0001`: evaluation/telemetry must not affect caller-facing
  answers.
- `AMB-RESCUE-0002`: stale/untrusted evidence must signal and fall back, not be
  used silently.
- `AMB-RESCUE-0003`: verified evidence artifacts should be the operational
  source of truth over opaque model/session state.
- `AMB-RESCUE-0004`: runtime-served principles need applicability and
  counter-evidence paths to avoid dogmatization.
- `AMB-RESCUE-0005`: durable architectural memory must have diffable
  provenance.

## Counter-Evidence

All active engineering-principle records now include a non-empty
`counter_evidence` field.

## Known Limitation

This gate is a manual correction. It does not fix the deterministic distill
classifier. Future distill runs can repeat the same error until classifier
semantics are redesigned to judge transferability by meaning rather than wording
and artifact specificity.

## Scope Preserved

- Runtime import/serving: false.
- Cluster writes: false.
- Router answer behavior changes: false.
- Classifier algorithm changes: false.

Gate 13 remains future work and still requires a separate decision before any
runtime import/serving.

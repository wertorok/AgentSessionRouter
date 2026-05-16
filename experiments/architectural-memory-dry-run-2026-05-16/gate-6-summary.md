# Phase 7 Gate 6 Summary: Static Verifier

Status: closed as a verifier/report artifact. No promotion occurred.

Gate 6 defines and exercises the minimum static verification layer needed before
any architectural-memory candidate can become authoritative.

## Artifacts

- Spec: `docs/CLUSTER_CACHE_SPEC.md`
- Verifier script: `scripts/architectural-memory-verifier.mjs`
- Report JSON: `verification-report.json`
- Report Markdown: `verification-report.md`

## Result

The verifier checked 116 candidates from `factsheet-dry-run.json`.

| metric | count |
| --- | ---: |
| candidates checked | 116 |
| statically verified | 93 |
| failed verification | 23 |
| promotion eligible | 0 |

Failed checks:

| check | count | meaning |
| --- | ---: | --- |
| `not_rejected_or_suspended` | 23 | Gate 4 intentionally rejected or suspended these candidates. |

No candidate is promotion-eligible yet. This is expected: Gate 5 artifacts
preserve candidate text and provenance, but do not populate the durable fields
required for active memory:

- `applies_when`
- `revisit_when`
- `rationale`
- `project_scope`
- explicit promotion approval

## Invariants Preserved

- The verifier opens SQLite read-only.
- The verifier reads docs/experiment files only.
- The verifier does not call an LLM.
- The verifier does not write clusters.
- The verifier does not promote any candidate.
- The verifier writes only `verification-report.json` and
  `verification-report.md` under the experiment directory.

## Verification

- `npm run build` passed with `--noUnusedLocals --noUnusedParameters`.
- `npm test` passed: 106 tests.
- `npm run memory:verify` passed.
- Durable Claude lead session reviewed Gate 6 and returned `APPROVE`.

## Stop Line

Gate 6 proves that static source/provenance verification is possible, and also
proves that the current candidates are not ready for durable promotion.

Next work must design the durable source-of-truth location and the field
population step for `applies_when`, `revisit_when`, `rationale`, and
`project_scope`. Runtime serving/import remains out of scope until that exists.

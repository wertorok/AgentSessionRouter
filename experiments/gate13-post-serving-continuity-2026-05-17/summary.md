# Gate 13 Post-Serving Targeted Continuity

Started: 2026-05-17T07:05:40.041Z
Finished: 2026-05-17T07:13:04.727Z

## Summary

```json
{
  "baseline": {
    "label": "baseline_20a02c4",
    "calls": 15,
    "failed": 0,
    "avg_all": 2.8,
    "avg_memory_probe": 3,
    "avg_non_seed": 2.67,
    "seeded_calls": 0,
    "seed_token_counts": [],
    "by_repetition": [
      {
        "repetition": 1,
        "scores": {
          "T1": 3,
          "T2": 3,
          "T3": 3,
          "T4": 3,
          "T5": 2
        },
        "memory_scores": [
          3,
          3
        ],
        "non_seed_scores": [
          3,
          3,
          2
        ],
        "seed_records": []
      },
      {
        "repetition": 2,
        "scores": {
          "T1": 3,
          "T2": 3,
          "T3": 3,
          "T4": 3,
          "T5": 2
        },
        "memory_scores": [
          3,
          3
        ],
        "non_seed_scores": [
          3,
          3,
          2
        ],
        "seed_records": []
      },
      {
        "repetition": 3,
        "scores": {
          "T1": 3,
          "T2": 3,
          "T3": 3,
          "T4": 3,
          "T5": 2
        },
        "memory_scores": [
          3,
          3
        ],
        "non_seed_scores": [
          3,
          3,
          2
        ],
        "seed_records": []
      }
    ]
  },
  "current": {
    "label": "current_8ec92c7",
    "calls": 15,
    "failed": 0,
    "avg_all": 2.87,
    "avg_memory_probe": 3,
    "avg_non_seed": 2.78,
    "seeded_calls": 3,
    "seed_token_counts": [
      892,
      892,
      892
    ],
    "by_repetition": [
      {
        "repetition": 1,
        "scores": {
          "T1": 3,
          "T2": 3,
          "T3": 3,
          "T4": 3,
          "T5": 3
        },
        "memory_scores": [
          3,
          3
        ],
        "non_seed_scores": [
          3,
          3,
          3
        ],
        "seed_records": [
          "AMB-RESCUE-0002",
          "AMB-DOC-0008",
          "AMB-RESCUE-0003",
          "AMB-RESCUE-0004",
          "AMB-SD-000050",
          "AMB-RESCUE-0001",
          "AMB-RESCUE-0005"
        ]
      },
      {
        "repetition": 2,
        "scores": {
          "T1": 3,
          "T2": 3,
          "T3": 3,
          "T4": 3,
          "T5": 2
        },
        "memory_scores": [
          3,
          3
        ],
        "non_seed_scores": [
          3,
          3,
          2
        ],
        "seed_records": [
          "AMB-RESCUE-0002",
          "AMB-DOC-0008",
          "AMB-RESCUE-0003",
          "AMB-RESCUE-0004",
          "AMB-SD-000050",
          "AMB-RESCUE-0001",
          "AMB-RESCUE-0005"
        ]
      },
      {
        "repetition": 3,
        "scores": {
          "T1": 3,
          "T2": 3,
          "T3": 3,
          "T4": 3,
          "T5": 2
        },
        "memory_scores": [
          3,
          3
        ],
        "non_seed_scores": [
          3,
          3,
          2
        ],
        "seed_records": [
          "AMB-RESCUE-0002",
          "AMB-DOC-0008",
          "AMB-RESCUE-0003",
          "AMB-RESCUE-0004",
          "AMB-SD-000050",
          "AMB-RESCUE-0001",
          "AMB-RESCUE-0005"
        ]
      }
    ]
  }
}
```

## Interpretation

- Baseline uses commit 20a02c4 with serving disabled.
- Current uses commit 8ec92c7 with seed-at-session-creation serving enabled.
- The prompt metadata is intentionally proof-of-value aligned so the current seed includes the relevant active principles instead of measuring an unrelated seed.
- This is a continuity/noise regression check, not a new proof-of-value judge.
- Result: no continuity regression. Memory probes stayed 3.00/3 in all 3 baseline repetitions and all 3 post-serving repetitions.
- T5 stayed at the known scorer-artifact baseline in 2/3 post-serving repetitions and improved to 3 in 1/3. Treat [3,2,2] on T5 as no regression against the established [2,2,2] baseline pattern for this targeted scorer.

## Seed Composition Check

The earlier controlled-enablement smoke seed selected:

| Record | Mapping |
| --- | --- |
| `AMB-DOC-0008` | Proof-of-value Q6: auditable classifier/rubric |
| `AMB-RESCUE-0004` | Proof-of-value Q4/Q8: runtime principles need applicability and counter-evidence |
| `AMB-SD-000039` | Proof-of-value Q7: orphaned/dead sessions are not silently reused |
| `AMB-SD-000050` | Related to stale/fallback behavior, but not the exact rescued stale-evidence principle |
| `AMB-SD-000035` | Related to internal metrics boundary, but not the exact caller-facing telemetry principle |
| `PA-SD-000219` | Project-scoped classification implementation detail, not a proof-of-value principle |
| `AMB-SD-000007` | Project-scoped shadow lock namespace, not a proof-of-value principle |
| `AMB-SD-000116` | Project-scoped SQL metacharacter validation, not a proof-of-value principle |

That smoke seed was valid for enablement guardrails, but not sufficient as the
quality-regression seed for proof-of-value principles. The targeted continuity
run therefore used architectural metadata that selected these proof-aligned
records on every post-serving repetition:

| Record | Mapping |
| --- | --- |
| `AMB-RESCUE-0002` | stale/untrusted evidence must signal and fallback; programming needs precise/current evidence |
| `AMB-RESCUE-0003` | verified artifacts/source-of-truth beats opaque session memory |
| `AMB-RESCUE-0004` | runtime principles require applicability and counter-evidence |
| `AMB-RESCUE-0001` | telemetry/shadow evaluation must not mutate caller-facing answers |
| `AMB-RESCUE-0005` | durable architectural memory needs diffable provenance |
| `AMB-DOC-0008` | classifier/rubric scoring must be explicit and auditable |
| `AMB-SD-000050` | stale cluster fallback uses conservative routing |

Known gap: `single-run-insufficient` and `extract != improve` are documented as
process/scorer guardrails in project docs, but they are not currently active
engineering-principle records. They cannot be selected by runtime serving until
they are promoted into the active source-of-truth memory corpus.

# Gate 13 Proof Of Value: Test-Mode Seed A/B

Commit: 20a02c4
Seeded project: AgentSessionRouter-gate13-proof-of-value-2026-05-17-20a02c4-seeded
Control project: AgentSessionRouter-gate13-proof-of-value-2026-05-17-20a02c4-control
Seeded session: session_fd0c1109-4828-4956-8065-5cc15ee201a9
Control session: session_be6b20b0-72ff-4e4d-b156-f30b6f365d51
Runtime serving enabled: false

## Interpretation

Seeded architectural memory showed measurable value on this targeted set.

This experiment tests usefulness, not regression safety. `session:continuity` remains the regression benchmark for chain-memory quality. Shadow-style A/B judging is appropriate here because this is a fan-out comparison of two independent answers; it is not the right tool for guardrail 5 continuity regression.

## Aggregate

```json
{
  "total": 8,
  "seeded_wins": 8,
  "control_wins": 0,
  "ties": 0,
  "unknown": 0,
  "seeded_cites_expected_principle": 8,
  "control_cites_expected_principle": 0,
  "principle_helped_and_seeded_won": 8,
  "success_threshold_met": true
}
```

## Per Question

| Q | Expected principles | Seeded cited expected | Control cited expected | Preferred | Principle helped | Judge parse |
| --- | --- | --- | --- | --- | --- | --- |
| Q1 | AMB-RESCUE-0001 | true | false | seeded | true | regex/raw |
| Q2 | AMB-RESCUE-0002, AMB-RESCUE-0003 | true | false | seeded | true | regex/raw |
| Q3 | AMB-RESCUE-0003 | true | false | seeded | true | regex/raw |
| Q4 | AMB-RESCUE-0004 | true | false | seeded | true | regex/raw |
| Q5 | AMB-RESCUE-0005 | true | false | seeded | true | regex/raw |
| Q6 | AMB-DOC-0008 | true | false | seeded | true | regex/raw |
| Q7 | AMB-SD-000039 | true | false | seeded | true | regex/raw |
| Q8 | AMB-RESCUE-0002, AMB-RESCUE-0004 | true | false | seeded | true | regex/raw |

# Route Calibration Report

Generated: 2026-05-15T21:02:51.299Z
Project: `AgentSessionRouter`
Window: last 168h since 2026-05-08T21:02:51.278Z

This is an offline report. It does not invoke Claude and does not change routing behavior. It turns real `router_route_decision` telemetry into a calibration queue for future match-score tuning.

## Executive Summary

- Route decisions inspected: 82
- Active/dormant sessions considered for near-topic analysis: 8
- Decisions with candidate-gap telemetry: 0
- Low-gap decisions (< 0.15): 0
- New-session route decisions: 0
- Expensive/slow outcome signals: 0
- Near-duplicate topic signals: 11
- Calibration queue items: 18

> Sample is large enough to inspect recurring patterns, but thresholds should still be tuned only after labeling correctness.

## Selected Path Counts

| Selected path                   | Count |
| ------------------------------- | ----- |
| cluster_consult_explicit        | 38    |
| claude_consult_explicit_session | 23    |
| claude_consult_existing_session | 18    |
| claude_consult_auto             | 3     |

## Suspicious Signal Counts

| Signal                             | Count |
| ---------------------------------- | ----- |
| near_duplicate_topic               | 11    |
| error_after_route                  | 6     |
| auto_fallback                      | 3     |
| metadata_parse_failure_after_route | 3     |
| token_anomaly_after_route          | 3     |

## Calibration Queue

| Event | Path                            | Score  | Gap | Signals                                                              | Topic hint / topic                                                               |
| ----- | ------------------------------- | ------ | --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 194   | claude_consult_auto             | 0.3081 | -   | auto_fallback, metadata_parse_failure_after_route, error_after_route | router consult shadow eval sample                                                |
| 144   | claude_consult_auto             | 0.1365 | -   | auto_fallback, metadata_parse_failure_after_route, error_after_route | router consult route telemetry sample                                            |
| 113   | claude_consult_explicit_session | 1      | -   | token_anomaly_after_route, error_after_route                         | v2.1 shadow eval architecture                                                    |
| 106   | claude_consult_explicit_session | 1      | -   | token_anomaly_after_route, error_after_route                         | v2.1 shadow eval architecture                                                    |
| 101   | claude_consult_explicit_session | 1      | -   | token_anomaly_after_route, error_after_route                         | v2.1 shadow eval architecture                                                    |
| 165   | cluster_consult_explicit        | 1      | -   | metadata_parse_failure_after_route, error_after_route                | stale cluster sample claude-code-live-workload                                   |
| 247   | claude_consult_existing_session | 1      | -   | near_duplicate_topic                                                 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full          |
| 245   | claude_consult_existing_session | 1      | -   | near_duplicate_topic                                                 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full          |
| 243   | claude_consult_explicit_session | 1      | -   | near_duplicate_topic                                                 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3   |
| 239   | claude_consult_explicit_session | 1      | -   | near_duplicate_topic                                                 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full          |
| 237   | claude_consult_explicit_session | 1      | -   | near_duplicate_topic                                                 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full          |
| 235   | cluster_consult_explicit        | 1      | -   | near_duplicate_topic                                                 | stale cluster sample agentsessionrouter-codebase-reprepared-2026-05-15-target... |
| 231   | cluster_consult_explicit        | 1      | -   | near_duplicate_topic                                                 | stale cluster sample agentsessionrouter-codebase-reprepared-2026-05-15-full      |
| 206   | cluster_consult_explicit        | 1      | -   | near_duplicate_topic                                                 | stale cluster sample agentsessionrouter-codebase-reprepared-2026-05-15-full      |
| 201   | cluster_consult_explicit        | 1      | -   | near_duplicate_topic                                                 | stale cluster sample agentsessionrouter-codebase-reprepared-2026-05-15-target... |
| 168   | cluster_consult_explicit        | 1      | -   | near_duplicate_topic                                                 | stale cluster sample agentsessionrouter-codebase-reprepared-2026-05-15-target... |
| 162   | cluster_consult_explicit        | 1      | -   | near_duplicate_topic                                                 | stale cluster sample agentsessionrouter-codebase-reprepared-2026-05-15-full      |
| 147   | claude_consult_auto             | 0.2286 | -   | auto_fallback                                                        | router consult cache maintenance sample                                          |

## How To Use This

1. Inspect the calibration queue before changing score weights.
2. Label each queued route as `correct_reuse`, `wrong_reuse`, `correct_new_session`, or `unnecessary_new_session`.
3. Only after labels exist, compare alternative weights/thresholds against those labels.
4. Treat explicit cluster/session routes as operator intent, not evidence that fuzzy matching worked.

## Artifacts

- `calibration-report.json`: full machine-readable route decisions, parsed reasons, outcome signals, and queue.
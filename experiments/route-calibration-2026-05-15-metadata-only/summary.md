# Route Calibration Report

Generated: 2026-05-15T21:25:51.198Z
Project: `AgentSessionRouter`
Window: last 168h since 2026-05-08T21:25:51.192Z
Filter: metadata_score events only

This is an offline report. It does not invoke Claude and does not change routing behavior. It turns real `router_route_decision` telemetry into a calibration queue for future match-score tuning.

## Executive Summary

- Route decisions inspected: 0
- Active/dormant sessions considered for near-topic analysis: 8
- Decisions with candidate-gap telemetry: 0
- Decisions with metadata-quality telemetry: 0
- Low-gap decisions (< 0.15): 0
- Low-metadata decisions (< 0.70): 0
- New-session route decisions: 0
- Expensive/slow outcome signals: 0
- Near-duplicate topic signals: 0
- Calibration queue items: 0

> Sample is still small. Use this report for inspection, not threshold tuning.

## Selected Path Counts

| Selected path | Count |
| ------------- | ----- |
|               |       |

## Suspicious Signal Counts

| Signal | Count |
| ------ | ----- |
|        |       |

## Calibration Queue

No suspicious route decisions found in this window.

## How To Use This

1. Inspect the calibration queue before changing score weights.
2. Label each queued route as `correct_reuse`, `wrong_reuse`, `correct_new_session`, or `unnecessary_new_session`.
3. Only after labels exist, compare alternative weights/thresholds against those labels.
4. Treat explicit cluster/session routes as operator intent, not evidence that fuzzy matching worked.

## Artifacts

- `calibration-report.json`: full machine-readable route decisions, parsed reasons, outcome signals, and queue.
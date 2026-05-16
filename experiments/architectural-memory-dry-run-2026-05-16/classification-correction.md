# Phase 7 Gate 12.5 Classification Correction

Generated: 2026-05-17T00:00:00.000Z
Status: `classification_corrected`

## Counts

- engineering_principles_before: 13
- engineering_principles_after: 13
- project_architecture_before: 75
- project_architecture_after: 80
- moved_to_project_architecture: 5
- rescued_engineering_principles: 5
- active_records_total_after: 93

## Moved To Project Architecture

- AMB-SD-000007: Shadow must use dedicated lock namespace (shadow:${projectId}) separate from production locks
- AMB-SD-000116: Reject cluster names containing SQL metacharacters (; " --) at input validation boundary
- AMB-SD-000121: Consistent fallback routing for all parallel queries until cluster-level revalidation succeeds
- AMB-SD-000122: Continue fallback routing for all remaining parallel queries until cluster revalidation
- AMB-SD-000123: Maintain fallback during reprepare until successful completion

## Rescued Engineering Principles

- AMB-RESCUE-0001: Evaluation and telemetry paths must not affect caller-facing answers; observation must remain separate from production response behavior.
- AMB-RESCUE-0002: Untrusted or stale evidence must produce an explicit signal and safe fallback, not silent use of stale data.
- AMB-RESCUE-0003: Verified evidence artifacts should be the operational source of truth; opaque model or session state must not be the only authority.
- AMB-RESCUE-0004: Runtime-served principles need applicability conditions and an explicit rejection or counter-evidence path to avoid dogmatization.
- AMB-RESCUE-0005: Durable architectural memory must have diffable provenance; hidden model-memory must not become the authority.

## Known Limitation

Gate 12.5 is a manual correction. The deterministic distill classifier remains known-weak because it judged wording and artifact specificity more than semantic transferability in both directions.

## Scope

- Runtime import/serving: false
- Cluster writes: false
- Router behavior changes: false
- Classifier algorithm changed: false

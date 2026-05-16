# Adversarial Review - 2026-05-16

Purpose: attack AgentSessionRouter through the public MCP surface and record actual failure modes before adding more features.

## Summary

The router held its main safety invariant: caller-facing consult paths generally returned an answer by falling back to `claude_consult` when cluster cache evidence could not be trusted. The review found three operational gaps that can waste tokens or hide cache decay:

1. Very large questions were rejected too late, after expensive routing/prompt work.
2. A stale cluster under concurrent load could trigger repeated revalidation failures and fallback calls.
3. `cluster_reprepare` full coverage collapse was less visible than partial coverage drops.

## P0

### Preflight Input Limits

Observed: oversized caller input could enter the router and reach cost checks late. A 100k-character question caused slow processing before returning `COST_LIMIT_EXCEEDED`.

Expected: reject oversized consult input before any Claude invocation and before expensive route construction.

Required behavior:
- Bound `question`, `relevant_code`, metadata strings, tags, and file hints.
- Return a structured validation/cost error.
- Do not call Claude for oversized input.

### Stale Burst Control

Observed: 10 parallel `cluster_consult` calls against the same stale cluster produced repeated `evidence_revalidation_failed` and repeated fallback attempts.

Expected:
- Revalidation remains serialized per cluster.
- After one strict evidence failure, follow-up calls in a short window skip repeated revalidation.
- Identical concurrent fallback questions coalesce to one fallback Claude call when possible.
- Caller still gets an answer when Claude is available.

## P1

### Full Coverage Collapse Visibility

Observed: partial `cluster_reprepare` drops surfaced in `router_monitor`, but a full rejection path could return `CLUSTER_FACTSHEET_INVALID` without a `cluster_reprepare` coverage event.

Expected:
- If a reprepare attempt rejects all existing facts, `router_monitor.cache_health.reprepare_coverage_drops` must show a 100% coverage drop.
- Recommendation should point to `cluster_prepare`, not another `cluster_reprepare`, because semantic coverage must be regenerated.

### Metadata Sanitization

Observed: routing metadata accepted dangerous or noisy values such as absolute paths, `../` traversal paths, and huge tags.

Expected:
- Routing metadata should be treated as hints only.
- Drop unsafe file paths and oversized tags before storage/scoring.
- Do not read paths from metadata.

## P2

### SQLite Storage Health

Observed: external SQLite lock/removal scenarios can timeout or remain invisible to status tools because an open SQLite handle can survive file unlinking.

Expected future work:
- Add storage health diagnostics to `router_status`.
- Surface database lock/timeouts as structured infrastructure errors.

### Routing Calibration

Observed: generic metadata can over-weight file/tag/recency signals and produce high-confidence session reuse for a nearby but not exact topic.

Expected future work:
- Use real route outcomes to tune scoring weights.
- Add calibration filters for post-feature calls and generic tag effectiveness.

## Worst Failure Mode

Stale cluster under burst load:

```
N concurrent consults
  -> same stale cluster
  -> N stale detections
  -> repeated revalidation failures
  -> repeated fallback Claude calls
  -> avoidable cost and latency spike
```

Fix priority: P0 stale burst control before new feature work.

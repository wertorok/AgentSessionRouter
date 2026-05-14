# v2.2 Release Notes

Release date: 2026-05-14

Tag: `v2.2`

Repository: `wertorok/AgentSessionRouter`

## Summary

`v2.2` is the caller-safe cluster-cache release.

The core contract is now simple:

```txt
cluster_consult(cluster_id, question) -> answer
```

The caller does not handle factsheet health, strict revalidation failures, or static/LLM trust decisions. Those are router internals. If the cache path cannot safely answer and Claude is available, the router falls back internally to normal `claude_consult` and still returns an answer to the parent agent.

## Included Since v2.0

- Strict selector/snippet evidence revalidation for changed factsheet files.
- Per-cluster revalidation lock with retry-after-lock behavior.
- Internal fallback from failed cache revalidation to normal `claude_consult`.
- `needs_prepare` cluster status for operator-visible cache decay.
- `router_status.v2_clusters.fallback_count_last_24h`.
- Cluster-level `static_factsheet_policy: "allow" | "deny"`.
- Removal of per-call `allow_static_factsheet` from the caller-facing `cluster_consult` API.
- Optional v2.1-lite shadow eval telemetry with blind structured judge.

## Current Production Contract

Caller-facing `cluster_consult`:

1. Validates project and cluster ownership.
2. Checks factsheet trust using cluster metadata.
3. Checks scoped file hashes.
4. If files changed, strict-revalidates every cited selector and stored `snippet_hash`.
5. If all evidence still matches, consults through the factsheet.
6. If the cluster is missing, has no usable factsheet, is not trusted enough, or evidence cannot be proven valid, logs the reason and falls back internally to `claude_consult`.
7. Marks existing clusters `needs_prepare` when their stored evidence decays.
8. Returns caller-visible errors only for project ownership/security mismatch, invalid request shape that prevents asking Claude, or true infrastructure failure where Claude cannot answer through either path.

## Validation

Before tagging:

- `git diff --check`
- `npm test` - 69 tests passed
- `npm run build`
- `npm run smoke:postinstall`
- `npm run smoke:postinstall:live` when local Claude auth/rate limits permit

## Post-MVP Enhancements

These are explicitly not release blockers:

- fork baselines
- automatic factsheet distillation from v1 sessions
- automatic cluster routing
- cross-process locking

# Claude Code Monitor Report — 2026-05-15

## MCP Tools Used

| Tool | Status |
|------|--------|
| `router_monitor` | ✅ success |
| `router_status` | ✅ success |
| `cluster_list` | ✅ success |
| `comparison_stats` | ✅ success |
| `comparison_list` | ✅ success |

## Key Monitor Findings

**Health**: Mode `normal`, no degraded reason.
**Sessions**: 1 active v1 session, 0 dormant/orphaned/archived.
**Clusters**: 5 active, 0 stale, 0 needing prepare, 0 invalidated, 0 archived.
**Fallbacks**: 0 in last 24h.
**Shadow Eval**: Enabled but no comparisons exist yet (0 total, 0 judged, 0 pending).
**Cache**: No stale clusters, no clusters needing attention.
**Quality data**: No cluster stats, no win samples, no context misses recorded.
**Next direction**: Collect more shadow comparisons before auto-routing or factsheet expansion.

**Router Status**: Confirms normal mode, 0 recent errors (session or cluster events), 0 warnings.

**Cluster List**: 5 clusters, all `active`:
- `claude-code-live-workload` — static_verified, 2 facts, policy `allow`
- `agentsessionrouter-codebase-expanded` — llm_verified, 33 facts, policy `deny`
- `agentsessionrouter-codebase` — llm_verified, 25 facts, policy `deny`
- `agentsessionrouter-codebase-pilot2` — llm_verified, 25 facts, policy `deny`
- `agentsessionrouter-codebase-pilot` — llm_verified, 25 facts, policy `deny`

**Shadow comparisons**: 0 collected (stats and list both empty).

## Permissions Worked?

Yes. All five MCP tools invoked successfully — no auth failures, no timeouts.

## Test Command Result

```
npm test -- --run tests/tools.test.ts
Test Files  9 passed (9)
     Tests  71 passed (71)
  Duration  1.68s
```

All 71 tests passed across 9 test files.

## Recommended Next Actions

1. **Collect shadow comparison data** — no comparisons exist yet. Design a baseline vs. router comparison task to start generating win/loss/tie data.
2. **Review `static_factsheet_policy`** — 4 of 5 clusters use `deny`; only `claude-code-live-workload` uses `allow`. Consider whether codebase clusters should use static factheets.
3. **Expand `claude-code-live-workload` facts** — currently only 2 facts. Enrich with more claims to improve quality signal.
4. **Trigger baseline session capture** — set `baseline_session_id` on active clusters to enable per-cluster quality scoring.

## Compact JSON Summary

```json
{
  "date": "2026-05-15",
  "mcp_tools_invoked": 5,
  "mcp_tools_permitted": 5,
  "mcp_tools_blocked": 0,
  "health_mode": "normal",
  "v1_sessions_active": 1,
  "v2_clusters_active": 5,
  "v2_clusters_stale": 0,
  "shadow_comparisons_total": 0,
  "test_result": "PASS",
  "tests_passed": 71,
  "test_files_passed": 9,
  "permissions_issue": false
}
```
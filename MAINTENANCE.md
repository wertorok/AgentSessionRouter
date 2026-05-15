# Maintenance

## Cluster Factsheet Re-Prepare

Re-prepare affected cluster factsheets after any architectural PR that changes:

- database schemas or public field names
- cluster/session event types
- caller-facing `cluster_consult` semantics
- evidence revalidation, fallback, or cache trust policy
- shadow eval, router monitor, or comparison scoring
- `SESSION_UPDATE_JSON` parsing or session metadata updates

Use a new cluster id for validation first, then replace or refresh the production
cluster only after targeted checks pass.

Recommended validation sequence:

1. Run a targeted benchmark for the affected questions/domains.
2. Confirm factual questions no longer return `NOT IN CONTEXT`.
3. Confirm caller-facing behavior is described through the MCP tool wrapper, not
   only through lower-level helper functions.
4. Run the full quality comparison matrix when targeted checks pass.
5. Keep `summary.md`, `trace-report.md`, and event dumps under `experiments/`
   so future regressions can be compared to a concrete baseline.

For the AgentSessionRouter codebase cluster, include at least:

- `src/tools.ts`
- `src/clusterConsult.ts`
- `src/clusterEvidenceRevalidation.ts`
- `src/clusterRefresh.ts`
- `src/cluster.ts`
- `src/db.ts`
- `src/schema.ts`
- `src/consult.ts`
- `src/profiles.ts`
- `docs/CLUSTER_CACHE_SPEC.md`
- `docs/SHADOW_EVAL_SPEC.md`


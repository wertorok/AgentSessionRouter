# Maintenance

## Current Operator Baseline

As of 2026-05-15, the production MCP baseline is:

- code pushed on `master` through commit `3ba27be`
- public MCP tools: 17
- tests: `81 passed`
- build: passing
- shadow eval: `90/90` judged, `0` pending, `0` failed
- active benchmark clusters: 3
- archived superseded benchmark clusters: 8
- active direct wins after grounded judge: 0
- `fallback_count_last_24h`: 0
- current monitor signals:
  - latest full codebase cluster has 3 `NOT IN CONTEXT` samples
  - one slow `new_session` event around 302 seconds

Use `router_monitor` as the first diagnostic entry point. Treat its output as
the information monitor for what works, what fails, why it failed, and what to
inspect next.

Current follow-up priorities:

1. Inspect the 3 active `NOT IN CONTEXT` samples and decide whether they are
   factsheet gaps, noisy full-cluster scope, or questions that should route to
   `claude_consult`.
2. Keep targeted `SESSION_UPDATE_JSON` coverage separate from answer-quality
   benchmarks, especially parse-failure threshold and archived-bootstrap
   recovery behavior.
3. Inspect slow direct `new_session` events when they recur; prefer
   `cluster_consult` for covered questions when direct discovery approaches the
   caller timeout boundary.

## Cluster Factsheet Re-Prepare

Re-prepare affected cluster factsheets after any architectural PR that changes:

- database schemas or public field names
- cluster/session event types
- caller-facing `cluster_consult` semantics
- evidence revalidation, fallback, or cache trust policy
- shadow eval, router monitor, or comparison scoring
- `SESSION_UPDATE_JSON` parsing or session metadata updates

Also re-prepare or re-check when monitoring shows:

- repeated `NOT IN CONTEXT` on questions that should be covered
- cluster quality drops more than 0.3 below the last benchmark baseline
- repeated `cluster_consult` losses against the shadow/direct baseline
- new suspicious identifiers in trace reports
- stale/revalidation/fallback events grow for the same cluster over several runs

Use a new cluster id for validation first, then replace or refresh the production
cluster only after targeted checks pass.

Recommended validation sequence:

1. Run a targeted benchmark for the affected questions/domains.
2. Identify whether low scores come from missing facts, stale facts, noisy
   factsheet scope, or weak scoring.
3. Add explicit facts and evidence selectors for the missing area.
4. Re-run `cluster_prepare` with `verification_mode: "llm"` under a new
   validation cluster id.
5. Confirm factual questions no longer return `NOT IN CONTEXT`.
6. Confirm caller-facing behavior is described through the MCP tool wrapper, not
   only through lower-level helper functions.
7. Run the full quality comparison matrix when targeted checks pass.
8. Keep `summary.md`, `trace-report.md`, and event dumps under `experiments/`
   so future regressions can be compared to a concrete baseline.

Do not treat a bigger factsheet as automatically better. If targeted checks pass
but the full matrix regresses, split the cluster or factsheet scope before adding
more broad facts. Context noise is a real failure mode.

`SESSION_UPDATE_JSON` must be tested separately from answer quality. The quality
matrix compares answers and only indirectly observes session metadata parsing.
Use targeted `claude_consult` tests to verify:

- session `summary` updates
- `session_decisions` append without destructive overwrite
- `session_files`, `session_tags`, and `session_aliases` update correctly
- parse failures include `raw_response_path` when a raw response was written
- malformed update blocks do not corrupt existing registry state

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

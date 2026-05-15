# Maintenance

## Current Operator Baseline

As of 2026-05-15, the production MCP baseline is:

- code pushed on `master`; use `git log -1 --oneline` for the latest commit
- public MCP tools: 17
- tests: `83 passed`
- build: passing
- shadow eval: `90/90` judged, `0` pending, `0` failed
- active benchmark clusters: 3
- archived superseded benchmark clusters: 8
- active direct wins after grounded judge: 0
- `fallback_count_last_24h`: 0
- current monitor signals:
  - no active direct wins after grounded judge
  - no low-scoring active `NOT IN CONTEXT` coverage failures
  - one slow `new_session` event around 302 seconds, caused by a broad
    `tokens_in=78,258` direct roadmap consult

Use `router_monitor` as the first diagnostic entry point. Treat its output as
the information monitor for what works, what fails, why it failed, and what to
inspect next.

Current follow-up priorities:

1. Keep targeted `SESSION_UPDATE_JSON` coverage separate from answer-quality
   benchmarks. The MCP workload matrix now exercises clean metadata updates,
   parse-failure threshold archival, and archived-bootstrap replacement.
2. Inspect slow direct `new_session` events when they recur; prefer
   `cluster_consult` for covered questions when direct discovery approaches the
   caller timeout boundary. Use `router_monitor.latency.slow_session_samples`
   for the exact session id, topic, question, token counts, duration, and raw
   response path.
3. Use monitor data for the next real decision. Do not add fork/distill work
   until monitor shows latency/cost or coverage as the actual bottleneck.
4. Save monitor snapshots before and after larger router changes with
   `npm run monitor:snapshot`; compare snapshots when deciding whether a change
   improved metadata health, latency, cache fallback, or quality.

`router_monitor.quality.auto_routing_candidates` is a read-only research signal.
It means a cluster is stable enough to study for future routing suggestions; it
does not mean automatic routing is enabled.

## Monitor Signal Filtering Invariants

`NOT IN CONTEXT` is an audit signal, not automatically a coverage failure.

Operational rule:

- `NOT IN CONTEXT` with a high judge score (`cluster_score >= 2`) means a
  useful answer included an honest caveat. Do not count it as a coverage
  problem, do not surface it as a coverage recommendation, and do not use it as
  a factsheet-expansion trigger.
- `NOT IN CONTEXT` with no judge result yet, or with low score
  (`cluster_score <= 1`), is a real coverage signal. Surface it in
  `router_monitor.quality.not_in_context_samples` and use it to decide whether
  to expand the factsheet, split the cluster, or route that question type to
  `claude_consult`.
- This distinction must stay in `router_monitor` and DB monitor aggregation.
  Do not regress to raw substring counting of `NOT IN CONTEXT`.

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

Use `router_monitor.metadata_health` for operational follow-up:

- `event_counts` shows parse-failure and threshold totals in the recent window
- `affected_sessions` shows which topics/sessions are degrading
- `samples` links to raw response paths for concrete malformed outputs

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

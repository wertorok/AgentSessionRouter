# Maintenance

## Current Operator Baseline

As of 2026-05-15, the production MCP baseline is:

- code pushed on `master`; use `git log -1 --oneline` for the latest commit
- public MCP tools: 18
- tests: `91 passed`
- build: passing
- shadow eval: `118/118` judged, `0` pending, `0` failed
- active benchmark clusters: 1 (`agentsessionrouter-codebase`)
- archived superseded benchmark clusters: 10
- active direct wins after grounded judge: 0
- `fallback_count_last_24h`: 0
- current monitor signals:
  - no active direct wins after grounded judge
  - one historical active-cluster `NOT IN CONTEXT` sample remains in the recent
    window; inspect the judged sample before treating it as a coverage issue
  - no active stale or `needs_prepare` clusters after archiving superseded
    validation clusters
  - `router_monitor.route_health` is available and records `router_consult`
    selected-path samples
  - 2026-05-15 live route sampling found stale codebase evidence after
    route/docs/answer-hygiene changes; `agentsessionrouter-codebase` was then
    re-prepared to factsheet version 4 with `llm_verified`, 50 verified facts,
    and 0 rejected facts
  - post-cleanup live route sample showed 12 real calls, 0 failures,
    0 caller-facing pseudo tool-call leaks, 0 empty answers, and 0
    `NOT IN CONTEXT` answers
  - post-v4 cluster sample showed A1/A2/A3 all served by
    `cluster_consult_explicit` with 0 failures, 0 pseudo tool-call leaks, and 0
    `NOT IN CONTEXT` answers
  - one slow `new_session` event around 302 seconds, caused by a broad
    `tokens_in=78,258` direct roadmap consult

Use `router_monitor` as the first diagnostic entry point. Treat its output as
the information monitor for what works, what fails, why it failed, and what to
inspect next.

Current follow-up priorities:

1. Keep targeted `SESSION_UPDATE_JSON` coverage separate from answer-quality
   benchmarks. The MCP workload matrix now exercises clean metadata updates,
   parse-failure threshold archival, and archived-bootstrap replacement.
2. Inspect slow direct `new_session` events when they recur. Use
   `router_consult` as the recommended parent-agent entry point so route
   decisions are recorded in `router_monitor.route_health`. Prefer explicit
   `cluster_id` for covered questions and explicit/exact sessions for broad
   reasoning before repeating cold discovery. Use
   `router_monitor.latency.slow_session_samples` for the exact session id,
   topic, question, token counts, duration, and raw response path.
3. Use monitor data for the next real decision. Do not add fork/distill work
   until monitor shows latency/cost or coverage as the actual bottleneck.
4. Save monitor snapshots before and after larger router changes with
   `npm run monitor:snapshot`; compare snapshots when deciding whether a change
   improved metadata health, latency, cache fallback, or quality.
5. After route changes, run `npm run router:sanity` to generate a small live
   `router_consult` trace before relying on route-health conclusions.
6. Older superseded codebase clusters are archived. Prefer the fresh
   `agentsessionrouter-codebase` factsheet version 4 for route sanity and
   future benchmark work.
7. Use `npm run session:continuity` when evaluating the original v1 premise:
   repeated questions in one durable session. Do not infer session-memory
   quality from cluster shadow eval, because shadow uses a fresh direct
   baseline by design.
8. Use `npm run session:collision` when evaluating whether similar topics can
   confuse the router. Exact-topic continuity is the easy case; collision
   analysis separates exact reuse from fuzzy high-confidence reuse,
   low-confidence reuse, and conservative no-reuse.

`router_monitor.quality.auto_routing_candidates` is a read-only research signal.
It means a cluster is stable enough to study for future routing suggestions; it
does not mean automatic routing is enabled.

## Consultation Routing Invariant

The normal parent-agent entry point is `router_consult`.

Operational rule:

- If the caller knows the covered cluster, pass `cluster_id`; the router uses
  `cluster_consult` and records `selected_path=cluster_consult_explicit`.
- If the caller knows the durable session, pass `session_id`; the router uses
  `claude_consult` with that session and records
  `selected_path=claude_consult_explicit_session`.
- If neither is provided, the router may reuse an exact or high-confidence v1
  session; otherwise it delegates to normal `claude_consult` auto-routing.
- Automatic cluster selection is not enabled. Stable cluster candidates from
  `router_monitor.quality.auto_routing_candidates` are telemetry only.
- Exact normalized topic reuse is intentionally strong, but it only proves the
  easy path. For overlapping or near-duplicate topics, use
  `npm run session:collision` before changing thresholds or claiming the router
  can disambiguate similar sessions.
- Every `router_consult` writes `router_route_decision`. Use
  `router_monitor.route_health.samples` to inspect accidental broad
  `claude_consult_auto` decisions before adding new routing logic.

Do not push cluster/session health handling back to the parent caller. The
router should answer through the safest available path and expose internal
route/cache health through monitor telemetry.

## Live Route Sampling

Use `npm run router:sample` when you need a real route-behavior sample across
fresh clusters, stale clusters, explicit sessions, exact-topic sessions, and
auto fallback.

The 2026-05-15 route sample produced 64 recent `router_route_decision` rows:

- `cluster_consult_explicit`: 31
- `claude_consult_explicit_session`: 17
- `claude_consult_existing_session`: 13
- `claude_consult_auto`: 3

Observed invariants:

- Fresh `agentsessionrouter-codebase` cluster was the strongest route for
  covered questions.
- Stale/needs_prepare clusters still returned caller-visible answers through
  internal fallback, but they polluted monitor recommendations and should be
  archived, re-prepared, or explicitly kept as stale fixtures.
- Direct/session fallback can emit pseudo tool-call markup when Claude tries to
  search instead of answer. The consult prompt forbids this and
  `cleanCallerAnswer` strips known pseudo tool-call blocks; keep this as a
  caller-facing answer hygiene invariant.
- The hourly cost limiter is expected to stop broad live samples. Treat
  `COST_LIMIT_EXCEEDED` as a successful safety signal, not as an MCP crash.

When reviewing route samples, inspect both layers:

- `router_monitor.route_health` for path selection and slow/broad routing.
- `comparison_stats` / `comparison_list` for cluster answer quality.

Do not interpret very low direct shadow scores blindly. If direct answers are
tool-call plans or search intents, the shadow baseline is measuring fallback
hygiene, not pure reasoning quality.

For monitor snapshots, `router_monitor` caps large `sample_limit` requests to a
safe effective limit and reports `output_limits.truncated`. As of 2026-05-15,
`sample_limit=80` is accepted by the snapshot script, becomes
`effective_sample_limit=30` inside `router_monitor`, and uses
`warnings_limit=50` for `router_status`.

## Session Continuity Benchmark

Use `npm run session:continuity` to measure whether the router preserves context
across multiple questions in one durable session. This is separate from shadow
eval:

- shadow eval compares `cluster_consult` with isolated `direct_fresh`
  background calls
- session continuity compares fresh-each-turn calls with repeated calls through
  the same Claude/router session

The 2026-05-15 continuity run used 20 real MCP/Claude calls under isolated
project id `AgentSessionRouter-continuity-2026-05-15`:

| Method | Memory-probe score | Sessions used | Interpretation |
| --- | ---: | ---: | --- |
| `fresh_each_turn` | 0.67 | 5 | cold calls do not preserve prior benchmark decisions |
| `same_claude_session` | 3.00 | 1 | direct durable v1 session preserves continuity |
| `router_exact_topic` | 3.00 | 1 | `router_consult` exact-topic reuse preserves continuity |
| `router_explicit_session` | 2.67 | 1 | continuity mostly preserved; one synthesis answer chose a fallback benchmark instead of naming same-session benchmark |

The same run also verified `SESSION_UPDATE_JSON` metadata on this path: 8
inspected sessions stored 19 decisions, and `router_monitor.metadata_health`
reported no parse failures for the continuity project.

Operational rule:

- Use shadow eval for cluster factsheet quality.
- Use session continuity benchmark for durable session memory.
- Do not compare `cluster_consult` only against `direct_fresh` when the question
  being asked is whether the router preserves multi-turn context.

## Session Routing Collision Analysis

Use `npm run session:collision` to inspect fuzzy routing risk without spending
Claude tokens. The script reads the router SQLite DB, applies the same matching
weights as `src/matching.ts`, and writes artifacts under
`experiments/session-routing-collision-<date>/`.

Read the output this way:

- `exact_topic_reuse`: expected and safe when the caller repeats the same topic.
- `exact_topic_collision`: two active sessions normalize to the same topic key;
  rename/archive one before trusting exact routing.
- `high_confidence_route`: fuzzy score crosses the router-consult reuse
  threshold.
- `low_confidence_reuse_possible`: lower-level `claude_consult` may reuse the
  session, but `router_consult` delegates rather than claiming confidence.
- `low_confidence_ambiguous`: lower-level `claude_consult` may reuse one of two
  close candidates; inspect or pass an explicit session before trusting auto
  reuse.
- `conservative_no_reuse`: the router is unlikely to confuse sessions; the risk
  is under-reuse/new-session creation, not wrong-session reuse.

Do not lower fuzzy thresholds just to increase reuse. First inspect collision
gaps and route-health samples; then add aliases/tags/file evidence or split
near-duplicate sessions.

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

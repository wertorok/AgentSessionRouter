# Maintenance

## Current Operator Baseline

As of 2026-05-16, the production MCP baseline is:

- code pushed on `master`; use `git log -1 --oneline` for the latest commit
- public MCP tools: 19
- tests: `98 passed`
- build: passing
- MCP workload matrix: `23/23` stub checks, including observe-only
  `router_dry_run`
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

## v2.7 Observe-Only Routing Snapshot

Verified on 2026-05-16:

- public MCP surface has 19 tools
- every tool description starts with a tier label:
  `[ANSWER DEFAULT]`, `[ANSWER EXPERT]`, `[OBSERVE]`, `[MAINTAIN]`, or
  `[EVAL DEBUG]`
- `router_dry_run` previews the same conservative route decision used by
  `router_consult`
- `router_dry_run` must not invoke Claude, create sessions, apply lifecycle
  changes, or write `router_route_decision`
- tests: `98 passed`
- build: passing
- workload matrix: `23/23` stub checks

## v2.6 Metadata-Rich Routing Snapshot

Verified on 2026-05-15:

- tag `v2.6` is pushed to GitHub and points at release commit `412c20f`
  (`feat(router): add metadata-rich routing hints`); later documentation
  commits may sit after the tag on `master`
- tests: `97 passed`
- build: passing
- git diff: clean before this documentation snapshot

Capabilities:

- [x] Session router with persistent memory, validated by continuity benchmark
  (`3.00` durable/session-routed memory score vs `0.67` fresh-each-turn
  baseline in the original continuity run)
- [x] Cluster cache with verified factsheets (`3.00` on factual lookup in the
  covered codebase cluster, about `23%` of direct-resume cost in the benchmark)
- [x] Routing disambiguation with conservative safety: exact/high-confidence
  reuse, low-confidence reuse only with clear gap, otherwise new durable
  session instead of guessing
- [x] Self-monitoring with recommendations through `router_monitor`
- [x] Metadata-aware scoring with observability through optional
  `topic_hint`, `related_files`, `tags`, and `task_type`
- [x] Calibration tooling with post-feature filtering:
  `npm run route:calibration -- --metadata-only`

Known properties:

- [x] Caller should not receive router-internal cache/revalidation errors when
  the router can answer through a fallback path
- [x] Honest refusal (`NOT IN CONTEXT`) is preserved as an audit signal and is
  not treated as a coverage failure when the judged answer quality is high
- [x] Operator can observe metadata-quality trends through
  `router_monitor.route_health.metadata_quality`
- [x] Router can advise about its own state through `router_monitor`
  recommendations and next directions

Open questions requiring real usage:

- [open] Optimal scoring weights across larger and more diverse session
  distributions
- [open] Effectiveness of generic-tag filtering in real caller behavior
- [open] Long-term scoring drift as sessions, aliases, files, and tags
  accumulate
- [open] Production frequency of cluster `needs_prepare` and fallback events

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
   analysis separates exact reuse, high-confidence reuse, router-disambiguated
   low-confidence reuse, ambiguous new-session fallback, and conservative
   no-reuse.

`router_monitor.quality.auto_routing_candidates` is a read-only research signal.
It means a cluster is stable enough to study for future routing suggestions; it
does not mean automatic routing is enabled.

## Consultation Routing Invariant

The normal parent-agent entry point is `router_consult`.

Use `router_dry_run` only as an observe/debug preview. It should answer the
question "where would the router send this request?" without invoking Claude,
creating sessions, applying lifecycle changes, or writing route events. The
real answer path remains `router_consult`.

Operational rule:

- If the caller knows the covered cluster, pass `cluster_id`; the router uses
  `cluster_consult` and records `selected_path=cluster_consult_explicit`.
- If the caller knows the durable session, pass `session_id`; the router uses
  `claude_consult` with that session and records
  `selected_path=claude_consult_explicit_session`.
- If neither is provided, the router may reuse an exact/high-confidence v1
  session, reuse a low-confidence session only when the best candidate is
  clearly separated from the runner-up, or create a new durable session when
  candidates are ambiguous.
- Automatic cluster selection is not enabled. Stable cluster candidates from
  `router_monitor.quality.auto_routing_candidates` are telemetry only.
- Exact normalized topic reuse is intentionally strong, but it only proves the
  easy path. For overlapping or near-duplicate topics, use
  `npm run session:collision` before changing thresholds or claiming the router
  can disambiguate similar sessions.
- Every `router_consult` writes `router_route_decision`. Use
  `router_monitor.route_health.samples` to inspect accidental broad
  `claude_consult_new_session` decisions before adding new routing logic.
- Caller-side routing hints (`topic_hint`, `related_files`, `tags`,
  `task_type`) are optional but strongly preferred. Missing hints must never
  block the caller; they should lower
  `router_monitor.route_health.metadata_quality` and appear in calibration
  reports instead.

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

The 2026-05-15-v5 rerun after router disambiguation kept the durable-memory
result intact:

| Method | Memory-probe score | Memory+synthesis score | Sessions used |
| --- | ---: | ---: | ---: |
| `fresh_each_turn` | 0.50 | 0.67 | 5 |
| `same_claude_session` | 3.00 | 2.67 | 1 |
| `router_exact_topic` | 3.00 | 2.67 | 1 |
| `router_explicit_session` | 3.00 | 2.67 | 1 |

The synthesis score was 2.67 because the final synthesis answer omitted one
benchmark label, not because routing changed sessions. The actual memory probes
remained 3.00 for durable/session-routed paths.

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
- `router_disambiguated_reuse`: fuzzy score is below high-confidence, but the
  best candidate is far enough from the runner-up; `router_consult` selects that
  session automatically.
- `low_confidence_ambiguous`: two low-confidence candidates are too close;
  `router_consult` starts a new durable session instead of guessing.
- `conservative_no_reuse`: the router is unlikely to confuse sessions; the risk
  is under-reuse/new-session creation, not wrong-session reuse.

Do not lower fuzzy thresholds just to increase reuse. First inspect collision
gaps and route-health samples; then add aliases/tags/file evidence or split
near-duplicate sessions.

Current threshold provenance:

- `threshold_use = 0.70` and `threshold_low_confidence = 0.55` are the original
  v1 matching thresholds. They were not newly tuned for v2.3.2.
- `disambiguation_gap = 0.10` was added after the 2026-05-15 collision report:
  clear low-confidence cases had gaps around `0.33-0.37`, while ambiguous
  fallback-session pairs had gaps around `0.02-0.04`.
- Sensitivity artifacts live under
  `experiments/session-routing-collision-2026-05-15/sensitivity/`. On the
  current active session set, `threshold_use ±0.05` and
  `disambiguation_gap ±0.05` did not change classification counts. Lowering
  `threshold_low_confidence` to `0.50` increased disambiguated reuse; raising it
  to `0.60` kept the ambiguous cases forced-new.

Current scoring provenance:

- The weighted score is a deterministic heuristic, not an LLM judgment:
  `0.30 * topic_similarity + 0.25 * files_overlap + 0.20 * tags_overlap +
  0.15 * aliases_overlap + 0.10 * recency_score`.
- These weights are engineering defaults from v1. They are transparent and
  testable, but they are not calibrated against a labeled production-routing
  dataset yet.
- Treat current routing as safe-conservative, not optimal. The router is
  designed to avoid wrong-session reuse and may create extra sessions until
  enough real route data exists for calibration.
- Do not claim that a high fuzzy score is objectively correct. It means the
  metadata heuristic found overlap. Correctness must be checked through
  `route_health`, follow-up behavior, collision reports, and eventually a
  labeled routing calibration set.
- Before changing weights, first check whether poor routes had poor caller
  metadata. If `metadata_quality.average_score` is low, improve caller hints
  before tuning thresholds.
- Calibration should wait for real usage: collect route decisions, inspect cases
  with `candidate_gap < 0.15`, label whether the chosen session was actually
  correct, then compare alternative weights. Do not tune weights on synthetic
  examples only.

## Route Calibration Report

Use `npm run route:calibration` to turn accumulated `router_route_decision`
telemetry into an offline calibration queue. The report does not invoke Claude
and does not change routing behavior.

Default command:

```bash
npm run build
npm run route:calibration -- --project-id AgentSessionRouter --recent-hours 168
```

Post-metadata-hints command:

```bash
npm run route:calibration -- --project-id AgentSessionRouter --recent-hours 168 --metadata-only
```

Artifacts are written under `experiments/route-calibration-<date>/`:

- `summary.md`: selected-path counts, suspicious signal counts, and the
  calibration queue
- `calibration-report.json`: full route decisions with parsed `match_reason`,
  candidate gaps, inferred outcome events, follow-up signals, and near-topic
  sessions

Use this report before changing thresholds or score weights. Inspect and label
queued decisions as:

- `correct_reuse`
- `wrong_reuse`
- `correct_new_session`
- `unnecessary_new_session`

Only after labels exist should weights or thresholds be changed. The report is
designed to catch cases like low candidate gaps, ambiguity-forced new sessions,
near-duplicate topics, slow/high-token outcomes after a route, and metadata
parse failures after a route.

`metadata_score` is computed from caller-provided routing hints:

- `topic_hint` from caller: `0.35`
- `related_files` non-empty: `0.35`
- `tags` non-empty: `0.20`
- `task_type` present: `0.10`

Interpretation:

- `1.00`: full metadata
- `0.70-0.99`: good enough for normal inspection
- `0.35-0.69`: weak; improve caller hints before tuning weights
- `<0.35`: poor; router is mostly working from inferred/question-only context

Determinism rule:

- With unchanged registry state, exact/high-confidence/disambiguated routes are
  deterministic because matching is a pure score sort over the current DB rows.
- A forced-new ambiguity route intentionally changes future state: the first call
  creates a new durable session; a repeated same-topic call can then exact-match
  that new session. This is expected, not variance.

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

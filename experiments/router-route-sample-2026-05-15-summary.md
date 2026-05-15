# Router Route Sample Summary - 2026-05-15

## Scope

This run collected live `router_consult` traffic across the major caller-facing states:

- fresh explicit cluster
- stale/needs_prepare explicit cluster with internal fallback
- explicit active session
- secondary/older active session
- exact-topic session reuse
- auto fallback to `claude_consult`
- cost-limit boundary
- shadow comparison drain

Artifacts:

- `experiments/router-route-sample-2026-05-15-full-route/`
- `experiments/router-route-sample-2026-05-15-full-route-b/`
- `experiments/router-route-sample-2026-05-15-post-tool-markup-fix/`
- `experiments/router-monitor-snapshots/2026-05-15-route-sample-postfix.json`

## Sample Size

Live script calls:

| Run | Calls | Failed | Notes |
| --- | ---: | ---: | --- |
| `full-route` | 19 | 0 | Fresh cluster, explicit session, exact-topic, auto fallback |
| `full-route-b` | 25 | 0 | Added stale clusters and secondary sessions |
| `post-tool-markup-fix` | 15 | 9 | Hit `max_consults_per_hour=30`; first 6 cluster/stale calls succeeded |

`router_monitor.route_health` after the runs showed 64 route decisions in the recent window:

| Selected path | Count |
| --- | ---: |
| `cluster_consult_explicit` | 31 |
| `claude_consult_explicit_session` | 17 |
| `claude_consult_existing_session` | 13 |
| `claude_consult_auto` | 3 |

Shadow eval after the runs:

- total comparisons: 115
- judged: 115
- pending: 0
- failed auth/timeout/other: 0

## What Worked

Fresh `agentsessionrouter-codebase` cluster served covered questions reliably.

Latest comparison stats for that cluster:

- `n=25`
- `cluster_q=2.72`
- `direct_q=0.40`
- `cluster_wins=25`
- `direct_wins=0`
- `ties=0`

Important interpretation: this proves the cluster path is operationally strong, but the low direct score is partly a shadow-baseline quality issue. Several direct/shadow answers were tool-call plans or incomplete search intents rather than final answers.

Stale clusters did not break the caller contract. Calls against stale/needs_prepare clusters returned successful tool responses through internal fallback and logged operator-facing recommendations. The caller did not have to decide how to recover.

The cost limiter worked. After the broader live sample exceeded `max_consults_per_hour=30`, session/auto paths returned `COST_LIMIT_EXCEEDED` immediately instead of continuing to spend direct consult budget.

## What Failed Or Looked Weak

### 1. Direct/session fallback can leak pseudo tool calls

Observed examples:

- `<minimax:tool_call>...<invoke name="Glob">...`
- `[TOOL_CALL] {tool => "Read"} [/TOOL_CALL]`

This is not a router crash, but it is not a valid caller-facing answer. It appeared in stale cluster fallback, secondary session, and auto fallback scenarios.

Fix applied after the sample:

- `src/prompt.ts` now explicitly forbids XML/bracketed/pseudo tool calls in consult responses.
- `src/sessionUpdate.ts` now strips pseudo tool-call blocks from caller-facing answer text.
- `src/consult.ts` applies the same cleanup when `SESSION_UPDATE_JSON` parsing fails and it must return the raw answer path.
- `scripts/router-route-sample.mjs` now detects `[TOOL_CALL]` as tool markup.

Live re-verification of session/auto paths was blocked by the hourly consult limit; unit coverage passes.

### 2. Some active sessions contain stale mental models

Examples from live output:

- an older session claimed `route_health` was not a first-class concept after it had already been added
- an older session repeated stale guidance around direct lower-level consult usage

This is expected behavior for durable sessions: they preserve memory, including outdated memory. It means monitor data should treat old sessions as useful but not authoritative unless refreshed by newer decisions.

### 3. Stale clusters remain noisy

Current recommendations still show stale/needs_prepare clusters:

- `agentsessionrouter-codebase-reprepared-2026-05-15-full`
- `claude-code-live-workload`
- `agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3`

They are useful as fallback/revalidation test fixtures, but should not be considered production clusters. They should either be archived or explicitly kept as stale fixtures.

### 4. SESSION_UPDATE_JSON parse failures increased

Monitor recommendations reported 8 recent `SESSION_UPDATE_JSON` parse failures after the live sample. This confirms the earlier concern: answer quality benchmarks do not fully cover metadata update health. Metadata parse health must stay a separate monitor axis.

### 5. Large monitor snapshots can exceed practical response shape

`router-monitor-snapshot` with `sample_limit=80` failed with a non-JSON MCP error. The same snapshot with `sample_limit=30` succeeded. This suggests monitor output needs pagination, truncation, or a documented safe sample limit.

## Operational Conclusions

1. `router_consult` is the right parent-agent entry point, but not because it magically makes every answer cheap. It gives one observable place where route choices, fallbacks, stale clusters, cost limits, and metadata failures are visible.
2. Fresh cluster path is strong for covered questions.
3. Stale cluster path preserves the caller contract through fallback, but fallback quality depends on `claude_consult` answer hygiene.
4. Shadow eval is useful, but its direct baseline currently needs quality hygiene. Do not read low direct scores as a clean proof that direct reasoning is bad.
5. `router_monitor` is doing its job: it surfaced stale clusters, fallback recurrence, direct consult cost bloat, metadata parse failures, and tool-call leakage.

## Next Work

1. Re-run a small post-fix live sample after the hourly consult budget resets, focused on stale fallback, secondary session, and auto fallback. Expected result: no pseudo tool-call blocks in caller-facing answers.
2. Add a targeted metadata health test for `SESSION_UPDATE_JSON` under live-ish `claude_consult` responses. The quality benchmark does not cover this path sufficiently.
3. Add monitor truncation or pagination so high `sample_limit` cannot make snapshot collection fail.
4. Decide what to do with stale clusters: archive them, re-prepare them, or label them as fixtures so monitor recommendations are not polluted.
5. Keep auto cluster routing disabled until route data shows stable patterns. The current conservative router is observable and safe enough.

# SPEC v2.1-lite: Shadow Comparison Eval

## 1. Purpose

Shadow Comparison Eval adds lightweight quality telemetry around `cluster_consult`.

It answers one operational question:

> On real parent-agent questions, is the verified cluster answer as good as an isolated direct Claude baseline?

This layer is observability, not routing. It must not change the answer returned to the parent agent and must not write evaluation artifacts into production session memory.

## 2. Scope

Included in v2.1-lite:

- Optional shadow mode controlled by `[eval].shadow_mode`.
- Background comparison after successful `cluster_consult`.
- Isolated `direct_fresh` baseline for the same question.
- One blind structured judge call.
- One storage table: `consult_comparisons`.
- Read-only MCP tools for stats and recent rows.
- Operator monitor built from shadow comparisons, router status, and cluster events.

Explicitly out of scope:

- Human-in-the-loop review.
- Cross-model judging.
- Multi-step grounded fact checking.
- Automatic routing changes based on judge results.
- Reusing production `claude_consult` sessions as the shadow baseline.

## 3. Architecture

Normal caller path:

```txt
parent agent -> cluster_consult -> cluster answer returned immediately
```

Optional telemetry path:

```txt
successful cluster_consult
  -> schedule background comparison
  -> run isolated direct_fresh Claude baseline
  -> randomly shuffle cluster/direct as answer A/B
  -> run no-tools judge
  -> store scores, errors, preference, and reasoning
```

The parent agent does not wait for the shadow baseline or judge. Shadow failure never changes the cluster answer.

## 4. Isolation Rules

- Shadow eval is disabled by default.
- Shadow baseline uses a fresh Claude prompt, not a production router session.
- Shadow calls do not append session summaries, decisions, files, tags, or aliases to the v1 session registry.
- Judge calls run with `--tools ""` and do not inherit configured Claude extra args.
- Comparison rows can be deleted or ignored without changing router behavior.

The Claude CLI may still create its own raw conversation file for the shadow call. That file is not registered as a durable AgentSessionRouter production session.

## 5. Data Model

### `consult_comparisons`

```sql
CREATE TABLE consult_comparisons (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  cluster_id TEXT,
  question TEXT NOT NULL,

  cluster_answer TEXT,
  cluster_duration_ms INTEGER,
  cluster_cost_usd REAL,
  cluster_was_not_in_context INTEGER NOT NULL DEFAULT 0,

  shadow_method TEXT NOT NULL DEFAULT 'direct_fresh',
  shadow_status TEXT NOT NULL DEFAULT 'pending',
  shadow_error TEXT,
  direct_answer TEXT,
  direct_duration_ms INTEGER,
  direct_cost_usd REAL,

  cluster_score INTEGER,
  direct_score INTEGER,
  preferred TEXT,
  cluster_errors_json TEXT,
  direct_errors_json TEXT,
  judge_reasoning TEXT,
  judged_at TEXT,

  created_at TEXT NOT NULL
);
```

Allowed `shadow_status` values:

- `pending`
- `ok`
- `failed_auth`
- `failed_timeout`
- `failed_other`

Allowed `preferred` values:

- `cluster`
- `direct`
- `tie`

## 6. Judge Prompt

The judge receives the question and two answers labeled only as A and B. The cluster/direct origin is hidden through random shuffling before the prompt is built.

The required JSON shape is:

```json
{
  "answer_a_score": 0,
  "answer_a_errors": ["specific error 1"],
  "answer_b_score": 0,
  "answer_b_errors": ["specific error 1"],
  "preferred": "a|b|tie",
  "reasoning": "one paragraph why"
}
```

Score scale:

- `0`: wrong or hallucinated
- `1`: partial, missed key facts
- `2`: correct but shallow
- `3`: fully correct and substantive

Honest uncertainty or `NOT IN CONTEXT` is acceptable when the answer lacks needed context. It should not be scored the same as a confident hallucination.

## 7. MCP Tools

### `comparison_stats`

Returns aggregate judged comparison stats per cluster:

- row count
- mean cluster score
- mean direct score
- mean score gap (`direct_score - cluster_score`; negative means cluster scored higher)
- cluster wins
- direct wins
- ties

This tool never invokes Claude.

### `comparison_list`

Returns recent comparison rows, optionally filtered by cluster and preferred answer.

By default full answers are replaced with `"[omitted]"` to keep parent-agent context small. Set `include_answers: true` only for diagnosis.

This tool never invokes Claude.

### `router_status`

`router_status` includes shadow-eval health in the broader router status snapshot:

- total comparisons
- judged comparisons
- pending comparisons
- `ok` but unjudged comparisons
- failed shadow baselines by failure class
- last comparison creation and judge timestamps

This makes a stalled or failing shadow pipeline visible without opening SQLite.

### `router_monitor`

`router_monitor` is the intended information monitor for parent agents and operators. It does not invoke Claude. It combines:

- router health and Claude compatibility state
- v1/v2 session and cluster counts
- stale/needs-prepare cluster data
- recent cluster attention events such as fallback and revalidation failures
- shadow comparison quality stats
- direct-win and `NOT IN CONTEXT` samples
- prioritized recommendations
- next-direction hints

This is the layer that turns telemetry into action: whether to re-prepare a factsheet, expand coverage, fix shadow eval, avoid a weak cluster, or consider future auto-routing.

## 8. Failure Handling

- If cluster consult fails, no comparison is scheduled.
- If comparison row insertion fails, the scheduler logs `shadow_comparison_failed` and the caller path remains complete.
- If shadow baseline fails, the comparison is kept with `shadow_status` and `shadow_error`.
- If the judge fails or returns invalid JSON, the scheduler logs `shadow_comparison_failed`; the original cluster answer is already returned.
- Judge runs only after both cluster and direct answers exist.

## 9. Configuration

```toml
[eval]
shadow_mode = false
```

`false` is the production-safe default. Set to `true` when you want passive quality telemetry on real cluster traffic.

## 10. Acceptance Criteria

- `cluster_consult` behavior is unchanged when `shadow_mode = false`.
- With `shadow_mode = true`, successful `cluster_consult` schedules a comparison and returns without waiting for row insertion, direct baseline, or judge completion.
- Shadow direct baseline failure is visible in `shadow_status` and does not affect the caller path.
- Judge calls use no-tools mode and blind A/B order.
- `comparison_stats` and `comparison_list` expose stored telemetry without invoking Claude.
- `router_monitor` exposes combined quality/health recommendations without invoking Claude.
- Unit tests cover DB storage, parser behavior, shadow success/failure, config loading, and MCP tool registration.

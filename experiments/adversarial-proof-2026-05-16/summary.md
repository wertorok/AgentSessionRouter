# Adversarial Proof Matrix

Started: 2026-05-16T18:08:07.095Z
Finished: 2026-05-16T18:08:13.097Z

## Findings

### ZONE 1: Caller sends malformed or huge input

- HELD: oversized_router_consult_100k
  - input: router_consult question length = 100000
  - edge: Would previously enter route/prompt work; must reject before Claude.
  - claude_delta: total=0, by_type={}, cost=$0
- HELD: wrong_schema_metadata
  - input: topic_hint=array, related_files=string, tags include object
  - edge: MCP schema/handler must return a structured validation failure, not stack trace or hang.
- HELD: unsafe_related_files_sanitized
  - input: related_files includes ../../../etc/passwd, /etc/passwd, src/evidence.ts
  - edge: Path hints must not be read or stored if unsafe.
  - claude_delta: total=1, by_type={"consult":1}, cost=$0.003171

### ZONE 2: Concurrency / stale race

- HELD: ten_parallel_same_stale_cluster
  - input: 10 parallel cluster_consult calls, same stale cluster, same question
  - edge: One revalidation failure and one fallback; no factsheet corruption and no N duplicate fallbacks.
  - claude_delta: total=3, by_type={"profile_probe":2,"consult":1}, cost=$0.003591
  - event_counts: {"cluster_created":1,"factsheet_static_verified":1,"cluster_refresh_required":1,"evidence_revalidation_failed":1,"evidence_revalidation_suppressed":9,"cluster_fallback_coalesced":9,"cluster_fallback_to_claude_consult":1}

### ZONE 3: SQLite/session scale and routing precision

- HELD: two_hundred_sessions_routing_scale
  - input: Create 200 sessions through claude_consult, then run router_dry_run/router_consult probes.
  - edge: Routing should not catastrophically slow down or pick unrelated sessions only because N is large.
  - latency: before=3ms, after=60ms
  - scale: seeded=200, total_sessions=202

### ZONE 4: Stale / revalidation / fallback

- HELD: selector_moved_same_content_revalidates
  - input: Same selector/content moved by adding leading lines before it.
  - edge: Line movement alone should revalidate and continue cluster answer.
  - event_counts: {"cluster_created":1,"factsheet_static_verified":2,"cluster_refresh_required":1,"evidence_revalidated":1,"cluster_consult":1}
- HELD: evidence_file_deleted_falls_back
  - input: Delete evidence file, then cluster_consult.
  - edge: Must not answer from stale factsheet; must fallback internally and mark cluster needs_prepare.
  - event_counts: {"cluster_created":1,"factsheet_static_verified":1,"cluster_refresh_required":1,"evidence_revalidation_failed":1,"cluster_fallback_to_claude_consult":1}

### ZONE 5: Tier/API contract misuse

- HELD: caller_direct_cluster_reprepare
  - input: Direct call to [MAINTAIN] cluster_reprepare.
  - edge: Should not corrupt cluster or pretend to be an answer path; returns maintenance payload.
- HELD: caller_direct_comparison_rejudge
  - input: Direct call to [EVAL DEBUG] comparison_rejudge after creating one judged comparison.
  - edge: Should return eval-maintenance structure and may invoke judge once; not a caller answer.
  - claude_delta: total=1, by_type={"judge":1}, cost=$0.004128

### ZONE 6: Cost / loop / shadow burst

- HELD: always_stale_same_question_30
  - input: 30 sequential cluster_consult calls; evidence file changed before every call; same question.
  - edge: Should not grow linearly or exponentially for identical fallback question inside cache TTL.
  - claude_delta: total=1, by_type={"consult":1}, cost=$0.003381
  - event_counts: {"cluster_created":1,"factsheet_static_verified":1,"cluster_refresh_required":1,"evidence_revalidation_failed":1,"cluster_fallback_to_claude_consult":1,"evidence_revalidation_suppressed":29,"cluster_fallback_coalesced":29}
- HELD: always_stale_unique_questions_30
  - input: 30 sequential cluster_consult calls; evidence file changed before every call; unique questions.
  - edge: Should be linear at worst: one fallback per unique question, no repeated revalidation and no recursive loop.
  - claude_delta: total=30, by_type={"consult":30}, cost=$0.110175
  - event_counts: {"cluster_created":1,"factsheet_static_verified":1,"cluster_refresh_required":1,"evidence_revalidation_failed":1,"cluster_fallback_to_claude_consult":30,"evidence_revalidation_suppressed":29}
- HELD: shadow_eval_burst_20
  - input: 20 fast cluster_consult calls against fresh cluster with shadow_mode=true.
  - edge: Shadow eval is bounded to cluster call + direct baseline + judge per successful cluster consult.
  - claude_delta: total=60, by_type={"cluster_consult":20,"shadow_direct":20,"judge":20}, cost=$0.12696
- HELD: single_router_consult_max_claude_calls
  - input: One router_consult with explicit cluster_id and shadow_mode=true.
  - edge: Caller-path max should be one Claude call before answer; shadow adds two async telemetry calls after.

### ZONE 6B: Cost/rate limit proof

- HELD: rate_limit_caps_unique_stale_fallback
  - input: 12 unique cluster_consult calls against one stale cluster with max_consults_per_hour=5
  - edge: Fallback cost must be capped instead of unbounded Claude calls.
  - claude_delta: total=7, by_type={"profile_probe":2,"consult":5}, cost=$0.018429

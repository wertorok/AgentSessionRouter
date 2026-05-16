# SPEC v2: Cluster Cache and Fork Layer

## 1. Purpose

Cluster Cache and Fork Layer extends AgentSessionRouter with reusable exploration artifacts.

The goal is not to minimize tokens at any cost. The goal is to stop repeating solved discovery work and reuse completed, verified exploration runs safely.

The layer adds:

- Verified factsheets per project cluster.
- Tool profiles that control Claude Code invocation shape.
- Optional baseline Claude sessions used only as fork sources.
- Deterministic cache freshness checks.
- Automated verification instead of human review.

The measured motivation is documented in `docs/EXPERIMENTS.md`:

- Broad exploration consult: 264.8s, 56,051 input tokens, `Agent` + `Glob` + `Read`.
- Fresh `--bare --tools ""` with verified factsheet: 36.8s, 1,170 input tokens.
- Fork from bare factsheet baseline: 11.5s, 2,002 input tokens.

## 2. Relationship to v1

v1 remains intact.

Existing tools keep their current semantics:

- `claude_sessions_list`
- `claude_consult`
- `claude_session_archive`
- `claude_session_inspect`
- `claude_router_reset`

v2 is opt-in. It adds cluster-scoped tools and storage. No existing consult is automatically routed into a cluster in the MVP.

Current implementation status:

- Implemented: Phase 0 schema/storage.
- Implemented: Phase 1 direct `cluster_prepare` with static local-file verification.
- Implemented: Phase 2 LLM verifier loop as an explicit `verification_mode: "llm"` path.
- Implemented: Phase 3 profile args, `bare`/`focused` probes, and deterministic `bare -> focused` downgrade.
- Implemented: Phase 4 `cluster_consult` without fork, with append-system-prompt factsheet injection, strict stale evidence revalidation, and fallback to `claude_consult` when cache evidence cannot be proven valid.
- Implemented: Phase 6 `cluster_refresh` in `verify_only` mode and stale factsheet state.
- Implemented early for observability: read-only `cluster_get` and `cluster_list`.
- Implemented separately: v2.1-lite optional shadow comparison telemetry. See `docs/SHADOW_EVAL_SPEC.md`.
- Deferred post-MVP: fork baseline, architectural-memory distillation from existing sessions, and automatic cluster routing.

The current `cluster_prepare` accepts direct factsheet JSON and stores only facts whose evidence passes deterministic local checks. By default these factsheets are marked `static_verified`, not `llm_verified`, because static checks prove evidence existence but not full semantic correctness. When `verification_mode` is `llm`, Claude is invoked with a no-tools verifier prompt and only `VERIFIED` facts are promoted to `llm_verified`.

## 3. Core Terms

### Cluster

A named, project-scoped knowledge area such as:

- `router-ops-diagnostics`
- `config-and-cwd-isolation`
- `test-and-smoke-harness`
- `github-issues-triage`

For MVP, callers provide `cluster_id` explicitly. Auto-cluster routing is out of scope until the cache mechanics are proven.

### Factsheet

A compact, verified artifact containing only facts that are backed by evidence.

Factsheet is the source of truth. It must be transparent, diffable, versioned, and invalidatable.

### Baseline Session

A Claude session prepared from a verified factsheet. It may be resumed with `--fork-session` to answer follow-up questions without resending the whole factsheet.

Baseline sessions are acceleration state, not authority. They are opaque and can carry unwanted model state, so they must stay narrowly cluster-scoped.

### Tool Profile

The invocation policy used for a cluster consult:

- `bare`: `claude -p --bare --tools ""`
- `focused`: `claude -p --tools ""` or explicit allow/deny args when `--bare` is unavailable
- `agent`: normal Claude Code tool access for fresh discovery

## 4. Non-Goals

- No human review loop in runtime.
- No automatic escalation of the factsheet-backed path to full `agent` mode.
- Caller-facing `cluster_consult` falls back to normal `claude_consult` when cache evidence cannot be proven valid, because the router must return an answer when another available path can answer.
- No opaque fork session as the only knowledge store.
- No whole-repository invalidation when only scoped evidence files matter.
- No automatic cluster selection in MVP.
- No distributed worker architecture in MVP.

## 5. Data Model

### `clusters`

```sql
CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tool_profile_default TEXT NOT NULL DEFAULT 'bare',
  static_factsheet_policy TEXT NOT NULL DEFAULT 'deny',
  baseline_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  trust_state TEXT NOT NULL DEFAULT 'unprepared',
  created_at TEXT NOT NULL,
  last_used TEXT NOT NULL,
  UNIQUE(project_id, id)
);
```

Allowed `status` values:

- `active`
- `stale`
- `invalidated`
- `archived`

Allowed `trust_state` values:

- `unprepared`
- `static_verified`
- `llm_verified`
- `partial_static`
- `partial_llm`
- `untrusted`

### `cluster_factsheets`

```sql
CREATE TABLE cluster_factsheets (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  source_session_id TEXT,
  baseline_session_id TEXT,
  git_rev TEXT,
  generated_at TEXT NOT NULL,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  FOREIGN KEY(cluster_id) REFERENCES clusters(id)
);
```

Allowed `status` values:

- `draft`
- `static_verified`
- `llm_verified`
- `rejected`
- `stale`

### `cluster_file_hashes`

```sql
CREATE TABLE cluster_file_hashes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id TEXT NOT NULL,
  factsheet_id TEXT NOT NULL,
  path TEXT NOT NULL,
  hash TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  last_verified TEXT NOT NULL,
  FOREIGN KEY(cluster_id) REFERENCES clusters(id),
  FOREIGN KEY(factsheet_id) REFERENCES cluster_factsheets(id)
);
```

### `cluster_events`

```sql
CREATE TABLE cluster_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details_json TEXT,
  duration_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL
);
```

Suggested event types:

- `cluster_created`
- `factsheet_generated`
- `factsheet_static_verified`
- `factsheet_partially_static_verified`
- `factsheet_llm_verified`
- `factsheet_partially_llm_verified`
- `factsheet_rejected`
- `factsheet_stale`
- `baseline_created`
- `baseline_forked`
- `tool_profile_downgraded`
- `bare_probe_failed`
- `cluster_consult`
- `cluster_fallback_failed`
- `cluster_fallback_to_claude_consult`
- `cluster_refresh_required`
- `evidence_revalidated`
- `evidence_revalidation_failed`
- `evidence_revalidation_suppressed`
- `cluster_fallback_coalesced`

## 6. Factsheet Format

Factsheets are structured JSON, not free prose.

Current implementation stores fact-level evidence metadata inside `cluster_factsheets.content_json`. There is no separate `cluster_facts` table yet; `cluster_file_hashes` remains the file-level index, while `selector` and `snippet_hash` live on each evidence entry.

```json
{
  "schema_version": 1,
  "cluster_id": "config-and-cwd-isolation",
  "summary": "Cwd and Claude CLI invocation behavior for AgentSessionRouter.",
  "facts": [
    {
      "id": "fact.routerconfig.claude.extra_args",
      "claim": "RouterConfig.claude.extraArgs exists and is appended before router-managed output/resume/prompt args.",
      "confidence": "static_verified",
      "evidence": [
        {
          "path": "src/config.ts",
          "hash": "sha256:...",
          "selector": "RouterConfig.claude.extraArgs",
          "snippet_hash": "sha256:..."
        },
        {
          "path": "src/claude.ts",
          "hash": "sha256:...",
          "selector": "CliClaudeAdapter.runPrompt",
          "snippet_hash": "sha256:..."
        }
      ]
    }
  ],
  "pitfalls": [
    {
      "id": "pitfall.broad_prompt_exploration",
      "text": "Broad planning prompts can trigger Agent/Glob/Read discovery and large token use."
    }
  ],
  "forbidden_inferences": [
    "Do not invent config keys not present in RouterConfig.",
    "If a fact is absent from this factsheet, answer NOT IN CONTEXT."
  ]
}
```

Allowed fact confidence values:

- `static_verified`
- `llm_verified`
- `ambiguous`
- `unverified`

Only `llm_verified` facts are injected into `bare` consult prompts by default after Phase 2. During Phase 1, `static_verified` factsheets are inspectable and seedable but should not be treated as final semantic truth.

## 7. Tool Profiles

### `bare`

Used when factsheet is complete and verified.

CLI shape:

```bash
claude -p --bare --tools "" --output-format json "<prompt>"
```

Properties:

- Lowest measured cost.
- No tools.
- No Claude Code project auto-discovery.
- May fail on machines where `--bare` cannot authenticate.

### `focused`

Used when `bare` probe fails or the task requires bounded file access.

CLI shape examples:

```bash
claude -p --tools "" --output-format json "<prompt>"
```

or:

```bash
claude -p --disallowedTools "Agent,Glob,Bash" --output-format json "<prompt>"
```

Properties:

- Still avoids broad agent exploration.
- More portable than `bare`.
- More expensive than `bare` in measured runs.

### `agent`

Used only for explicit exploration or refresh.

CLI shape:

```bash
claude -p --output-format json "<prompt>"
```

Properties:

- Can use `Agent`, `Glob`, `Read`, and other Claude Code tools.
- Expensive and less bounded.
- Never selected automatically for a user consult in MVP.

## 8. Auth and Profile Probing

On first profile-gated cluster use:

1. Run a short `bare` probe:

   ```bash
   claude -p --bare --tools "" --output-format json "Return exactly: PROFILE_OK"
   ```

2. If it succeeds, mark `bare_available = true`.
3. If it fails, record `bare_probe_failed` and use `focused` where a cluster default says `bare`.
4. Probe `focused` with `--tools ""`; if focused is also unavailable, fail closed.

The downgrade is deterministic:

```txt
bare -> focused
focused -> focused
agent -> agent only when explicitly requested
```

The router must not silently escalate `bare` or `focused` to `agent`.

## 9. Automated Verification

No human-in-loop is required.

Verification has three layers.

### Static Verifier

Validates facts against local files:

- `path` exists.
- File hash matches.
- File size matches.
- Selector or evidence string is present.
- JSON paths in `package.json` or TOML config can be parsed.
- Public API/config keys named in the factsheet exist in the evidence file.

Static verifier is deterministic and runs before LLM verification.

### LLM Verifier

Runs with `bare` profile when available, otherwise `focused` no-tools profile.

Verifier prompt:

```txt
You are verifying a factsheet.
For each claimed fact, return VERIFIED only if the supplied evidence supports it.
Return UNVERIFIED if support is missing.
Return AMBIGUOUS if the evidence is related but insufficient.
Do not infer.
Do not use tools.
```

LLM verifier output:

```json
{
  "facts": [
    {
      "id": "fact.routerconfig.claude.extra_args",
      "verdict": "VERIFIED",
      "reason": "Evidence includes RouterConfig.claude.extraArgs and runPrompt arg composition."
    }
  ]
}
```

Only `VERIFIED` facts are promoted into the stored factsheet.

### Runtime Verifier

Before every `cluster_consult`:

- Check factsheet status is `llm_verified` for normal consults, or explicitly allow `static_verified` while Phase 2 is not implemented.
- Check all scoped file hashes.
- Check baseline session exists if fork is requested.
- Check selected tool profile is available.

If a check fails, return a structured diagnostic. Do not guess and do not auto-escalate to `agent`.

## 10. New MCP Tools

### `cluster_prepare`

Creates or refreshes a cluster factsheet.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "description": "Cwd, project isolation, and Claude CLI invocation behavior.",
  "source_session_id": "session_...",
  "verification_mode": "llm",
  "llm_verifier_profile": "focused",
  "create_baseline": true
}
```

Behavior:

1. Resolve project id.
2. Load source registry data from `source_session_id` if provided.
3. If source is missing, run explicit exploration with `agent` profile only if requested.
4. Distill draft factsheet.
5. Run static verifier.
6. If `verification_mode` is `llm`, run LLM verifier with `--tools ""` or `--bare --tools ""`.
7. Store `static_verified` or `llm_verified` factsheet.
8. Hash evidence files.
9. Optionally create a baseline Claude session using the verified factsheet.

Output:

```json
{
  "cluster_id": "config-and-cwd-isolation",
  "factsheet_id": "factsheet_...",
  "factsheet_version": 1,
  "trust_state": "llm_verified",
  "baseline_session_id": "claude-session-id-or-null",
  "verified_facts": 12,
  "rejected_facts": 3
}
```

### `cluster_get`

Returns cluster metadata and the current factsheet.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "include_factsheet": true
}
```

Output:

```json
{
  "cluster": {
    "id": "config-and-cwd-isolation",
    "project_id": "AgentSessionRouter",
    "status": "active",
    "trust_state": "llm_verified",
    "tool_profile_default": "bare",
    "static_factsheet_policy": "deny",
    "baseline_session_id": "..."
  },
  "factsheet": {
    "id": "factsheet_...",
    "version": 1,
    "status": "llm_verified",
    "verified_at": "2026-05-12T00:00:00.000Z",
    "content": {}
  }
}
```

### `cluster_consult`

Consults Claude using a verified factsheet. Phase 4 does not use fork sessions; fork support is Phase 5.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "question": "Which cwd isolation issues remain?",
  "tool_profile": null
}
```

Behavior:

1. Resolve project and cluster.
2. Return `CLUSTER_PROJECT_MISMATCH` directly if the cluster belongs to another project. This is a security boundary.
3. Check factsheet trust against cluster `static_factsheet_policy`.
   - `llm_verified` factsheets are trusted.
   - `static_verified` factsheets are trusted only when cluster metadata has `static_factsheet_policy = 'allow'`.
   - This is not a per-call caller decision.
4. Select tool profile:
   - explicit input profile if provided,
   - cluster default otherwise,
   - deterministic downgrade from `bare` to `focused` if bare probe failed.
5. Check scoped evidence file hashes.
6. If hashes changed and `[cluster].auto_refresh = true`, strict-revalidate every cited selector and `snippet_hash` under a per-cluster lock.
7. If cache evidence is trusted and current, inject the factsheet with `--append-system-prompt`.
8. If the cluster is missing, has no usable factsheet, is not trusted enough, or evidence cannot be proven valid, fall back internally to normal `claude_consult`.
9. Return a caller-visible answer whenever either the cluster path or fallback path can answer.
10. Log cluster event metrics for cache consults, revalidation, and fallback.

Cluster-path output follows `claude_consult` shape with cluster metadata:

```json
{
  "cluster_id": "config-and-cwd-isolation",
  "factsheet_version": 1,
  "factsheet_status": "llm_verified",
  "used_fork": false,
  "tool_profile": "bare",
  "claude_session_id": "new-session-id",
  "answer": "...",
  "metrics": {
    "duration_ms": 11500,
    "tokens_in": 2002,
    "tokens_out": 458,
    "cost_usd": 0.0215
  }
}
```

### `cluster_refresh`

Revalidates or regenerates a cluster factsheet.

Input:

```json
{
  "project_id": null,
  "cluster_id": "config-and-cwd-isolation",
  "mode": "verify_only"
}
```

Allowed `mode` values:

- `verify_only`: recheck hashes and evidence selectors.
- `focused_refresh`: update facts from scoped files only.
- `agent_refresh`: explicit broad exploration.

MVP should implement `verify_only` first.

### `cluster_list`

Lists clusters for a project.

Input:

```json
{
  "project_id": null,
  "include_archived": false
}
```

Output:

```json
{
  "project_id": "AgentSessionRouter",
  "clusters": [
    {
      "id": "config-and-cwd-isolation",
      "status": "active",
      "trust_state": "llm_verified",
      "tool_profile_default": "bare",
      "static_factsheet_policy": "deny",
      "factsheet_version": 1,
      "baseline_session_id": "..."
    }
  ]
}
```

## 11. Invalidation

Factsheet freshness is scoped to evidence, not to the whole repository.

On every `cluster_consult`, compare current file hashes to `cluster_file_hashes` for the active factsheet. A file-level mismatch does not by itself prove the fact is invalid; it only triggers strict evidence revalidation.

Caller-facing MCP `cluster_consult` treats changed evidence as recoverable only when `[cluster].auto_refresh = true` and the router can prove every cited snippet is unchanged:

1. Detect changed scoped evidence by file hash.
2. Acquire a per-cluster evidence-revalidation lock.
3. For every fact, find each cited `selector` in the current file.
4. Recompute the `snippet_hash` for the selector evidence window.
5. If every required selector is present and every snippet hash matches, store a new factsheet version with updated file hashes and continue the consult in the same MCP call.
6. If any required selector is missing or any snippet hash changed, log `evidence_revalidation_failed`, mark the cluster `needs_prepare`, and do not consult from a partial factsheet.
7. The caller-facing MCP tool then falls back internally to normal `claude_consult` with the same question and returns that answer. The caller should not spend tokens deciding how to recover from cache health.
8. After a failed revalidation, repeated attempts for the same cluster enter a short cooldown and log `evidence_revalidation_suppressed` instead of rechecking identical broken evidence.
9. Identical fallback questions for the same decayed cluster may be coalesced through a short pending/result cache and logged as `cluster_fallback_coalesced`.

Evidence revalidation is all-or-nothing for facts: any rejected fact fails the revalidation path. The retained-ratio config remains strict by default (`1.0`) and is not a license to answer from partially revalidated programming facts.

If the lower-level service is called directly, stale evidence returns:

```json
{
  "error": {
    "code": "CLUSTER_FACTSHEET_STALE",
    "message": "Cluster factsheet is stale. Run cluster_refresh before consulting.",
    "cluster_id": "config-and-cwd-isolation",
    "changed_files": ["src/config.ts"]
  }
}
```

Do not invalidate on unrelated repository changes.

Policy options:

- `strict`: return stale error.
- `auto_revalidate`: run selector/snippet evidence revalidation automatically.
- `fallback`: use normal `claude_consult` when the cache path cannot safely answer.

Current caller-facing default: `auto_revalidate` through `[cluster].auto_refresh = true`, then `fallback` if revalidation cannot prove the cache valid. If `[cluster].auto_refresh = false`, caller-facing `cluster_consult` skips revalidation and goes straight to `fallback`.

## 12. Routing Policy

MVP uses explicit cluster id only.

```json
{
  "cluster_id": "router-ops-diagnostics",
  "question": "..."
}
```

No automatic cluster selection in MVP.

Future options:

- Match by tags/files/factsheet terms.
- Let a proxy agent choose cluster from `cluster_list`.
- Hybrid route to cluster first, then session within cluster.

These must not be implemented until cluster mechanics are measured and stable.

## 13. Failure Modes

### Bare Unavailable

Cause:

- No API key or compatible auth for `--bare`.
- Claude CLI version does not support `--bare`.

Behavior:

- Log `bare_probe_failed`.
- Downgrade `bare` cluster calls to `focused`.
- Do not downgrade to `agent`.

### Factsheet Stale

Cause:

- Evidence file hash mismatch.

Behavior:

- Caller-facing `cluster_consult` revalidates evidence when `[cluster].auto_refresh = true`.
- If all required selectors and snippet hashes still match, write `evidence_revalidated` and continue the consult.
- If any selector is missing or any snippet changed, mark the cluster `needs_prepare`, write `evidence_revalidation_failed`, fall back internally to `claude_consult`, and return the fallback answer.
- Do not silently consult stale facts.
- Return a caller-visible error only if fallback cannot answer either, for example when Claude invocation fails.

### Factsheet Verification Fails

Cause:

- Static verifier cannot find evidence.
- LLM verifier marks too many facts `UNVERIFIED` or `AMBIGUOUS`.

Behavior:

- Store rejected draft for audit if useful.
- Mark cluster `untrusted` or `partial`.
- Do not create baseline.

Suggested threshold:

- If more than 50 percent of facts are rejected, reject whole factsheet.
- Otherwise store only verified facts and mark omitted count.

### Fork Fails

Cause:

- Baseline session missing.
- Claude resume/fork fails.

Behavior:

- If factsheet is fresh, fallback to fresh factsheet consult in same selected profile.
- Log `baseline_fork_failed`.
- Do not fallback the factsheet/fork path to `agent`; use normal `claude_consult` as the caller-facing recovery path when cache evidence is invalid.

### Answer Needs Missing Facts

Behavior:

- Claude should return `NOT IN CONTEXT`.
- Router records the missing fact request for later refresh.

## 14. Prompt Contracts

### Cluster Consult Prompt Footer

Every factsheet-backed consult should end with:

```txt
Use only the verified factsheet and the user's question.
If a fact is not present in the factsheet, write NOT IN CONTEXT.
Do not infer config keys, function names, files, or behavior.
Do not use tools unless the selected profile explicitly allows them.
Keep scope to the user's question.
```

### Fork Consult Prompt Footer

Forked consults need an additional constraint:

```txt
You are in a fork from a verified cluster baseline.
Use the baseline factsheet only for context.
Do not introduce new architecture unless explicitly asked.
Do not choose a new next experiment unless the user asks for one.
```

This mitigates fork-induced drift.

## 15. Metrics

Every cluster invocation must log:

- `duration_ms`
- `tokens_in`
- `tokens_out`
- `cache_creation_input_tokens` if available
- `cache_read_input_tokens` if available
- `cost_usd` if available
- `tool_profile`
- `used_fork`
- `factsheet_version`
- `tool_calls` if observable
- `bare_available`

Metrics are first-class because cluster design is justified by measured performance.

## 16. MVP Implementation Order

### Phase 0: Schema Only

- Add cluster tables.
- Add migrations/tests for `clusters`, `cluster_factsheets`, `cluster_file_hashes`, and `cluster_events`.
- Do not add MCP tools yet.
- No Claude calls yet.

### Phase 1: Static Factsheet Seed

- Add `cluster_prepare` with direct supplied factsheet JSON in dev/test mode.
- Run static verifier.
- Store verified factsheet and hashes.
- No LLM verifier in this phase; no distillation or baseline session yet.

This phase avoids building auto-distillation before storage and verification are proven.

### Phase 2: LLM Verifier Loop

- Add verifier prompt and parser.
- Run verifier in `bare` no-tools mode when available, otherwise focused no-tools mode.
- Promote only `VERIFIED` facts.
- Reject or mark partial factsheets according to verification thresholds.
- Test verifier quality independently from `cluster_prepare`.

### Phase 3: Bare Probe and Profiles

- Add bare availability probe.
- Add profile-to-CLI-args builder.
- Add tests for `bare`, `focused`, and `agent` arg construction.
- Do not escalate from `bare` or `focused` to `agent`.

### Phase 4: Cluster Consult Without Fork

- Add `cluster_consult`.
- Support fresh factsheet inline mode.
- Log metrics.
- Do not implement `--fork-session` yet.

### Phase 5: Fork From Baseline (Deferred)

- Optional post-MVP optimization. Add baseline session creation from a verified factsheet only if observed latency or cost makes it worthwhile.
- Add `cluster_consult` fork path with `--resume <baseline_session_id> --fork-session`.
- Preserve baseline session; every fork must produce a distinct Claude session id.
- Measure fresh factsheet versus forked factsheet costs separately.

### Phase 6: Refresh and Invalidation

- Add `cluster_refresh` with `verify_only`.
- Add stale error path.
- Implemented: `cluster_consult` detects changed scoped evidence files, marks the factsheet stale, and records a refresh-required event.
- Implemented: `cluster_refresh` rechecks the latest factsheet's scoped file hashes/selectors without invoking Claude.
- Implemented: caller-facing `cluster_consult` performs strict selector/snippet evidence revalidation under a per-cluster lock when changed file hashes are detected.
- Implemented: caller-facing `cluster_consult` falls back to normal `claude_consult` when strict revalidation fails, while marking the cluster `needs_prepare`.

### Inspect Tools (Implemented Early)

- Add `cluster_list`.
- Add `cluster_get`.
- Keep these read-only and independent from Claude invocation.

### Phase 7: Architectural Memory Distill (Post-MVP)

- Add draft factsheet generation from session registry metadata and raw response paths.
- Feed draft through static verifier and LLM verifier.
- Promote verified facts only.

#### Decision: Architectural Memory Pipeline (Proposed, Not Implemented)

Status: proposed. This section records the architectural decision only; it does
not authorize implementation yet.

Phase 7 is no longer treated as a narrow "turn v1 sessions into factsheets"
task. The proposed scope is an architectural-memory pipeline:

```txt
SQLite session_decisions table / phase summaries / existing specs
  -> distill
  -> classify as project-scoped or transferable
  -> verify
  -> seed future lead sessions and cluster factsheets
```

The pipeline has two memory products:

- `project-architecture`: project-scoped decisions and rationale. These remain
  under the current `project_id` / MCP `cwd` boundary and may be served through a
  normal project cluster.
- `engineering-principles`: transferable engineering invariants. These are not
  a hidden mutable global cluster. Their source of truth must be a transparent
  document or importable template first, and only later may be served through a
  cluster for low-token consults.

Classification policy:

- Codex may run the first classification pass automatically.
- Project-specific signals such as repository names, file paths, issue ids,
  local schema names, or one-off workflow constraints default to
  `project-architecture`.
- Transferable candidates must go through a staging state before promotion to
  `engineering-principles`.
- The durable Claude lead session reviews staged transferable candidates through
  `router_consult`. The human owner is not a manual curator; they only receive
  the phase-end summary.

Principles must be advisory and scoped, not dogma. Each transferable principle
must carry at least:

- stable id
- statement
- `applies_when`
- `revisit_when`
- provenance: source session/doc/phase/date
- status: `proposed`, `active`, `suspended`, or `superseded`
- optional counter-evidence / suspension note

The exact source-of-truth file name and storage backend are not decided yet, but
the entry shape is already part of this decision. A future diffable principle
document must support entries shaped like:

```yaml
- id: EP-0001
  status: proposed
  statement: "Caller-facing router tools should return an answer whenever any safe internal recovery path exists."
  applies_when:
    - "caller is another automated agent"
    - "router can recover internally without credentials, destructive actions, or product-scope approval"
  revisit_when:
    - "the caller contract changes to require explicit cache-health errors"
    - "internal fallback creates unacceptable cost or latency in router_monitor"
  provenance:
    source_type: session_decision
    source_ref: "session:<id> / docs:<path> / experiment:<path>"
    derived_at: "YYYY-MM-DD"
    derived_by: "codex"
    reviewed_by: "claude-lead-session"
  counter_evidence: []
  supersedes: null
```

Using a principle means "check this applies in the current context", not "always
do this". A lead session may reject or suspend a principle in a new context when
it records counter-evidence and the scope condition that failed.

Project isolation rule:

- Normal router storage remains project-scoped by MCP process `cwd` and
  `project_id`.
- Transferable principles are shared only by explicit import from a canonical
  document/template or a future per-user global store. They must not silently
  mutate every project.
- A future `engineering-principles` cluster is a serving/index layer over that
  explicit source of truth, not the authority itself.

Bootstrap policy:

- No required human-written seed file.
- Codex may derive the first seed from existing project docs and
  the SQLite `session_decisions` table, then ask the durable Claude lead session
  to review the distilled candidates.
- The human owner receives a phase-end summary of what was seeded and why, but
  does not hand-curate the initial list.

Distill mechanism boundary:

- Decided: Phase 7 needs a distill step that turns existing decisions/docs into
  staged project-architecture and engineering-principle candidates.
- Not yet designed: the extraction prompt, scoring rules, hallucination checks,
  over-extraction limits, and reviewer rubric for deciding whether a candidate
  was actually supported by the source decision.
- Do not build distill extraction in the same step as the principle document
  structure. First design the diffable source-of-truth structure and dry-run
  report shape. Only then design the LLM extraction/review mechanism.
- Distill has the same risk class as `cluster_prepare`: it can over-extract,
  over-generalize, or invent a principle that was not present in the source
  decision. It must therefore have explicit evidence/provenance and lead-session
  review before promotion.

#### Data/Model Spec (Gate 1)

This subsection defines the source-of-truth data shapes and dry-run report
shape. It does not define extraction prompts, storage tables, runtime
evaluation, or cluster serving behavior.

##### A. `project-architecture` Record

Project-architecture records capture decisions that are useful inside one
project but should not automatically travel to other projects.

```yaml
- id: PA-0001
  topic: "short project-specific topic"
  decision: "what was decided"
  rationale: "why this decision was chosen, including relevant alternatives"
  project_scope:
    project_id: "AgentSessionRouter"
    boundary_ref: "stable repository/project boundary this applies to"
  provenance:
    source_type: phase_summary
    source_ref: "docs:<path> / experiment:<path> / session:<id>"
    source_date: "YYYY-MM-DD"
  status: active
  superseded_by: null
```

Required fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable project-scoped id, prefixed `PA-`. |
| `topic` | string | Short descriptor for lookup and review. |
| `decision` | string | The project-specific decision. |
| `rationale` | string | Why the decision was made and what alternatives mattered. |
| `project_scope.project_id` | string | Project identity the record belongs to. |
| `project_scope.boundary_ref` | string | Stable repository/project boundary, such as a git remote, configured project id, or documented project root identity. Do not rely on a transient process cwd string alone. |
| `provenance.source_type` | enum | `phase_summary`, `experiment`, `spec`, or `session_decision`. |
| `provenance.source_ref` | string | Diffable doc path, experiment path, or session id. |
| `provenance.source_date` | date | Date of the source decision or evidence. |
| `status` | enum | `active` or `superseded`. |
| `superseded_by` | string/null | Replacement `PA-*` id when status is `superseded`. |

##### B. `engineering-principles` Record

Engineering-principle records capture transferable guidance. They are advisory
and scoped. They are not unconditional rules.

```yaml
- id: EP-0001
  status: proposed
  statement: "Caller-facing router tools should return an answer whenever any safe internal recovery path exists."
  applies_when:
    - "caller is another automated agent"
    - "router can recover internally without credentials, destructive actions, or product-scope approval"
  revisit_when:
    - "the caller contract changes to require explicit cache-health errors"
    - "internal fallback creates unacceptable cost or latency in router_monitor"
  provenance:
    source_type: session_decision
    source_ref: "session:<id> / docs:<path> / experiment:<path>"
    derived_at: "YYYY-MM-DD"
    derived_by: "codex"
    reviewed_by: "claude-lead-session"
  suspensions: []
  superseded_by: null
```

Required fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable transferable id, prefixed `EP-`. |
| `status` | enum | `proposed`, `active`, `suspended`, or `superseded`. |
| `statement` | string | Advisory principle text. |
| `applies_when` | string[] | Scope conditions that must be checked before applying the principle. |
| `revisit_when` | string[] | Trigger conditions for re-review. |
| `provenance.source_type` | enum | `phase_summary`, `experiment`, `spec`, or `session_decision`. |
| `provenance.source_ref` | string | Diffable doc path, experiment path, or session id. |
| `provenance.derived_at` | date | Date the candidate was derived. |
| `provenance.derived_by` | enum | `codex` or `claude-lead-session`, depending on who originated the candidate. |
| `provenance.reviewed_by` | string/null | Lead-session review identity, or null while still staged. |
| `suspensions` | suspension[] | Counter-evidence log for suspended applicability. |
| `superseded_by` | string/null | Replacement `EP-*` id when status is `superseded`. |

Suspension entries use this shape:

```yaml
- suspended_at: "YYYY-MM-DD"
  reason: "why the principle should not apply in this context"
  counter_evidence: "specific evidence that narrowed or invalidated applicability"
  lead_session_ref: "session:<id>"
  resolved_at: null
  resolution: null
```

##### C. Staging State Machine

Staging is the review state before a candidate becomes authoritative. Rejected
candidates may appear in a dry-run report, but they do not become durable memory.

Valid transitions:

| From | To | Meaning |
| --- | --- | --- |
| `proposed` | `active` | Candidate passed Codex review and durable lead-session review. |
| `proposed` | `rejected` | Candidate failed review and is discarded after the dry-run/report. |
| `active` | `suspended` | Lead session recorded counter-evidence or failed applicability. |
| `active` | `superseded` | A newer record replaces this one. |
| `suspended` | `active` | Lead session revokes suspension after scope/rationale update. |

Rejection paths:

- `rejected_project_noise`: candidate was too project-specific for
  `engineering-principles`.
- `rejected_unsupported`: candidate was not sufficiently supported by
  provenance.

##### D. Dry-Run Report Shape

A future Gate 2 dry run should produce a report shaped like this and should not
write durable memory.

```markdown
# Architectural Memory Distill Dry-Run Report

Generated: YYYY-MM-DDTHH:mm:ssZ
Project: <project_id>
Source rows reviewed: <N>
Source docs reviewed: <N>
Skipped as non-distillable: <N>

## Project-Architecture Candidates

| id | topic | decision | provenance.source_type | provenance.source_ref | status |
| --- | --- | --- | --- | --- | --- |
| PA-0001 | ... | ... | session_decision | session:<id> | proposed |

## Engineering-Principle Candidates

| id | statement | applies_when | provenance.source_type | provenance.source_ref | status |
| --- | --- | --- | --- | --- | --- |
| EP-0001 | ... | ... | spec | docs:<path> | proposed |

## Rejected Candidates

| source_ref | rejection_code | reason |
| --- | --- | --- |
| session:<id> | rejected_project_noise | ... |

## Notes

- signal_quality: <high|medium|low>
- duplicate_candidates: <N>
- reviewer_observations: ...
```

#### Scorer/Rubric Rules (Gate 3)

Gate 3 makes the Gate 2 classification explicit and auditable. It adds
deterministic scoring to the dry-run report and documents every signal. It does
not add LLM extraction, semantic rewriting, durable memory promotion, cluster
writes, or runtime principle evaluation.

Allowed project-architecture signals:

| Signal | Meaning |
| --- | --- |
| `project_file_path` | Candidate text mentions a project file path such as `src/...`, `docs/...`, `scripts/...`, or a known repository file. |
| `project_identity` | Candidate text mentions the current project name, package name, or git repository identity. |
| `current_project_session` | Candidate comes from the current project's SQLite `session_decisions` table. |
| `repo_feature_name` | Candidate text mentions a feature specific to this router, such as `router_consult`, `cluster_consult`, `cluster_reprepare`, `shadow_eval`, `SESSION_UPDATE_JSON`, or `router_monitor`. |
| `version_or_phase_marker` | Candidate text mentions a release, version, phase, gate, benchmark id, or project milestone. |

Allowed engineering-principle signals:

| Signal | Meaning |
| --- | --- |
| `normative_language` | Candidate text uses advisory rule language such as `must`, `should`, `never`, `always`, `invariant`, or `principle`. |
| `generic_agent_or_router_pattern` | Candidate text describes a pattern that can apply to any agent/router system, not only this repository. |
| `generic_contract_language` | Candidate text mentions caller contracts, interfaces, boundaries, observability, fallback, or verification without a project-only file/schema dependency. |
| `no_project_specific_signal` | Candidate has no project-specific signal and has at least one other transferable signal. |
| `spec_source` | Candidate comes from a spec/maintenance document section rather than a session-only decision. |

Scoring formula:

```txt
project_score = count(project_signals)
transferable_score = count(engineering_principle_signals)

classification =
  project-architecture      if project_score > transferable_score
  engineering-principles    if transferable_score > project_score
  ambiguous                 otherwise

confidence =
  high      if abs(project_score - transferable_score) >= 2
  medium    if abs(project_score - transferable_score) == 1
  low       if abs(project_score - transferable_score) == 0
```

Rejection rules:

| Code | Meaning |
| --- | --- |
| `rejected_too_short` | Candidate text is shorter than 20 characters after trimming. |
| `rejected_duplicate` | Candidate text exactly duplicates an earlier candidate in the same dry run after whitespace/case normalization. |
| `rejected_no_signal` | Candidate has zero project signals and zero transferable signals. |

Scoring statuses are separate from lifecycle statuses. Gate 3 may emit
`project-architecture`, `engineering-principles`, `ambiguous`, or one of the
`rejected_*` codes. Lifecycle statuses remain `proposed`, `active`,
`suspended`, and `superseded`; Gate 3 only emits `proposed` candidates.

Gate 3 dry-run reports must add:

- `project_score`
- `transferable_score`
- `primary_signal`
- `confidence`
- `classification`
- rejected candidate rows with `rejection_code` and reason
- notes summarizing confidence buckets and signal totals

Ambiguous candidates are not errors. They are the handoff queue for the future
lead-session review gate.

#### Verifier and Promotion Semantics (Gate 6 Design)

Status: proposed, not implemented. Gate 6 defines what "verified" and
"promotion-eligible" mean for architectural-memory candidates. This section does
not itself promote any candidate, create a runtime serving path, or write a
cluster.

Gate 6 exists because Gates 1-5 produce useful review artifacts, but they are
not authoritative memory. A candidate may become authoritative only after a
separate verification step proves that the candidate is structurally complete,
traceable to real provenance, and explicitly approved by the durable Claude lead
session.

Verifier inputs:

- `factsheet-dry-run.json` from the Gate 5 artifact.
- `lead-session-review.json` from the Gate 4 artifact.
- The current project SQLite `session_decisions` table opened read-only.
- Referenced docs/experiment files opened read-only.

The verifier performs only deterministic checks. It must not call an LLM and
must not rewrite candidate text.

| Check | Meaning |
| --- | --- |
| `provenance_exists` | `provenance.source_ref` resolves to an existing session decision row or existing doc/experiment path. |
| `source_text_matches` | For session decisions, the source row text still matches the candidate text or the review target that produced it. |
| `structure_complete` | Required fields for the current candidate artifact are present and non-empty. This proves the candidate can be audited, not that it is ready for durable promotion. |
| `lead_review_present` | A Gate 4 lead-session review decision exists for the candidate when the candidate came from the ambiguous queue. |
| `not_rejected_or_suspended` | Candidate is not rejected and has no active suspension. |
| `no_direct_negation` | Candidate text does not mechanically negate the source text with obvious `always`/`never` or `must`/`must not` contradiction. This is a guardrail only, not semantic proof. |
| `duplicate_id_absent` | Candidate id is not already present in the target durable document/import artifact. |

Verifier output:

```json
{
  "generated_at": "YYYY-MM-DDTHH:mm:ssZ",
  "source_factsheet": "experiments/.../factsheet-dry-run.json",
  "candidate_results": [
    {
      "candidate_id": "EP-0001",
      "candidate_type": "engineering-principles",
      "verified": true,
      "promotion_eligible": false,
      "checks_passed": ["provenance_exists", "structure_complete"],
      "checks_failed": [],
      "failure_reasons": [],
      "promotion_blockers": ["missing_applies_when", "missing_revisit_when"],
      "source_ref": "session:<id>;decision:<id>"
    }
  ],
  "summary": {
    "verified": 0,
    "promotion_eligible": 0,
    "failed": 0
  }
}
```

Promotion eligibility requires all of:

1. `verified: true` in the Gate 6 verifier report.
2. Lead-session `APPROVED` decision for the candidate.
3. Non-empty `applies_when` for transferable principles, or non-empty
   project-scope/rationale fields for project-architecture records.
4. Non-empty `revisit_when` for transferable principles.
5. No active suspension.
6. No duplicate id in the destination source-of-truth document/import artifact.

Failure handling:

| Failure | Handling |
| --- | --- |
| Missing provenance | `verified: false`; do not promote. |
| Source text changed since review | `verified: false`; require a new dry-run/review cycle. |
| Empty `applies_when` / `revisit_when` | `verified: true` may still be possible, but `promotion_eligible: false`; send back to staging. |
| Rejected by lead session | `verified: false`; keep only in audit trail. |
| Suspended by lead session | `verified: false`; keep in suspended section until a future review resolves it. |
| Direct mechanical contradiction | `verified: false`; require lead-session review with counter-evidence. |
| Duplicate id | `verified: true`, `promotion_eligible: false`; merge/supersede must be designed separately. |

Operatorless approval rule:

- The durable Claude lead session is the reviewer for promotion eligibility.
- Codex must send a bounded `router_consult` request with explicit candidate ids,
  proposed disposition, and verifier results.
- The lead session may return `APPROVED`, `REQUEST_REVIEW`, or `SUSPEND` per
  candidate.
- The human owner is not a curator in this loop; they receive the phase-end
  summary only.

Gate 6 non-goals:

- no runtime serving of architectural memory
- no cluster writes
- no hidden global memory
- no semantic LLM verifier in this gate
- no automatic promotion from dry-run output alone
- no promotion of candidates with missing scope conditions
- no project-to-project mutation without explicit import

Implementation note:

Gate 6 may safely start with a verifier report artifact only. Durable promotion
is a later step that must name the source-of-truth file/import location before
writing any `active` memory item.

#### Field-Population Semantics (Gate 7 Design)

Status: proposed, not implemented. Gate 7 names the future diffable
source-of-truth documents and defines how missing durable fields are populated.
It does not create active entries, promote candidates, write clusters, or add a
runtime serving path.

Gate 6 showed that static verification can prove provenance for candidates, but
that no candidate is promotion-eligible yet because the Gate 5 artifacts do not
populate durable fields such as `applies_when`, `revisit_when`, `rationale`, and
`project_scope`.

Future source-of-truth documents:

| Memory product | Future file | Role |
| --- | --- | --- |
| `engineering-principles` | `docs/ENGINEERING_PRINCIPLES.md` | Canonical diffable source for transferable principles. A future cluster may index or serve this file, but the file remains the authority. |
| `project-architecture` | `docs/PROJECT_ARCHITECTURE.md` | Canonical diffable source for project-scoped decisions and rationale. It does not travel across projects unless explicitly imported. |

These file names are reserved by the spec. Gate 7 does not create or populate
them with active records. Creating them as empty templates is allowed only when
the next gate needs a destination artifact for dry-run output.

Field-population rules for `engineering-principles`:

| Field | Populated by | Rule |
| --- | --- | --- |
| `statement` | Codex | Use the candidate text or the lead-reviewed wording. Do not generalize beyond the source text. |
| `applies_when` | Codex proposes, lead reviews | Convert the lead review `scope_condition` into one or more explicit applicability conditions. If only a broad scope condition exists, the candidate remains not promotion-eligible. |
| `revisit_when` | Codex proposes, lead reviews | Add at least one concrete trigger for re-review, usually derived from verifier/monitor risks, caller-contract changes, or counter-evidence risk. |
| `provenance` | Codex | Copy source ref, derived date, derived_by, and reviewed_by from Gate 4/6 artifacts. |
| `status` | Promotion step | Remains `proposed` until the future promotion gate explicitly activates it. |

Field-population rules for `project-architecture`:

| Field | Populated by | Rule |
| --- | --- | --- |
| `decision` | Codex | Use the candidate decision text verbatim. |
| `rationale` | Codex proposes, lead reviews | Prefer explicit rationale from the source. If absent, derive a conservative rationale from surrounding phase artifacts and mark it as derived. |
| `project_scope.project_id` | Codex | Use the project id from the dry-run report. |
| `project_scope.boundary_ref` | Codex | Use stable git remote/package identity when available; do not rely on transient process cwd alone. |
| `provenance` | Codex | Copy source ref/date/type from Gate 4/6 artifacts. |
| `status` | Promotion step | Remains `proposed` until the future promotion gate explicitly activates it. |

Lead-session role:

- Codex may populate draft fields mechanically.
- The durable Claude lead session reviews the populated fields through a bounded
  `router_consult` request.
- The lead session may return `APPROVED_FIELDS`, `REQUEST_CHANGES`, or
  `SUSPEND`.
- Field approval is not promotion. It only allows a future promotion gate to
  consider the candidate.

Gate 7 non-goals:

- no active entries in `docs/ENGINEERING_PRINCIPLES.md`
- no active entries in `docs/PROJECT_ARCHITECTURE.md`
- no runtime serving or import
- no cluster writes
- no hidden global memory
- no promotion based only on field population

Gate 7 acceptance criteria:

1. `docs/CLUSTER_CACHE_SPEC.md` names the future source-of-truth files.
2. Field-population rules exist for `applies_when`, `revisit_when`,
   `rationale`, and `project_scope`.
3. The spec distinguishes field approval from promotion.
4. The spec keeps all runtime serving/import work out of Gate 7.
5. The human owner remains outside the curation loop; only a phase-end summary
   is required.

#### Draft Field Population (Gate 8 Dry Run)

Status: dry-run implemented, not promoted. Gate 8 turns the Gate 5/6 candidates
into a field-populated draft artifact, but the result is still not active
memory.

Gate 8 outputs:

- `experiments/architectural-memory-dry-run-2026-05-16/field-population-draft.json`
- `experiments/architectural-memory-dry-run-2026-05-16/field-population-draft.md`
- empty source-of-truth scaffolds:
  - `docs/ENGINEERING_PRINCIPLES.md`
  - `docs/PROJECT_ARCHITECTURE.md`

The scaffold documents are intentionally empty. They reserve the future
diffable destinations and contain no active principles or decisions.

Gate 8 population semantics:

- `engineering-principles` entries receive draft `statement`, `applies_when`,
  `revisit_when`, and copied provenance fields.
- `project-architecture` entries receive draft `decision`, conservative
  `rationale`, `rationale_note`, `project_scope.project_id`,
  `project_scope.boundary_ref`, and copied provenance fields.
- Every draft entry remains `status: "proposed"`.
- Every draft entry remains `field_review_status: "pending_lead_review"`.
- Rejected, suspended, or statically failed candidates are excluded from the
  populated draft and retained only as audit buckets.

Gate 8 non-goals:

- no active entries in the scaffold docs
- no import from the draft artifact into runtime memory
- no cluster writes
- no `cluster_consult` serving path
- no promotion eligibility change
- no human curation loop

#### Lead Field Review (Gate 9)

Status: review artifact implemented, not promoted. Gate 9 asks the durable
Claude lead session to review the field-populated Gate 8 draft. It validates
the shape and quality of populated fields only; it does not activate memory.

Gate 9 outputs:

- `experiments/architectural-memory-dry-run-2026-05-16/field-review-request.md`
- `experiments/architectural-memory-dry-run-2026-05-16/field-review-raw.md`
- `experiments/architectural-memory-dry-run-2026-05-16/field-review.json`
- `experiments/architectural-memory-dry-run-2026-05-16/field-review.md`

Gate 9 review statuses:

- `APPROVED_FIELDS`: the populated fields are specific enough for future
  promotion consideration.
- `REQUEST_CHANGES`: the candidate may be valid, but fields or wording must be
  corrected before future promotion consideration.
- `SUSPEND`: the candidate must not advance without additional source context
  or current-code validation.

Gate 9 result for the 2026-05-16 dry run:

- 93 entries reviewed across 12 bounded lead-session batches.
- 87 entries received `APPROVED_FIELDS`.
- 6 entries received `REQUEST_CHANGES`.
- 0 entries received `SUSPEND`.

Gate 9 non-goals:

- no status changes in the scaffold docs
- no active entries
- no cluster writes
- no runtime import or serving path
- no promotion approval
- no automatic correction of `REQUEST_CHANGES` entries

#### Request-Changes Resolution (Gate 10)

Status: resolution artifact implemented, not promoted. Gate 10 resolves the
six `REQUEST_CHANGES` entries from Gate 9 before any future promotion gate may
consider the field-reviewed set.

Gate 10 outputs:

- `experiments/architectural-memory-dry-run-2026-05-16/request-changes-resolution.json`
- `experiments/architectural-memory-dry-run-2026-05-16/request-changes-resolution.md`

Gate 10 result for the 2026-05-16 dry run:

- `AMB-DOC-0008` was corrected from the Gate 3 scorer/rubric source section
  and approved by the durable lead session for future promotion consideration.
- 5 entries were excluded from promotion because they were generic, stale,
  inaccurate, or superseded.
- The field-reviewed set now has 88 entries eligible for future promotion
  consideration and 5 excluded audit entries.

Gate 10 non-goals:

- no active entries
- no source-of-truth doc population
- no cluster writes
- no runtime import or serving path
- no promotion approval

#### Proposed Record Materialization (Gate 11)

Status: proposed records materialized, not promoted. Gate 11 writes the
field-approved set into the diffable source-of-truth documents as proposed
records only.

Gate 11 outputs:

- `docs/ENGINEERING_PRINCIPLES.md`
- `docs/PROJECT_ARCHITECTURE.md`
- `experiments/architectural-memory-dry-run-2026-05-16/materialized-proposed-records.json`
- `experiments/architectural-memory-dry-run-2026-05-16/materialized-proposed-records.md`

Gate 11 result for the 2026-05-16 dry run:

- 13 engineering-principle records written as `status: proposed`.
- 75 project-architecture records written as `status: proposed`.
- 88 total proposed records.
- 0 active records.
- 5 excluded audit records remain out of the source-of-truth docs.

Every proposed record carries promotion requirements:

- explicit future promotion gate
- lead-session promotion approval
- active source-of-truth write
- separate runtime import/serving gate before router use

Gate 11 non-goals:

- no `status: active`
- no promotion approval
- no runtime import or serving path
- no cluster writes
- no router behavior changes

#### Active Source-of-Truth Promotion (Gate 12)

Status: active source-of-truth records promoted, not runtime-served. Gate 12
adds bounded durable lead-session promotion approval and updates the diffable
source-of-truth documents from proposed records to active records.

Gate 12 outputs:

- `docs/ENGINEERING_PRINCIPLES.md`
- `docs/PROJECT_ARCHITECTURE.md`
- `experiments/architectural-memory-dry-run-2026-05-16/active-promotion.json`
- `experiments/architectural-memory-dry-run-2026-05-16/active-promotion.md`
- `experiments/architectural-memory-dry-run-2026-05-16/gate-12-summary.md`

Gate 12 result:

- The durable Claude lead session returned `APPROVE_SCOPE` for promotion of 88
  field-approved records.
- The same lead session clarified that Gate 12 itself is the bounded
  lead-session promotion approval. Gate 9 was field review only and Gate 10 was
  request-changes resolution only.
- Post-write compact review returned `APPROVE_SCOPE` and closed Gate 12.
- 13 engineering-principle records are now `status: active` with
  `active_date: 2026-05-17`.
- 75 project-architecture records are now `status: active` with
  `active_date: 2026-05-17`.
- 0 proposed records remain in the source-of-truth docs.

Gate 12 non-goals:

- no runtime import or serving path
- no cluster writes
- no router behavior changes
- no hidden model-memory authority

Non-goals:

- no implementation in this decision step
- no automatic cross-project mutation
- no unverified principle promotion
- no replacement for factsheet evidence verification
- no hidden model-memory authority; every active memory item must have a
  diffable artifact or explicit provenance record

Implementation gates:

1. Closed: write the data/model spec for project decisions, transferable
   principles, staging, provenance, and suspension.
2. Closed: add a dry-run distill report that reads the SQLite
   `session_decisions` table, `session_events.raw_response_path` files where
   available, and existing docs, but writes no durable memory.
3. Closed: add scorer/reviewer rules for project-vs-transferable
   classification.
4. Closed: add staging and lead-session review.
5. Closed: compile a non-authoritative factsheet dry-run artifact.
6. Closed: define verifier/promotion semantics and add a static verifier report
   artifact.
7. Closed: design and name the durable source-of-truth document/import location
   for active project-architecture and engineering-principle records.
8. Closed: populate draft `applies_when`, `revisit_when`, `rationale`, and
   `project_scope` fields into a non-authoritative draft artifact.
9. Closed: run bounded lead-session field review of the populated draft.
10. Closed: resolve or exclude `REQUEST_CHANGES` entries before promotion.
11. Closed: materialize field-approved records as proposed source-of-truth docs.
12. Closed: add bounded lead-session promotion approval and active writes.
13. Future: add explicit import/serving for `engineering-principles`.
    Runtime import/serving requires a separate design gate and human sign-off on
    the canonical URL/import boundary before router use.
14. Future: add `router_monitor` visibility: staged count, promoted count,
    suspended count, stale/superseded count, and recent counter-evidence.

Do not implement this pipeline if real usage shows that durable lead sessions
already preserve enough architectural continuity, if `session_decisions` remain
too noisy to distill reliably, or if no explicit source-of-truth document/import
path exists for transferable principles. The durable Claude lead session should
make that stop/go call from concrete dry-run distill samples and
`router_monitor` evidence, not from intuition alone.

### Phase 8: Live Experiment Matrix

- Repeat the measured scenarios from `docs/EXPERIMENTS.md` through MCP tools.
- Verify no-tools/fork metrics are logged in `cluster_events`.
- Verify changed factsheet evidence never consults from stale facts; it either proves every cited fact still valid or falls back to normal `claude_consult`.

### Phase 9: Optional Auto-Routing

Out of MVP. Consider only after explicit cluster id flow is stable.

## 17. Acceptance Criteria

MVP is acceptable when:

- Existing v1 tools still pass all tests.
- A cluster can be created with a `static_verified` factsheet in Phase 1 and an `llm_verified` factsheet after Phase 2.
- `cluster_consult` with `bare` profile succeeds when bare probe passes.
- If bare probe fails, `cluster_consult` uses focused profile and records downgrade.
- `cluster_consult` does not return cache-health errors to the caller when normal `claude_consult` can answer instead.
- Strict selector/snippet evidence revalidation either proves every cited fact still valid or falls back to normal `claude_consult`.
- Static factsheet trust policy is cluster metadata, not a per-call caller input.
- No path requires human approval.
- No path silently escalates from `bare` or `focused` to `agent`.
- Metrics and status expose fallback/revalidation health to the operator.

## 18. Open Questions

- Should baseline sessions be rebuilt after every factsheet version or only when fork drift is detected?
- Should factsheets store exact line ranges, AST selectors, or both?
- What minimum evidence is required for a fact about runtime behavior?
- How should missing facts discovered during `cluster_consult` be queued for refresh?
- Should `cluster_prepare` allow raw user-supplied factsheet JSON in production, or only in tests/dev mode?

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
- Implemented: Phase 4 `cluster_consult` without fork, with append-system-prompt factsheet injection and stale hash refusal.
- Implemented: Phase 6 `cluster_refresh` in `verify_only` mode and stale factsheet state.
- Implemented early for observability: read-only `cluster_get` and `cluster_list`.
- Not implemented yet: fork baseline and distillation from existing sessions.

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
- No automatic fallback to full `agent` mode for a user question.
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
- `cluster_refresh_required`

## 6. Factsheet Format

Factsheets are structured JSON, not free prose.

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
          "selector": "RouterConfig.claude.extraArgs"
        },
        {
          "path": "src/claude.ts",
          "hash": "sha256:...",
          "selector": "CliClaudeAdapter.runPrompt"
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
  "tool_profile": null,
  "allow_static_factsheet": false
}
```

Behavior:

1. Resolve project and cluster.
2. Run runtime verifier.
3. Select tool profile:
   - explicit input profile if provided,
   - cluster default otherwise,
   - deterministic downgrade from `bare` to `focused` if bare probe failed.
4. Reject stale factsheets by checking scoped evidence file hashes.
5. Inject the factsheet with `--append-system-prompt`.
6. Require answer to cite only factsheet facts or return `NOT IN CONTEXT`.
7. Log cluster event metrics.

Output follows `claude_consult` shape with cluster metadata:

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
      "factsheet_version": 1,
      "baseline_session_id": "..."
    }
  ]
}
```

## 11. Invalidation

Factsheet freshness is scoped to evidence files.

On every `cluster_consult`, compare current file hashes to `cluster_file_hashes` for the active factsheet.

If any evidence file changed:

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

Policy options for later:

- `strict`: return stale error.
- `auto_verify`: run `verify_only` automatically.
- `auto_refresh`: run focused refresh automatically.

MVP default: `strict`.

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

- Return `CLUSTER_FACTSHEET_STALE`.
- Suggest `cluster_refresh`.
- Do not silently consult stale facts.

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
- Do not fallback to `agent`.

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

### Phase 5: Fork From Baseline

- Add baseline session creation from a verified factsheet.
- Add `cluster_consult` fork path with `--resume <baseline_session_id> --fork-session`.
- Preserve baseline session; every fork must produce a distinct Claude session id.
- Measure fresh factsheet versus forked factsheet costs separately.

### Phase 6: Refresh and Invalidation

- Add `cluster_refresh` with `verify_only`.
- Add stale error path.
- Implemented: `cluster_consult` refuses changed scoped evidence files, marks the factsheet stale, and records a refresh-required event.
- Implemented: `cluster_refresh` rechecks the latest factsheet's scoped file hashes/selectors without invoking Claude.

### Phase 7: Inspect Tools

- Add `cluster_list`.
- Add `cluster_get`.
- Keep these read-only and independent from Claude invocation.

### Phase 8: Distill From Existing Session

- Add draft factsheet generation from session registry metadata and raw response paths.
- Feed draft through static verifier and LLM verifier.
- Promote verified facts only.

### Phase 9: Live Experiment Matrix

- Repeat the measured scenarios from `docs/EXPERIMENTS.md` through MCP tools.
- Verify no-tools/fork metrics are logged in `cluster_events`.
- Verify stale factsheets refuse consults.

### Phase 10: Optional Auto-Routing

Out of MVP. Consider only after explicit cluster id flow is stable.

## 17. Acceptance Criteria

MVP is acceptable when:

- Existing v1 tools still pass all tests.
- A cluster can be created with a `static_verified` factsheet in Phase 1 and an `llm_verified` factsheet after Phase 2.
- `cluster_consult` with `bare` profile succeeds when bare probe passes.
- If bare probe fails, `cluster_consult` uses focused profile and records downgrade.
- `cluster_consult` refuses stale factsheet by default.
- `cluster_consult` with fork creates a new Claude session id and preserves baseline.
- No path requires human approval.
- No path silently escalates from `bare` or `focused` to `agent`.
- Metrics show fresh bare and forked bare profiles separately.

## 18. Open Questions

- Should baseline sessions be rebuilt after every factsheet version or only when fork drift is detected?
- Should factsheets store exact line ranges, AST selectors, or both?
- What minimum evidence is required for a fact about runtime behavior?
- How should missing facts discovered during `cluster_consult` be queued for refresh?
- Should `cluster_prepare` allow raw user-supplied factsheet JSON in production, or only in tests/dev mode?

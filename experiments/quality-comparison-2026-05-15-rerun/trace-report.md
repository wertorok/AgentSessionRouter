# Quality Trace Report

Generated: 2026-05-15T07:28:31.591Z
Matrix: experiments/quality-comparison-2026-05-15-rerun/matrix.csv

## Executive Trace

- Rows: 90
- Methods: direct_fresh, direct_resume, cluster_consult
- Questions: A1, A2, A3, A4, A5, B1, B2, B3, C1, C2
- Low/error rows: 9
- NOT IN CONTEXT rows: 8
- Suspicious identifier rows: 9
- Session parse_failed events in router DB dump: 1
- Session parse_failed events since this run started: 0
- Response rows mentioning SESSION_UPDATE_JSON/parse warning: 0

## Question Leaks

| Question | Kind | Gap | direct_fresh | direct_resume | cluster_consult |
|---|---|---:|---:|---:|---:|
| A1 | direct_resume_beats_cluster | 2 | 3 | 3 | 1 |
| A1 | cluster_not_in_context |  | 3 | 3 | 1 |
| A1 | cluster_low_score |  | 3 | 3 | 1 |
| A2 | direct_resume_beats_cluster | 1 | 2.33 | 3 | 2 |
| A3 | direct_resume_beats_cluster | 1.67 | 0.67 | 1.67 | 0 |
| A3 | cluster_low_score |  | 0.67 | 1.67 | 0 |
| B2 | direct_resume_beats_cluster | 1 | 2.33 | 3 | 2 |
| B2 | cluster_not_in_context |  | 2.33 | 3 | 2 |
| C2 | cluster_not_in_context |  | 2.33 | 2 | 2 |

## Low/Error Rows

### A3 direct_fresh run 1

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/direct_fresh_A3_run1.txt

```txt
When the factsheet is stale, `consultCluster` does the following at lines 62-79:

**Detection**: Files are checked for changes by comparing SHA-256 hashes and file sizes against the stored `fileHashes` via `findStaleFiles()` (line 62).

**Actions taken when stale files are found**:

1. **`db.markClusterFactsheetStale(loaded.factsheet.id)`** — marks the factsheet record as stale in the database (line 64)

2. **`db.logClusterEvent(...)`** — logs a `cluster_refresh_required` event with details including the `factsheet_id`, `factsheet_version`, and the list of changed files (lines 65-74)

3. **Returns an error** with code `ERROR_CODES.CLUSTER_FACTSHEET_STALE` (lines 75-78), including `changed_files` in the details

There's also an early exit in `loadClusterContext` (lines 176-183): if `getCurrentClusterFactsheet()` returns nothing and the latest factsheet already has `status === "stale"`, it immediately returns a `CLUSTER_FACTSHEET_STALE` error without even checking file hashes.

So stale detection can happen in two ways:
- **Already-marked stale** (status field set previously) — caught early in `loadClusterContext`
- **Newly-detected stale** (files changed since factsheet was built) —
...[truncated]
```

### A3 direct_fresh run 2

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/direct_fresh_A3_run2.txt

```txt
There are two distinct stale checks in `cluster_consult`:

### 1. Stale at load time (`loadClusterContext`, line 173-184)
When `getCurrentClusterFactsheet` returns null, it checks if the latest factsheet has status `"stale"`. If so, it returns early with `CLUSTER_FACTSHEET_STALE`:
```ts
if (latestFactsheet?.status === "stale") {
  return errorPayload(ERROR_CODES.CLUSTER_FACTSHEET_STALE, ..., {
    cluster_id: clusterId,
    details: { factsheet_id: latestFactsheet.id, factsheet_version: latestFactsheet.version }
  });
}
```

### 2. Stale due to file changes (`consultCluster`, lines 62-79)
Even if the factsheet is currently `"llm_verified"`, `findStaleFiles` compares the recorded SHA-256 hashes and file sizes of all tracked files against the actual filesystem. If any file has changed (or is missing):
- `db.markClusterFactsheetStale()` is called immediately — setting the factsheet status to `"stale"` in the DB
- A `cluster_refresh_required` event is logged
- An error is returned with `CLUSTER_FACTSHEET_STALE`

**In both cases the result is the same:** a `CLUSTER_FACTSHEET_STALE` error is returned to the caller, with the message `"Cluster factsheet is stale. Run cluster_refresh before
...[truncated]
```

### A3 direct_resume run 3

- score: 1
- notes: captures only part of caller-facing stale behavior; matched 3/6
- response: responses/direct_resume_A3_run3.txt

```txt
Two layers:

**`clusterConsult.ts` (direct call, lines 62–79):**
- Detects stale files via `findStaleFiles` (sha256 + size mismatch against `cluster_file_hashes`)
- Calls `db.markClusterFactsheetStale()` + logs `cluster_refresh_required`
- Returns `CLUSTER_FACTSHEET_STALE` error immediately — no consult attempted

**`tools.ts → consultClusterForCaller` (caller-facing path, lines 771–817):**
- If `auto_refresh` is **off**: immediately falls back to `claude_consult` internally; caller gets a normal answer, no error
- If `auto_refresh` is **on**: under a per-cluster lock, re-validates every cited `selector`/`snippet_hash`
  - If revalidation passes → proceeds with the consult
  - If revalidation fails → falls back to `claude_consult`, marks cluster `needs_prepare`
- In **either case**, the caller of `cluster_consult` always gets an answer — never a stale error

**Key:** The stale error is returned by `clusterConsult.ts` but consumed and acted upon by `consultClusterForCaller` before reaching the caller. The stale path is an internal recovery mechanism, not a caller-visible failure mode.
```

### A1 cluster_consult run 1

- score: 1
- notes: honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- response: responses/cluster_consult_A1_run1.txt

```txt
NOT IN CONTEXT — the factsheet contains no fact describing the field names in the `clusters` table. The only schema fact present (`sessions-dormant-default`) pertains to the `sessions` table, not the `clusters` table.
```

### A3 cluster_consult run 1

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/cluster_consult_A3_run1.txt

```txt
When `cluster_consult` finds stale scoped evidence files, it:

1. Marks the factsheet stale
2. Logs `cluster_refresh_required` to `cluster_events` with `changed_files`
3. Returns `CLUSTER_FACTSHEET_STALE`
4. Does **not** invoke Claude
```

### A1 cluster_consult run 2

- score: 1
- notes: honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- response: responses/cluster_consult_A1_run2.txt

```txt
NOT IN CONTEXT

The factsheet does not include the `clusters` table schema. The only schema fact present (`sessions-dormant-default`) references `src/schema.ts` for the `sessions` table, but no equivalent fact documents the `clusters` table fields.
```

### A3 cluster_consult run 2

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/cluster_consult_A3_run2.txt

```txt
When `cluster_consult` finds stale scoped evidence files, it:

1. Marks the factsheet stale
2. Logs `cluster_refresh_required` with `changed_files`
3. Returns `CLUSTER_FACTSHEET_STALE`
4. **Does not invoke Claude**
```

### A1 cluster_consult run 3

- score: 1
- notes: honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- response: responses/cluster_consult_A1_run3.txt

```txt
NOT IN CONTEXT

The factsheet does not contain the exact field names for the `clusters` table. The only schema-related fact in the factsheet pertains to the `sessions` table's `dormant_after_days` default value (in `src/schema.ts`), not the `clusters` table schema itself.
```

### A3 cluster_consult run 3

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/cluster_consult_A3_run3.txt

```txt
When `cluster_consult` finds stale scoped evidence files, it:

1. Marks the factsheet stale
2. Logs `cluster_refresh_required` with `changed_files` to cluster_events
3. Returns `CLUSTER_FACTSHEET_STALE`
4. **Does not invoke Claude**

(factsheet id: `stale-cluster-consult-behavior`, confidence: `llm_verified`)
```

## NOT IN CONTEXT Rows

### C2 direct_fresh run 2

- score: 2
- notes: substantive but not fully structured or missing some project specificity; includes NOT IN CONTEXT caveat
- response: responses/direct_fresh_C2_run2.txt

```txt
A likely untested failure mode of `--bare --tools ""`:

## Silent factsheet ignoring

**The failure:** The bare profile probe only tests `["--bare", "--tools", ""]` with the fixed prompt `"Return exactly: PROFILE_OK"`. It proves the profile *runs*, not that it actually *consults the appended factsheet*.

In `consultCluster`, the factsheet is injected via `--append-system-prompt` (line 96 of `src/clusterConsult.ts`), not via the prompt itself. If the Claude binary's bare profile *silently ignores or truncates `--append-system-prompt`** when `--bare --tools ""` is active, the model would answer from its own knowledge instead of the factsheet — hallucinating while returning a 2xx status and a valid JSON response. The existing probe wouldn't catch it.

**Why it's likely:** This is a real CLI flag interaction risk. `--bare` suppresses tools; `--append-system-prompt` injects content into the system prompt. Whether these compose correctly across Claude versions isn't guaranteed by the availability probe.

**How to detect it:**

1. **Add a "NOT IN CONTEXT" probe** — use a cluster with a factsheet that explicitly *omits* a fact (e.g., don't mention `router_monitor` at all), then ask "What i
...[truncated]
```

### A1 cluster_consult run 1

- score: 1
- notes: honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- response: responses/cluster_consult_A1_run1.txt

```txt
NOT IN CONTEXT — the factsheet contains no fact describing the field names in the `clusters` table. The only schema fact present (`sessions-dormant-default`) pertains to the `sessions` table, not the `clusters` table.
```

### C2 cluster_consult run 1

- score: 2
- notes: substantive but not fully structured or missing some project specificity; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_C2_run1.txt

```txt
Based on the factsheet:

**Failure mode not yet tested:** When `--bare --tools ""` encounters a query whose answer isn't in the factsheet, it may **infer or hallucinate API names, config keys, or function signatures** rather than correctly returning `NOT IN CONTEXT`.

**Detection:** Feed cluster consult queries targeting facts deliberately absent from the factsheet and assert the response contains `NOT IN CONTEXT` verbatim — not a plausible-sounding but unverified answer.

This is the documented "known risk" of the bare/no-tools profile per `bare-profile-risk` in the factsheet.
```

### A1 cluster_consult run 2

- score: 1
- notes: honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- response: responses/cluster_consult_A1_run2.txt

```txt
NOT IN CONTEXT

The factsheet does not include the `clusters` table schema. The only schema fact present (`sessions-dormant-default`) references `src/schema.ts` for the `sessions` table, but no equivalent fact documents the `clusters` table fields.
```

### C2 cluster_consult run 2

- score: 2
- notes: substantive but not fully structured or missing some project specificity; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_C2_run2.txt

```txt
**Untested failure mode:** When the factsheet genuinely lacks a required fact, `--bare --tools ""` may still produce inferred API names, config keys, file paths, or function names rather than properly returning `NOT IN CONTEXT`.

**Detection:** Create cluster consult test cases where the factsheet intentionally omits the queried fact. Assert the response contains `NOT IN CONTEXT` verbatim and contains no fabricated identifiers (e.g., no invented function names or config keys).
```

### A1 cluster_consult run 3

- score: 1
- notes: honest NOT IN CONTEXT/refusal; useful only if factsheet intentionally lacks this fact
- response: responses/cluster_consult_A1_run3.txt

```txt
NOT IN CONTEXT

The factsheet does not contain the exact field names for the `clusters` table. The only schema-related fact in the factsheet pertains to the `sessions` table's `dormant_after_days` default value (in `src/schema.ts`), not the `clusters` table schema itself.
```

### B2 cluster_consult run 3

- score: 2
- notes: partial orphan recovery path; matched 5/6; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_B2_run3.txt

```txt
Based on the factsheet, here's the code path when a deleted `.jsonl` session file is encountered on `claude_consult`:

## Detection

`consult.ts` checks `sessionFileExists(session.claude_session_id)` — if the stored session ID's `.jsonl` file is absent, the file is gone.

## Three Matching Modes, One Outcome

The exact path depends on how the session was identified:

1. **Explicit session_id** → `orphan-explicit-session` triggers
2. **Auto-routed, exact topic match** → `orphan-exact-topic-session` triggers  
3. **Auto-routed, non-exact match** → `orphan-auto-routed-session` triggers

In all three cases the same sequence occurs:

1. **`db.markSessionOrphaned(sessionId)`** — the registry entry is flagged orphaned in the DB
2. **Bootstrap context built** from the old session's stored view (`buildBootstrapContext(oldView, "orphaned")`)
3. **Replacement route created** from registry context (rather than from the missing session file)
4. **`wasOrphanRecovery: true`** set on the new route

## Output

`claude_consult` returns with `routing.was_orphan_recovery: true` (per the `orphan-routing-output` fact), signaling to the caller that a lost session was recovered.

**NOT IN CONTEXT:** The f
...[truncated]
```

### C2 cluster_consult run 3

- score: 2
- notes: substantive but not fully structured or missing some project specificity; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_C2_run3.txt

```txt
**Likely untested failure mode:** The bare profile LLM produces hallucinated API/config names instead of returning `"NOT IN CONTEXT"` when faced with questions whose answers are absent from the factsheet.

**How to detect it:** Write a test case where cluster_consult is asked about a fact not present in the factsheet, and assert the response contains the literal string `"NOT IN CONTEXT"` rather than a plausible but fabricated API name, config key, or function signature.

**Evidence in factsheet:** The `bare-profile-risk` fact documents this exact risk, citing the instruction in both `src/clusterConsult.ts` and `docs/CLUSTER_CACHE_SPEC.md`: *"If a required fact is absent, write NOT IN CONTEXT."* The factsheet identifies this as a known failure mode of bare/no-tools consulting, but does not enumerate existing test coverage for it.
```

## Suspicious Identifier Claims

### C1 direct_fresh run 2

- suspicious identifiers not found in repo text: change_type
- score: 2
- response: responses/direct_fresh_C1_run2.txt

```txt
Here are three targeted improvements that preserve `cluster_refresh`'s existing semantics while making it smarter:

---

**1. Evidence-path-indexed selective re-verification**

Currently `verifyFactsheetStatic` re-verifies *all* facts whenever any file changes — even facts whose evidence paths are completely unrelated to the changed files. Index facts by their evidence file paths during load; only re-verify facts whose paths intersect the changed-files set.

**Why it's safe**: the existing pass/fail semantics are unchanged — we just skip work that would have produced the same result.

**File to modify**: `src/clusterRefresh.ts` — add a helper that builds a `Map<path, factId[]>` and filters the verification scope.

---

**2. mtime + size as a fast-path before full content hash**

`findChang
...[truncated]
```

### C2 direct_fresh run 3

- suspicious identifiers not found in repo text: tool_invocation_suppressed, bare_mode_tool_warning
- score: 3
- response: responses/direct_fresh_C2_run3.txt

```txt
**Likely untested failure mode: `--bare --tools ""` causes a silent session/auth mismatch on the first real invocation after a bare-probe success**

Here's the reasoning:

### What `--bare --tools ""` actually does

`src/profiles.ts:33` — bare profile is `["--bare", "--tools", ""]`. The empty-string argument to `--tools` is supposed to disable tool access. This is the probe profile. But after `detectAvailableProfiles` succeeds for bare, that same flag sequence gets reused for every real prompt run in that session.

### The untested scenario

1. `detectAvailableProfiles` probes bare successfully → `bare.available = true`
2. A subsequent call (cluster consult, shadow eval judge, etc.) invokes Claude with `--bare --tools ""`
3. But something about the **session state or auth context** when ba
...[truncated]
```

### C1 direct_resume run 1

- suspicious identifiers not found in repo text: refresh_age_days
- score: 3
- response: responses/direct_resume_C1_run1.txt

```txt
Here are three improvements to `cluster_refresh` that preserve existing semantics:

---

**1. Granular per-fact revalidation instead of all-or-nothing**

Currently (`src/clusterRefresh.ts:54-66`), if `verifyFactsheetStatic` throws, the entire factsheet is marked stale. Instead, catch individual fact failures and re-run static verification per-fact:

```ts
// Instead of one global try/catch around the whole verification:
for (const fact of loaded.factsheetContent.facts ?? []) {
  try {
    verifyOneFact(cwd, fact, loaded.fileHashes);
  } catch (error) {
    // track per-fact failure, keep facts that still pass
  }
}
```

This preserves `rejected_facts` granularity (already tracked) and avoids marking a factsheet stale when only one fact's evidence moved.

---

**2. Partial revalidation: dis
...[truncated]
```

### C2 direct_resume run 1

- suspicious identifiers not found in repo text: ANTHROPIC_API_KEY
- score: 2
- response: responses/direct_resume_C2_run1.txt

```txt
The untested failure mode I'd flag: **bare works for `ping` but fails for multi-turn conversations due to session state mismatch.**

### Why `--bare --tools ""` could fail mid-conversation

The health probe in `src/claude.ts:70-102` runs a single `await this.runPrompt("ping")` with the default profile — not bare. It passes if that succeeds. But bare mode has a different runtime contract:

1. **Session mode mismatch**: A session created with `agent` or `focused` profile carries tool-call history. Resuming it with `--bare --tools ""` means Claude sees tool-call history in a no-tools context. Claude may reject this, or hallucinate tool-use despite the flag.

2. **Auth vs API key divergence**: `--bare` authenticates differently — it may use `ANTHROPIC_API_KEY` from env rather than Claude Code'
...[truncated]
```

### C1 direct_resume run 2

- suspicious identifiers not found in repo text: refresh_age_days, llm_reverify_scheduled
- score: 2
- response: responses/direct_resume_C1_run2.txt

```txt
(I answered this earlier in this conversation — here's the summary.)

**1. Per-fact revalidation instead of all-or-nothing**

Currently if `verifyFactsheetStatic` throws, the entire factsheet is marked stale. Catch per-fact failures and only reject individual facts, keeping those still verifiable. Already tracked by `rejected_facts` in the output — just wire it up granularly in `refreshCluster` instead of failing the whole factsheet.

**2. Distinguish file-hash-changed from selector-actually-changed**

`findChangedFiles` flags any file whose hash differs. But a changed hash doesn't prove the cited `selector` text moved. Add a per-selector recheck: for changed files, re-read and verify each `selector` string + `snippet_hash`. Only mark stale if the selector actually changed. This avoids fal
...[truncated]
```

### C2 direct_resume run 2

- suspicious identifiers not found in repo text: ANTHROPIC_API_KEY
- score: 2
- response: responses/direct_resume_C2_run2.txt

```txt
**Multi-turn session state mismatch** — the most likely untested failure.

The health probe (`src/claude.ts:70-102`) runs a single `ping` call. It passes because ping is stateless. But bare mode has different auth behavior than normal Claude Code sessions:

1. **Session was created with `agent` or `focused`** — it carries tool-call history in `.jsonl`. Resuming with `--bare --tools ""` means Claude sees tool history in a no-tools context. It may refuse the resume, ignore the flag, or hallucinate tools.

2. **`--bare` uses API key auth, not Claude Code session auth** — on some machines the health probe passes (Claude Code auth is valid) but `ANTHROPIC_API_KEY` is unset. Bare mode would fail only at consult time.

3. **`result` vs `text` field inconsistency** — `parseClaudeJson` (`src/claude
...[truncated]
```

### C1 direct_resume run 3

- suspicious identifiers not found in repo text: refresh_age_days, llm_reverify_scheduled
- score: 2
- response: responses/direct_resume_C1_run3.txt

```txt
These were all answered earlier in this session — here's the concise recap:

**1. Per-fact revalidation instead of all-or-nothing**
Currently `verifyFactsheetStatic` throwing marks the whole factsheet stale. Catch per-fact failures and only reject individual facts, preserving facts that still verify. The `rejected_facts` field already exists in the output — just use it granularly.

**2. Distinguish hash-changed from selector-actually-changed**
`findChangedFiles` flags any file with a mismatched hash. But a changed hash doesn't prove the cited selector text moved. Recheck each `selector` + `snippet_hash` in changed files before marking stale — avoids false stale-marks from unrelated edits.

**3. Schedule LLM re-verification after N days even on clean static pass**
An `llm_verified` factshee
...[truncated]
```

### C2 direct_resume run 3

- suspicious identifiers not found in repo text: ANTHROPIC_API_KEY
- score: 2
- response: responses/direct_resume_C2_run3.txt

```txt
**Untested failure: multi-turn session state mismatch**

The health probe (`src/claude.ts:79`) runs a single stateless `ping` and passes. But bare mode has different auth semantics than normal Claude Code sessions:

1. **Session was created with `agent`/`focused`** — its `.jsonl` carries tool-call history. Resuming with `--bare --tools ""` may reject the resume, ignore the flag, or hallucinate tool use despite it.

2. **`--bare` uses `ANTHROPIC_API_KEY` auth, not Claude Code session auth** — a machine where Claude Code auth is valid but the env var is unset/unreadable would pass the current probe but fail at first bare consult.

**Detection:**

Add a bare-specific probe at startup that actually uses bare args (`src/claude.ts:70` area):

```ts
await runCommand(config.claude.command, [
  "-p
...[truncated]
```

### A5 cluster_consult run 1

- suspicious identifiers not found in repo text: seminactive_after_days
- score: 2
- response: responses/cluster_consult_A5_run1.txt

```txt
**30**

Evidence: The sessions schema default for `dormant_after_days` is 30. (Source: `src/schema.ts`, `seminactive_after_days INTEGER DEFAULT 30`)
```

## SESSION_UPDATE_JSON Audit

The 90-call quality benchmark compares direct Claude modes and cluster_consult. It does not fully exercise claude_consult metadata parsing unless a fallback path invokes claude_consult. SESSION_UPDATE_JSON quality must therefore be tracked through session_events and targeted claude_consult tests, not only answer quality scores.

Code audit note: parse_failed events now include raw_response_path when the raw Claude response was already written, so monitor output can point operators to the exact failed response.

Recent parse_failed samples from session_events_dump.json:

- id=17 session_id=session_634d7cd0-ec7c-4473-a93d-ea5c27b700e0 created_at=2026-05-12T01:15:26.394Z
  error=SESSION_UPDATE_JSON block missing
  raw_response_path=null

## Method/Question Score Grid

| Question | direct_fresh | direct_resume | cluster_consult |
|---|---:|---:|---:|
| A1 | 3/3/3 (3.00) | 3/3/3 (3.00) | 1/1/1 (1.00) |
| A2 | 3/2/2 (2.33) | 3/3/3 (3.00) | 2/2/2 (2.00) |
| A3 | 0/0/2 (0.67) | 2/2/1 (1.67) | 0/0/0 (0.00) |
| A4 | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) |
| A5 | 3/3/3 (3.00) | 3/3/3 (3.00) | 2/3/3 (2.67) |
| B1 | 3/3/3 (3.00) | 3/3/3 (3.00) | 2/3/3 (2.67) |
| B2 | 2/3/2 (2.33) | 3/3/3 (3.00) | 2/2/2 (2.00) |
| B3 | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) |
| C1 | 3/2/2 (2.33) | 3/2/2 (2.33) | 3/3/3 (3.00) |
| C2 | 2/2/3 (2.33) | 2/2/2 (2.00) | 2/2/2 (2.00) |

# Quality Trace Report

Generated: 2026-05-15T09:58:00.087Z
Matrix: experiments/quality-comparison-2026-05-15-full-reprepare/matrix.csv

## Executive Trace

- Rows: 90
- Methods: direct_fresh, direct_resume, cluster_consult
- Questions: A1, A2, A3, A4, A5, B1, B2, B3, C1, C2
- Low/error rows: 5
- NOT IN CONTEXT rows: 3
- Suspicious identifier rows: 7
- Session parse_failed events in router DB dump: 1
- Session parse_failed events since this run started: 0
- Response rows mentioning SESSION_UPDATE_JSON/parse warning: 1

## Question Leaks

| Question | Kind | Gap | direct_fresh | direct_resume | cluster_consult |
|---|---|---:|---:|---:|---:|
| A3 | cluster_low_score |  | 0 | 2 | 2.33 |
| B1 | direct_resume_beats_cluster | 0.67 | 2.67 | 3 | 2.33 |
| B2 | cluster_not_in_context |  | 2.67 | 3 | 2.67 |
| C2 | cluster_not_in_context |  | 2 | 1.33 | 2.33 |

## Low/Error Rows

### A3 direct_fresh run 1

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/direct_fresh_A3_run1.txt

```txt
When the factsheet is stale, `cluster_consult`:

1. **Detects staleness** via `findStaleFiles()` — it re-hashes every tracked file on disk and compares against the stored hashes. Any mismatch (file changed size, content hash differ, or file unreadable) marks it stale.

2. **Marks the factsheet stale in the DB** — `db.markClusterFactsheetStale(loaded.factsheet.id)`

3. **Logs a `cluster_refresh_required` event** with the factsheet id, version, and list of changed files.

4. **Returns an error response** with code `ERROR_CODES.CLUSTER_FACTSHEET_STALE`, halting the consult. The caller gets back:
   ```json
   {
     "error": "CLUSTER_FACTSHEET_STALE",
     "details": { "changed_files": [...] }
   }
   ```

There's also a second staleness path at `src/clusterConsult.ts:176` — if the factsheet exists but its status is already `"stale"` (e.g., a prior run left it in that state), it also returns the same error rather than proceeding.

The core contract: `cluster_consult` will not answer a question against a cluster whose factsheet doesn't reflect the current on-disk state. The caller must trigger a factsheet rebuild before re-consulting.
```

### A3 direct_fresh run 2

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/direct_fresh_A3_run2.txt

```txt
When the factsheet is stale, `cluster_consult` takes **two different failure paths** depending on where staleness is detected:

### 1. At load time — `loadClusterContext` (lines 173–184)

If a cluster has **no current factsheet** but the latest factsheet has `status === "stale"`, it returns an error immediately:

```
ERROR_CODES.CLUSTER_FACTSHEET_STALE
```

The error details include the stale factsheet's `id` and `version`.

### 2. At consult time — `consultCluster` (lines 62–79)

If a current factsheet **exists but source files have changed**, `findStaleFiles` detects drift by comparing file hashes and sizes against the stored `ClusterFileHashRecord[]`. When any file is stale (hash mismatch, size mismatch, or file missing):

1. **Marks the factsheet stale** in the DB: `db.markClusterFactsheetStale(loaded.factsheet.id)`
2. **Logs a `cluster_refresh_required` event** with the list of changed files
3. **Returns the same `CLUSTER_FACTSHEET_STALE` error** with `changed_files` in the details

In both cases theconsult is aborted — no LLM call is made. The caller must re-run the factsheet preparation pipeline before retrying.
```

### A3 direct_fresh run 3

- score: 0
- notes: wrong or unsupported; matched 1/6
- response: responses/direct_fresh_A3_run3.txt

```txt
## Staleness in `cluster_consult`

There are two distinct staleness paths in `src/clusterConsult.ts`:

### 1. Stale at load time — no current factsheet

`loadClusterContext` (lines 173–188) calls `db.getCurrentClusterFactsheet()`. If that returns nothing, it looks for the latest factsheet. If the latest one already has status `"stale"`, it immediately returns an error:

```
ERROR_CODES.CLUSTER_FACTSHEET_STALE
```

No further processing happens — the function short-circuits before ever calling the LLM.

### 2. Stale at consult time — files changed on disk

This is the more common path. `consultCluster` (lines 62–79) calls `findStaleFiles`, which re-hashes every tracked file against the stored `ClusterFileHashRecord`. If any file has changed or is missing:

1. **`db.markClusterFactsheetStale(loaded.factsheet.id)`** — updates the factsheet row status to `"stale"` in the DB.
2. **`db.logClusterEvent({ eventType: "cluster_refresh_required", ... })`** — emits a `cluster_refresh_required` event with the list of changed files.
3. **Returns error `ERROR_CODES.CLUSTER_FACTSHEET_STALE`** with `details.changed_files` listing the offending paths.

Both paths return the same error code (`CLUSTER
...[truncated]
```

### C2 direct_resume run 2

- score: 0
- notes: Invocation failed: claude exited 1: {"type":"system","subtype":"hook_started","hook_id":"733fb53a-ea15-4d3f-9f66-13fcc08b7d67","hook_name":"SessionStart:resume","hook_event":"SessionStart","uuid":"ba
- response: responses/direct_resume_C2_run2.txt

```txt
ERROR: {"type":"system","subtype":"hook_started","hook_id":"733fb53a-ea15-4d3f-9f66-13fcc08b7d67","hook_name":"SessionStart:resume","hook_event":"SessionStart","uuid":"ba75c035-0f53-41de-8397-b29e0c6480c3","session_id":"f146380d-cb96-4de0-b997-bce707afd563"}
{"type":"system","subtype":"hook_started","hook_id":"fd9ed356-4b27-4625-8c86-556c2ee97a73","hook_name":"SessionStart:resume","hook_event":"SessionStart","uuid":"01e78ede-4310-4dc6-99b3-5ed6d8d5c3f3","session_id":"f146380d-cb96-4de0-b997-bce707afd563"}
{"type":"system","subtype":"hook_response","hook_id":"fd9ed356-4b27-4625-8c86-556c2ee97a73","hook_name":"SessionStart:resume","hook_event":"SessionStart","output":"","stdout":"","stderr":"","exit_code":0,"outcome":"success","uuid":"2beb2c2a-0845-4560-99e1-a3673617a869","session_id":"f146380d-cb96-4de0-b997-bce707afd563"}
{"type":"system","subtype":"hook_response","hook_id":"733fb53a-ea15-4d3f-9f66-13fcc08b7d67","hook_name":"SessionStart:resume","hook_event":"SessionStart","output":"","stdout":"","stderr":"","exit_code":0,"outcome":"success","uuid":"648f6acd-f6a3-4ddd-b6f3-160e800723b7","session_id":"f146380d-cb96-4de0-b997-bce707afd563"}
{"type":"system","subtype":"init","cwd":"/r
...[truncated]
```

### A3 cluster_consult run 2

- score: 1
- notes: captures only part of caller-facing stale behavior; matched 3/6
- response: responses/cluster_consult_A3_run2.txt

```txt
From the verified factsheet, the stale factsheet behavior has two levels:

**Low-level detection** (in `consultCluster`): When scoped evidence files are stale, it marks the factsheet stale, logs `cluster_refresh_required` with `changed_files`, and returns `CLUSTER_FACTSHEET_STALE` internally.

**Caller-facing** (in the `cluster_consult` tool): It consumes the `CLUSTER_FACTSHEET_STALE` error. If `autoRefresh` is enabled, it revalidates evidence under a per-cluster lock. If revalidation fails or `autoRefresh` is disabled, it falls back internally to `claude_consult` and returns an answer to the caller.
```

## NOT IN CONTEXT Rows

### B2 cluster_consult run 1

- score: 2
- notes: partial orphan recovery path; matched 5/6; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_B2_run1.txt

```txt
## Orphan Recovery on Deleted `.jsonl` File

Per the verified factsheet, `claude_consult` detects the missing file via `sessionFileExists(session.claude_session_id)` and handles three distinct paths:

### 1. Explicit `session_id` provided by caller
`consult.ts` finds the stored session, detects the `.jsonl` is gone, calls `db.markSessionOrphaned(session.id)`, logs `"Selected session was orphaned; creating replacement from registry context."`, and creates a replacement route from bootstrap registry context. (`orphan-explicit-session`)

### 2. Auto-routed exact topic match
Same detection, calls `db.markSessionOrphaned(selectedSession.id)`, logs `"Exact normalized topic match was orphaned; creating replacement from registry context."`, builds bootstrap context from the old view, creates a replacement route, and sets `wasOrphanRecovery: true`. (`orphan-exact-topic-session`)

### 3. Auto-routed non-exact match
Same pattern — orphan marking, `"Auto-routed session was orphaned; creating replacement from registry context."`, bootstrap context from `oldView`, replacement route, `wasOrphanRecovery: true`. (`orphan-auto-routed-session`)

### Side effects
- `markSessionOrphaned` sets the sessi
...[truncated]
```

### C2 cluster_consult run 1

- score: 3
- notes: specific, project-aware, and gives at least three concrete points; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_C2_run1.txt

```txt
**Likely untested failure mode:** When `--bare --tools ""` is used in cluster consulting, the model may **hallucinate or infer API/config names** (e.g., MCP keys, policy fields, function names) instead of correctly responding **"NOT IN CONTEXT"** for facts absent from the factsheet.

This is the inverse of the documented bare profile risk: the system relies on the bare profile to constrain outputs to only what the factsheet contains, but a plausible failure is the model drifting — especially under partial evidence matches or ambiguous phrasing — and fabricating names that appear plausible.

**How to detect it:**

1. **Structured probe test** — supply a cluster consult question whose answer requires a fact entirely absent from the factsheet (e.g., a non-existent MCP tool or config key), and assert the response body contains the literal string `"NOT IN CONTEXT"` and **does not** contain any free-text identifier resembling an API name or path.

2. **Regression harness on the existing quality-comparison scripts** — the `scripts/quality-comparison.mjs` (currently modified) can be extended with a golden-set of "NOT IN CONTEXT" cases paired with expected safe responses, asserting zero ide
...[truncated]
```

### C2 cluster_consult run 2

- score: 2
- notes: substantive but not fully structured or missing some project specificity; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_C2_run2.txt

```txt
**Likely failure mode:** The bare profile (`--bare --tools ""`) may **hallucinate/invent facts** rather than returning `NOT IN CONTEXT` when a required fact is absent from the factsheet.

**How to detect it:** The factsheet already flags this risk (fact id: `bare-profile-risk`). You would detect it by running cluster consult queries that intentionally ask for facts *not* stored in the factsheet, then asserting the response contains `NOT IN CONTEXT` verbatim rather than a plausible-sounding fabricated name or value.
```

## Suspicious Identifier Claims

### C1 direct_fresh run 1

- suspicious identifiers not found in repo text: last_verified_at
- score: 2
- response: responses/direct_fresh_C1_run1.txt

```txt
Here are 3 ways to make `cluster_refresh` smarter without breaking existing semantics:

---

**1. Delta-only rehash: skip files whose mtime hasn't changed since last refresh**

In `findChangedFiles` (`src/clusterRefresh.ts:150`), add a fast-path using `mtime` before computing SHA-256 hashes:

```ts
const stat = statSync(absolutePath);
if (stat.mtimeMs === file.mtime_ms) continue; // skip unchanged files
const content = readFileSync(absolutePath);
// ... hash check
```

This preserves exact semantics (same output, same trust path) but cuts I/O for large clusters where only a few files changed. The `file.mtime_ms` field needs to be added to `ClusterFileHashRecord` in `src/db.ts` — a non-breaking schema addition.

---

**2. Partial-stale classification: distinguish "files changed" vs "factshe
...[truncated]
```

### C1 direct_fresh run 2

- suspicious identifiers not found in repo text: fact_dependencies, verification_bypassed
- score: 2
- response: responses/direct_fresh_C1_run2.txt

```txt
Here are 3 concrete improvements to `clusterRefresh` that preserve existing behavior while reducing wasted work:

---

**1. File-type-aware change scoring (skip noise-only changes)**

`findChangedFiles` currently treats any byte difference as a meaningful change. Add a lightweight heuristic: classify changes as *structural* vs *incidental* (whitespace, comments, formatting). Only structural changes increment a "change severity" score. If severity is low (e.g., only formatting/comments changed), skip factsheet re-verification entirely and mark fresh immediately — most facts are unaffected.

`src/clusterRefresh.ts:150` — extend `findChangedFiles` to return a severity level alongside the changed file list.

---

**2. Incremental fact-to-file lineage**

Currently if 1 of 50 tracked files chang
...[truncated]
```

### C2 direct_fresh run 2

- suspicious identifiers not found in repo text: ANTHROPIC_API_KEY, verified_multi_turn, tool_invocation_suppressed, bare_mode_tool_warning
- score: 2
- response: responses/direct_fresh_C2_run2.txt

```txt
The experiments already have a strong answer from the model. Let me surface the key points concisely.

---

## Likely untested failure mode of `--bare --tools ""`

**Scenario: Session state / auth context mismatch on the first real (non-probe) invocation**

`detectAvailableProfiles` probes bare with `PROFILE_OK` — a single short prompt. It succeeds and sets `bare.available = true`. Then every subsequent real call in that session reuses `["--bare", "--tools", ""]`.

**Two specific failure variants already identified in the experiments:**

### 1. Multi-turn session mode mismatch
A session created under `agent` or `focused` carries tool-call history. Resuming it under `--bare --tools ""` means Claude sees tool-call history in a no-tools context. The model may reject this or hallucinate tool u
...[truncated]
```

### C1 direct_resume run 1

- suspicious identifiers not found in repo text: consecutive_refresh_failures, cluster_volatile_evidence
- score: 2
- response: responses/direct_resume_C1_run1.txt

```txt
Here are three concrete improvements to `cluster_refresh` that preserve existing semantics:

---

### 1. Per-fact scoped revalidation (not all-or-nothing staleness)

**Current behavior** (`src/clusterRefresh.ts:50-68`): any changed file in `cluster_file_hashes` marks the entire factsheet stale — even if only 1 of 20 facts depends on the changed file.

**Improvement**: Before marking stale, cross-reference `changedFiles` against each fact's evidence paths. Only mark the factsheet stale if facts covering those files can't be re-verified. This avoids penalizing unrelated facts and reduces unnecessary `cluster_prepare` churn.

The `clusterEvidenceRevalidation.ts` logic already does selector-level checking — the gap is that `cluster_refresh` doesn't use it as a pre-staleness filter; it goes str
...[truncated]
```

### C1 direct_resume run 2

- suspicious identifiers not found in repo text: cluster_evidence_volatile
- score: 2
- response: responses/direct_resume_C1_run2.txt

```txt
Three concrete improvements to `cluster_refresh` that preserve existing semantics:

---

### 1. Per-fact scoped revalidation (not all-or-nothing staleness)

**Current** (`src/clusterRefresh.ts:50-68`): any changed file marks the entire factsheet stale — even if only 1 of 20 facts depends on it.

**Improvement**: cross-reference `changedFiles` against each fact's evidence paths before marking stale. Only mark the factsheet stale if facts citing those files can't be individually re-verified. This avoids unnecessary `cluster_prepare` churn and lets a changed file in an uncited path keep the cluster active. The `clusterEvidenceRevalidation.ts` selector-level checking already proves this is feasible — the gap is that `cluster_refresh` doesn't use it as a pre-staleness filter.

---

### 2. Incre
...[truncated]
```

### C1 direct_resume run 3

- suspicious identifiers not found in repo text: cluster_evidence_volatile
- score: 2
- response: responses/direct_resume_C1_run3.txt

```txt
Same answer as before — three concrete improvements to `cluster_refresh` that preserve existing semantics:

---

### 1. Per-fact scoped revalidation (not all-or-nothing staleness)

**Current** (`src/clusterRefresh.ts:50-68`): any changed file in `cluster_file_hashes` marks the entire factsheet stale — even if only 1 of 20 facts depends on it.

**Improvement**: cross-reference `changedFiles` against each fact's evidence paths before marking stale. Only mark the factsheet stale if facts citing those files can't be individually re-verified. The `clusterEvidenceRevalidation.ts` selector-level logic already proves this is feasible — the gap is that `cluster_refresh` skips directly to binary stale/unchanged without using it as a pre-staleness filter. This avoids unnecessary `cluster_prepare` chu
...[truncated]
```

### C1 cluster_consult run 1

- suspicious identifiers not found in repo text: depends_on
- score: 3
- response: responses/cluster_consult_C1_run1.txt

```txt
Based on the verified factsheet, three concrete directions:

1. **AST selectors over line-based selectors**  
   The spec flag `cluster-refresh-selector-improvement-open-question` names this explicitly as an open question: store AST selectors or exact line ranges (or both) instead of relying solely on file-hash + selector pairs. AST selectors survive non-semantic whitespace or formatting edits, reducing false stale detections without changing verify_only semantics.

2. **partial_lm fallback on static re-verification failure**  
   Currently verify_only only does static re-verification and marks stale when hashes change or facts are rejected. Adding an LLM pass on remaining stale facts (under a per-cluster lock) would capture semantic drift that pure hash checks miss — preserving the same t
...[truncated]
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
| A1 | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) |
| A2 | 3/3/3 (3.00) | 2/2/2 (2.00) | 3/3/3 (3.00) |
| A3 | 0/0/0 (0.00) | 2/2/2 (2.00) | 3/1/3 (2.33) |
| A4 | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) |
| A5 | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) |
| B1 | 2/3/3 (2.67) | 3/3/3 (3.00) | 3/2/2 (2.33) |
| B2 | 3/3/2 (2.67) | 3/3/3 (3.00) | 2/3/3 (2.67) |
| B3 | 3/3/3 (3.00) | 3/3/3 (3.00) | 3/3/3 (3.00) |
| C1 | 2/2/2 (2.00) | 2/2/2 (2.00) | 3/3/3 (3.00) |
| C2 | 2/2/2 (2.00) | 2/0/2 (1.33) | 3/2/2 (2.33) |

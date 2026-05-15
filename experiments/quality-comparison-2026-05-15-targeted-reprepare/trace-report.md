# Quality Trace Report

Generated: 2026-05-15T08:44:09.118Z
Matrix: experiments/quality-comparison-2026-05-15-targeted-reprepare/matrix.csv

## Executive Trace

- Rows: 20
- Methods: direct_resume, cluster_consult
- Questions: A1, A2, A3, A5, B2
- Low/error rows: 6
- NOT IN CONTEXT rows: 0
- Suspicious identifier rows: 0
- Session parse_failed events in router DB dump: 1
- Session parse_failed events since this run started: 0
- Response rows mentioning SESSION_UPDATE_JSON/parse warning: 0

## Question Leaks

| Question | Kind | Gap | direct_fresh | direct_resume | cluster_consult |
|---|---|---:|---:|---:|---:|
| A3 | cluster_low_score |  |  | 1 | 1 |
| B2 | direct_resume_beats_cluster | 1 | NaN | 3 | 2 |

## Low/Error Rows

### A2 direct_resume run 1

- score: 1
- notes: missing some cluster event types; matched 10/19
- response: responses/direct_resume_A2_run1.txt

```txt
Based on grep results across the codebase, the `cluster_events` table receives these event types:

| Event Type | Source |
|---|---|
| `cluster_created` | `src/db.ts:688` |
| `cluster_refresh` | `src/clusterRefresh.ts:97` |
| `cluster_refresh_required` | `src/clusterConsult.ts:68` |
| `cluster_consult` | `src/clusterConsult.ts:119` |
| `cluster_consult_failed` | `src/clusterConsult.ts:147` |
| `cluster_fallback_to_claude_consult` | `src/tools.ts:847` |
| `cluster_fallback_failed` | `src/tools.ts:847` |
| `factsheet_rejected` | `src/cluster.ts:210, 451` |
| `llm_verifier` | `src/cluster.ts:235` |
| `evidence_revalidation_failed` | `src/clusterEvidenceRevalidation.ts:100` |

Note: `cluster_consult_fallback` appears in `src/tools.ts:835` as a **trigger name** (for the `cluster_consult_fallback` tool), not as an event type written to the table.
```

### A3 direct_resume run 1

- score: 1
- notes: captures only part of caller-facing stale behavior; matched 3/6
- response: responses/direct_resume_A3_run1.txt

```txt
When the factsheet is stale in `cluster_consult`, the flow at `src/clusterConsult.ts:62-79` is:

1. **`findStaleFiles()`** compares stored file hashes against current on-disk files (lines 198-214). Any file that changed, was deleted, or can't be read is flagged stale.

2. **If stale files exist** (line 63):
   - `db.markClusterFactsheetStale()` — marks the factsheet as stale in the DB
   - `db.logClusterEvent({ eventType: "cluster_refresh_required" })` — logs the event with details on which files changed
   - Returns an **`ErrorPayload`** with `ERROR_CODES.CLUSTER_FACTSHEET_STALE` — the MCP call fails with an error

3. **The caller** (in `src/tools.ts`) is expected to catch this error and fall back to regular `claude_consult`, re-issuing the question without the factsheet context.

So the stale factsheet causes an **early return with an error**, not a silent fallback — the caller must handle the fallback explicitly. The error message is: `"Cluster factsheet is stale. Run cluster_refresh before consulting."` (from `src/errors.ts:43`).
```

### A2 direct_resume run 2

- score: 1
- notes: missing some cluster event types; matched 10/19
- response: responses/direct_resume_A2_run2.txt

```txt
Based on cross-referencing all writes to `cluster_events` in the codebase:

| Event Type | Source |
|---|---|
| `cluster_created` | `src/db.ts:688` |
| `cluster_refresh` | `src/clusterRefresh.ts:97` |
| `cluster_refresh_required` | `src/clusterConsult.ts:68` |
| `cluster_consult` | `src/clusterConsult.ts:119` |
| `cluster_consult_failed` | `src/clusterConsult.ts:147` |
| `cluster_fallback_to_claude_consult` | `src/tools.ts:847` |
| `cluster_fallback_failed` | `src/tools.ts:847` |
| `factsheet_rejected` | `src/cluster.ts:210, 451` |
| `llm_verifier` | `src/cluster.ts:235` |
| `evidence_revalidation_failed` | `src/clusterEvidenceRevalidation.ts:100` |

Notably, `cluster_fallback_to_claude_consult` and `cluster_fallback_failed` are written by the fallback handler in `src/tools.ts`, not by `clusterConsult.ts` itself — the consult path returns an error, and the caller (fallback trigger) logs which path it took.
```

### A3 direct_resume run 2

- score: 1
- notes: captures only part of caller-facing stale behavior; matched 3/6
- response: responses/direct_resume_A3_run2.txt

```txt
When the factsheet is stale in `cluster_consult` (`src/clusterConsult.ts:62-79`):

1. **`findStaleFiles()`** (line 198-214) compares stored file hashes against current on-disk files — any file that changed, was deleted, or can't be read is flagged stale.

2. **If stale files exist** (line 63):
   - `db.markClusterFactsheetStale()` — marks the factsheet stale in the DB
   - `db.logClusterEvent({ eventType: "cluster_refresh_required" })` — logs with changed file details
   - Returns **`ErrorPayload`** with `ERROR_CODES.CLUSTER_FACTSHEET_STALE` — the MCP call fails immediately

3. **The caller** (fallback trigger in `src/tools.ts`) catches this error and re-issues the question via regular `claude_consult`, preserving the answer.

The error message is `"Cluster factsheet is stale. Run cluster_refresh before consulting."` (`src/errors.ts:43`).
```

### A3 cluster_consult run 1

- score: 1
- notes: captures only part of caller-facing stale behavior; matched 3/6
- response: responses/cluster_consult_A3_run1.txt

```txt
Based on the verified factsheet:

When `cluster_consult` encounters a stale factsheet (internal `CLUSTER_FACTSHEET_STALE` error), it does the following:

1. **If autoRefresh is enabled**: it revalidates evidence under a per-cluster lock (using `runtime.locks.withLock` with the key `cluster-evidence-revalidation:<clusterId>`) by calling `revalidateClusterEvidence()`.

2. **If revalidation fails or autoRefresh is disabled**: it falls back internally to `claude_consult` and returns an answer to the caller.

Additionally, the low-level `consultCluster` function itself marks the factsheet stale, writes `cluster_refresh_required` to `cluster_events`, and returns `CLUSTER_FACTSHEET_STALE` internally when scoped evidence files are stale.
```

### A3 cluster_consult run 2

- score: 1
- notes: captures only part of caller-facing stale behavior; matched 3/6
- response: responses/cluster_consult_A3_run2.txt

```txt
Two layers of behavior are defined:

**Low-level `consultCluster`** (stale-cluster-consult-behavior): When scoped evidence files are stale, it marks the factsheet stale, writes a `cluster_refresh_required` event to `cluster_events` (with `changed_files` in the details), and returns `CLUSTER_FACTSHEET_STALE` internally.

**Caller-facing `cluster_consult` tool** (caller-facing-stale-cluster-consult-behavior): It consumes that internal error — if `autoRefresh` is enabled it revalidates evidence under a per-cluster lock (`cluster-evidence-revalidation:`); if revalidation fails or `autoRefresh` is disabled, it falls back internally to `claude_consult` and returns an answer to the caller.
```

## NOT IN CONTEXT Rows

None.

## Suspicious Identifier Claims

None.

## SESSION_UPDATE_JSON Audit

The 90-call quality benchmark compares direct Claude modes and cluster_consult. It does not fully exercise claude_consult metadata parsing unless a fallback path invokes claude_consult. SESSION_UPDATE_JSON quality must therefore be tracked through session_events and targeted claude_consult tests, not only answer quality scores.

Code audit note: parse_failed events now include raw_response_path when the raw Claude response was already written, so monitor output can point operators to the exact failed response.

Recent parse_failed samples from session_events_dump.json:

- id=17 session_id=session_634d7cd0-ec7c-4473-a93d-ea5c27b700e0 created_at=2026-05-12T01:15:26.394Z
  error=SESSION_UPDATE_JSON block missing
  raw_response_path=null

## Method/Question Score Grid

| Question | direct_resume | cluster_consult |
|---|---:|---:|
| A1 | 3/3 (3.00) | 3/3 (3.00) |
| A2 | 1/1 (1.00) | 2/2 (2.00) |
| A3 | 1/1 (1.00) | 1/1 (1.00) |
| A5 | 3/3 (3.00) | 3/3 (3.00) |
| B2 | 3/3 (3.00) | 2/2 (2.00) |

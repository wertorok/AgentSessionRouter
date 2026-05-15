# Quality Trace Report

Generated: 2026-05-15T08:52:03.503Z
Matrix: experiments/quality-comparison-2026-05-15-targeted-reprepare-v2/matrix.csv

## Executive Trace

- Rows: 10
- Methods: cluster_consult
- Questions: A1, A2, A3, A5, B2
- Low/error rows: 0
- NOT IN CONTEXT rows: 1
- Suspicious identifier rows: 0
- Session parse_failed events in router DB dump: 1
- Session parse_failed events since this run started: 0
- Response rows mentioning SESSION_UPDATE_JSON/parse warning: 0

## Question Leaks

| Question | Kind | Gap | direct_fresh | direct_resume | cluster_consult |
|---|---|---:|---:|---:|---:|
| B2 | cluster_not_in_context |  |  |  | 3 |

## Low/Error Rows

None.

## NOT IN CONTEXT Rows

### B2 cluster_consult run 2

- score: 3
- notes: walks orphan recovery path; includes NOT IN CONTEXT caveat
- response: responses/cluster_consult_B2_run2.txt

```txt
## Orphan Recovery Code Path

Based on the verified factsheet, here's the walkthrough when a `.jsonl` file is deleted before a `claude_consult` call:

### Step 1: Session File Check Fails

`claude_consult` checks whether the stored Claude session file still exists:

```ts
// src/consult.ts
sessionFileExists(session.claude_session_id)
```

If it doesn't → **orphan path triggered**.

### Step 2: Session Marked Orphaned

The router marks the old registry session as orphaned:

```ts
// src/consult.ts
this.runtime.db.markSessionOrphaned(session.id)
```

`markSessionOrphaned` in `src/db.ts` does two things:
1. Sets session `status = 'orphaned'` in the DB
2. Writes an `orphan_recovery` event to `cluster_events`

### Step 3: Bootstrap Context Built from Old View

The system reads the old session's registry view and builds a bootstrap context from it:

```ts
// src/consult.ts
bootstrapContext: oldView ? buildBootstrapContext(oldView, "orphaned") : undefined
```

### Step 4: Replacement Route Created

A new registry session is created, and `wasOrphanRecovery` is set to `true`:

```ts
// src/consult.ts
wasOrphanRecovery: true
```

### Step 5: New Session Persisted

When `invokeClaude` runs wi
...[truncated]
```

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

| Question | cluster_consult |
|---|---:|
| A1 | 3/3 (3.00) |
| A2 | 3/3 (3.00) |
| A3 | 3/2 (2.50) |
| A5 | 3/3 (3.00) |
| B2 | 3/3 (3.00) |

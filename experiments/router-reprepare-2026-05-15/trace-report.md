# Quality Trace Report

Generated: 2026-05-15T16:31:43.460Z
Matrix: experiments/router-reprepare-2026-05-15/matrix.csv

## Executive Trace

- Rows: 1
- Methods: cluster_consult
- Questions: A3
- Low/error rows: 0
- NOT IN CONTEXT rows: 0
- Suspicious identifier rows: 0
- Session parse_failed events in router DB dump: 2
- Session parse_failed events since this run started: 0
- Response rows mentioning SESSION_UPDATE_JSON/parse warning: 0

## Question Leaks

No direct-vs-cluster leaks detected by threshold.

## Low/Error Rows

None.

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
- id=102 session_id=session_11d18ee8-3799-443f-8f5f-ecd866db9e57 created_at=2026-05-15T16:25:22.926Z
  error=SESSION_UPDATE_JSON block missing
  raw_response_path=/root/projects/AgentSessionRouter/.claude-session-router/raw/session_11d18ee8-3799-443f-8f5f-ecd866db9e57-1778862322925.txt

## Method/Question Score Grid

| Question | cluster_consult |
|---|---:|
| A3 | 3 (3.00) |

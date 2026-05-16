# Phase 7 Gate 13 Design Summary: Runtime Serving Boundary

Gate 13 is a design gate only. It does not implement runtime import/serving and
does not change router behavior.

## Decision

Architectural-memory serving should seed selected engineering principles once
when creating a durable lead session.

It should not retrieve architectural memory on every `router_consult` by
default.

## Why

- Engineering principles are stable enough to seed once.
- Durable lead sessions already preserve context across turns.
- Per-consult retrieval would add recurring token cost and would risk
  recreating the broad discovery/context-bloat problem the router was built to
  avoid.
- Most consults are lookup, debug, monitor, benchmark, or implementation
  requests and should not touch architectural memory at all.

## Selection

The future serving path must use deterministic prefiltering, not an LLM pass
over all active records.

Default pool:

- Include active `engineering-principles`.
- Exclude `project-architecture` from global lead-session seed.
- Allow at most 3 project-architecture records only for explicit
  project-scoped lead sessions.

Signals:

- session kind and task type
- `topic_hint`, `tags`, and `related_files`
- record `statement`, `applies_when`, `revisit_when`, `counter_evidence`, and
  `provenance`

The selection result must be auditable through selected ids, scores, matched
signals, skipped records, and token budget result.

## Token Budget

Current active corpus after Gate 12.5:

| Corpus | Count | Approx tokens/record | Approx total |
| --- | ---: | ---: | ---: |
| Engineering principles | 13 | 140 | 1,820 |
| Project architecture | 80 | 140 | 11,200 |
| All active records | 93 | 140 | 13,020 |

Injecting all active records is forbidden.

Future seed limits:

| Budget item | Limit |
| --- | ---: |
| Engineering-principle records | max 7 |
| Compact seed text | target < 900 tokens |
| Project-architecture records | default 0 |
| Project-scoped add-on | max 3 records and max 300 additional tokens |
| Absolute one-time seed cap | 1,200 tokens |
| Per-consult architectural-memory cost | 0 tokens by default |

The compact seed should carry only id, statement, short applicability condition,
short counter-evidence condition, and provenance pointer. The source-of-truth
docs remain the authority.

## Deduplication

A future implementation must store a seed manifest in session metadata or an
append-only session decision. The manifest records source docs, selected ids,
record hashes, seed signature, timestamp, and deterministic selection reasons.

Before reseeding, the router compares the current deterministic selection with
the session seed manifest. Matching signatures skip injection. Deltas are
seeded only if they stay within budget. Substantial changes require explicit
reseed instead of silent replacement.

## Trigger Boundary

Allowed:

- durable lead-session creation
- explicit project lead-session creation with architectural-memory seed
- explicit reseed after source-of-truth docs changed

Disallowed:

- normal `router_consult`
- `cluster_consult` factual lookup
- debug, lookup, benchmark, and monitor calls unless explicitly escalated into
  lead-session architectural review

## Status

- Runtime import/serving enabled: false
- Runtime code changes: none
- Cluster writes: none
- Router answer behavior changes: none

## Lead Review

The durable Claude lead session reviewed the compact Gate 13 design and returned
`APPROVE_SCOPE`.

Lead review confirmed that the design addresses the required concerns:

- serving cannot become a 12k-per-turn discovery blob because full-corpus
  injection is forbidden and the absolute one-time seed cap is 1,200 tokens;
- selection cannot run an LLM over all records because the design requires a
  deterministic prefilter with auditable ids, scores, matched signals, and skip
  reasons;
- repeated injection is prevented by a seed manifest and `seed_signature`;
- normal consults do not touch architectural memory because triggers are
  limited to lead-session creation or explicit reseed paths.

Lead review also confirmed that implementation remains blocked on explicit
sign-off for the canonical import boundary.

Gate 13 implementation remains blocked until there is explicit sign-off on the
canonical import boundary and a proof that the seed stays below the token budget.

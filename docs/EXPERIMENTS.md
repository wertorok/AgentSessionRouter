# AgentSessionRouter Experiments

## 2026-05-12: Cluster Skeleton, Tool Profiles, and Fork Reuse

### Baseline Failure

Original broad issue-planning consult:

- Duration: 264.8s
- Input tokens: 56,051
- Output tokens: 4,237
- Tool calls: `Agent`, `Glob`, `Read`
- Cause: Claude Code treated the planning request as a codebase exploration task, launched an Explore subagent, globbed the project, and read many files.

Key finding: correct MCP `cwd` prevented cross-project bleed, but did not prevent redundant in-project discovery.

### Prompt Prohibition Only

Curated project skeleton plus explicit instruction not to use `Agent`, `Glob`, `Read`, or directory exploration:

- Duration: 42.6s
- Input tokens: 187
- Cache creation input tokens: 41,059
- Output tokens: 1,881
- Tool calls: none
- Cost: 0.3046 USD

Finding: prompt prohibition works, but normal Claude Code mode still pays a large baseline/cache-creation cost.

Risk found: incomplete skeleton caused hallucinated API/config fields.

### `--tools ""` With Current Skeleton

Same incomplete skeleton, hard tool disable:

- Duration: 68.0s
- Input tokens: 17,208
- Cache creation input tokens: 0
- Output tokens: 1,803
- Tool calls: none
- Cost: 0.1311 USD

Finding: `--tools ""` works with the current auth setup and removes the large Claude Code cache-creation baseline.

Risk found: incomplete skeleton still causes hallucinated fields.

### `--tools ""` With Verified Factsheet

Verified factsheet plus hard tool disable:

- Duration: 28.0s
- Input tokens: 17,587
- Cache creation input tokens: 0
- Output tokens: 1,168
- Tool calls: none
- Cost: 0.1171 USD

Finding: a verified factsheet removes most hallucinated API/config claims. If facts are missing, Claude tends to answer `NOT IN CONTEXT` instead of inventing when instructed.

### `--bare` Auth Probe

Command:

```bash
claude -p --bare --tools "" --output-format json "Return exactly: BARE_OK"
```

Result:

- Duration: 1.7s
- Cache creation input tokens: 258
- Cost: 0.0026 USD
- Status: success

Finding: `--bare` works in this environment despite its documented caveat that it does not read OAuth/keychain credentials. This likely depends on the local auth setup.

### `--bare --tools ""` With Verified Factsheet

- Duration: 36.8s
- Input tokens: 1,170
- Cache creation input tokens: 0
- Output tokens: 1,220
- Tool calls: none
- Cost: 0.0364 USD

Finding: `--bare --tools ""` is the best fresh-call profile observed so far for a complete factsheet.

### `--bare --tools "" --resume BASELINE --fork-session`

Fork from the bare verified-factsheet session, then send only a short follow-up question:

- Duration: 11.5s
- Input tokens: 2,002
- Cache creation input tokens: 0
- Output tokens: 458
- Tool calls: none
- Cost: 0.0215 USD

Finding: `--fork-session` exists and works. The fork retained factsheet context without resending the full factsheet.

Risk found: if the follow-up question is under-scoped, the fork can still introduce a plausible but unrequested next step. Forked consults need strict scope and output contracts.

### Non-Bare `--tools "" --resume BASELINE --fork-session`

Fork from the non-bare verified-factsheet session:

- Duration: 12.2s
- Input tokens: 37
- Cache creation input tokens: 18,299
- Output tokens: 539
- Tool calls: none
- Cost: 0.1280 USD

Finding: non-bare fork keeps a large Claude Code baseline cost. It is faster than fresh, but not cheaper than bare.

### MCP Phase 2 LLM Verifier Implementation

One live `cluster_prepare` run through the implemented LLM verifier path:

- Profile: `focused` (`--tools ""`)
- Duration: 21.9s
- Input tokens: 13,407
- Output tokens: 325
- Result: `partial_llm`
- Verified facts: 1
- Rejected facts: 1

Scenario: static verifier accepted both facts because both selectors appeared in the file, including a false `claude.policy` claim present only in a comment. The LLM verifier promoted the real `extraArgs` fact and rejected the false `claude.policy` field claim.

Finding: the LLM verifier closes the semantic gap left by static evidence checks and correctly distinguishes selector presence from supported API/config truth.

## Decisions

- Use verified factsheet cache as source of truth. Do not use opaque Claude session state as the only source of truth.
- Treat fork as an acceleration layer over a verified factsheet baseline, not as the durable knowledge store.
- Preferred profiles:
  - `bare`: `--bare --tools ""` for complete verified factsheets and low-risk planning.
  - `focused`: `--tools ""` or explicit allowed/denied tool args when `--bare` is unavailable.
  - `agent`: full Claude Code exploration only when factsheet is missing or invalid.
- Replace human review with automated verification: explore -> distill -> verify -> cache; on failure, run focused refresh or mark cluster untrusted.

## Open Risks

- `--bare` auth compatibility may vary by machine because it bypasses OAuth/keychain reads.
- Factsheet incompleteness leads either to `NOT IN CONTEXT` or hallucination, depending on prompt strictness.
- Forked sessions can carry opaque state and must stay cluster-scoped.
- Cache invalidation must be scoped to files that support the factsheet, not the whole repository.

## Proposed Next Design

Cluster cache/fork layer:

- `clusters`: id, project id, name, tool profile, baseline session id, trust state.
- `cluster_factsheets`: cluster id, version, content, git rev, evidence hashes, created at.
- `cluster_files`: cluster id, path, hash, last verified.
- `cluster_prepare`: explore, distill, verify, and save factsheet.
- `cluster_get`: inspect cluster metadata and factsheet.
- `cluster_consult`: invoke Claude with factsheet and optionally fork from baseline.
- `cluster_refresh`: revalidate factsheet against current file hashes.
- `cluster_list`: list project clusters.

Invalidation rule:

- On consult, check hashes only for files cited by the current factsheet.
- If mismatch is found, do not silently auto-refresh. Return a refresh-required diagnostic or run a configured automated refresh policy.

The resulting draft specification is in `docs/CLUSTER_CACHE_SPEC.md`.

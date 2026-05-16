# v2.7 Router Test And Cluster Re-Prepare

Date: 2026-05-16

## What Was Tested

- `npm run build`
- `npm test`
- `npm run smoke:postinstall`
- `npm run mcp:workload`
- live `npm run router:sanity`
- live `router_dry_run`
- live `router_consult` through explicit `agentsessionrouter-codebase` cluster

## Results

- Build: passed
- Unit/integration tests: 98 passed
- Post-install MCP smoke: passed, 19 tools discovered
- MCP workload matrix: passed, 23/23 checks
- Live router sanity after re-prepare: passed
- `router_dry_run`: returned a route decision without invoking Claude, writing route events, applying lifecycle changes, or creating sessions

## Important Finding

The first live sanity run after v2.7 found `agentsessionrouter-codebase` stale.
That was expected because v2.7 changed files cited by the factsheet:

- `MAINTENANCE.md`
- `README.md`
- `package.json`
- `src/consult.ts`
- `src/matching.ts`
- `src/tools.ts`
- `tests/tools.test.ts`

The router itself behaved correctly:

- `router_dry_run` worked as observe-only preview
- `router_status` exposed the stale cluster
- `router:sanity` skipped the explicit cluster scenario before re-prepare

## Re-Prepare Attempt 1

The first re-prepare reused the previous factsheet content with old evidence
`hash` and `snippet_hash` fields still attached.

Result:

- factsheet version: 6
- trust state: `partial_llm`
- verified facts: 4
- rejected facts: 12

This was not a model-quality failure. It was a maintenance procedure mistake:
old evidence hashes were passed back as input, so static verification correctly
rejected them as hash mismatches.

Operational rule:

When re-preparing a cluster from an existing factsheet, strip stored evidence
`hash` and `snippet_hash` fields first. `cluster_prepare` must recalculate
those values from the current files.

## Re-Prepare Attempt 2

The second re-prepare used factsheet v5 as the source, removed old evidence
hashes/snippet hashes, added v2.7 facts, and ran `cluster_prepare` with
`verification_mode: "llm"`.

Result:

- cluster: `agentsessionrouter-codebase`
- factsheet version: 7
- trust state: `llm_verified`
- verified facts: 16
- rejected facts: 0

New v2.7 facts added:

- `router_dry_run` is observe-only and does not invoke Claude, write route
  events, apply lifecycle changes, or create sessions.
- MCP tool descriptions use tier labels: `[ANSWER DEFAULT]`,
  `[ANSWER EXPERT]`, `[OBSERVE]`, `[MAINTAIN]`, `[EVAL DEBUG]`.
- Public MCP surface has 19 tools and includes `router_dry_run`.

## Post-Reprepare Verification

`cluster_refresh verify_only`:

- fresh: true
- factsheet version: 7
- factsheet status: `llm_verified`
- trust state: `llm_verified`
- rejected facts: 0

Explicit cluster consult through `router_consult`:

- selected path: `cluster_consult_explicit`
- cluster: `agentsessionrouter-codebase`
- factsheet version: 7
- factsheet status: `llm_verified`
- duration: 5667ms
- reported cost: $0.04641875
- answer correctly described `router_dry_run`

Live `router:sanity` after re-prepare:

- ok: true
- explicit cluster route: passed
- existing session route: passed
- router status: normal

Remaining warnings were historical telemetry from the recent window, not current
v2.7 failures:

- previous `factsheet_stale` events
- previous `cost_limit_exceeded`
- previous `parse_failed`
- one historical slow broad `new_session`

## Conclusion

v2.7 routing mechanics work:

- `router_consult` remains the main answer path.
- `router_dry_run` works as observe-only routing preview.
- Tool tier labels are visible through MCP discovery.
- The active codebase cluster is current again at factsheet v7.

The main maintenance lesson is to treat generated evidence hashes as output,
not reusable source input, during cluster re-prepare.

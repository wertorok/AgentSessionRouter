# Phase 7 Gate 14 Summary: Architectural Memory Monitor Visibility

Gate 14 added read-only architectural-memory telemetry to `router_status` and
`router_monitor`.

## Scope

- Observability only.
- Reads existing source-of-truth docs and audit artifacts.
- Does not import or serve architectural memory at runtime.
- Does not write clusters.
- Does not change router answer behavior.

## Exposed Telemetry

`router_status.architectural_memory` and
`router_monitor.health.architectural_memory` now include:

- `active_records`
- `proposed_records`
- `suspended_records`
- `suspended_audit_records`
- `rejected_audit_records`
- `excluded_records`
- `rejected_or_suspended_audit_records`
- `runtime_import_serving_enabled`
- per-document counts for `docs/ENGINEERING_PRINCIPLES.md` and
  `docs/PROJECT_ARCHITECTURE.md`
- audit artifact paths when present
- warnings for missing docs/artifacts or active-date mismatches

## Live Check

The live MCP `router_monitor` call before Gate 12.5 reported:

- active records: 88
- proposed records: 0
- suspended records in active docs: 0
- suspended audit records: 3
- rejected audit records: 20
- excluded records: 5
- runtime import/serving enabled: false
- warnings: none

After Gate 12.5 classification correction, architectural-memory telemetry
reports 93 active records, 5 rescued-from-rejected records, and 15 remaining
rejected audit records.

## Verification

- `npm run build`
- `npm test` (107 passed)
- live MCP `router_monitor`
- durable lead-session post-implementation review: `APPROVE_SCOPE`

## Next Boundary

Gate 13 remains future work. Runtime import/serving still requires a separate
design gate and human sign-off on the canonical URL/import boundary.

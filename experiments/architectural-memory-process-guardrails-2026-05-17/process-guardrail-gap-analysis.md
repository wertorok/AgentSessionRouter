# Process Guardrail Gap Analysis

Generated: 2026-05-17

Scope: MAINTENANCE.md disciplines that affect engineering behavior but are not currently active `engineering-principles` records and therefore will not be seeded by runtime architectural-memory serving.

## Promoted In This Phase

| Guardrail | Active record | Status |
| --- | --- | --- |
| Single successful runs do not prove behavior under variance | `AMB-RESCUE-0006` | promoted |
| Refactor/extract labels must not hide semantic behavior changes | `AMB-RESCUE-0007` | promoted after revision-2 lead approval |

## Remaining Serving Gaps

| Source | Discipline | Current status | Suggested treatment |
| --- | --- | --- | --- |
| `MAINTENANCE.md#storage-health-diagnostics` | Fix storage health before trusting route quality, session memory, shadow comparisons, or monitor trends. | documented only | Candidate transferable infrastructure-health principle. |
| `MAINTENANCE.md#adversarial-proof-matrix` | Use adversarial proof for API/routing safety changes; `BROKEN=0` is necessary for safety surfaces. | documented only | Candidate transferable proof-discipline principle, but must be scoped so it does not replace quality benchmarks. |
| `MAINTENANCE.md#consultation-routing-invariant` | Normal caller entry point is `router_consult`; lower-level tools are maintenance/debug unless explicitly selected. | documented only | Mostly project/product API discipline; likely project-architecture unless generalized to "use highest-level safe abstraction by default." |
| `MAINTENANCE.md#live-route-sampling` | Use live route sampling to inspect real routing behavior and pseudo-tool leaks. | documented only | Project-specific operational procedure; keep docs-only unless generalized later. |
| `MAINTENANCE.md#session-continuity-benchmark` | Use session continuity, not fan-out shadow comparison, to test durable multi-turn memory. | documented only | Strong transferable evaluation-method principle. |
| `MAINTENANCE.md#session-routing-collision-analysis` | Inspect routing collision/ambiguity risk; current routing is safe-conservative, not proven optimal. | documented only | Candidate transferable routing-calibration principle. |
| `MAINTENANCE.md#route-calibration-report` | Do not tune routing weights without accumulated route-decision data and metadata-quality inspection. | documented only | Candidate transferable calibration principle. |
| `MAINTENANCE.md#monitor-signal-filtering-invariants` | `NOT IN CONTEXT` with high judge score is an honest caveat, not a coverage failure. | documented only | Candidate transferable scorer/monitor interpretation principle. |
| `MAINTENANCE.md#cluster-factsheet-re-prepare` | Re-prepare factsheets after architecture-affecting PRs or monitor quality drops; validate targeted then full matrix. | documented only | Mostly project-specific maintenance workflow; transferable cache-maintenance core exists but should be rewritten before promotion. |
| `MAINTENANCE.md#cluster-factsheet-re-prepare` | `SESSION_UPDATE_JSON`/metadata update correctness must be tested separately from answer quality. | documented only | Candidate transferable metadata-side-effect testing principle. |
| `MAINTENANCE.md#operatorless-engineering-workflow` | Agent-led phase loop with Codex executor, Claude lead memory, narrow workers, human only for true product/risk decisions. | documented only | Workflow/product operating model; likely project-architecture unless generalized for multi-agent systems. |
| `MAINTENANCE.md#phase-loop` | Each phase defines proof artifacts, checks monitor when relevant, consults lead on architecture changes, verifies risk, and ends with evidence bundle. | documented only | Candidate transferable phase-governance principle if rewritten compactly. |
| `MAINTENANCE.md#when-codex-proceeds-alone` | Proceed without lead only when contracts/routing/monitor/scorer baselines are not affected and tests define expected behavior. | documented only | Mostly project role policy; keep docs-only or project-architecture. |
| `MAINTENANCE.md#when-codex-consults-the-claude-lead-session` | Consult lead when architecture paths conflict, routing/session/cache/monitor/scorer semantics change, or proof interpretation is ambiguous. | documented only | Workflow policy; could become transferable lead-consultation principle later. |
| `MAINTENANCE.md#phase-end-bundle` | Completed phases leave commits/files, proof commands, monitor/benchmark artifacts, risks, and lead conclusion. | documented only | Candidate transferable evidence-bundle principle. |
| `MAINTENANCE.md#human-touchpoint` | Human touchpoint is phase-end summary; mid-phase human interruption is not default workflow. | documented only | Product/operating model; likely project-architecture or external workflow doc, not global engineering principle. |
| `MAINTENANCE.md#deferred-technical-debt` | Split large tests only after behavior-preserving refactors are proven; defer db split/stringly telemetry/config cleanup. | partially covered by `AMB-RESCUE-0007` | Remaining items are project-specific deferred debt, not active corpus candidates. |
| `MAINTENANCE.md#adversarial-proof-matrix` | O(N) session matching scaling limit has a 250-300ms/~1000-session trigger for future indexing. | documented only | Project-specific scaling trigger; keep project-architecture unless generalized through measured threshold policy. |

## Interpretation

After promoting `AMB-RESCUE-0006` and `AMB-RESCUE-0007`, the biggest remaining transferable gaps are evaluation-method discipline:

1. session continuity vs fan-out shadow evaluation,
2. route calibration before tuning weights,
3. monitor/scorer signal filtering (`NOT IN CONTEXT` high-score caveats),
4. metadata side-effect tests separate from answer quality,
5. phase-end evidence bundle.

Do not batch-promote these without the same staged candidate + lead review path. The classifier is still known-weak, and many MAINTENANCE.md items are local operating model or project-architecture records rather than transferable engineering principles.

## Prioritized Backlog

Do not promote the remaining gaps as a batch. The architecture is already closed;
these are corpus-quality additions for future lead sessions.

Next candidates, when work resumes:

1. `continuity-vs-shadow`: use session-continuity style tests for durable
   multi-turn memory; use shadow/fan-out A/B only for independent answer
   comparisons. This was a recurring measurement lesson in Gate 13 and applies
   to any project that evaluates persistent agent memory.
2. `not-in-context-not-coverage-failure`: `NOT IN CONTEXT` with a high-quality
   answer is an honest caveat/audit signal, not automatically a coverage
   failure. This was a recurring scorer/monitor interpretation lesson across
   cluster benchmarks.

Both must follow the full path before active promotion:

1. formulate transferable candidate with concrete `applies_when`,
   `revisit_when`, `provenance`, and non-empty `counter_evidence`
2. lead review through `router_consult`
3. expect and accept rejection if the wording is project-specific
4. rewrite if needed, as with `AMB-RESCUE-0007`
5. targeted seed-selection verification on a relevant lead-session topic

Deferred until a new project makes them concretely relevant:

- `route-calibration-order`
- `SESSION_UPDATE_JSON` / metadata side-effect tests separate from answer quality
- `phase-end-bundle`

# Cross-Project Architectural Memory Governance Review

Generated: 2026-05-17

## Result

Claude lead reviewed the cross-project architectural-memory governance question through `router_consult`.

Route: `claude_consult_existing_session`
Session: `session_11b3d81c-f9e6-4848-88f9-a44adba36b2a`

## Decision

Freeze global promotion pending spec.

New projects may consume the global `engineering-principles` corpus as seed input, but must not promote into it automatically or directly. The global corpus is now shared infrastructure; degrading it degrades all future lead sessions.

## Non-Goals

- No automatic global distill, silent or otherwise.
- No multi-project promote-without-steward-review model.
- No classifier-only global promotion.
- No contradiction propagation without a resolution mechanism.
- No deduplication by wording-sensitive classifier alone.

## Answers To The Five Questions

1. Distill trigger: remains operator-initiated for the foreseeable future. Silent distill remains banned.
2. Enforcement: global promotion must be structurally gated. Current safe model is read-only consumption; future model needs steward gate plus allowlist.
3. Deduplication: submitting project must declare similarity to existing global records with a delta description; steward reviews the delta.
4. Contradictions: tradeoff principles need concrete non-overlap proof in `applies_when` and explicit counter scenarios in `counter_evidence` before global promotion.
5. Steward: no existing option is acceptable. Need a steward-as-service spec before cross-project promotion is allowed.

## Required Spec Work Before Cross-Project Promotion

1. Steward model and authority limits.
2. Substantiveness criteria for `applies_when`.
3. Dedup manifest format.
4. Contradiction resolution path.
5. Corruption recovery for degraded global corpus.

## Phased Path

1. Now: global corpus frozen for promotion; second projects consume only.
2. When needed: steward gate via `router_consult` as a process agreement.
3. After spec: steward-as-service with allowlist and dedup manifest.
4. Later, if corpus grows: automated dedup tooling over the manifest.

No implementation was performed in this review.

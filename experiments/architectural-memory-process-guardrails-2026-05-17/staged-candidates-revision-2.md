# Gate 13 Follow-Up: Process Guardrail Promotion Candidate Revision 2

Generated: 2026-05-17

The first lead review approved `AMB-RESCUE-0006` and rejected the original `AMB-RESCUE-0007` wording as too close to AgentSessionRouter-specific refactoring governance. This revision keeps the transferable core and removes local governance framing.

## Revised Candidate

| id | proposed_classification | statement | applies_when | revisit_when | counter_evidence | provenance |
| --- | --- | --- | --- | --- | --- | --- |
| AMB-RESCUE-0007 | engineering-principles | A refactor label must not smuggle semantic change: if code movement, extraction, or renaming changes behavior, treat that behavior change as a separate claim and prove it separately. | Apply when a change is described as mechanical, behavior-preserving, extraction-only, cleanup, split, rename, or refactor, especially when reviewers or agents may assume the old behavior is unchanged. | When the intended goal is explicitly to change behavior.; When preserving current behavior would keep a confirmed bug or security issue.; When tests prove the mechanical move changed behavior and the work must be reclassified. | If the existing behavior is wrong or unsafe, do not preserve it blindly; explicitly label the behavior change, keep it separate from mechanical movement where practical, and verify it with targeted regression/adversarial checks. | operator-review:AgentSessionRouter-v2.x; docs:MAINTENANCE.md#post-refactor-proof-2026-05-16; docs:MAINTENANCE.md#deferred-technical-debt |

## Lead Review Request

Review only the revised `AMB-RESCUE-0007`.

Return APPROVED only if this revised wording is transferable beyond AgentSessionRouter, operationally sharp, and safe for runtime serving as bounded guidance.

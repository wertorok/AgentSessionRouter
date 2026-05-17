**AMB-RESCUE-0007 (revised) — APPROVED**

The revised wording removed the project-specific governance framing and kept the transferable core. The statement is domain-agnostic: "refactor label," "code movement," "extraction," "renaming," and "semantic change" are universal programming concepts applicable to any codebase. The principle states a universal claim-checking discipline — behavior changes hidden under mechanical labels must be separated and proven separately — which is true in any language, framework, or system.

**What changed from v1 to v2:**
- v1 framed "extract must be separated from logic change" as a prescriptive workflow rule (AgentSessionRouter-specific governance convention)
- v2 frames "do not smuggle semantic change under refactor label" as a claim-validation discipline (universal invariant)

**applies_when** is sharp: applies when reviewers or agents may assume old behavior is unchanged — this is a cross-project failure mode.

**counter_evidence** is correct and non-dogmatic: it explicitly carves out the exception where preserving current behavior would keep a confirmed bug or security issue. This prevents blind preservation.

**Provenance** still traces to MAINTENANCE.md entries, but that is the trigger source, not the binding constraint. The record itself does not depend on AgentSessionRouter-specific conventions to be applied elsewhere.

```json
{"gate":"gate-13-process-guardrail-promotion-revision-2","decisions":[{"id":"AMB-RESCUE-0007","lead_decision":"APPROVED","effective_classification":"engineering-principles","reason":"Universal invariant: do not smuggle semantic change under refactor/mechanical label. Operationally sharp, domain-agnostic concepts, counter-evidence correctly carves out bug/security exception. transferable to any codebase.","scope_condition":"Apply when a change is described as mechanical, behavior-preserving, extraction-only, cleanup, split, rename, or refactor, especially when reviewers or agents may assume the old behavior is unchanged.","counter_evidence":"If the existing behavior is wrong or unsafe, do not preserve it blindly; explicitly label the behavior change, keep it separate from mechanical movement where practical, and verify it with targeted regression/adversarial checks."}],"remaining_ambiguous":[]}

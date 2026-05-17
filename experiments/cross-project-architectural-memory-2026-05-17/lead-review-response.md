# Cross-Project Architectural Memory Governance Lead Review

Generated: 2026-05-17T07:50:12.196Z
Route: claude_consult_existing_session
Session: session_11b3d81c-f9e6-4848-88f9-a44adba36b2a

## Answer

## Cross-Project Architectural Memory Governance: Architecture Decision

### Recommended Current Policy

**Freeze global promotion pending spec.** No second project promotes into the global `engineering-principles` corpus until the enforcement model and stewardship role are specified and signed off. The global corpus currently contains 15 approved engineering-principles (13 original + AMB-RESCUE-0006 + AMB-RESCUE-0007 revised). That corpus is now a shared artifact. Degrading it degrades all future lead sessions.

Second projects may **consume** the global corpus as seed input. They may **not promote** into it until this review produces a durable spec.

---

### Non-Goals

- No automatic global distill, silent or otherwise, under any condition
- No multi-project promote-without-steward-review model
- No classifier-only global promotion without human/steward authority in the loop
- No cross-project contradiction propagation without a resolution mechanism
- No cross-project deduplication by classifier similarity alone

---

### Answers to the 5 Questions

**Q1 — Distill trigger: operator-initiated forever or automatic staged distill?**

Remain operator-initiated for the foreseeable future. The "hybrid bootstrap" decision (operator-curated seed, then auto-distill within a project) was made for good reason — the classifier is known-weak and requires human judgment to correct. Extending that model cross-project means the operator initiating the distill in each project, not automatic triggering. Silent distill was and remains a hard invariant: banned permanently.

**Q2 — Enforcing lead review before global promotion**

The classifier weakness means cross-project promotion cannot be classifier-enforced. The enforcement model must be structural, not policy-based. Options in order of robustness:

1. **Read-only consumption** (current): second project can read global corpus as seed, not write to it. No enforcement problem because there is no write path.
2. **Steward gate**: global promotion requires a designated steward review via `router_consult` with bounded question. Until that steward model is spec'd, no global promotion occurs.
3. **Mechanized allowlist**: after steward approves a candidate, it enters an allowlist with a stable ID. Subsequent global promotions reference stable IDs rather than re-classifying from text.

Recommend implementing Option 1 immediately (no code change needed — just do not promote). Implement Option 2 and 3 as a paired spec when cross-project promotion is actually requested.

**Q3 — Cross-project deduplication**

The wording-sensitive classifier will not match paraphrases. The correct model is not to rely on the classifier for dedup — it is to require the **submitting operator to declare similarity** to existing global records. The promoter declares: "this candidate is related to [ID] with delta [description]." The steward reviews the delta, not the full text. This shifts dedup to human judgment at submission time rather than mechanical comparison.

A lightweight dedup manifest (simple ID + hash + delta description table) is sufficient until the corpus grows large enough to require automated dedup tooling.

**Q4 — Cross-project contradictions**

This is the most critical unresolved design issue. The example (fail-fast) is real: two valid-in-context principles can become contradictory seeds for a third project. `applies_when` / `counter_evidence` only helps if it is substantive and captures the real context boundary — not a generic placeholder.

**Required spec work before any contradiction-prone principle goes global:**
- `applies_when` must be a concrete, context-specific condition, not a generic subject-area tag
- `counter_evidence` must name the contradicting scenario explicitly
- The steward must verify that two seemingly contradictory principles are actually non-overlapping in applicability before both are approved globally

In practice: principles that describe tradeoffs (correctness vs. latency, fail-fast vs. fallback) need explicit non-overlap proof in their `applies_when` before global promotion. Principles that describe invariants (single-run insufficient, no semantic change under refactor label) do not have this problem.

**Q5 — Global corpus steward**

Three options, none is fully acceptable today:

1. **Each project promotes globally**: high degradation risk (classifier is known-weak, project X context is unknown to project Y operator)
2. **Single operator bottleneck**: conflicts with operatorless workflow, becomes a human single point of failure
3. **Automation promotes globally**: classifier is known-weak, garbage risk is high

None is chosen. The decision is: **global corpus is frozen until Option 4 is designed**.

Option 4: A steward-as-service model where a designated persistent Claude session (not human, not the classifier) receives promotion requests, verifies that `applies_when` and `counter_evidence` are substantive, checks dedup manifest, and approves/rejects with a bounded statement. This is the long-term path, but it requires designing the steward session's authority limits and the escalation path before it can be implemented.

---

### Required Spec Work Before Cross-Project Promotion

Before any second project can promote into the global corpus, these must be specified:

1. **Steward model**: Who/what approves global promotions, what authority does the steward have, how does it handle contradictions
2. **Applies-when substantiveness criteria**: Minimum bar for `applies_when` to prevent generic placeholders propagating globally
3. **Dedup manifest format**: ID + hash + delta description for submitter-declared similarity
4. **Contradiction resolution path**: When two approved global principles conflict in a new project's context, what happens
5. **Corruption recovery**: If the global corpus is degraded, what is the recovery mechanism

---

### Phased Path

**Phase 1 (now, no code):** Global corpus is frozen. Second project may read and consume. No promotion.

**Phase 2 (when needed):** Implement steward gate via `router_consult` as a lightweight bounded review. No code change — just a process agreement that global promotion goes through the existing review mechanism.

**Phase 3 (when steward model is spec'd):** Implement steward-as-service with mechanized allowlist and dedup manifest.

**Phase 4 (if/when corpus is large enough):** Build automated dedup tooling atop the dedup manifest.

---

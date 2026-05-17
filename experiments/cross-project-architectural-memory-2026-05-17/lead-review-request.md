# Cross-Project Architectural Memory Governance Review

Generated: 2026-05-17

This is an architectural review request for the durable Claude lead session. It is not an implementation request.

## Context

The two-level memory structure has been designed and validated inside one project:

- `project-architecture`: per-project, project-specific decisions.
- `engineering-principles`: global, cross-project transferable invariants.

For AgentSessionRouter, the process has been operator-driven and explicitly reviewed:

- staged candidates were inspected before active promotion,
- classifier weakness was discovered and documented,
- rejected candidates were rescued only through manual rewrite + lead review,
- Gate 13 serving is now bounded one-time lead-session seeding,
- runtime serving is ON for consuming active corpus records.

What is not designed yet: cross-project accumulation into the global `engineering-principles` corpus.

## Safe Current State

Until this review is resolved and converted into a decision/spec/phased implementation:

- global corpus remains manually curated/operator-curated,
- new projects may consume global engineering principles,
- new projects must not automatically promote into global engineering principles,
- no silent distill or silent global promotion is allowed.

## Architectural Questions

1. Distill trigger in a new project:
   - Should distill remain operator-initiated forever?
   - Or should there be a condition for automatic staged distill?
   - Silent distill was previously forbidden. Does that remain a hard invariant?

2. Enforcing lead review before global promotion:
   - The classifier is known-weak.
   - In multi-project use, a classification error in project X can seed garbage into project Y, where the operator does not know X context.
   - Lead review of staged candidates must be mandatory before global promotion.
   - What enforces this mechanically rather than relying on project goodwill?

3. Cross-project deduplication:
   - The current classifier is wording-sensitive.
   - It will not reliably match "single-run insufficient" from project A against a paraphrase from project B.
   - What mechanism prevents global corpus bloat from many wording variants of the same principle?

4. Cross-project contradictions:
   - Project A may derive "fail-fast is bad because caller is an agent and needs fallback".
   - Project B may derive "fail-fast is correct because correctness requires hard stop".
   - Both are valid in context.
   - If both become global, project C can receive contradictory seed records.
   - `applies_when` / `counter_evidence` only helps if it captures the real context boundary, not a generic placeholder.
   - How do we ensure context-specific, non-template applicability conditions for cross-project principles?

5. Global corpus steward:
   - In AgentSessionRouter, the human operator was the effective steward.
   - In multi-project use, options are:
     - each project can promote globally: high degradation risk,
     - only one operator can promote globally: bottleneck, conflicts with operatorless workflow,
     - automation promotes globally: classifier known-weak, high garbage risk.
   - None is chosen.
   - Since global corpus becomes source-of-truth for all future lead sessions, its degradation degrades all future projects.
   - Decide stewardship before the second project promotes anything globally, not after.

## Required Output

Return an architecture decision, not code:

- recommended current policy,
- explicit non-goals,
- answer to each of the 5 questions,
- what must be specified before implementation,
- phased path if/when cross-project promotion is built.

Do not propose implementing automatic global promotion yet unless the enforcement and stewardship model are concrete.

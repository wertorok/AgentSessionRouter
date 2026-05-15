# Session Routing Collision Analysis

Project id: AgentSessionRouter
Active candidates: 8
Thresholds: use=0.7, low_confidence=0.55

## Executive Result

- Exact normalized topic collisions: 0
- Probe exact-topic reuses: 0
- Probe exact-topic collisions: 0
- High collision risk probes: 0
- router_consult high-confidence fuzzy reuses: 0
- lower-level claude_consult ambiguous low-confidence reuses: 2
- lower-level claude_consult low-confidence possible reuses: 2
- conservative no-reuse probes: 9

Interpretation: exact-topic reuse is proven by the continuity benchmark, but it is the easy case. This report separates exact-topic reuse from fuzzy matching. With the current active sessions and thresholds, similar topic names mostly do not cross the router-consult fuzzy reuse threshold. The main router_consult risk is missed reuse/new sessions; the remaining confusion risk is lower-level low-confidence reuse when two candidates have close scores.

## Closest Active Topic Pairs

| Topic Jaccard | Left | Right |
| ---: | --- | --- |
| 0.73 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 |
| 0.43 | router consult shadow eval sample | router consult cache maintenance sample |
| 0.43 | router consult shadow eval sample | router consult route telemetry sample |
| 0.43 | router consult cache maintenance sample | router consult route telemetry sample |
| 0.25 | router consult shadow eval sample | v2.1 shadow eval architecture |
| 0.22 | v2.1 shadow eval architecture | project roadmap after v2.3.1 |
| 0.15 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full | cluster fallback claude-code-live-workload |
| 0.14 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 | cluster fallback claude-code-live-workload |
| 0 | router consult shadow eval sample | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full |
| 0 | router consult shadow eval sample | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 |

## Probe Results

| Probe | Risk | Best fuzzy score | Gap to second | Exact or best topic |
| --- | --- | ---: | ---: | --- |
| route-cache-overlap | conservative_no_reuse | 0.41 | 0.11 |  |
| cache-shadow-overlap | conservative_no_reuse | 0.35 | 0.05 |  |
| shadow-route-overlap | conservative_no_reuse | 0.44 | 0.17 |  |
| cluster-fallback-generic | conservative_no_reuse | 0.22 | 0.02 |  |
| roadmap-monitor-overlap | conservative_no_reuse | 0.23 | 0.1 |  |
| near-current-1 | conservative_no_reuse | 0.34 | 0.11 |  |
| near-current-2 | low_confidence_reuse_possible | 0.6 | 0.37 | router consult cache maintenance sample |
| near-current-3 | conservative_no_reuse | 0.46 | 0.25 |  |
| near-current-4 | low_confidence_ambiguous | 0.61 | 0.04 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full |
| near-current-5 | low_confidence_ambiguous | 0.6 | 0.02 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 |
| near-current-6 | low_confidence_reuse_possible | 0.61 | 0.33 | cluster fallback claude-code-live-workload |
| near-current-7 | conservative_no_reuse | 0.54 | 0.17 |  |
| near-current-8 | conservative_no_reuse | 0.54 | 0.22 |  |

## Operational Conclusion

- The previous `router_exact_topic` continuity score should be read as exact-topic reuse, not fuzzy semantic routing.
- Current top-level fuzzy matching is safe but under-reuses sessions unless topic, tags, aliases, or file paths strongly overlap.
- Ambiguous low-confidence cases should be inspected before relying on auto `claude_consult` reuse.
- To improve non-exact reuse later, collect route-health samples first and then add ambiguity-aware matching rather than lowering thresholds blindly.

# Session Routing Collision Analysis

Project id: AgentSessionRouter
Active candidates: 8
Thresholds: use=0.65, low_confidence=0.55, disambiguation_gap=0.1

## Executive Result

- Exact normalized topic collisions: 0
- Probe exact-topic reuses: 0
- Probe exact-topic collisions: 0
- High collision risk probes: 0
- router_consult high-confidence fuzzy reuses: 0
- router_consult disambiguated low-confidence reuses: 3
- ambiguous low-confidence probes forced to new session: 2
- conservative no-reuse probes: 8

Interpretation: exact-topic reuse is proven by the continuity benchmark, but it is the easy case. This report separates exact-topic reuse from fuzzy matching. With the current active sessions and thresholds, router_consult now handles three internal outcomes: reuse high-confidence matches, reuse low-confidence matches only when the gap is clear, or force a new durable session when low-confidence candidates are close.

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
| cache-shadow-overlap | conservative_no_reuse | 0.42 | 0.12 |  |
| shadow-route-overlap | conservative_no_reuse | 0.44 | 0.08 |  |
| cluster-fallback-generic | conservative_no_reuse | 0.22 | 0.02 |  |
| roadmap-monitor-overlap | conservative_no_reuse | 0.23 | 0.08 |  |
| near-current-1 | router_disambiguated_reuse | 0.57 | 0.34 | router consult shadow eval sample |
| near-current-2 | router_disambiguated_reuse | 0.6 | 0.36 | router consult cache maintenance sample |
| near-current-3 | conservative_no_reuse | 0.46 | 0.21 |  |
| near-current-4 | low_confidence_ambiguous | 0.61 | 0.04 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-full |
| near-current-5 | low_confidence_ambiguous | 0.6 | 0.02 | cluster fallback agentsessionrouter-codebase-reprepared-2026-05-15-targeted-v3 |
| near-current-6 | router_disambiguated_reuse | 0.61 | 0.33 | cluster fallback claude-code-live-workload |
| near-current-7 | conservative_no_reuse | 0.54 | 0.17 |  |
| near-current-8 | conservative_no_reuse | 0.54 | 0.22 |  |

## Operational Conclusion

- The previous `router_exact_topic` continuity score should be read as exact-topic reuse, not fuzzy semantic routing.
- Current top-level fuzzy matching is safe: ambiguous low-confidence cases are no longer delegated to lower-level auto reuse.
- Ambiguous low-confidence cases should still be inspected because they show where aliases/tags/file evidence or session cleanup would improve reuse.
- To improve non-exact reuse later, collect route-health samples first and then add ambiguity-aware matching rather than lowering thresholds blindly.

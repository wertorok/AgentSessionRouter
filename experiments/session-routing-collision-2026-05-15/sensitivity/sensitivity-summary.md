# Session Routing Threshold Sensitivity

Project id: AgentSessionRouter

| Case | use | low | gap | exact collisions | high | disambiguated | ambiguous forced-new | no reuse |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Default thresholds | 0.7 | 0.55 | 0.1 | 0 | 0 | 3 | 2 | 8 |
| threshold_use -0.05 | 0.65 | 0.55 | 0.1 | 0 | 0 | 3 | 2 | 8 |
| threshold_use +0.05 | 0.75 | 0.55 | 0.1 | 0 | 0 | 3 | 2 | 8 |
| threshold_low_confidence -0.05 | 0.7 | 0.5 | 0.1 | 0 | 0 | 5 | 2 | 6 |
| threshold_low_confidence +0.05 | 0.7 | 0.6 | 0.1 | 0 | 0 | 2 | 2 | 9 |
| disambiguation_gap -0.05 | 0.7 | 0.55 | 0.05 | 0 | 0 | 3 | 2 | 8 |
| disambiguation_gap +0.05 | 0.7 | 0.55 | 0.15 | 0 | 0 | 3 | 2 | 8 |

Interpretation: on the current 8 active sessions and 13 probes, ±0.05 changes to threshold_use and disambiguation_gap do not change the routing classification counts. Lowering threshold_low_confidence to 0.50 increases disambiguated reuse from 2 to 4; raising it to 0.60 keeps 2 disambiguated and 2 ambiguous because the relevant probes score around 0.60-0.61. The 0.10 gap separates clear cases (gap 0.33/0.37) from ambiguous fallback-session pairs (gap 0.02/0.04).

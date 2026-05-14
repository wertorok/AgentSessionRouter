# MCP Workload Report — claude-code-run

This is retained as known-failure evidence for nested consult calls from a Claude Code parent-agent workload. Non-Claude MCP tools passed; `cluster_consult` and `claude_consult` reached the MCP server but timed out at Claude Code's MCP transport layer because they invoke nested Claude calls. The canonical consult-path coverage is `npm run mcp:workload:live`.

## Tools Used

- `router_monitor`
- `router_status`
- `cluster_prepare`
- `cluster_get`
- `cluster_consult`
- `claude_consult`
- `comparison_stats`
- `comparison_list`

## Outcomes

### `router_monitor` — pass

- Input: {"project_id":null,"recent_hours":24,"sample_limit":10}
- Output summary: {project_id, checked_at, recent_window_hours, health, cache_health, quality, recommendations, next_directions}

### `router_status` — pass

- Input: {"project_id":null,"recent_hours":24,"warnings_limit":10}
- Output summary: {project_id, checked_at, mode, degraded_reason, uptime_hours, claude, v1_sessions, v2_clusters...}

### `cluster_prepare` — pass

- Input: {"project_id":null,"cluster_id":"claude-code-live-workload","name":"Claude Code Live Workload","tool_profile_default":"bare","static_factsheet_policy":"allow","verification_mode":"static","factsheet":
- Output summary: {project_id, cluster_id, factsheet_id, factsheet_version, verification_stage, trust_state, verified_facts, rejected_facts...}

### `cluster_get` — pass

- Input: {"project_id":null,"cluster_id":"claude-code-live-workload","include_factsheet":true}
- Output summary: {project_id, cluster, current_factsheet, file_hashes}

### `cluster_consult` — **FAIL**

- Input: {"project_id":null,"cluster_id":"claude-code-live-workload","question":"What is router_monitor for and when should a parent agent use it?"}
- Output summary: {thrown_error}
- Error: MCP error -32001: Request timed out

### `claude_consult` — **FAIL**

- Input: {"project_id":null,"session_id":null,"topic_hint":"claude code workload via mcp","trigger":"mcp workload matrix","task":"Exercise AgentSessionRouter MCP from Claude Code","relevant_code":"README.md\ns
- Output summary: {thrown_error}
- Error: MCP error -32001: Request timed out

### `comparison_stats` — pass

- Input: {"project_id":null,"cluster_id":null}
- Output summary: {project_id, stats}

### `comparison_list` — pass

- Input: {"project_id":null,"cluster_id":null,"preferred":null,"include_answers":false,"limit":20}
- Output summary: {project_id, comparisons}

## Summary

- Tools called: 8
- Passed: 6
- Failed: 2

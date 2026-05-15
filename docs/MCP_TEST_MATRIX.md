# MCP Workload Test Matrix

This matrix is the production exercise plan for AgentSessionRouter as an MCP server. It is designed to create enough real telemetry for `router_monitor`, `router_status`, `comparison_stats`, and `comparison_list` to show what works, what degrades, and what to change next.

## Entry Points

```bash
npm run mcp:workload
npm run mcp:workload:live
```

The default workload uses a deterministic fake Claude CLI so failure paths can be exercised without waiting on live model behavior. The live workload uses the real `claude` CLI and should be run only when local auth/rate limits are healthy.

Artifacts are written under:

```txt
experiments/mcp-workload-<date>/
  stub-matrix.json
  stub-summary.md
  live-matrix.json
  live-summary.md
```

## Agent Boundary

Claude Code helper agents are not part of the normal MCP client path. They are spawned workers/consultants; they should receive the project task and local file/Bash permissions needed for that task, not permanent access to AgentSessionRouter's MCP server.

The production client path is:

```txt
Codex/parent caller -> AgentSessionRouter MCP -> router internals -> Claude CLI when needed
```

The workload matrix exercises AgentSessionRouter directly through the MCP SDK. This is intentional: it tests the application without leaking router internals into unrelated Claude Code agents.

The project-local `router.config.toml` is intentionally gitignored and used only for this machine. It enables shadow telemetry and prevents recursive MCP loading inside the router's own `claude -p` calls:

```toml
[eval]
shadow_mode = true

[claude]
extra_args = ["--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']
```

If a one-off Claude Code integration diagnostic is needed, pass MCP config explicitly on that single command with `--strict-mcp-config --mcp-config ...`. Do not register AgentSessionRouter as a persistent Claude Code MCP server.

## Coverage Matrix

| Area | Scenario | Expected signal |
| --- | --- | --- |
| Tool discovery | MCP lists all public tools | 14 tools including `router_monitor` |
| Router health | `router_status` baseline | normal/degraded state, Claude version, counts |
| Information monitor | `router_monitor` baseline/final | recommendations and next directions |
| v1 sessions | `claude_consult` new session | `new_session`, registry row, raw log |
| v1 resume | explicit `session_id` consult | same router session reused |
| v1 inspect | `claude_session_inspect` | decisions/events visible |
| Cluster prepare static | `cluster_prepare` static allow | `factsheet_static_verified` |
| Cluster fast path | `cluster_consult` with fresh evidence | `cluster_consult`, shadow comparison scheduled |
| Shadow telemetry | `comparison_stats` / `comparison_list` | at least one judged comparison, wins/ties/gaps |
| Refresh | `cluster_refresh verify_only` | fresh factsheet, unchanged files |
| Revalidation success | file hash changes, selector snippet same | `evidence_revalidated`, answer from cluster |
| Revalidation failure | selector removed/renamed | `evidence_revalidation_failed`, `needs_prepare`, fallback |
| Revalidation failure | selector still present, snippet changed | `evidence_revalidation_failed`, `needs_prepare`, fallback |
| Static trust policy | `static_factsheet_policy=deny` | fallback to `claude_consult` |
| LLM trust policy | `static_factsheet_policy=deny` with LLM factsheet | `cluster_consult` serves trusted LLM factsheet |
| Missing cluster | unknown `cluster_id` | fallback to `claude_consult`, caller still gets answer |
| LLM verifier | `verification_mode=llm` | `factsheet_llm_verified`, `llm_verifier` |
| Monitor diagnosis | final `router_monitor` | cache/quality recommendations |

## What To Watch

Use `router_monitor` first. It combines the important telemetry:

- `health`: router and Claude state
- `cache_health`: stale clusters, revalidation failures, fallbacks
- `quality`: shadow comparison stats and samples
- `recommendations`: concrete actions
- `next_directions`: where to go next

Use drill-down tools only after the monitor points at a problem:

- `router_status` for compact operational health
- `comparison_stats` for quality aggregates
- `comparison_list` for concrete direct-win or `NOT IN CONTEXT` samples
- `cluster_get` for factsheet inspection

## Interpreting Results

If fallback count grows, the cache is not serving enough calls. Re-prepare or expand the relevant factsheet.

If direct wins grow, inspect direct-win samples. The cluster may need reasoning facts, broader evidence, or routing away from that question class.

If shadow pending/failed grows, fix shadow eval before trusting trend data.

If clusters score well and have no fallback/revalidation failures, they become candidates for future auto-routing.

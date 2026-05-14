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
  claude-code-report.md
```

## Claude Code Parent-Agent Mode

Claude Code is connected locally with:

```txt
agent-session-router: node /root/projects/AgentSessionRouter/dist/src/index.js
```

The project-local `router.config.toml` is intentionally gitignored and used only for this machine. It enables shadow telemetry and prevents recursive MCP loading inside the router's own `claude -p` calls:

```toml
[eval]
shadow_mode = true

[claude]
extra_args = ["--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']
```

Under root, Claude Code refuses `bypassPermissions`; the working permission mode is `auto` with default tools, the connected MCP server, and an explicit CLI allowlist. This is the real executable mode for this host, not a no-permission dry run.

Example parent-agent monitor workload:

```bash
claude -p \
  --permission-mode auto \
  --tools default \
  --allowedTools "mcp__agent-session-router__router_monitor,mcp__agent-session-router__router_status,mcp__agent-session-router__cluster_list,mcp__agent-session-router__comparison_stats,mcp__agent-session-router__comparison_list,Bash(npm test:*),Write,mcp__filesystem__write_file" \
  "Use router_monitor, router_status, cluster_list, comparison_stats, comparison_list, run npm test -- --run tests/tools.test.ts, and write the monitor report."
```

The broader Claude Code workload intentionally tried `cluster_consult` and `claude_consult` from inside Claude Code. Those calls reached the MCP server but timed out at Claude Code's MCP transport layer because they invoke nested Claude calls. The production consult paths are therefore covered by `npm run mcp:workload:live`, which uses the MCP SDK directly with longer tool-call timeouts. Claude Code is used as the parent-agent monitor and operator caller.

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
| Claude Code caller | Claude uses MCP directly | report written by Claude under experiments |

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

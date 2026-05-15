# AgentSessionRouter Agent Instructions

## Default Consult Path

Use `router_consult` as the normal parent-agent entry point for Claude consultation.

Do not call broad `claude_consult` directly unless you are intentionally testing or debugging the lower-level v1 session router. The 2026-05-15 route audit found a 302s / 78k-token cold `new_session` call caused by bypassing the top-level route decision.

## Routing Rules

- If the question belongs to a known covered cluster, call `router_consult` with `cluster_id`.
- If a specific durable session is required, call `router_consult` with `session_id`.
- If neither is known, call `router_consult` with a precise `topic_hint`, `task`, and `question`.
- Treat `router_monitor.quality.auto_routing_candidates` as telemetry only. Automatic cluster selection is not enabled.

Lower-level tools remain available for explicit work:

- Use `cluster_consult` only when testing the cluster path directly.
- Use `claude_consult` only when testing v1 behavior directly or when a maintainer explicitly asks for it.
- Use `router_monitor` before deciding what to fix next.

## Caller Contract

The router should return an answer whenever Claude is reachable. Parent agents should not reason through internal cache health, factsheet revalidation, fallback, or shadow-eval mechanics. Those are router internals and should be inspected through `router_monitor`, `router_status`, `cluster_get`, or comparison tools.

## Maintenance Checks

Before committing router changes:

```bash
npm test
npm run build
npm run mcp:workload -- --date <date-or-label>
```

For route-specific sanity checks on this repository:

```bash
npm run router:sanity -- --out experiments/router-consult-sanity/<label>.json
npm run monitor:snapshot -- --out experiments/router-monitor-snapshots/<label>.json
```

## Agent Boundary

Spawned Claude Code helpers are consultants, not persistent MCP clients for this router. Give them the local files and shell permissions needed for their task. Do not register AgentSessionRouter as a permanent MCP server inside those helper agents unless the task is specifically a one-off integration diagnostic.

# Claude Live Diagnosis

## Environment

| Field | Value |
| --- | --- |
| OS | Linux 6.8.0-106-generic x64 |
| Node | v22.22.2 |
| cwd | /root/projects/AgentSessionRouter |
| Claude env vars present | none |

## Root Cause

| Field | Value |
| --- | --- |
| Final live verdict | CLAUDE_PROBE_PASS |
| Category | claude_cli_ready |
| Summary | Claude CLI adapter invocation succeeds with valid JSON, `session_id`, and `result`; focused and bare profile checks should be read separately because cluster paths use profile probing and may downgrade `bare` to `focused`. |
| Exact operator action | No Claude environment action is required for the MCP adapter path. |

Version-scoped note: this result applies to the local Claude CLI version and
auth state shown below. Re-run this diagnosis and `npm run claude:profile-audit`
after Claude Code upgrades, auth changes, or OS changes.

## Manual Claude CLI Command Results

| name | command | exitCode | durationMs | jsonValid | jsonType | jsonIsError | sessionId | result | stderr | spawnError |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| version | claude --version | 0 | 96 | false |  |  |  | 2.1.92 (Claude Code)<br> |  |  |
| auth_status | claude auth status | 0 | 219 | true |  |  |  | {<br>  "loggedIn": true,<br>  "authMethod": "oauth_token",<br>  "apiProvider": "firstParty"<br>}<br> |  |  |
| adapter_ping | claude -p --output-format json Return exactly DIAG_ADAPTER_OK | 0 | 6267 | true | result | false | cd873814-4d9f-4f3f-af18-c229d2b39b44 | <br><br>DIAG_ADAPTER_OK |  |  |
| focused_strict_ping | claude -p --tools  --strict-mcp-config --mcp-config {"mcpServers":{}} --output-format json Return exactly DIAG_FOCUSED_OK | 0 | 3289 | true | result | false | 0bc68bbb-4464-4371-b526-b46aea14f602 | DIAG_FOCUSED_OK |  |  |
| bare_ping_router_order | claude -p --bare --tools  --output-format json Return exactly DIAG_BARE_OK | 0 | 3376 | true | result | false | 59fe2669-1824-4f88-95ba-6c1bee779268 | DIAG_BARE_OK |  |  |
| text_ping_arg | claude -p Return exactly DIAG_TEXT_OK | 0 | 6511 | false |  |  |  | DIAG_TEXT_OK<br> |  |  |

## Comparison With src/claude.ts

- src/claude.ts expects Claude JSON to include a session id and answer text (session_id plus result, text, or answer).
- The installed Claude CLI returns valid adapter-path JSON with session_id and result, so the output shape is compatible.
- The real adapter invocation returns is_error: false, so live MCP consults can proceed.
- Cluster and LLM-verifier paths may request `bare`, but profile probing is expected to downgrade `bare` to strict `focused` when bare is unavailable.
- Current strict focused profile: available (session_id=0bc68bbb-4464-4371-b526-b46aea14f602).
- Current router-order bare profile: available (session_id=59fe2669-1824-4f88-95ba-6c1bee779268).
- This diagnosis covers headless `claude -p` mode. It is not a proof of interactive Claude Code TUI parity.
- Local Claude SessionEnd hook stderr is recorded as environment noise; it does not block the adapter path when the command exits 0 with valid JSON.

## Raw JSON Evidence

```json
[
  {
    "name": "version",
    "command": "claude",
    "args": [
      "--version"
    ],
    "input": "",
    "exitCode": 0,
    "durationMs": 96,
    "spawnError": null,
    "stdout": "2.1.92 (Claude Code)\n",
    "stderr": "",
    "json": {
      "valid": false,
      "keys": [],
      "type": null,
      "subtype": null,
      "is_error": null,
      "result": null,
      "session_id": null,
      "usage_keys": []
    }
  },
  {
    "name": "auth_status",
    "command": "claude",
    "args": [
      "auth",
      "status"
    ],
    "input": "",
    "exitCode": 0,
    "durationMs": 219,
    "spawnError": null,
    "stdout": "{\n  \"loggedIn\": true,\n  \"authMethod\": \"oauth_token\",\n  \"apiProvider\": \"firstParty\"\n}\n",
    "stderr": "",
    "json": {
      "valid": true,
      "keys": [
        "loggedIn",
        "authMethod",
        "apiProvider"
      ],
      "result": null,
      "session_id": null,
      "usage_keys": []
    }
  },
  {
    "name": "adapter_ping",
    "command": "claude",
    "args": [
      "-p",
      "--output-format",
      "json",
      "Return exactly DIAG_ADAPTER_OK"
    ],
    "input": "",
    "exitCode": 0,
    "durationMs": 6267,
    "spawnError": null,
    "stdout": "{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"duration_ms\":3942,\"duration_api_ms\":3894,\"num_turns\":1,\"result\":\"\\n\\nDIAG_ADAPTER_OK\",\"stop_reason\":\"end_turn\",\"session_id\":\"cd873814-4d9f-4f3f-af18-c229d2b39b44\",\"total_cost_usd\":0.20262800000000003,\"usage\":{\"input_tokens\":40273,\"cache_creation_input_tokens\":0,\"cache_read_input_tokens\":576,\"output_tokens\":39,\"server_tool_use\":{\"web_search_requests\":0,\"web_fetch_requests\":0},\"service_tier\":\"standard\",\"cache_creation\":{\"ephemeral_1h_input_tokens\":0,\"ephemeral_5m_input_tokens\":0},\"inference_geo\":\"\",\"iterations\":[],\"speed\":\"standard\"},\"modelUsage\":{\"MiniMax-M2.7\":{\"inputTokens\":40273,\"outputTokens\":39,\"cacheReadInputTokens\":576,\"cacheCreationInputTokens\":0,\"webSearchRequests\":0,\"costUSD\":0.20262800000000003,\"contextWindow\":200000,\"maxOutputTokens\":32000}},\"permission_denials\":[],\"terminal_reason\":\"completed\",\"fast_mode_state\":\"off\",\"uuid\":\"f5477136-a9e9-4801-8732-a665d8ababa5\"}\n",
    "stderr": "",
    "json": {
      "valid": true,
      "keys": [
        "type",
        "subtype",
        "is_error",
        "duration_ms",
        "duration_api_ms",
        "num_turns",
        "result",
        "stop_reason",
        "session_id",
        "total_cost_usd",
        "usage",
        "modelUsage",
        "permission_denials",
        "terminal_reason",
        "fast_mode_state",
        "uuid"
      ],
      "type": "result",
      "subtype": "success",
      "is_error": false,
      "result": "\n\nDIAG_ADAPTER_OK",
      "session_id": "cd873814-4d9f-4f3f-af18-c229d2b39b44",
      "usage_keys": [
        "input_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
        "output_tokens",
        "server_tool_use",
        "service_tier",
        "cache_creation",
        "inference_geo",
        "iterations",
        "speed"
      ]
    }
  },
  {
    "name": "focused_strict_ping",
    "command": "claude",
    "args": [
      "-p",
      "--tools",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      "{\"mcpServers\":{}}",
      "--output-format",
      "json",
      "Return exactly DIAG_FOCUSED_OK"
    ],
    "input": "",
    "exitCode": 0,
    "durationMs": 3289,
    "spawnError": null,
    "stdout": "{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"duration_ms\":2850,\"duration_api_ms\":2836,\"num_turns\":1,\"result\":\"DIAG_FOCUSED_OK\",\"stop_reason\":\"end_turn\",\"session_id\":\"0bc68bbb-4464-4371-b526-b46aea14f602\",\"total_cost_usd\":0.06111250000000001,\"usage\":{\"input_tokens\":0,\"cache_creation_input_tokens\":9610,\"cache_read_input_tokens\":0,\"output_tokens\":42,\"server_tool_use\":{\"web_search_requests\":0,\"web_fetch_requests\":0},\"service_tier\":\"standard\",\"cache_creation\":{\"ephemeral_1h_input_tokens\":0,\"ephemeral_5m_input_tokens\":0},\"inference_geo\":\"\",\"iterations\":[],\"speed\":\"standard\"},\"modelUsage\":{\"MiniMax-M2.7\":{\"inputTokens\":0,\"outputTokens\":42,\"cacheReadInputTokens\":0,\"cacheCreationInputTokens\":9610,\"webSearchRequests\":0,\"costUSD\":0.06111250000000001,\"contextWindow\":200000,\"maxOutputTokens\":32000}},\"permission_denials\":[],\"terminal_reason\":\"completed\",\"fast_mode_state\":\"off\",\"uuid\":\"ee74486d-958b-4c5e-ba8a-01362f7b2699\"}\n",
    "stderr": "",
    "json": {
      "valid": true,
      "keys": [
        "type",
        "subtype",
        "is_error",
        "duration_ms",
        "duration_api_ms",
        "num_turns",
        "result",
        "stop_reason",
        "session_id",
        "total_cost_usd",
        "usage",
        "modelUsage",
        "permission_denials",
        "terminal_reason",
        "fast_mode_state",
        "uuid"
      ],
      "type": "result",
      "subtype": "success",
      "is_error": false,
      "result": "DIAG_FOCUSED_OK",
      "session_id": "0bc68bbb-4464-4371-b526-b46aea14f602",
      "usage_keys": [
        "input_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
        "output_tokens",
        "server_tool_use",
        "service_tier",
        "cache_creation",
        "inference_geo",
        "iterations",
        "speed"
      ]
    }
  },
  {
    "name": "bare_ping_router_order",
    "command": "claude",
    "args": [
      "-p",
      "--bare",
      "--tools",
      "",
      "--output-format",
      "json",
      "Return exactly DIAG_BARE_OK"
    ],
    "input": "",
    "exitCode": 0,
    "durationMs": 3376,
    "spawnError": null,
    "stdout": "{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"duration_ms\":3026,\"duration_api_ms\":3013,\"num_turns\":1,\"result\":\"DIAG_BARE_OK\",\"stop_reason\":\"end_turn\",\"session_id\":\"59fe2669-1824-4f88-95ba-6c1bee779268\",\"total_cost_usd\":0.00309375,\"usage\":{\"input_tokens\":0,\"cache_creation_input_tokens\":327,\"cache_read_input_tokens\":0,\"output_tokens\":42,\"server_tool_use\":{\"web_search_requests\":0,\"web_fetch_requests\":0},\"service_tier\":\"standard\",\"cache_creation\":{\"ephemeral_1h_input_tokens\":0,\"ephemeral_5m_input_tokens\":0},\"inference_geo\":\"\",\"iterations\":[],\"speed\":\"standard\"},\"modelUsage\":{\"MiniMax-M2.7\":{\"inputTokens\":0,\"outputTokens\":42,\"cacheReadInputTokens\":0,\"cacheCreationInputTokens\":327,\"webSearchRequests\":0,\"costUSD\":0.00309375,\"contextWindow\":200000,\"maxOutputTokens\":32000}},\"permission_denials\":[],\"terminal_reason\":\"completed\",\"fast_mode_state\":\"off\",\"uuid\":\"973e5b65-2ca4-4df4-ad36-94b706707efb\"}\n",
    "stderr": "",
    "json": {
      "valid": true,
      "keys": [
        "type",
        "subtype",
        "is_error",
        "duration_ms",
        "duration_api_ms",
        "num_turns",
        "result",
        "stop_reason",
        "session_id",
        "total_cost_usd",
        "usage",
        "modelUsage",
        "permission_denials",
        "terminal_reason",
        "fast_mode_state",
        "uuid"
      ],
      "type": "result",
      "subtype": "success",
      "is_error": false,
      "result": "DIAG_BARE_OK",
      "session_id": "59fe2669-1824-4f88-95ba-6c1bee779268",
      "usage_keys": [
        "input_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
        "output_tokens",
        "server_tool_use",
        "service_tier",
        "cache_creation",
        "inference_geo",
        "iterations",
        "speed"
      ]
    }
  },
  {
    "name": "text_ping_arg",
    "command": "claude",
    "args": [
      "-p",
      "Return exactly DIAG_TEXT_OK"
    ],
    "input": "",
    "exitCode": 0,
    "durationMs": 6511,
    "spawnError": null,
    "stdout": "DIAG_TEXT_OK\n",
    "stderr": "",
    "json": {
      "valid": false,
      "keys": [],
      "type": null,
      "subtype": null,
      "is_error": null,
      "result": null,
      "session_id": null,
      "usage_keys": []
    }
  }
]
```

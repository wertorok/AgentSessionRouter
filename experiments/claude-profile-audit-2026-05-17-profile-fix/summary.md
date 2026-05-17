# Claude Profile Audit

Started: 2026-05-17T10:34:33.328Z
Finished: 2026-05-17T10:36:14.263Z
Claude: 2.1.92 (Claude Code)
Overall: PASS

| Profile | Tools | MCP | Skills | Hooks | Cost | Checks |
|---|---:|---:|---:|---:|---:|---|
| configured | 0 | 0 | 169 | 4 | 0.049329 | pass:tools_zero<br>pass:mcp_zero<br>pass:hooks_present |
| focused_legacy | 28 | 4 | 169 | 4 | 0.29494725 | warn:legacy_tools_present<br>warn:legacy_mcp_present |
| focused_strict_empty | 0 | 0 | 169 | 4 | 0.053005000000000004 | pass:tools_zero<br>pass:mcp_zero<br>pass:hooks_present |
| bare | 0 | 0 | 6 | 0 | 0.028461999999999998 | pass:tools_zero<br>pass:mcp_zero<br>pass:hooks_zero |
| readonly_strict | 3 | 0 | 169 | 4 | 0.1656625 | pass:tools_subset<br>pass:unexpected_tools_unavailable<br>pass:mcp_zero |
| readonly_strict_bash_probe | 3 | 0 | 169 | 4 | 0.07323750000000001 | pass:bash_unavailable<br>pass:mcp_zero |
| allowedtools_bash_probe | 55 | 4 | 169 | 4 | 0.2286505 | warn:allowedtools_negative_control |

## Notes

- `focused_strict_empty` is the intended no-tools/no-MCP fallback profile.
- `readonly_strict` is the intended direct-benchmark profile: built-in Read/Glob/Grep only and no MCP servers. It is not a full sandbox because hooks and skills still load.
- `allowedtools_bash_probe` is a negative control. If it warns, `--allowedTools` is not a sufficient isolation boundary on this Claude version.

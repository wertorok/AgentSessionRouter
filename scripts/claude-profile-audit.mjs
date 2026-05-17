import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const date = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outDir = path.resolve(args.out ?? path.join(repoRoot, "experiments", "claude-profile-audit", date));
const maxBudgetUsd = String(args.maxBudgetUsd ?? args["max-budget-usd"] ?? "0.35");
const timeoutMs = Number(args.timeoutMs ?? args["timeout-ms"] ?? 180_000);
const requestedProfiles = parseList(
  args.profiles ??
    "configured,focused_legacy,focused_strict_empty,bare,readonly_strict,readonly_strict_bash_probe,allowedtools_bash_probe"
);

const STRICT_EMPTY_MCP_ARGS = ["--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'];
const READONLY_STRICT_ARGS = ["--tools", "Read,Glob,Grep", ...STRICT_EMPTY_MCP_ARGS.slice(2)];

const profiles = {
  default: {
    description: "Plain headless -p. Expected to show the ambient Claude Code context.",
    args: [],
    prompt: "Profile audit default: return exactly PROFILE_AUDIT_DEFAULT_OK.",
    checks: []
  },
  configured: {
    description: "Runtime-style strict empty MCP/tool profile from router.config.toml.",
    args: STRICT_EMPTY_MCP_ARGS,
    prompt: "Profile audit configured: return exactly PROFILE_AUDIT_CONFIGURED_OK.",
    checks: [expectNoTools(), expectNoMcp(), expectHooksPresent()]
  },
  focused_legacy: {
    description: "Historical focused profile: --tools \"\" only. Informational drift probe.",
    args: ["--tools", ""],
    prompt: "Profile audit legacy focused: return exactly PROFILE_AUDIT_LEGACY_FOCUSED_OK.",
    checks: [warnIfToolsPresent(), warnIfMcpPresent()]
  },
  focused_strict_empty: {
    description: "Current focused profile target: no built-in tools and no MCP servers, hooks still enabled.",
    args: STRICT_EMPTY_MCP_ARGS,
    prompt: "Profile audit focused strict empty: return exactly PROFILE_AUDIT_FOCUSED_STRICT_OK.",
    checks: [expectNoTools(), expectNoMcp(), expectHooksPresent()]
  },
  bare: {
    description: "Bare fast path: minimal Claude Code context. Portability depends on local auth.",
    args: ["--bare", "--tools", ""],
    prompt: "Profile audit bare: return exactly PROFILE_AUDIT_BARE_OK.",
    checks: [expectNoTools(), expectNoMcp(), expectNoHooks()]
  },
  readonly_strict: {
    description: "Direct benchmark read-only profile: Read/Glob/Grep only, no MCP servers.",
    args: READONLY_STRICT_ARGS,
    prompt: "Profile audit read-only strict: return exactly PROFILE_AUDIT_READONLY_STRICT_OK.",
    checks: [expectToolSubset(["Read", "Glob", "Grep"]), expectUnexpectedToolsUnavailable(["Read", "Glob", "Grep"]), expectNoMcp()]
  },
  readonly_strict_bash_probe: {
    description: "Safety probe: Bash should be unavailable under read-only strict profile.",
    args: READONLY_STRICT_ARGS,
    prompt:
      "Profile audit safety probe: attempt to use Bash to run exactly: echo PROFILE_AUDIT_READONLY_BASH_PROBE. If Bash is unavailable, say Bash unavailable.",
    checks: [expectBashUnavailable(), expectNoMcp()]
  },
  allowedtools_bash_probe: {
    description: "Negative control: checks whether --allowedTools Read actually blocks Bash on this Claude version.",
    args: ["--allowedTools", "Read"],
    prompt:
      "Profile audit negative control: attempt to use Bash to run exactly: echo PROFILE_AUDIT_ALLOWEDTOOLS_BASH_PROBE. If Bash is unavailable, say Bash unavailable.",
    checks: [warnIfBashExecuted()]
  }
};

for (const name of requestedProfiles) {
  if (!profiles[name]) {
    fail(`Unknown profile '${name}'. Known profiles: ${Object.keys(profiles).join(", ")}`);
  }
}
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("--timeout-ms must be a positive number.");
}

mkdirSync(outDir, { recursive: true });

const startedAt = new Date().toISOString();
const claudeVersion = runQuick("claude", ["--version"]);
const authStatus = runQuick("claude", ["auth", "status"]);
const results = [];
for (const name of requestedProfiles) {
  const definition = profiles[name];
  const result = await runProfile(name, definition);
  results.push(result);
}

const report = {
  ok: results.every((result) => !result.checks.some((check) => check.status === "fail")),
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  cwd: repoRoot,
  platform: process.platform,
  node: process.version,
  claude_version: claudeVersion,
  auth_status: authStatus,
  max_budget_usd: Number(maxBudgetUsd),
  timeout_ms: timeoutMs,
  profiles: results
};

writeFileSync(path.join(outDir, "profile-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(path.join(outDir, "summary.md"), renderSummary(report), "utf8");
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      out_dir: outDir,
      failed: results.flatMap((result) =>
        result.checks
          .filter((check) => check.status === "fail")
          .map((check) => ({ profile: result.name, check: check.name, message: check.message }))
      ),
      warnings: results.flatMap((result) =>
        result.checks
          .filter((check) => check.status === "warn")
          .map((check) => ({ profile: result.name, check: check.name, message: check.message }))
      )
    },
    null,
    2
  )
);
process.exitCode = report.ok ? 0 : 1;

async function runProfile(name, definition) {
  const commandArgs = [
    "-p",
    ...definition.args,
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-budget-usd",
    maxBudgetUsd,
    definition.prompt
  ];
  const started = Date.now();
  const raw = await runProcess("claude", commandArgs, timeoutMs);
  const events = parseStreamJson(raw.stdout);
  const init = events.find((event) => event.type === "system" && event.subtype === "init") ?? null;
  const result = events.find((event) => event.type === "result") ?? null;
  const hookEvents = events.filter((event) => event.type === "system" && String(event.subtype ?? "").startsWith("hook"));
  const toolUses = collectContentItems(events, "tool_use").map((item) => ({ id: item.id, name: item.name, input: item.input }));
  const toolResults = collectContentItems(events, "tool_result").map((item) => ({
    tool_use_id: item.tool_use_id,
    is_error: item.is_error,
    content: typeof item.content === "string" ? item.content.slice(0, 500) : item.content
  }));
  const summary = {
    name,
    description: definition.description,
    command: "claude",
    args: commandArgs,
    exit_code: raw.code,
    duration_ms: Date.now() - started,
    stream_parse_errors: events.parseErrors ?? [],
    init_present: Boolean(init),
    claude_code_version: init?.claude_code_version ?? null,
    model: init?.model ?? null,
    cwd: init?.cwd ?? null,
    api_key_source: init?.apiKeySource ?? null,
    permission_mode: init?.permissionMode ?? null,
    tools: init?.tools ?? [],
    tool_count: Array.isArray(init?.tools) ? init.tools.length : null,
    mcp_servers: init?.mcp_servers ?? [],
    mcp_server_count: Array.isArray(init?.mcp_servers) ? init.mcp_servers.length : null,
    agents_count: Array.isArray(init?.agents) ? init.agents.length : null,
    skills_count: Array.isArray(init?.skills) ? init.skills.length : null,
    plugins: init?.plugins ?? [],
    hook_event_count: hookEvents.length,
    hook_events: hookEvents.map((event) => ({
      subtype: event.subtype,
      hook_name: event.hook_name,
      hook_event: event.hook_event,
      outcome: event.outcome,
      exit_code: event.exit_code
    })),
    tool_uses: toolUses,
    tool_results: toolResults,
    result: result
      ? {
          subtype: result.subtype ?? null,
          is_error: result.is_error ?? null,
          stop_reason: result.stop_reason ?? null,
          total_cost_usd: result.total_cost_usd ?? null,
          usage: result.usage ?? null,
          model_usage: result.modelUsage ?? null,
          permission_denials: result.permission_denials ?? [],
          errors: result.errors ?? [],
          result_preview: typeof result.result === "string" ? result.result.slice(0, 800) : null
        }
      : null,
    stderr: raw.stderr.slice(0, 4000)
  };
  return {
    ...summary,
    checks: definition.checks.map((check) => check(summary))
  };
}

function expectNoTools() {
  return (summary) => {
    const count = summary.tool_count ?? 0;
    return {
      name: "tools_zero",
      status: count === 0 ? "pass" : "fail",
      message: `tool_count=${count}`
    };
  };
}

function expectToolSubset(allowed) {
  return (summary) => {
    const tools = summary.tools ?? [];
    const unexpected = tools.filter((tool) => !allowed.includes(tool));
    const missing = allowed.filter((tool) => !tools.includes(tool));
    return {
      name: "tools_subset",
      status: unexpected.length === 0 && missing.length === 0 ? "pass" : "fail",
      message: `tools=${tools.join(",")}; unexpected=${unexpected.join(",")}; missing=${missing.join(",")}`
    };
  };
}

function expectUnexpectedToolsUnavailable(allowed) {
  return (summary) => {
    const unexpected = (summary.tool_uses ?? []).filter((tool) => !allowed.includes(tool.name));
    const executed = unexpected.filter((tool) => {
      const result = summary.tool_results.find((item) => item.tool_use_id === tool.id);
      return !(
        result?.is_error === true &&
        typeof result.content === "string" &&
        result.content.includes("No such tool available")
      );
    });
    return {
      name: "unexpected_tools_unavailable",
      status: executed.length === 0 ? "pass" : "fail",
      message:
        unexpected.length === 0
          ? "no unexpected tool_use observed"
          : `unexpected=${unexpected.map((tool) => tool.name).join(",")}; executed=${executed
              .map((tool) => tool.name)
              .join(",")}`
    };
  };
}

function expectNoMcp() {
  return (summary) => {
    const count = summary.mcp_server_count ?? 0;
    return {
      name: "mcp_zero",
      status: count === 0 ? "pass" : "fail",
      message: `mcp_server_count=${count}`
    };
  };
}

function expectHooksPresent() {
  return (summary) => ({
    name: "hooks_present",
    status: summary.hook_event_count > 0 ? "pass" : "warn",
    message: `hook_event_count=${summary.hook_event_count}`
  });
}

function expectNoHooks() {
  return (summary) => ({
    name: "hooks_zero",
    status: summary.hook_event_count === 0 ? "pass" : "warn",
    message: `hook_event_count=${summary.hook_event_count}`
  });
}

function warnIfToolsPresent() {
  return (summary) => ({
    name: "legacy_tools_present",
    status: (summary.tool_count ?? 0) === 0 ? "pass" : "warn",
    message: `legacy profile tool_count=${summary.tool_count ?? "unknown"}`
  });
}

function warnIfMcpPresent() {
  return (summary) => ({
    name: "legacy_mcp_present",
    status: (summary.mcp_server_count ?? 0) === 0 ? "pass" : "warn",
    message: `legacy profile mcp_server_count=${summary.mcp_server_count ?? "unknown"}`
  });
}

function expectBashUnavailable() {
  return (summary) => {
    const bashUse = summary.tool_uses.find((tool) => tool.name === "Bash");
    const bashError = summary.tool_results.find(
      (result) => result.is_error === true && typeof result.content === "string" && result.content.includes("No such tool available: Bash")
    );
    return {
      name: "bash_unavailable",
      status: !bashUse || bashError ? "pass" : "fail",
      message: bashUse ? `Bash tool_use observed; unavailable_error=${Boolean(bashError)}` : "No Bash tool_use observed"
    };
  };
}

function warnIfBashExecuted() {
  return (summary) => {
    const bashUse = summary.tool_uses.find((tool) => tool.name === "Bash");
    const bashSuccess = summary.tool_results.find(
      (result) => result.is_error === false && typeof result.content === "string" && result.content.includes("PROFILE_AUDIT_ALLOWEDTOOLS_BASH_PROBE")
    );
    return {
      name: "allowedtools_negative_control",
      status: bashSuccess ? "warn" : "pass",
      message: bashUse
        ? `Bash tool_use observed; executed=${Boolean(bashSuccess)}`
        : "No Bash tool_use observed under --allowedTools negative control"
    };
  };
}

function collectContentItems(events, type) {
  const items = [];
  for (const event of events) {
    const content = event.message?.content ?? event.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const item of content) {
      if (item?.type === type) {
        items.push(item);
      }
    }
  }
  return items;
}

function parseStreamJson(stdout) {
  const events = [];
  const parseErrors = [];
  for (const [index, line] of stdout.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        error: error instanceof Error ? error.message : String(error),
        preview: line.slice(0, 300)
      });
    }
  }
  events.parseErrors = parseErrors;
  return events;
}

function runProcess(command, commandArgs, timeout) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...(process.platform === "win32" ? { shell: true } : {})
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);
    timer.unref();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim(), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function runQuick(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10_000,
    shell: process.platform === "win32"
  });
  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    exit_code: result.status
  };
}

function renderSummary(report) {
  const lines = [
    "# Claude Profile Audit",
    "",
    `Started: ${report.started_at}`,
    `Finished: ${report.finished_at}`,
    `Claude: ${report.claude_version.stdout ?? report.claude_version.error ?? "unknown"}`,
    `Overall: ${report.ok ? "PASS" : "FAIL"}`,
    "",
    "| Profile | Tools | MCP | Skills | Hooks | Cost | Checks |",
    "|---|---:|---:|---:|---:|---:|---|"
  ];
  for (const profile of report.profiles) {
    lines.push(
      `| ${profile.name} | ${profile.tool_count ?? "?"} | ${profile.mcp_server_count ?? "?"} | ${
        profile.skills_count ?? "?"
      } | ${profile.hook_event_count} | ${profile.result?.total_cost_usd ?? "?"} | ${profile.checks
        .map((check) => `${check.status}:${check.name}`)
        .join("<br>")} |`
    );
  }
  lines.push("", "## Notes", "");
  lines.push(
    "- `focused_strict_empty` is the intended no-tools/no-MCP fallback profile.",
    "- `readonly_strict` is the intended direct-benchmark profile: built-in Read/Glob/Grep only and no MCP servers. It is not a full sandbox because hooks and skills still load.",
    "- `allowedtools_bash_probe` is a negative control. If it warns, `--allowedTools` is not a sufficient isolation boundary on this Claude version."
  );
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function parseList(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

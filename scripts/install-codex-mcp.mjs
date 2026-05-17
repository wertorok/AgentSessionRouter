import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverName = valueAfter("--server-name") ?? "claude-session-router";
const projectCwd = path.resolve(valueAfter("--project-cwd") ?? repoRoot);
const startupTimeoutSec = Number(valueAfter("--startup-timeout-sec") ?? "300");
const serverEntry = path.resolve(valueAfter("--server-entry") ?? path.join(repoRoot, "dist", "src", "index.js"));
const configPath = path.resolve(valueAfter("--config") ?? codexConfigPath());
const writeConfig = process.argv.includes("--write");
const force = process.argv.includes("--force");
const allowSelfCwd = process.argv.includes("--allow-self-cwd");
const skipInstall = process.argv.includes("--skip-install");
const skipBuild = process.argv.includes("--skip-build");
const skipSmoke = process.argv.includes("--skip-smoke");
const liveSmoke = process.argv.includes("--live-smoke");

if (!Number.isFinite(startupTimeoutSec) || startupTimeoutSec <= 0) {
  fail("--startup-timeout-sec must be a positive number.");
}
if (writeConfig && !valueAfter("--project-cwd") && !allowSelfCwd) {
  fail("--project-cwd is required when writing Codex config. Pass --allow-self-cwd only for AgentSessionRouter self-tests.");
}

const warnings = [];
if (isBroadCwd(projectCwd)) {
  warnings.push(`Project cwd looks broad: ${projectCwd}. The router should point at a real project directory.`);
}
if (looksLikeRouterRepo(projectCwd) && !process.argv.includes("--project-cwd")) {
  warnings.push("No --project-cwd was provided; using the AgentSessionRouter repo itself as the target project for self-test.");
}

console.log("AgentSessionRouter Codex MCP setup");
console.log(`repo_root=${repoRoot}`);
console.log(`target_project_cwd=${projectCwd}`);
console.log(`codex_config=${configPath}`);
console.log(`write=${writeConfig}`);

if (!skipInstall) {
  runStep("npm install", npmCommand(), ["install"]);
}
if (!skipBuild) {
  runStep("npm run build", npmCommand(), ["run", "build"]);
}
if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

const block = markedBlock(serverName, renderTomlBlock(serverName, serverEntry, projectCwd, startupTimeoutSec));
const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
const writePlan = planConfigWrite(existing, block, serverName);

if (writeConfig) {
  if (writePlan.status === "blocked_existing_unmarked") {
    fail(
      [
        `Codex config already contains an unmarked ${serverName} MCP entry at ${configPath}.`,
        "Refusing to write because appending a duplicate TOML table would break the config.",
        "Edit the existing entry manually, remove it, or rerun with --force only after inspecting the file."
      ].join("\n")
    );
  }
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, writePlan.next, "utf8");
  console.log(`Wrote ${serverName} MCP block to ${configPath} (${writePlan.status}).`);
} else {
  console.log("\nDry run only. Re-run with --write to update the Codex config file.");
  if (writePlan.status === "blocked_existing_unmarked") {
    console.log(`Warning: existing unmarked ${serverName} table detected in ${configPath}; --write will refuse unless you fix it or pass --force.`);
  }
  console.log("\nTOML block:\n");
  console.log(block.trimEnd());
}

if (!skipSmoke) {
  runStep(liveSmoke ? "npm run smoke:postinstall:live" : "npm run smoke:postinstall", npmCommand(), [
    "run",
    liveSmoke ? "smoke:postinstall:live" : "smoke:postinstall",
    "--",
    "--codex-config",
    configPath
  ]);
}

const claudeProbe = probeClaude();
const result = {
  ok: true,
  mode: writeConfig ? "write" : "dry-run",
  config_path: configPath,
  config_status: writeConfig ? writePlan.status : "not_written",
  server_name: serverName,
  server_entry: serverEntry,
  project_cwd: projectCwd,
  smoke: skipSmoke ? "skipped" : liveSmoke ? "live" : "stub",
  claude: claudeProbe,
  warnings
};

console.log("\nSetup summary:");
console.log(JSON.stringify(result, null, 2));
if (!writeConfig) {
  console.log("\nNext step:");
  console.log(`npm run install:codex -- --project-cwd "${projectCwd}"`);
}

function runStep(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.error) {
    fail(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status}.`);
  }
}

function planConfigWrite(existing, block, name) {
  const normalized = existing.replace(/\r\n/g, "\n");
  const begin = markerBegin(name);
  const end = markerEnd(name);
  const beginIndex = normalized.indexOf(begin);
  const endIndex = normalized.indexOf(end);
  if (beginIndex >= 0 && endIndex > beginIndex) {
    const before = normalized.slice(0, beginIndex);
    const after = normalized.slice(endIndex + end.length).replace(/^\n+/, "");
    return {
      status: "replaced_marked_block",
      next: `${before}${block}${after ? `\n${after}` : ""}`
    };
  }
  const range = unmarkedServerTableRange(normalized, name);
  if (range && force) {
    const before = normalized.slice(0, range.start);
    const after = normalized.slice(range.end).replace(/^\n+/, "");
    return {
      status: "replaced_unmarked_table",
      next: `${before}${block}${after ? `\n${after}` : ""}`
    };
  }
  if (range) {
    return {
      status: "blocked_existing_unmarked",
      next: normalized
    };
  }
  const prefix = normalized.trim().length > 0 ? `${normalized.replace(/\n*$/, "\n\n")}` : "";
  return {
    status: "appended_new_block",
    next: `${prefix}${block}`
  };
}

function renderTomlBlock(name, entry, cwd, timeout) {
  return `[mcp_servers.${tomlKey(name)}]
command = "${escapeToml(process.execPath)}"
args = ["${escapeToml(entry)}"]
cwd = "${escapeToml(cwd)}"
startup_timeout_sec = ${timeout}
`;
}

function markedBlock(name, toml) {
  return `${markerBegin(name)}
# Managed by AgentSessionRouter setup. Do not put this block in Claude Code or Claude Desktop configs.
${toml}${markerEnd(name)}
`;
}

function markerBegin(name) {
  return `# >>> AgentSessionRouter MCP: ${name} >>>`;
}

function markerEnd(name) {
  return `# <<< AgentSessionRouter MCP: ${name} <<<`;
}

function unmarkedServerTableRange(source, name) {
  const escapedName = escapeRegExp(name);
  const escapedTomlName = escapeRegExp(escapeToml(name));
  const pattern = new RegExp(`^\\s*\\[\\s*mcp_servers\\s*\\.\\s*(?:"${escapedTomlName}"|${escapedName})\\s*\\]\\s*$`, "m");
  const match = pattern.exec(source);
  if (!match || match.index === undefined) {
    return null;
  }
  const start = match.index;
  const nextTablePattern = /^\s*\[/gm;
  nextTablePattern.lastIndex = start + match[0].length;
  let next = nextTablePattern.exec(source);
  while (next && next.index === start) {
    next = nextTablePattern.exec(source);
  }
  return {
    start,
    end: next?.index ?? source.length
  };
}

function probeClaude() {
  const result = spawnSync("claude", ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 5000,
    shell: process.platform === "win32"
  });
  if (result.error) {
    return {
      status: result.error.code === "ENOENT" ? "missing" : "probe_failed",
      error: result.error.message
    };
  }
  return {
    status: result.status === 0 ? "ready" : "version_failed",
    version: result.stdout.trim(),
    stderr: result.stderr.trim(),
    exit_code: result.status
  };
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function codexConfigPath() {
  return path.join(os.homedir(), ".codex", "config.toml");
}

function isBroadCwd(value) {
  const parsed = path.parse(value);
  return value === parsed.root || value === os.homedir();
}

function looksLikeRouterRepo(value) {
  return path.resolve(value) === repoRoot;
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function escapeToml(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function tomlKey(value) {
  return `"${escapeToml(value)}"`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

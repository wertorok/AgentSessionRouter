import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverName = valueAfter("--server-name") ?? "claude-session-router";
const format = valueAfter("--format") ?? "toml";
const projectCwd = path.resolve(valueAfter("--project-cwd") ?? process.cwd());
const startupTimeoutSec = Number(valueAfter("--startup-timeout-sec") ?? "300");
const serverEntry = path.resolve(valueAfter("--server-entry") ?? path.join(repoRoot, "dist", "src", "index.js"));
const comments = !process.argv.includes("--no-comments");

if (!Number.isFinite(startupTimeoutSec) || startupTimeoutSec <= 0) {
  fail("--startup-timeout-sec must be a positive number.");
}

if (!existsSync(serverEntry)) {
  fail(`Built server entry is missing at ${serverEntry}. Run npm run build first.`);
}

if (format === "json") {
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          [serverName]: {
            command: "node",
            args: [serverEntry],
            cwd: projectCwd
          }
        }
      },
      null,
      2
    )
  );
} else if (format === "toml") {
  const prefix = comments
    ? [
        "# Paste this whole block into Codex CLI config:",
        `#   ${codexConfigPath()}`,
        "# Do not put this in Claude Code .claude.json or Claude Desktop claude_desktop_config.json.",
        "# `cwd` is required: AgentSessionRouter derives the target project from this directory.",
        "# `codex mcp add` is not sufficient for this router unless you also add cwd manually.",
        ""
      ].join("\n")
    : "";
  console.log(`${prefix}[mcp_servers.${tomlKey(serverName)}]
command = "${escapeToml(process.execPath)}"
args = ["${escapeToml(serverEntry)}"]
cwd = "${escapeToml(projectCwd)}"
startup_timeout_sec = ${startupTimeoutSec}`);
} else {
  fail("--format must be either toml or json.");
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

function codexConfigPath() {
  if (process.platform === "win32") {
    const home = process.env.USERPROFILE ?? "%USERPROFILE%";
    return `${home}\\.codex\\config.toml`;
  }
  return path.join(process.env.HOME ?? "~", ".codex", "config.toml");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

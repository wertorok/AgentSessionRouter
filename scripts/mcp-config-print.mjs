import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const serverName = valueAfter("--server-name") ?? "claude-session-router";
const format = valueAfter("--format") ?? "toml";
const projectCwd = path.resolve(valueAfter("--project-cwd") ?? process.cwd());
const startupTimeoutSec = Number(valueAfter("--startup-timeout-sec") ?? "180");
const serverEntry = path.resolve(valueAfter("--server-entry") ?? path.join(repoRoot, "dist", "src", "index.js"));

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
  console.log(`[mcp_servers.${tomlKey(serverName)}]
command = "node"
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

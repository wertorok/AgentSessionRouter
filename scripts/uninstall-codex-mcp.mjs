import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const serverName = valueAfter("--server-name") ?? "claude-session-router";
const configPath = path.resolve(valueAfter("--config") ?? codexConfigPath());
const writeConfig = process.argv.includes("--write");
const force = process.argv.includes("--force");

const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
const plan = planConfigRemoval(existing, serverName, existsSync(configPath));

if (writeConfig && plan.status === "blocked_existing_unmarked") {
  fail({
    code: "UNMARKED_ENTRY_REQUIRES_FORCE",
    message: [
      `Codex config contains an unmarked ${serverName} MCP entry at ${configPath}.`,
      "Refusing to remove it automatically because it was not created by AgentSessionRouter setup.",
      "Inspect the file, then rerun with --force to remove that table."
    ].join(" ")
  });
}

if (writeConfig && plan.changed) {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, plan.next, "utf8");
}

const result = {
  ok: plan.status !== "blocked_existing_unmarked" || !writeConfig,
  mode: writeConfig ? "write" : "dry-run",
  config_path: configPath,
  server_name: serverName,
  status: plan.status,
  changed: writeConfig ? plan.changed : false,
  would_change: plan.changed,
  force,
  note:
    plan.status === "removed_marked_block" || plan.status === "removed_unmarked_table"
      ? "Codex MCP registration was removed. Router SQLite state and Claude session files were left intact."
      : "No Codex MCP registration was removed."
};

console.log(JSON.stringify(result, null, 2));

function planConfigRemoval(existing, name, configExists) {
  if (!configExists) {
    return {
      status: "config_missing",
      changed: false,
      next: ""
    };
  }

  const normalized = existing.replace(/\r\n/g, "\n");
  const begin = markerBegin(name);
  const end = markerEnd(name);
  const beginIndex = normalized.indexOf(begin);
  const endIndex = normalized.indexOf(end);
  if (beginIndex >= 0 && endIndex > beginIndex) {
    return {
      status: "removed_marked_block",
      changed: true,
      next: removeRange(normalized, beginIndex, endIndex + end.length)
    };
  }

  const range = unmarkedServerTableRange(normalized, name);
  if (range && force) {
    return {
      status: "removed_unmarked_table",
      changed: true,
      next: removeRange(normalized, range.start, range.end)
    };
  }
  if (range) {
    return {
      status: "blocked_existing_unmarked",
      changed: false,
      next: normalized
    };
  }

  return {
    status: "not_present",
    changed: false,
    next: normalized
  };
}

function removeRange(source, start, end) {
  const before = source.slice(0, start).replace(/\n+$/, "\n");
  const after = source.slice(end).replace(/^\n+/, "");
  const next = `${before}${after}`.replace(/^\n+/, "");
  return next.trim().length > 0 ? `${next.replace(/\n*$/, "")}\n` : "";
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

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function codexConfigPath() {
  return path.join(os.homedir(), ".codex", "config.toml");
}

function escapeToml(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(error) {
  console.error(JSON.stringify({ ok: false, error }, null, 2));
  process.exit(1);
}

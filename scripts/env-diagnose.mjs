import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const compatibilityPath = path.join(cwd, "COMPATIBILITY.md");
const testedClaudeVersions = readTestedClaudeVersions(compatibilityPath);
const claudePaths = findClaudeExecutables();
const claudeProbes = claudePaths.map((entry) => probeClaude(entry));
const codexConfig = codexConfigInfo();
const claudeCodeConfig = configInfo("Claude Code", claudeCodeConfigPath());
const claudeDesktopConfig = configInfo("Claude Desktop", claudeDesktopConfigPath());

const warnings = [];
if (claudePaths.length === 0) {
  warnings.push("No `claude` executable found in PATH. Router live consults will start degraded until Claude Code CLI is installed/authenticated.");
}
if (claudePaths.length > 1) {
  warnings.push("Multiple `claude` executables found in PATH. The first PATH match is what the router will use; verify this is the intended Claude Code CLI.");
}
if (!codexConfig.exists) {
  warnings.push("Codex CLI config was not found. Register AgentSessionRouter in Codex config, not Claude Code or Claude Desktop config.");
}
if (claudeCodeConfig.exists || claudeDesktopConfig.exists) {
  warnings.push("Claude Code/Desktop configs exist on this machine. They are separate from Codex CLI config and are not the target for AgentSessionRouter registration.");
}
for (const probe of claudeProbes) {
  if (probe.compatibility === "unknown") {
    warnings.push(`Claude executable ${probe.path} reports an unlisted version. Check COMPATIBILITY.md before trusting live routing.`);
  }
  if (probe.status !== "ok") {
    warnings.push(`Claude executable ${probe.path} failed version probe: ${probe.error ?? probe.stderr ?? "unknown error"}`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      ready_for_live_codex_router: warnings.length === 0,
      platform: process.platform,
      cwd,
      compatibility: {
        path: compatibilityPath,
        tested_claude_versions: testedClaudeVersions
      },
      claude_path_resolution: {
        command_used_by_router: "claude",
        windows_spawn_mode: process.platform === "win32" ? "shell-enabled for .cmd/.bat shims" : "direct spawn",
        path_order: claudePaths,
        probes: claudeProbes
      },
      config_targets: {
        target_for_router: {
          product: "Codex CLI",
          path: codexConfig.path,
          exists: codexConfig.exists,
          format: "TOML",
          warning: "Register AgentSessionRouter here."
        },
        not_targets: [
          {
            product: "Claude Code",
            path: claudeCodeConfig.path,
            exists: claudeCodeConfig.exists,
            format: "JSON/settings",
            warning: "Do not register Codex MCP servers here."
          },
          {
            product: "Claude Desktop",
            path: claudeDesktopConfig.path,
            exists: claudeDesktopConfig.exists,
            format: "JSON",
            warning: "Do not register Codex MCP servers here."
          }
        ]
      },
      warnings,
      next_steps: [
        "Run `npm run print-codex-config -- --project-cwd <your-project>`.",
        `Paste the entire generated TOML block into ${codexConfig.path}.`,
        "Verify `cwd` points to the project the router should serve."
      ]
    },
    null,
    2
  )
);

function findClaudeExecutables() {
  const command = process.platform === "win32" ? "where" : "which";
  const args = process.platform === "win32" ? ["claude"] : ["-a", "claude"];
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 5000 });
  if (result.error || result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function probeClaude(claudePath) {
  const result = spawnSync(claudePath, ["--version"], {
    encoding: "utf8",
    timeout: 5000,
    shell: process.platform === "win32"
  });
  if (result.error) {
    return {
      path: claudePath,
      status: "probe_failed",
      compatibility: "unknown",
      error: result.error.message
    };
  }
  const version = result.stdout.trim();
  return {
    path: claudePath,
    status: result.status === 0 ? "ok" : "version_failed",
    version,
    compatibility: isKnownClaudeVersion(version) ? "known" : "unknown",
    exit_code: result.status,
    stderr: result.stderr.trim()
  };
}

function isKnownClaudeVersion(version) {
  return testedClaudeVersions.some((tested) => version.includes(tested) || tested.includes(version));
}

function readTestedClaudeVersions(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }
  const source = readFileSync(filePath, "utf8");
  const section = source.match(/claude-code:[\s\S]*?tested:\s*\[([^\]]*)\]/);
  if (!section) {
    return [];
  }
  return [...section[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function codexConfigInfo() {
  const filePath = path.join(homeDir(), ".codex", "config.toml");
  return configInfo("Codex CLI", filePath);
}

function claudeCodeConfigPath() {
  return path.join(homeDir(), ".claude.json");
}

function claudeDesktopConfigPath() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(homeDir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "darwin") {
    return path.join(homeDir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  return path.join(homeDir(), ".config", "Claude", "claude_desktop_config.json");
}

function configInfo(product, filePath) {
  return {
    product,
    path: filePath,
    exists: existsSync(filePath)
  };
}

function homeDir() {
  return os.homedir();
}

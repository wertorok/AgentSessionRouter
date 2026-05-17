import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("Codex MCP install scripts", () => {
  it("installs and removes the managed Codex MCP block idempotently", () => {
    const dir = makeTempDir("codex-install");
    const configPath = path.join(dir, "config.toml");
    const projectCwd = path.join(dir, "Project With Spaces");
    const serverEntry = path.join(dir, "dist", "src", "index.js");
    mkdirSync(path.dirname(serverEntry), { recursive: true });
    mkdirSync(projectCwd, { recursive: true });
    writeFileSync(serverEntry, "process.stdout.write('fake server\\n');\n", "utf8");
    writeFileSync(configPath, "model = \"gpt-5\"\n", "utf8");

    runScript("scripts/install-codex-mcp.mjs", [
      "--config",
      configPath,
      "--server-entry",
      serverEntry,
      "--project-cwd",
      projectCwd,
      "--write",
      "--force",
      "--skip-install",
      "--skip-build",
      "--skip-smoke"
    ]);

    const installed = readFileSync(configPath, "utf8");
    expect(installed).toContain("# >>> AgentSessionRouter MCP: claude-session-router >>>");
    expect(installed).toContain(`command = "${escapeTomlPath(process.execPath)}"`);
    expect(installed).toContain("startup_timeout_sec = 300");
    expect(installed).toContain(escapeTomlPath(projectCwd));

    const removal = JSON.parse(
      runScript("scripts/uninstall-codex-mcp.mjs", ["--config", configPath, "--write"])
    ) as { status: string; changed: boolean };
    expect(removal.status).toBe("removed_marked_block");
    expect(removal.changed).toBe(true);

    const removed = readFileSync(configPath, "utf8");
    expect(removed).toContain("model = \"gpt-5\"");
    expect(removed).not.toContain("claude-session-router");

    const secondRemoval = JSON.parse(
      runScript("scripts/uninstall-codex-mcp.mjs", ["--config", configPath, "--write"])
    ) as { status: string; changed: boolean };
    expect(secondRemoval.status).toBe("not_present");
    expect(secondRemoval.changed).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("requires --force before removing an unmarked Codex MCP table", () => {
    const dir = makeTempDir("codex-uninstall");
    const configPath = path.join(dir, "config.toml");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      configPath,
      [
        "[mcp_servers.\"claude-session-router\"]",
        "command = \"node\"",
        "args = [\"C:\\\\router\\\\dist\\\\src\\\\index.js\"]",
        "",
        "[mcp_servers.other]",
        "command = \"node\""
      ].join("\n"),
      "utf8"
    );

    const blockedRemoval = runScriptResult("scripts/uninstall-codex-mcp.mjs", ["--config", configPath, "--write"]);
    expect(blockedRemoval.status).toBe(1);
    expect(blockedRemoval.stderr).toContain("UNMARKED_ENTRY_REQUIRES_FORCE");

    const forcedRemoval = JSON.parse(
      runScript("scripts/uninstall-codex-mcp.mjs", ["--config", configPath, "--write", "--force"])
    ) as { status: string; changed: boolean };
    expect(forcedRemoval.status).toBe("removed_unmarked_table");
    expect(forcedRemoval.changed).toBe(true);

    const removed = readFileSync(configPath, "utf8");
    expect(removed).not.toContain("claude-session-router");
    expect(removed).toContain("[mcp_servers.other]");

    rmSync(dir, { recursive: true, force: true });
  });

  it("requires an explicit project cwd before writing install config", () => {
    const dir = makeTempDir("codex-project-cwd-required");
    const configPath = path.join(dir, "config.toml");
    const serverEntry = path.join(dir, "dist", "src", "index.js");
    mkdirSync(path.dirname(serverEntry), { recursive: true });
    writeFileSync(serverEntry, "process.stdout.write('fake server\\n');\n", "utf8");

    const missingProjectCwd = runScriptResult("scripts/install-codex-mcp.mjs", [
      "--config",
      configPath,
      "--server-entry",
      serverEntry,
      "--write",
      "--skip-install",
      "--skip-build",
      "--skip-smoke"
    ]);
    expect(missingProjectCwd.status).toBe(1);
    expect(missingProjectCwd.stderr).toContain("--project-cwd is required");

    rmSync(dir, { recursive: true, force: true });
  });
});

function runScript(script: string, args: string[]): string {
  return execFileSync(process.execPath, [path.join(repoRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function runScriptResult(script: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [path.join(repoRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function makeTempDir(prefix: string): string {
  return path.join(os.tmpdir(), `claude-router-${prefix}-${process.pid}-${Math.random().toString(16).slice(2)}`);
}

function escapeTomlPath(value: string): string {
  return value.replaceAll("\\", "\\\\");
}

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RouterConfig } from "./config.js";
import { isKnownVersion, readCompatibility } from "./compatibility.js";

export interface ClaudeJsonResponse {
  sessionId: string;
  result: string;
  tokensIn?: number;
  tokensOut?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  totalCostUsd?: number;
  model?: string;
  numTurns?: number;
}

export interface ClaudePromptOptions {
  resumeSessionId?: string;
  extraArgs?: string[];
  includeConfiguredExtraArgs?: boolean;
  appendSystemPrompt?: string;
}

export interface HealthProbeResult {
  ok: boolean;
  degraded: boolean;
  detectedVersion?: string;
  testedVersions: string[];
  unknownVersion: boolean;
  error?: string;
}

export interface ClaudeAdapter {
  getVersion(): Promise<string>;
  runPrompt(prompt: string, resumeSessionId?: string): Promise<ClaudeJsonResponse>;
  runPromptWithOptions?(prompt: string, options: ClaudePromptOptions): Promise<ClaudeJsonResponse>;
  healthProbe(): Promise<HealthProbeResult>;
  sessionFileExists(claudeSessionId: string): Promise<boolean>;
}

export class CliClaudeAdapter implements ClaudeAdapter {
  constructor(private readonly config: RouterConfig) {}

  async getVersion(): Promise<string> {
    return (await runCommand(this.config.claude.command, ["--version"], this.config.claude.commandTimeoutMs)).trim();
  }

  async runPrompt(prompt: string, resumeSessionId?: string): Promise<ClaudeJsonResponse> {
    return this.runPromptWithOptions(prompt, { resumeSessionId });
  }

  async runPromptWithOptions(prompt: string, options: ClaudePromptOptions = {}): Promise<ClaudeJsonResponse> {
    const args = [
      "-p",
      ...(options.includeConfiguredExtraArgs === false ? [] : this.config.claude.extraArgs),
      ...(options.extraArgs ?? []),
      "--output-format",
      this.config.claude.outputFormat
    ];
    if (options.appendSystemPrompt) {
      args.push("--append-system-prompt", options.appendSystemPrompt);
    }
    if (options.resumeSessionId) {
      args.push("--resume", options.resumeSessionId);
    }
    args.push(prompt);

    const stdout = await runCommand(this.config.claude.command, args, this.config.claude.commandTimeoutMs);
    return parseClaudeJson(stdout);
  }

  async healthProbe(): Promise<HealthProbeResult> {
    const compatibility = readCompatibility(this.config.claude.compatibilityFile);
    const testedVersions = compatibility.testedClaudeVersions;
    let detectedVersion: string | undefined;
    let unknownVersion = false;

    try {
      detectedVersion = await this.getVersion();
      unknownVersion = !isKnownVersion(detectedVersion, testedVersions);
      await this.runPrompt("ping");
      const fixtureId = this.readFixtureSessionId();
      if (fixtureId) {
        await this.runPrompt("ping", fixtureId);
      }

      return {
        ok: true,
        degraded: false,
        detectedVersion,
        testedVersions,
        unknownVersion
      };
    } catch (error: unknown) {
      return {
        ok: false,
        degraded: true,
        detectedVersion,
        testedVersions,
        unknownVersion,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async sessionFileExists(claudeSessionId: string): Promise<boolean> {
    const home = os.homedir();
    const candidates = [
      path.join(home, ".claude", "sessions", `${claudeSessionId}.json`),
      path.join(home, ".claude", "sessions", `${claudeSessionId}.jsonl`),
      path.join(home, ".claude", "projects")
    ];

    if (existsSync(candidates[0]) || existsSync(candidates[1])) {
      return true;
    }

    const projectsDir = candidates[2];
    if (!existsSync(projectsDir)) {
      return false;
    }

    return findFile(projectsDir, `${claudeSessionId}.jsonl`, 3);
  }

  private readFixtureSessionId(): string | null {
    const fixturePath = path.join(path.dirname(this.config.storage.dbPath), "fixture_resume_session_id.txt");
    if (!existsSync(fixturePath)) {
      return null;
    }
    const fixtureId = readFileSync(fixturePath, "utf8").trim();
    return fixtureId || null;
  }
}

export function parseClaudeJson(stdout: string): ClaudeJsonResponse {
  const parsed: unknown = JSON.parse(stdout);
  if (!isObject(parsed)) {
    throw new Error("Claude JSON response was not an object");
  }

  const usage = objectField(parsed, "usage");
  const modelUsage = objectField(parsed, "modelUsage");
  const sessionId = stringField(parsed, "session_id") ?? stringField(parsed, "sessionId");
  const result = stringField(parsed, "result") ?? stringField(parsed, "text") ?? stringField(parsed, "answer");
  if (!sessionId || !result) {
    throw new Error("Claude JSON response missing session_id or result");
  }
  if (parsed.is_error === true) {
    throw new Error(`Claude CLI returned error result: ${result}`);
  }

  return {
    sessionId,
    result,
    tokensIn:
      numberField(parsed, "tokens_in") ??
      numberField(parsed, "input_tokens") ??
      numberField(usage, "input_tokens") ??
      undefined,
    tokensOut:
      numberField(parsed, "tokens_out") ??
      numberField(parsed, "output_tokens") ??
      numberField(usage, "output_tokens") ??
      undefined,
    cacheCreationInputTokens:
      numberField(parsed, "cache_creation_input_tokens") ?? numberField(usage, "cache_creation_input_tokens") ?? undefined,
    cacheReadInputTokens:
      numberField(parsed, "cache_read_input_tokens") ?? numberField(usage, "cache_read_input_tokens") ?? undefined,
    totalCostUsd:
      numberField(parsed, "total_cost_usd") ?? numberField(parsed, "cost_usd") ?? numberField(usage, "total_cost_usd") ?? undefined,
    model: stringField(parsed, "model") ?? Object.keys(modelUsage)[0] ?? undefined,
    numTurns: numberField(parsed, "num_turns") ?? numberField(parsed, "numTurns") ?? undefined
  };
}

function findFile(dir: string, fileName: string, remainingDepth: number): boolean {
  if (remainingDepth < 0) {
    return false;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return true;
    }
    if (entry.isDirectory() && findFile(fullPath, fileName, remainingDepth - 1)) {
      return true;
    }
  }

  return false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function numberField(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function objectField(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return isObject(value) ? value : {};
}

export function buildCommandSpawnOptions(platform: NodeJS.Platform): {
  stdio: ["pipe", "pipe", "pipe"];
  windowsHide: boolean;
  shell?: boolean;
} {
  return {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    ...(platform === "win32" ? { shell: true } : {})
  };
}

function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, buildCommandSpawnOptions(process.platform));

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            killTimer = setTimeout(() => {
              child.kill("SIGKILL");
            }, 2_000);
            killTimer.unref();
          }, timeoutMs)
        : null;
    timer?.unref();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      if (timedOut) {
        reject(
          new Error(
            `Command timed out after ${timeoutMs}ms: ${command} ${formatArgsForError(args)}`
          )
        );
        return;
      }
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const jsonError = extractClaudeJsonError(stdout);
      reject(new Error(`Command failed: ${command} ${formatArgsForError(args)}\n${jsonError ?? stderr ?? stdout}`.trim()));
    });
    child.stdin.end();
  });
}

function formatArgsForError(args: string[]): string {
  return args.map((arg) => (arg.length > 200 ? `[arg length=${arg.length}]` : arg)).join(" ");
}

function extractClaudeJsonError(stdout: string): string | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (isObject(parsed) && parsed.is_error === true && typeof parsed.result === "string") {
      return `Claude CLI returned error result: ${parsed.result}`;
    }
  } catch {
    return null;
  }
  return null;
}

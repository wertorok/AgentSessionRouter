import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { RouterConfig } from "./config.js";
import { isKnownVersion, readCompatibility } from "./compatibility.js";

const execFileAsync = promisify(execFile);

export interface ClaudeJsonResponse {
  sessionId: string;
  result: string;
  tokensIn?: number;
  tokensOut?: number;
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
  healthProbe(): Promise<HealthProbeResult>;
  sessionFileExists(claudeSessionId: string): Promise<boolean>;
}

export class CliClaudeAdapter implements ClaudeAdapter {
  constructor(private readonly config: RouterConfig) {}

  async getVersion(): Promise<string> {
    const { stdout } = await execFileAsync(this.config.claude.command, ["--version"]);
    return stdout.trim();
  }

  async runPrompt(prompt: string, resumeSessionId?: string): Promise<ClaudeJsonResponse> {
    const args = ["-p", "--output-format", this.config.claude.outputFormat];
    if (resumeSessionId) {
      args.push("--resume", resumeSessionId);
    }
    args.push(prompt);

    const { stdout } = await execFileAsync(this.config.claude.command, args, {
      maxBuffer: 10 * 1024 * 1024
    });
    return parseClaudeJson(stdout);
  }

  async healthProbe(): Promise<HealthProbeResult> {
    const compatibility = readCompatibility(this.config.claude.compatibilityFile);
    const testedVersions = compatibility.testedClaudeVersions;

    try {
      const detectedVersion = await this.getVersion();
      const unknownVersion = !isKnownVersion(detectedVersion, testedVersions);
      await this.runPrompt("ping");

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
        testedVersions,
        unknownVersion: false,
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
}

function parseClaudeJson(stdout: string): ClaudeJsonResponse {
  const parsed: unknown = JSON.parse(stdout);
  if (!isObject(parsed)) {
    throw new Error("Claude JSON response was not an object");
  }

  const sessionId = stringField(parsed, "session_id") ?? stringField(parsed, "sessionId");
  const result = stringField(parsed, "result") ?? stringField(parsed, "text") ?? stringField(parsed, "answer");
  if (!sessionId || !result) {
    throw new Error("Claude JSON response missing session_id or result");
  }

  return {
    sessionId,
    result,
    tokensIn: numberField(parsed, "tokens_in") ?? numberField(parsed, "input_tokens") ?? undefined,
    tokensOut: numberField(parsed, "tokens_out") ?? numberField(parsed, "output_tokens") ?? undefined
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

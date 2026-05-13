import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface EvidenceFile {
  path: string;
  hash: string;
  fileSize: number;
  content: string;
}

export interface EvidenceSnippet {
  text: string;
  hash: string;
}

const SNIPPET_CONTEXT_LINES = 5;

export function readEvidenceFile(cwd: string, inputPath: string): EvidenceFile {
  const relativePath = normalizeEvidencePath(inputPath);
  const absoluteCwd = path.resolve(cwd);
  const absolutePath = path.resolve(absoluteCwd, relativePath);
  if (absolutePath !== absoluteCwd && !absolutePath.startsWith(`${absoluteCwd}${path.sep}`)) {
    throw new Error(`evidence path escapes project cwd: ${inputPath}`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`evidence path does not exist: ${relativePath}`);
  }
  const stat = statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`evidence path is not a file: ${relativePath}`);
  }
  const content = readFileSync(absolutePath, "utf8");
  return {
    path: relativePath,
    hash: sha256(content),
    fileSize: stat.size,
    content
  };
}

export function buildEvidenceSnippet(content: string, selector: string | undefined): EvidenceSnippet {
  const snippet = selector ? selectorSnippet(content, selector) : content;
  return {
    text: snippet,
    hash: `sha256:${sha256(snippet)}`
  };
}

export function normalizeEvidenceHash(hash: string): string {
  return hash.startsWith("sha256:") ? hash : `sha256:${hash}`;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function selectorSnippet(content: string, selector: string): string {
  const lines = content.split(/\r?\n/);
  const selectorLineIndex = lines.findIndex((line) => line.includes(selector));
  if (selectorLineIndex < 0) {
    throw new Error(`selector not found: ${selector}`);
  }
  const start = Math.max(0, selectorLineIndex - SNIPPET_CONTEXT_LINES);
  const end = Math.min(lines.length, selectorLineIndex + SNIPPET_CONTEXT_LINES + 1);
  return lines.slice(start, end).join("\n");
}

function normalizeEvidencePath(inputPath: string): string {
  if (!inputPath || path.isAbsolute(inputPath)) {
    throw new Error(`evidence path must be relative: ${inputPath}`);
  }
  const normalized = path.normalize(inputPath).replaceAll("\\", "/");
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`evidence path escapes project cwd: ${inputPath}`);
  }
  return normalized;
}

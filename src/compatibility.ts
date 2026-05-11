import { existsSync, readFileSync } from "node:fs";

export interface CompatibilityInfo {
  testedClaudeVersions: string[];
  testedCodexVersions: string[];
}

export function readCompatibility(filePath: string): CompatibilityInfo {
  if (!existsSync(filePath)) {
    return { testedClaudeVersions: [], testedCodexVersions: [] };
  }

  const source = readFileSync(filePath, "utf8");
  return {
    testedClaudeVersions: readTestedVersions(source, "claude-code"),
    testedCodexVersions: readTestedVersions(source, "codex-cli")
  };
}

export function isKnownVersion(versionOutput: string, testedVersions: readonly string[]): boolean {
  const detected = normalizeVersion(versionOutput);
  return testedVersions.some((version) => normalizeVersion(version) === detected);
}

export function normalizeVersion(versionOutput: string): string {
  const match = versionOutput.match(/\d+(?:\.\d+)+/);
  return match?.[0] ?? versionOutput.trim();
}

function readTestedVersions(source: string, section: "claude-code" | "codex-cli"): string[] {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${section}:`);
  if (start < 0) {
    return [];
  }

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.endsWith(":") && !line.startsWith("tested:")) {
      break;
    }
    if (line.startsWith("tested:")) {
      const listMatch = line.match(/\[(.*)]/);
      if (!listMatch) {
        return [];
      }
      return listMatch[1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}


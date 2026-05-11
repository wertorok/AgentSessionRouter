import { existsSync } from "node:fs";
import path from "node:path";

export function resolveProjectId(explicitProjectId: string | null | undefined, cwd: string): string {
  const trimmed = explicitProjectId?.trim();
  if (trimmed) {
    return trimmed;
  }
  return path.basename(findGitRoot(cwd) ?? cwd);
}

export function findGitRoot(cwd: string): string | null {
  let current = path.resolve(cwd);

  while (true) {
    if (existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}


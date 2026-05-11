import { randomUUID } from "node:crypto";

export function createInternalSessionId(): string {
  return `session_${randomUUID()}`;
}


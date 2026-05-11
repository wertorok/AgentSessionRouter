import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function jsonToolResult(payload: object, isError = false): CallToolResult {
  return {
    isError,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

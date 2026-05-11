import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { RouterRuntime, RuntimeOptions } from "./runtime.js";
import { createRuntime } from "./runtime.js";

export class RouterServer {
  private runtime: RouterRuntime | null = null;

  constructor(private readonly options: RuntimeOptions = {}) {}

  async start(): Promise<void> {
    this.runtime = await createRuntime(this.options);
    const server = new McpServer({
      name: "persistent-claude-session-router-mcp",
      version: "0.1.0"
    });

    await server.connect(new StdioServerTransport());
  }
}

export function createServer(options: RuntimeOptions = {}): RouterServer {
  return new RouterServer(options);
}

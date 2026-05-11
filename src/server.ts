export class RouterServer {
  async start(): Promise<void> {
    throw new Error("Server boot sequence is implemented in Phase 3");
  }
}

export function createServer(): RouterServer {
  return new RouterServer();
}


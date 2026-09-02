#!/usr/bin/env node
import { LocalEngramAdapter } from "./adapters/local.js";
import { EngramMcpServer } from "./mcp/server.js";

const server = new EngramMcpServer({ adapter: new LocalEngramAdapter() });
let stopping = false;

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await server.stop();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void stop().finally(() => process.exit(0)));
}

process.once("uncaughtException", (error) => {
  console.error(error instanceof Error ? error.message : "Internal MCP server error");
  void stop().finally(() => process.exit(1));
});

await server.start();

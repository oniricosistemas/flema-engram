import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import opencodeConfig from "../../opencode.example.json";

const RESOURCES = [
  "engram://health",
  "engram://projects",
  "engram://projects/{project}",
  "engram://observations/{id}",
  "engram://sessions/{session_id}",
  "engram://changes",
  "engram://changes/{change_name}/state",
  "engram://changes/{change_name}/artifacts",
];

let client: Client | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("declared stdio package command", () => {
  it("uses an OpenCode local MCP command array and lists capabilities", async () => {
    const config = opencodeConfig.mcp.engram;
    expect(config).toMatchObject({
      type: "local",
      command: ["npm", "run", "mcp"],
      enabled: true,
    });

    const transport = new StdioClientTransport({
      command: config.command[0],
      args: config.command.slice(1),
      cwd: process.cwd(),
      stderr: "pipe",
    });
    client = new Client({ name: "stdio-smoke", version: "1.0.0" });
    await client.connect(transport);

    expect((await client.listTools()).tools).toHaveLength(7);
    expect((await client.listResourceTemplates()).resourceTemplates).toHaveLength(5);
  }, 15_000);

  it("returns the exact eight canonical URI patterns from resources/list", async () => {
    const config = opencodeConfig.mcp.engram;
    const transport = new StdioClientTransport({
      command: config.command[0],
      args: config.command.slice(1),
      cwd: process.cwd(),
      stderr: "pipe",
    });
    client = new Client({ name: "stdio-resource-list", version: "1.0.0" });
    await client.connect(transport);

    const uris = (await client.listResources()).resources.map(({ uri }) => uri);

    expect(uris).toHaveLength(RESOURCES.length);
    expect(new Set(uris)).toEqual(new Set(RESOURCES));
  }, 15_000);
});

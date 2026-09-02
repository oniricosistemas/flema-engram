import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { LocalEngramAdapter } from "../../src/adapters/local.js";
import { EngramMcpServer } from "../../src/mcp/server.js";
import { liveRecentSessionsResponse } from "../fixtures/engram-recent-sessions.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live recent-session compatibility", () => {
  it("serves engram_list_projects when recent sessions omit updated_at", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json(liveRecentSessionsResponse));
    vi.stubGlobal("fetch", fetchMock);

    const server = new EngramMcpServer({ adapter: new LocalEngramAdapter() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "live-compat-test", version: "1.0.0" });

    try {
      await server.server.connect(serverTransport);
      await client.connect(clientTransport);

      const result = await client.callTool({ name: "engram_list_projects", arguments: {} });
      const projects = JSON.parse((result.content[0] as { text: string }).text);

      expect(projects).toEqual([
        {
          name: "general",
          observationCount: 0,
          lastActiveAt: "2026-08-30T23:31:35Z",
          scopes: [],
        },
      ]);
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        "http://127.0.0.1:7437/observations/recent?limit=100",
        "http://127.0.0.1:7437/sessions/recent?limit=100",
      ]);
    } finally {
      await client.close();
      await server.stop();
    }
  });

  it("orders mixed live and legacy session shapes by normalized updated_at", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json([
      {
        id: "fallback-newest",
        project: "general",
        started_at: "2026-08-30 13:00:00",
        observation_count: 1,
      },
      {
        id: "explicit-older",
        project: "general",
        started_at: "2026-08-30T10:00:00Z",
        updated_at: "2026-08-30T12:00:00Z",
        observation_count: 2,
      },
    ])));

    const server = new EngramMcpServer({ adapter: new LocalEngramAdapter() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "normalized-order-test", version: "1.0.0" });

    try {
      await server.server.connect(serverTransport);
      await client.connect(clientTransport);

      const result = await client.callTool({ name: "engram_list_sessions", arguments: {} });
      const sessions = JSON.parse((result.content[0] as { text: string }).text);

      expect(sessions.map(({ id }: { id: string }) => id)).toEqual([
        "fallback-newest",
        "explicit-older",
      ]);
      expect(sessions[0].updated_at).toBe("2026-08-30T13:00:00Z");
      expect(sessions[1].updated_at).toBe("2026-08-30T12:00:00Z");
    } finally {
      await client.close();
      await server.stop();
    }
  });
});

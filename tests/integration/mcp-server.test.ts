import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EngramAdapter, HealthStatus, Observation, Project, Session } from "../../src/adapters/types.js";
import { EngramMcpServer } from "../../src/mcp/server.js";
import { EngramUnavailable } from "../../src/utils/errors.js";

const TOOLS = [
  "engram_get_observation", "engram_get_project_state", "engram_get_session",
  "engram_list_observations", "engram_list_projects", "engram_list_sessions",
  "engram_search_observations",
];
const RESOURCES = [
  "engram://health", "engram://projects", "engram://projects/{project}",
  "engram://observations/{id}", "engram://sessions/{session_id}", "engram://changes",
  "engram://changes/{change_name}/state", "engram://changes/{change_name}/artifacts",
];

function observation(id: number, topic_key = `topic/${id}`, content = `content ${id}`): Observation {
  return {
    id, type: "manual", title: `Observation ${id}`, topic_key, content,
    project: "alpha team", scope: "project", updated_at: "2026-08-30T12:00:00Z",
    created_at: "2026-08-30T11:00:00Z",
  };
}

function project(name = "alpha team"): Project {
  return { name, observationCount: 2, lastActiveAt: "2026-08-30T12:00:00Z", scopes: ["project"] };
}

function session(id: string, updated_at: string): Session {
  return {
    id,
    project: "alpha team",
    started_at: "2026-08-30T10:00:00Z",
    updated_at,
    observation_count: 1,
  };
}

function adapter(overrides: Partial<EngramAdapter> = {}): EngramAdapter {
  return {
    health: vi.fn().mockResolvedValue({ local: { available: true } } satisfies HealthStatus),
    listProjects: vi.fn().mockResolvedValue([project()]),
    listObservations: vi.fn().mockResolvedValue([]),
    getObservation: vi.fn().mockResolvedValue(null),
    searchObservations: vi.fn().mockResolvedValue([]),
    listSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

let client: Client;
let server: EngramMcpServer;
let data: EngramAdapter;

beforeEach(async () => {
  data = adapter();
  server = new EngramMcpServer({ adapter: data });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "contract-test", version: "1.0.0" });
  await server.server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

async function expectCode(action: () => Promise<unknown>, code: number, text: string): Promise<void> {
  try {
    await action();
    throw new Error("Expected MCP request to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    expect((error as McpError).code).toBe(code);
    expect((error as Error).message).toContain(text);
  }
}

describe("MCP surface contract", () => {
  it("lists exactly seven tools and eight resources as sets", async () => {
    const tools = (await client.listTools()).tools.map(({ name }) => name).sort();
    const resourceUris = (await client.listResources()).resources.map(({ uri }) => uri);
    const templates = (await client.listResourceTemplates()).resourceTemplates.map(({ uriTemplate }) => uriTemplate);

    expect(tools).toEqual(TOOLS);
    expect(resourceUris).toHaveLength(RESOURCES.length);
    expect(new Set(resourceUris)).toEqual(new Set(RESOURCES));
    expect(new Set(templates)).toEqual(new Set(RESOURCES.filter((uri) => uri.includes("{"))));
  });

  it("returns compact JSON tool content through the injected adapter", async () => {
    const result = await client.callTool({ name: "engram_list_projects", arguments: {} });
    const item = result.content[0] as { type: string; text: string };

    expect(item).toEqual({ type: "text", text: JSON.stringify([project()]) });
    expect(data.listProjects).toHaveBeenCalledOnce();
  });

  it("validates tool input and maps nullable tool misses", async () => {
    await expectCode(
      () => client.callTool({ name: "engram_get_project_state", arguments: {} }),
      ErrorCode.InvalidParams,
      "Invalid",
    );
    await expectCode(
      () => client.callTool({ name: "engram_get_observation", arguments: { id: 404 } }),
      ErrorCode.InvalidParams,
      "not found",
    );
    await expectCode(
      () => client.callTool({ name: "engram_search_observations", arguments: { q: "" } }),
      ErrorCode.InvalidParams,
      "Invalid tool input",
    );
    await expectCode(
      () => client.callTool({ name: "engram_get_session", arguments: { id: "sess-missing" } }),
      ErrorCode.InvalidParams,
      "Session not found",
    );
  });

  it("returns canonical state for a valid project tool call", async () => {
    const activity = [
      observation(1, "sdd/alpha/proposal"),
      observation(2, "sdd/alpha/apply-progress", "status: blocked by approval"),
    ];
    vi.mocked(data.listObservations).mockResolvedValue(activity);

    const result = await client.callTool({
      name: "engram_get_project_state",
      arguments: { project: "alpha team" },
    });
    const state = JSON.parse((result.content[0] as { text: string }).text);

    expect(state.project).toEqual(project());
    expect(state.counts.total).toBe(2);
    expect(state.changes).toHaveLength(1);
    expect(state.blockers).toEqual([
      expect.objectContaining({ id: 2, title: "Observation 2" }),
    ]);
    expect(data.listObservations).toHaveBeenCalledWith({ project: "alpha team" });
  });

  it("returns observation and session lookups as JSON", async () => {
    const found = observation(42);
    const foundSession = session("session one", "2026-08-30T12:00:00Z");
    vi.mocked(data.getObservation).mockResolvedValue(found);
    vi.mocked(data.getSession).mockResolvedValue(foundSession);

    const observationResult = await client.callTool({ name: "engram_get_observation", arguments: { id: 42 } });
    const sessionResult = await client.callTool({ name: "engram_get_session", arguments: { id: "session one" } });

    expect(JSON.parse((observationResult.content[0] as { text: string }).text)).toEqual(found);
    expect(JSON.parse((sessionResult.content[0] as { text: string }).text)).toEqual(foundSession);
    expect(data.getSession).toHaveBeenCalledWith("session one");
  });

  it("orders session tool output by updated_at descending", async () => {
    vi.mocked(data.listSessions).mockResolvedValue([
      session("oldest", "2026-08-30T11:00:00Z"),
      session("newest", "2026-08-30T13:00:00Z"),
      session("middle", "2026-08-30T12:00:00Z"),
    ]);

    const result = await client.callTool({
      name: "engram_list_sessions",
      arguments: { project: "alpha team" },
    });
    const sessions = JSON.parse((result.content[0] as { text: string }).text) as Session[];

    expect(sessions.map(({ id }) => id)).toEqual(["newest", "middle", "oldest"]);
  });

  it("passes filters to all query handlers", async () => {
    await client.callTool({ name: "engram_list_observations", arguments: { project: "alpha", type: "bugfix", limit: 7 } });
    await client.callTool({ name: "engram_search_observations", arguments: { q: "auth model" } });
    await client.callTool({ name: "engram_list_sessions", arguments: { project: "alpha", limit: 3 } });

    expect(data.listObservations).toHaveBeenCalledWith({ project: "alpha", type: "bugfix", limit: 7 });
    expect(data.searchObservations).toHaveBeenCalledWith("auth model");
    expect(data.listSessions).toHaveBeenCalledWith({ project: "alpha", limit: 3 });
  });

  it("decodes resource variables and returns application/json", async () => {
    const result = await client.readResource({ uri: "engram://projects/alpha%20team" });
    const item = result.contents[0] as { uri: string; mimeType?: string; text: string };

    expect(item.mimeType).toBe("application/json");
    expect(JSON.parse(item.text).project.name).toBe("alpha team");
    expect(data.listObservations).toHaveBeenCalledWith({ project: "alpha team" });
  });

  it("returns canonical change state, artifacts, and explicit blockers", async () => {
    vi.mocked(data.listObservations).mockResolvedValue([
      observation(1, "sdd/space ship/proposal"),
      observation(2, "sdd/space ship/apply-progress", "status: blocked by API approval"),
      observation(3, "sdd/space ship/verify-report"),
    ]);
    const state = await client.readResource({ uri: "engram://changes/space%20ship/state" });
    const artifacts = await client.readResource({ uri: "engram://changes/space%20ship/artifacts" });

    expect(JSON.parse((state.contents[0] as { text: string }).text)).toMatchObject({
      name: "space ship", state: "completed", blockers: [{ id: 2 }],
      phases: [{ phase: "proposal" }, { phase: "apply" }, { phase: "verify" }],
    });
    expect(JSON.parse((artifacts.contents[0] as { text: string }).text).map((item: { kind: string }) => item.kind))
      .toEqual(["proposal", "apply", "verify"]);
  });

  it("maps invalid and missing resources to protocol errors", async () => {
    await expectCode(
      () => client.readResource({ uri: "engram://observations/not-a-number" }),
      ErrorCode.InvalidParams,
      "Invalid observation id",
    );
    await expectCode(
      () => client.readResource({ uri: "engram://sessions/missing" }),
      -32002,
      "not found",
    );
    await expectCode(
      () => client.readResource({ uri: "engram://changes/missing/state" }),
      -32002,
      "not found",
    );
  });

  it("maps unavailable and unexpected failures to safe internal errors", async () => {
    vi.mocked(data.listProjects).mockRejectedValueOnce(
      new EngramUnavailable("socket ECONNREFUSED 127.0.0.1:7437"),
    );
    await expectCode(
      () => client.callTool({ name: "engram_list_projects", arguments: {} }),
      ErrorCode.InternalError,
      "Engram is unavailable",
    );

    vi.mocked(data.health).mockRejectedValueOnce(new Error("secret transport detail"));
    await expectCode(
      () => client.readResource({ uri: "engram://health" }),
      ErrorCode.InternalError,
      "Internal Engram error",
    );
  });
});

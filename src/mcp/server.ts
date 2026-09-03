import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import packageJson from "../../package.json" with { type: "json" };
import type { EngramAdapter } from "../adapters/types.js";
import { EngramUnavailable } from "../utils/errors.js";
import { GetObservationInput, getObservationHandler } from "./tools/get-observation.js";
import { GetProjectStateInput, getProjectStateHandler } from "./tools/get-project-state.js";
import { GetSessionInput, getSessionHandler } from "./tools/get-session.js";
import { ListObservationsInput, listObservationsHandler } from "./tools/list-observations.js";
import { ListProjectsInput, listProjectsHandler } from "./tools/list-projects.js";
import { ListSessionsInput, listSessionsHandler } from "./tools/list-sessions.js";
import { SearchObservationsInput, searchObservationsHandler } from "./tools/search-observations.js";
import { changeArtifactsResourceHandler } from "./resources/engram-change-artifacts.js";
import { changeStateResourceHandler } from "./resources/engram-change-state.js";
import { changesResourceHandler } from "./resources/engram-changes.js";
import { healthResourceHandler } from "./resources/engram-health.js";
import { observationResourceHandler } from "./resources/engram-observation.js";
import { projectResourceHandler } from "./resources/engram-project.js";
import { projectsResourceHandler } from "./resources/engram-projects.js";
import { sessionResourceHandler } from "./resources/engram-session.js";

export interface McpServerConfig {
  adapter: EngramAdapter;
  name?: string;
  version?: string;
}

const JSON_RESOURCE = { mimeType: "application/json" } as const;

function listedResourceTemplate(name: string, uriTemplate: string): ResourceTemplate {
  return new ResourceTemplate(uriTemplate, {
    list: async () => ({ resources: [{ name, uri: uriTemplate }] }),
  });
}

async function atBoundary<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof McpError) throw error;
    if (error instanceof EngramUnavailable) {
      throw new McpError(ErrorCode.InternalError, "Engram is unavailable");
    }
    throw new McpError(ErrorCode.InternalError, "Internal Engram error");
  }
}

export class EngramMcpServer {
  private readonly mcp: McpServer;
  private readonly adapter: EngramAdapter;
  private transport: StdioServerTransport | null = null;

  constructor(config: McpServerConfig) {
    this.adapter = config.adapter;
    this.mcp = new McpServer({
      name: config.name ?? "mcp-flema-engram",
      version: config.version ?? packageJson.version,
    });
    this.registerTools();
    this.registerResources();
  }

  private registerTools(): void {
    const handlers = new Map<string, { schema: z.ZodObject<z.ZodRawShape>; run: (args: unknown) => Promise<unknown> }>();
    const tool = <S extends z.AnyZodObject>(name: string, description: string, schema: S, handler: (args: z.infer<S>) => Promise<unknown>) => {
      handlers.set(name, { schema, run: (args) => handler(args as z.infer<S>) });
      this.mcp.registerTool(name, { description, inputSchema: schema.shape }, (args: z.infer<S>) => atBoundary(() => handler(args)) as never);
    };

    tool("engram_get_observation", "Get one observation", GetObservationInput, (args) => getObservationHandler(this.adapter, args));
    tool("engram_get_project_state", "Get canonical project and SDD state", GetProjectStateInput, (args) => getProjectStateHandler(this.adapter, args));
    tool("engram_get_session", "Get one session", GetSessionInput, (args) => getSessionHandler(this.adapter, args));
    tool("engram_list_observations", "List observations", ListObservationsInput, (args) => listObservationsHandler(this.adapter, args));
    tool("engram_list_projects", "List Engram projects", ListProjectsInput, (args) => listProjectsHandler(this.adapter, args));
    tool("engram_list_sessions", "List sessions", ListSessionsInput, (args) => listSessionsHandler(this.adapter, args));
    tool("engram_search_observations", "Search observations", SearchObservationsInput, (args) => searchObservationsHandler(this.adapter, args));

    // McpServer converts callback failures to successful CallToolResult errors.
    // The reconciled contract requires JSON-RPC errors, so own the call boundary.
    this.mcp.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const definition = handlers.get(request.params.name);
      if (!definition) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      const parsed = definition.schema.safeParse(request.params.arguments ?? {});
      if (!parsed.success) throw new McpError(ErrorCode.InvalidParams, `Invalid tool input: ${parsed.error.message}`);
      return atBoundary(() => definition.run(parsed.data)) as never;
    });
  }

  private registerResources(): void {
    this.mcp.registerResource("engram-health", "engram://health", JSON_RESOURCE,
      () => atBoundary(() => healthResourceHandler(this.adapter)));
    this.mcp.registerResource("engram-projects", "engram://projects", JSON_RESOURCE,
      () => atBoundary(() => projectsResourceHandler(this.adapter)));
    this.mcp.registerResource("engram-changes", "engram://changes", JSON_RESOURCE,
      () => atBoundary(() => changesResourceHandler(this.adapter)));

    this.mcp.registerResource("engram-project", listedResourceTemplate("engram-project", "engram://projects/{project}"), JSON_RESOURCE,
      (uri, { project }) => atBoundary(() => projectResourceHandler(this.adapter, uri, { project: String(project ?? "") })));
    this.mcp.registerResource("engram-observation", listedResourceTemplate("engram-observation", "engram://observations/{id}"), JSON_RESOURCE,
      (uri, { id }) => {
        const raw = String(id ?? "");
        if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid observation id: ${raw}`);
        }
        return atBoundary(() => observationResourceHandler(this.adapter, uri, { id: Number(raw) }));
      });
    this.mcp.registerResource("engram-session", listedResourceTemplate("engram-session", "engram://sessions/{session_id}"), JSON_RESOURCE,
      (uri, { session_id }) => atBoundary(() => sessionResourceHandler(this.adapter, uri, { session_id: String(session_id ?? "") })));
    this.mcp.registerResource("engram-change-state", listedResourceTemplate("engram-change-state", "engram://changes/{change_name}/state"), JSON_RESOURCE,
      (uri, { change_name }) => atBoundary(() => changeStateResourceHandler(this.adapter, uri, { change_name: String(change_name ?? "") })));
    this.mcp.registerResource("engram-change-artifacts", listedResourceTemplate("engram-change-artifacts", "engram://changes/{change_name}/artifacts"), JSON_RESOURCE,
      (uri, { change_name }) => atBoundary(() => changeArtifactsResourceHandler(this.adapter, uri, { change_name: String(change_name ?? "") })));
  }

  get server(): McpServer { return this.mcp; }

  async start(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.mcp.connect(this.transport);
  }

  async stop(): Promise<void> {
    await this.mcp.close();
    this.transport = null;
  }
}

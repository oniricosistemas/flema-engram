# MCP Server Specification

## Purpose

Expose Engram state through a Model Context Protocol (MCP) server so external agents can read projects, observations, sessions, and SDD changes via standardized tools and resources.

## Types

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

interface McpServerConfig {
  adapter: EngramAdapter;
  name: string;                 // default: "mcp-flema-engram"
  version: string;              // default: package version
}

interface McpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

## Requirements

### Requirement: Server Setup

The server SHALL instantiate an MCP server with a name, version, and declared capabilities for tools and resources.

#### Scenario: Default configuration

- GIVEN `McpServerConfig` with an adapter
- WHEN the server is constructed
- THEN it creates an MCP server with name `mcp-flema-engram` and tools/resources capabilities

#### Scenario: Custom name and version

- GIVEN `name: "custom-engram"` and `version: "1.2.3"`
- WHEN the server is constructed
- THEN the server metadata reflects the supplied values

### Requirement: Stdio Transport

The server SHALL use stdio transport by default, suitable for integration with OpenCode, Claude Desktop, and other MCP hosts.

#### Scenario: Start on stdio

- GIVEN the server is configured
- WHEN `start()` is called
- THEN it connects a `StdioServerTransport` and begins processing messages

#### Scenario: Graceful shutdown

- GIVEN the server is running
- WHEN `stop()` is called
- THEN it closes the transport and stops processing new messages

### Requirement: Tool Registration

The server SHALL register exactly the seven read tools defined in the tools spec.

#### Scenario: List tools

- GIVEN the server is running
- WHEN the host calls `tools/list`
- THEN it returns the seven Engram tools with their input schemas

### Requirement: Resource Registration

The server SHALL register the nine resource templates defined in the resources spec.

#### Scenario: List resources

- GIVEN the server is running
- WHEN the host calls `resources/list`
- THEN it returns the nine Engram resource templates

### Requirement: Adapter Injection

The server SHALL receive an `EngramAdapter` instance and pass it to tool and resource handlers.

#### Scenario: Local adapter used

- GIVEN a local HTTP adapter is injected
- WHEN a tool handler executes
- THEN it uses the injected adapter, not a hard-coded client

### Requirement: Error Boundaries

Uncaught errors in handlers SHALL be caught and returned as MCP errors with appropriate error codes.

#### Scenario: Adapter throws

- GIVEN `getObservation` rejects with `EngramAdapterError`
- WHEN the matching tool is invoked
- THEN the server returns an MCP error with `code: -32603` and a sanitized message

#### Scenario: Invalid resource URI

- GIVEN a resource URI does not match any registered template
- WHEN the resource is read
- THEN the server returns an MCP error with `code: -32602`

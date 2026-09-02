# MCP Server Specification

## Purpose

Expose local Engram through a runnable, read-only MCP stdio server.

## Requirements

### Requirement: Runnable Stdio Entrypoint

The package MUST provide an executable entrypoint that creates the local adapter, starts `StdioServerTransport`, and remains usable from OpenCode's supported local MCP command-array configuration. It MUST support graceful shutdown.

#### Scenario: Start from package command

- GIVEN the package is installed and local Engram configuration is valid
- WHEN its declared MCP command is executed
- THEN a stdio server starts and completes MCP initialization

### Requirement: Exact MCP Surface

The server MUST register exactly the seven tools defined by the MCP tools contract and exactly the eight `engram://` resources defined by the MCP resources contract. Registration order MUST NOT be contractual.

#### Scenario: Enumerate capabilities

- GIVEN an initialized client
- WHEN tools and resources are listed
- THEN the seven tool names and eight resource URIs match their contracts as sets

### Requirement: Adapter Injection

Tool and resource handlers MUST use the injected read-only adapter and MUST NOT construct hidden clients.

#### Scenario: Invoke a tool

- GIVEN a local adapter is injected
- WHEN `engram_list_projects` is called
- THEN the handler obtains data through that adapter

### Requirement: MCP Error Boundaries

The server MUST map invalid input to invalid-parameter errors, missing resources to the MCP SDK's resource-not-found error, and local Engram failures or unexpected handler failures to safe internal errors. Nullable adapter lookups MUST become boundary errors, and errors MUST NOT be hidden in successful resource JSON.

#### Scenario: Missing resource entity

- GIVEN an adapter lookup returns `null`
- WHEN the corresponding resource is read
- THEN the client receives a resource-not-found error

#### Scenario: Local Engram is unavailable

- GIVEN the adapter reports unavailability
- WHEN a tool or resource is invoked
- THEN the client receives a safe MCP error without transport internals

## Deferred

- HTTP/SSE transports, writes, remote/cloud hosting guarantees, and custom host commands are deferred.

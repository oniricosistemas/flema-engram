# Integration Tests Specification

## Purpose

Define the integration test suite that validates the full stack — Engram HTTP client, adapters, MCP server, sidebar plugin, project resolver, dashboard launcher, and SDD change detector — against a live or mocked Engram service, ensuring correctness of end-to-end flows.

## Requirements

### Requirement: HTTP Client Integration

Tests SHALL validate the HTTP client against a real or mock Engram endpoint for all six verified endpoints.

#### Scenario: Health round-trip

- GIVEN a mock Engram server responding to `GET /health`
- WHEN `health()` is called
- THEN it returns the mocked health object

#### Scenario: Retry on failure

- GIVEN a mock that fails twice then succeeds on `GET /health`
- WHEN `health()` is called with `retries: 2`
- THEN the third attempt succeeds and the result is returned

#### Scenario: Timeout enforcement

- GIVEN a mock that delays response beyond `timeoutMs`
- WHEN any method is called
- THEN it rejects with `EngramApiError` with `code: "timeout"`

### Requirement: Adapter Integration

Tests SHALL validate all three adapter implementations (local HTTP, cloud stub, composite fallback) against mock HTTP clients.

#### Scenario: Local adapter normalizes errors

- GIVEN the HTTP client returns `EngramApiError` with `code: "connection"`
- WHEN the local adapter's `listProjects()` is called
- THEN it rejects with `EngramAdapterError` with `code: "unavailable"`

#### Scenario: Cloud stub returns empty data

- GIVEN the cloud adapter is instantiated
- WHEN `listProjects()` is called
- THEN it returns `[]` without network calls

#### Scenario: Composite fallback

- GIVEN the primary adapter rejects with `unavailable` and the secondary returns projects
- WHEN the composite adapter's `listProjects()` is called
- THEN it returns the secondary adapter's result

#### Scenario: Both adapters unavailable

- GIVEN both primary and secondary reject with `unavailable`
- WHEN the composite adapter's `listProjects()` is called
- THEN it rejects with `EngramAdapterError` with `code: "unavailable"`

### Requirement: MCP Server Integration

Tests SHALL validate the MCP server over stdio transport for tool invocation, resource reading, and error handling.

#### Scenario: Tool invocation end-to-end

- GIVEN the MCP server is connected via stdio transport
- WHEN a `tools/call` request for `engram_list_projects` is sent
- THEN the response contains a JSON array of projects

#### Scenario: Resource read end-to-end

- GIVEN the MCP server is connected via stdio transport
- WHEN a `resources/read` request for `eng-ram://health` is sent
- THEN the response contains the health status

#### Scenario: Invalid tool name

- GIVEN the MCP server is running
- WHEN a `tools/call` for `nonexistent_tool` is sent
- THEN it returns an MCP error with `code: -32601`

#### Scenario: Tool input validation

- GIVEN the MCP server is running
- WHEN `engram_get_project_state` is called without `project`
- THEN it returns an MCP error with `code: -32602`

### Requirement: Sidebar Plugin Integration

Tests SHALL validate sidebar rendering, keyboard actions, and error containment using component-level testing.

#### Scenario: Renders project data

- GIVEN a mock adapter returning a project with two changes
- WHEN the sidebar component renders
- THEN it displays the project name, change list, and health status

#### Scenario: Refresh action

- GIVEN the sidebar is rendered
- WHEN the refresh keyboard shortcut is triggered
- THEN the adapter's `getProjectState()` is called again

#### Scenario: Error containment

- GIVEN the adapter throws during render
- WHEN the error boundary catches it
- THEN the panel shows a fallback message without crashing the host

### Requirement: Project Resolver Integration

Tests SHALL validate cwd-to-project mapping against mock filesystem and adapter data.

#### Scenario: Resolves from cwd

- GIVEN `cwd` is `/projects/mcp-flema-engram`
- WHEN `resolve(cwd)` is called
- THEN it returns `"mcp-flema-engram"` with `source: "cwd"`

#### Scenario: Walks up parent directories

- GIVEN `cwd` is `/projects/mcp-flema-engram/src/plugin`
- WHEN `resolve(cwd)` is called
- THEN it finds the project root and returns the project name

#### Scenario: Engram validation

- GIVEN the directory name exists in Engram
- WHEN `resolve(cwd)` is called
- THEN it confirms via the adapter and returns `confidence: "high"`

### Requirement: Dashboard Launcher Integration

Tests SHALL validate path resolution and cross-platform launch using mock filesystem and spawn.

#### Scenario: Opens from cwd

- GIVEN `Task-Manager-Portable.html` exists in `cwd`
- WHEN `open()` is called
- THEN the correct file path is passed to the spawn command

#### Scenario: Walks up to find file

- GIVEN `Task-Manager-Portable.html` is in a parent directory
- WHEN `open()` is called
- THEN it finds and opens the file from the parent

#### Scenario: Reports not found

- GIVEN no `Task-Manager-Portable.html` exists anywhere
- WHEN `open()` is called
- THEN it returns `{ success: false, error: "Dashboard HTML not found" }`

### Requirement: SDD Change Detector Integration

Tests SHALL validate topic key parsing, phase grouping, state derivation, and blocker identification with realistic observation sets.

#### Scenario: Groups observations into changes

- GIVEN observations with topic keys `sdd/x/proposal`, `sdd/x/spec`, `sdd/y/design`
- WHEN `detectChanges()` is called
- THEN two changes are returned: `x` with two phases, `y` with one phase

#### Scenario: Derives in-progress state

- GIVEN change `x` has `spec` and `design` phases, `design` being most recent
- WHEN state is derived
- THEN state is `"in_progress"`

#### Scenario: Derives archived state

- GIVEN change `x` has an `archive` phase observation
- WHEN state is derived
- THEN state is `"archived"`

#### Scenario: Surfaces blockers

- GIVEN change `x` has a `bugfix` observation
- WHEN blockers are collected
- THEN the observation is included in the change's `blocker` field

### Requirement: Live Engram Smoke Tests

A subset of tests SHALL run against a real local Engram instance to validate contract assumptions, skipped when Engram is unavailable.

#### Scenario: Live health check

- GIVEN Engram is running on `127.0.0.1:7437`
- WHEN `health()` is called
- THEN it returns a valid `EngramHealth` object

#### Scenario: Live observation query

- GIVEN Engram has at least one observation
- WHEN `getRecentObservations({ project, limit: 1 })` is called
- THEN it returns an array with at least one observation

#### Scenario: Skipped when offline

- GIVEN Engram is not reachable
- WHEN a live test runs
- THEN it is skipped with a descriptive message, not failed

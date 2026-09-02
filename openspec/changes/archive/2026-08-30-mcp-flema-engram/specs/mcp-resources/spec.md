# MCP Resources Specification

## Purpose

Define the MCP resource templates that expose Engram state as URI-addressable, read-only resources for MCP hosts, enabling agents to subscribe to or fetch structured snapshots of projects, observations, sessions, and SDD change progress.

## Types

```ts
interface McpResourceTemplate {
  uri: string;           // URI template with {placeholders}
  name: string;          // Human-readable name
  mimeType: string;      // "application/json"
  description: string;   // What the resource returns
}

interface McpResource {
  uri: string;           // Resolved URI
  mimeType: string;
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;        // JSON stringified content
  }>;
}
```

## Requirements

### Requirement: Resource Template Manifest

The server SHALL register exactly nine resource templates covering health, projects, observations, sessions, and SDD changes.

#### Scenario: List resources

- GIVEN the MCP server is running
- WHEN `resources/list` is called
- THEN it returns exactly the nine resource templates in alphabetical order by URI

#### Scenario: Resource count

- GIVEN the server starts
- WHEN `resources/list` is called
- THEN the response contains exactly nine entries

### Requirement: eng-ram://health

The `eng-ram://health` resource SHALL return the current Engram server health status.

#### Scenario: Health snapshot

- GIVEN Engram is running on localhost
- WHEN `resources/read` is called with `eng-ram://health`
- THEN it returns a JSON object with `status` and optional `version`

#### Scenario: Engram offline

- GIVEN Engram is not reachable
- WHEN `resources/read` is called with `eng-ram://health`
- THEN it returns an MCP error with `code: -32603` and message "Engram unavailable"

### Requirement: eng-ram://projects

The `eng-ram://projects` resource SHALL return a list of all projects known to Engram.

#### Scenario: Multiple projects

- GIVEN Engram has observations for projects `alpha` and `beta`
- WHEN `resources/read` is called with `eng-ram://projects`
- THEN it returns a JSON array of `EngramProject` objects

#### Scenario: Empty project list

- GIVEN Engram has no observations
- WHEN `resources/read` is called with `eng-ram://projects`
- THEN it returns an empty JSON array `[]`

### Requirement: eng-ram://projects/{project}

The `eng-ram://projects/{project}` resource SHALL return full project state for a specific project.

#### Scenario: Valid project

- GIVEN project `mcp-flema-engram` exists
- WHEN `resources/read` is called with `eng-ram://projects/mcp-flema-engram`
- THEN it returns a JSON `EngramProjectState` with changes, blockers, and recent activity

#### Scenario: Unknown project

- GIVEN project `nonexistent` has no observations
- WHEN `resources/read` is called with `eng-ram://projects/nonexistent`
- THEN it returns a JSON object with empty changes, empty blockers, and empty recent activity

#### Scenario: URL encoding

- GIVEN a project name containing special characters `my project!`
- WHEN `resources/read` is called with `eng-ram://projects/my%20project%21`
- THEN it decodes the URI and queries for `my project!`

### Requirement: eng-ram://observations/{id}

The `eng-ram://observations/{id}` resource SHALL return a single observation by its numeric id.

#### Scenario: Existing observation

- GIVEN observation `42` exists
- WHEN `resources/read` is called with `eng-ram://observations/42`
- THEN it returns a JSON `EngramObservation`

#### Scenario: Non-existent observation

- GIVEN observation `999` does not exist
- WHEN `resources/read` is called with `eng-ram://observations/999`
- THEN it returns an MCP error with `code: -32602`

#### Scenario: Invalid id format

- GIVEN the URI contains `eng-ram://observations/abc`
- WHEN `resources/read` is called
- THEN it returns an MCP error with `code: -32602` and message "invalid observation id"

### Requirement: eng-ram://sessions/{session_id}

The `eng-ram://sessions/{session_id}` resource SHALL return a single session by its string id.

#### Scenario: Existing session

- GIVEN session `sess-abc` exists
- WHEN `resources/read` is called with `eng-ram://sessions/sess-abc`
- THEN it returns a JSON `EngramSession`

#### Scenario: Non-existent session

- GIVEN session `sess-missing` does not exist
- WHEN `resources/read` is called with `eng-ram://sessions/sess-missing`
- THEN it returns an MCP error with `code: -32602`

### Requirement: eng-ram://changes

The `eng-ram://changes` resource SHALL return all detected SDD changes across all projects with their current state.

#### Scenario: Multiple changes

- GIVEN Engram has observations for two SDD changes
- WHEN `resources/read` is called with `eng-ram://changes`
- THEN it returns a JSON array of `SddChange` objects with name, state, and phase summary

#### Scenario: No SDD observations

- GIVEN Engram has observations but none with `sdd/` topic keys
- WHEN `resources/read` is called with `eng-ram://changes`
- THEN it returns an empty JSON array `[]`

### Requirement: eng-ram://changes/{change_name}/state

The `eng-ram://changes/{change_name}/state` resource SHALL return the current phase state of a specific SDD change.

#### Scenario: Change in progress

- GIVEN change `mcp-flema-engram` has `spec` and `design` phases
- WHEN `resources/read` is called with `eng-ram://changes/mcp-flema-engram/state`
- THEN it returns a JSON object with `name`, `state`, current phase, and phase history

#### Scenario: Unknown change

- GIVEN change `no-such-change` has no observations
- WHEN `resources/read` is called with `eng-ram://changes/no-such-change/state`
- THEN it returns a JSON object with `state: "unknown"` and empty phases

### Requirement: eng-ram://changes/{change_name}/artifacts

The `eng-ram://changes/{change_name}/artifacts` resource SHALL return all artifacts (proposal, spec, design, tasks, verify-report, archive-report) for a specific SDD change.

#### Scenario: Change with multiple artifacts

- GIVEN change `mcp-flema-engram` has `proposal` and `spec` artifacts
- WHEN `resources/read` is called with `eng-ram://changes/mcp-flema-engram/artifacts`
- THEN it returns a JSON array of `EngramArtifact` objects sorted by `updatedAt` descending

#### Scenario: Change with no artifacts

- GIVEN change `empty-change` exists but has no artifacts
- WHEN `resources/read` is called with `eng-ram://changes/empty-change/artifacts`
- THEN it returns an empty JSON array `[]`

### Requirement: Resource Error Handling

Resource reads SHALL return MCP JSON-RPC errors for invalid URIs and adapter failures, never crash the server.

#### Scenario: Unregistered URI

- GIVEN a URI `eng-ram://unknown` is not registered
- WHEN `resources/read` is called
- THEN it returns an MCP error with `code: -32602` and message "resource not found"

#### Scenario: Adapter failure

- GIVEN the adapter throws `EngramAdapterError` with `code: "unavailable"`
- WHEN a resource read is attempted
- THEN it returns an MCP error with `code: -32603` and message "Engram unavailable"

### Requirement: JSON Serialization

All resource content SHALL be serialized as compact JSON strings inside the MCP `content` array, with `mimeType: "application/json"`.

#### Scenario: Compact JSON

- GIVEN a resource returns a project state
- WHEN the host receives the response
- THEN `content[0].mimeType` is `"application/json"` and `content[0].text` is compact JSON (no pretty-printing)

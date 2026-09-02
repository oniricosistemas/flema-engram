# MCP Tools Specification

## Purpose

Define the seven read-only MCP tools that expose Engram state to MCP hosts, including input/output schemas and error codes.

## Types

```ts
import { z } from "zod";

const ListProjectsInput = z.object({});
const GetProjectStateInput = z.object({ project: z.string().min(1) });
const ListObservationsInput = z.object({
  project: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  type: z.string().optional(),
});
const GetObservationInput = z.object({ id: z.number().int().positive() });
const SearchObservationsInput = z.object({ q: z.string().min(1).max(500) });
const ListSessionsInput = z.object({
  project: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});
const GetSessionInput = z.object({ id: z.string().min(1) });
```

## Requirements

### Requirement: Tool Manifest

The server SHALL expose exactly these tools: `engram_list_projects`, `engram_get_project_state`, `engram_list_observations`, `engram_get_observation`, `engram_search_observations`, `engram_list_sessions`, `engram_get_session`.

#### Scenario: Tools list

- GIVEN the MCP server is running
- WHEN `tools/list` is called
- THEN the response contains exactly the seven tools in alphabetical order

### Requirement: engram_list_projects

`engram_list_projects` SHALL return a list of projects known to Engram with counts and last activity.

#### Scenario: List projects

- GIVEN Engram contains projects `alpha` and `beta`
- WHEN `engram_list_projects` is called
- THEN it returns `[{ name: "alpha", ... }, { name: "beta", ... }]`

### Requirement: engram_get_project_state

`engram_get_project_state` SHALL accept a project name and return the full project state including changes, blockers, and recent activity.

#### Scenario: Valid project

- GIVEN project `mcp-flema-engram` exists
- WHEN `engram_get_project_state` is called with `{ project: "mcp-flema-engram" }`
- THEN it returns an `EngramProjectState`

#### Scenario: Missing project argument

- GIVEN the input omits `project`
- WHEN `engram_get_project_state` is called
- THEN it returns an MCP error with `code: -32602`

### Requirement: engram_list_observations

`engram_list_observations` SHALL accept optional `project`, `limit`, and `type` filters and return matching observations.

#### Scenario: Recent observations by project

- GIVEN project `x` has 10 observations
- WHEN `engram_list_observations` is called with `{ project: "x", limit: 5 }`
- THEN it returns 5 observations

#### Scenario: Filter by type

- GIVEN project `x` has both `decision` and `bugfix` observations
- WHEN `engram_list_observations` is called with `{ project: "x", type: "bugfix" }`
- THEN only bugfix observations are returned

### Requirement: engram_get_observation

`engram_get_observation` SHALL accept an observation id and return a single observation.

#### Scenario: Existing observation

- GIVEN observation id `42` exists
- WHEN `engram_get_observation` is called with `{ id: 42 }`
- THEN it returns the observation

#### Scenario: Non-existent observation

- GIVEN observation id `999` does not exist
- WHEN `engram_get_observation` is called with `{ id: 999 }`
- THEN it returns an MCP error with `code: -32602` and message containing "not found"

### Requirement: engram_search_observations

`engram_search_observations` SHALL accept a query string and return full-text search results.

#### Scenario: Search returns matches

- GIVEN the query `"auth model"` matches 3 observations
- WHEN `engram_search_observations` is called with `{ q: "auth model" }`
- THEN it returns 3 observations

#### Scenario: Empty query rejected

- GIVEN the input is `{ q: "" }`
- WHEN `engram_search_observations` is called
- THEN it returns an MCP error with `code: -32602`

### Requirement: engram_list_sessions

`engram_list_sessions` SHALL accept optional `project` and `limit` filters and return sessions.

#### Scenario: Recent sessions

- GIVEN project `x` has 3 sessions
- WHEN `engram_list_sessions` is called with `{ project: "x" }`
- THEN it returns the 3 sessions ordered by `updated_at` descending

### Requirement: engram_get_session

`engram_get_session` SHALL accept a session id and return a single session.

#### Scenario: Existing session

- GIVEN session id `sess-abc` exists
- WHEN `engram_get_session` is called with `{ id: "sess-abc" }`
- THEN it returns the session

#### Scenario: Non-existent session

- GIVEN session id `sess-missing` does not exist
- WHEN `engram_get_session` is called with `{ id: "sess-missing" }`
- THEN it returns an MCP error with `code: -32602`

### Requirement: Output Schema

Each tool SHALL return content as a JSON string inside the MCP `content` array.

#### Scenario: Structured response

- GIVEN a tool returns data
- WHEN the host receives the response
- THEN `content[0].type` is `"text"` and `content[0].text` is a JSON string

### Requirement: Error Codes

Tool errors SHALL map to MCP JSON-RPC error codes.

| Condition | Code |
|-----------|------|
| Invalid input | -32602 (Invalid params) |
| Engram not found | -32602 (Invalid params) |
| Engram unavailable | -32603 (Internal error) |
| Unexpected error | -32603 (Internal error) |

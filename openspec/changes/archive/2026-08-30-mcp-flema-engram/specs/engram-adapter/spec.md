# EngramAdapter Interface Specification

## Purpose

Define a shared, read-only contract that both the OpenCode sidebar plugin and the MCP server use to query Engram state, independent of transport (local HTTP, cloud stub, or composite fallback).

## Types

```ts
interface EngramProject {
  name: string;
  sessionCount: number;
  observationCount: number;
  lastActivityAt?: string;
}

interface EngramProjectState {
  project: string;
  health: EngramHealth;
  changes: EngramChange[];
  recentObservations: EngramObservation[];
  recentSessions: EngramSession[];
  blockers: EngramObservation[];
}

interface EngramChange {
  name: string;
  phase: string;
  state: "open" | "in_progress" | "completed" | "archived" | "unknown";
  artifacts: EngramArtifact[];
}

interface EngramArtifact {
  kind: "proposal" | "spec" | "design" | "tasks" | "verify-report" | "archive-report" | "other";
  topicKey: string;
  title: string;
  updatedAt: string;
}

interface EngramAdapter {
  health(): Promise<EngramHealth>;
  listProjects(): Promise<EngramProject[]>;
  getProjectState(project: string): Promise<EngramProjectState>;
  listObservations(options: { project?: string; limit?: number; type?: string }): Promise<EngramObservation[]>;
  getObservation(id: number): Promise<EngramObservation>;
  searchObservations(query: string): Promise<EngramObservation[]>;
  listSessions(options: { project?: string; limit?: number }): Promise<EngramSession[]>;
  getSession(id: string): Promise<EngramSession>;
}

class EngramAdapterError extends Error {
  code: "unavailable" | "not_found" | "invalid" | "unknown";
}
```

## Requirements

### Requirement: Adapter Contract

All adapter implementations SHALL satisfy the `EngramAdapter` interface and normalize errors to `EngramAdapterError`.

#### Scenario: Common interface across transports

- GIVEN a local HTTP adapter, a cloud stub adapter, and a composite fallback adapter
- WHEN each is typed as `EngramAdapter`
- THEN TypeScript compiles without coercion

#### Scenario: Error normalization

- GIVEN an underlying client throws `EngramApiError` with `code: "connection"`
- WHEN any adapter method is called
- THEN it rejects with `EngramAdapterError` with `code: "unavailable"`

### Requirement: Local HTTP Adapter

The local HTTP adapter SHALL delegate to `EngramHttpClient` and enrich raw observations into domain models.

#### Scenario: Project state from local Engram

- GIVEN the local adapter is configured for `http://127.0.0.1:7437`
- WHEN `getProjectState("mcp-flema-engram")` is called
- THEN it calls the HTTP client for health, recent observations, and recent sessions, then returns an `EngramProjectState`

#### Scenario: Observation not found

- GIVEN the HTTP client returns HTTP 404 for an observation id
- WHEN `getObservation(999)` is called
- THEN it rejects with `EngramAdapterError` with `code: "not_found"`

### Requirement: Cloud Stub Adapter

The cloud stub adapter SHALL implement the same interface but return empty or placeholder data, enabling builds and tests without a live Engram service.

#### Scenario: Build-time fallback

- GIVEN the cloud adapter is selected
- WHEN `listProjects()` is called
- THEN it returns an empty array

#### Scenario: Stub health

- GIVEN the cloud adapter is selected
- WHEN `health()` is called
- THEN it returns `{ status: "cloud-stub" }`

### Requirement: Composite Fallback Adapter

The composite adapter SHALL try a primary adapter and fall back to a secondary adapter when the primary rejects with `code: "unavailable"`.

#### Scenario: Primary unavailable

- GIVEN the primary adapter rejects with `unavailable` and the secondary returns data
- WHEN `listObservations({})` is called
- THEN the composite returns the secondary result

#### Scenario: Both unavailable

- GIVEN both adapters reject with `unavailable`
- WHEN `getProjectState("x")` is called
- THEN it rejects with `EngramAdapterError` with `code: "unavailable"`

### Requirement: Project List Derivation

`listProjects()` SHALL derive distinct project names from observations and sessions rather than relying on a dedicated endpoint.

#### Scenario: Projects from observations

- GIVEN recent observations exist for projects `alpha` and `beta`
- WHEN `listProjects()` is called
- THEN it returns both projects with correct observation counts and last activity timestamps

#### Scenario: Empty Engram

- GIVEN no observations or sessions exist
- WHEN `listProjects()` is called
- THEN it returns an empty array

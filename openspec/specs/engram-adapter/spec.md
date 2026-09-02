# Engram Adapter Specification

## Purpose

Define the shared read-only boundary over local Engram data.

## Requirements

### Requirement: Read-only Adapter Contract

The adapter MUST expose health, project listing, observation listing/search/lookup, and session listing/lookup. `getObservation(id)` and `getSession(id)` MUST return the entity or `null`; all list methods MUST return arrays.

#### Scenario: Lookup is absent

- GIVEN local Engram returns HTTP 404 for an observation or session
- WHEN the corresponding adapter lookup is called
- THEN the adapter returns `null`

### Requirement: Local Validation and Errors

The local adapter MUST use the bounded HTTP client, MUST validate returned data, and MUST normalize unavailable or invalid upstream responses to a safe adapter error.

#### Scenario: Local Engram is unavailable

- GIVEN the HTTP client reports a connection failure
- WHEN an adapter read is attempted
- THEN the adapter rejects with a safe unavailable error

### Requirement: Project Derivation

`listProjects()` MUST derive distinct projects from supported observation and session reads and MUST NOT require a dedicated `/projects` endpoint.

#### Scenario: Empty local Engram

- GIVEN no observations or sessions are returned
- WHEN projects are listed
- THEN the result is an empty array

### Requirement: Boundary Ownership

Project-state aggregation MAY be composed by MCP or sidebar boundaries from adapter reads. A nullable adapter result MUST be mapped to the appropriate MCP boundary error rather than returned as successful `null` content.

#### Scenario: Missing entity crosses MCP boundary

- GIVEN `getSession(id)` returns `null`
- WHEN an MCP handler serves that lookup
- THEN the handler returns the protocol-appropriate not-found error

## Deferred

- Cloud behavior and availability guarantees are deferred; a cloud stub MUST NOT be used by the local MVP runtime.
- Composite cloud fallback, advanced cache policy, invalidation guarantees, and cross-adapter retries are deferred.

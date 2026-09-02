# MCP Resources Specification

## Purpose

Expose local Engram state as read-only, addressable MCP resources.

## Requirements

### Requirement: Resource Manifest

The server SHALL register exactly these eight resources using the `engram://`
scheme. Registration order is not part of the contract:

- `engram://health`
- `engram://projects`
- `engram://projects/{project}`
- `engram://observations/{id}`
- `engram://sessions/{session_id}`
- `engram://changes`
- `engram://changes/{change_name}/state`
- `engram://changes/{change_name}/artifacts`

#### Scenario: List resources

- GIVEN the MCP server is running
- WHEN `resources/list` is called
- THEN the response contains exactly the eight listed URIs

### Requirement: Resource Content

Each resource SHALL return compact JSON with `mimeType: application/json`.
Project and change resources SHALL use the canonical SDD state and artifact
models.

#### Scenario: Read a known resource

- GIVEN local Engram contains the requested entity
- WHEN the matching `resources/read` request is sent
- THEN the response contains one JSON text item with the requested state

#### Scenario: Decode URI variables

- GIVEN a project or change name contains encoded characters
- WHEN its resource URI is read
- THEN the decoded name is passed to the adapter/query layer

### Requirement: Missing and Invalid Targets

Resource handlers SHALL map invalid identifiers and missing entities to the
MCP SDK's appropriate protocol errors, and SHALL map adapter unavailability
to an internal error. They MUST NOT return successful JSON containing hidden
errors.

#### Scenario: Missing entity

- GIVEN the requested observation, session, project, or change does not exist
- WHEN its resource is read
- THEN the host receives a resource-not-found error

#### Scenario: Invalid observation identifier

- GIVEN an observation URI contains a non-numeric identifier
- WHEN it is read
- THEN the host receives an invalid-parameter error

#### Scenario: Engram unavailable

- GIVEN local Engram cannot be reached
- WHEN a resource is read
- THEN the host receives an internal error with a safe unavailable message

### Requirement: SDD Resources

The change resources SHALL expose normalized report aliases, canonical phase
states, artifacts, and explicit blockers. Ordinary decisions or bugfixes
without an explicit blocked marker MUST NOT become blockers.

#### Scenario: Change state

- GIVEN observations contain SDD phase and report observations
- WHEN the change state resource is read
- THEN it returns normalized phases and the derived current state

#### Scenario: No matching change

- GIVEN no observation belongs to the requested change
- WHEN its state or artifacts resource is read
- THEN it returns a resource-not-found error

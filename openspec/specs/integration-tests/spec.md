# Integration Tests Specification

## Purpose

Define focused, reviewer-verifiable contract evidence for the local read-only MVP.

## Requirements

### Requirement: HTTP and Adapter Contracts

Tests MUST exercise bounded timeout behavior, response validation, query encoding, supported-endpoint project derivation, safe adapter errors, and nullable observation/session lookups against deterministic mocks.

#### Scenario: Missing lookup

- GIVEN a mock Engram endpoint returns 404
- WHEN an entity lookup crosses the adapter boundary
- THEN the adapter returns `null` and the MCP boundary test proves a protocol error

### Requirement: MCP Contract and Stdio Smoke

Tests MUST verify the exact seven-tool and eight-resource manifests as sets, input/output shapes, URI decoding, compact JSON MIME responses, and protocol error mapping. At least one smoke test MUST launch the package's real stdio entrypoint and complete initialization.

#### Scenario: Stdio startup

- GIVEN the package entrypoint is available
- WHEN a test client launches it over stdio
- THEN initialization succeeds and the expected capabilities can be listed

#### Scenario: Resource boundary error

- GIVEN a requested entity is absent
- WHEN its `engram://` resource is read
- THEN the client receives the SDK-appropriate not-found error rather than successful error JSON

### Requirement: Sidebar Host Contract

Tests MUST verify that the plugin exports an official `@opencode-ai/plugin/tui` module, renders SolidJS content in `sidebar_content`, exposes required MVP states, and contains view failures. Tests MUST NOT treat React rendering or `tui.json` as host integration evidence.

#### Scenario: Supported slot registration

- GIVEN the plugin module is loaded by a compatible TUI test host
- WHEN slots are registered
- THEN `sidebar_content` contains the Engram view

### Requirement: Resolver and SDD Contracts

Tests MUST cover override/cwd precedence, `undefined` resolution, report aliases, canonical states/artifacts, and explicit blocker markers.

#### Scenario: Ordinary decision is not a blocker

- GIVEN a decision has no explicit blocked marker
- WHEN SDD state is derived
- THEN it is absent from blockers

## Deferred

- Full live OpenCode/Engram E2E, exotic-platform launch matrices, retry/backoff tests, cloud tests, and advanced cache tests are deferred.
- Historical RED chronology is unavailable/waived; current contract evidence MUST NOT claim reconstructed RED history.

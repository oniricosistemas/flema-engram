# Proposal: MCP Flema Engram MVP

## Intent

Make local Engram and SDD progress visible during OpenCode work through two
read-only deliverables: a host-loadable OpenCode TUI sidebar and an MCP server.

## Scope

### In Scope

- A supported OpenCode TUI plugin using `@opencode-ai/plugin/tui`, SolidJS,
  and the `sidebar_content` slot.
- Local Engram HTTP access with bounded requests, response validation, safe
  error categories, query encoding, and project derivation from supported
  endpoints.
- Seven read-only MCP tools and exactly eight `engram://` resources.
- A runnable stdio MCP entrypoint using the OpenCode local MCP command-array
  configuration.
- Deterministic project selection, SDD report/state/artifact normalization,
  explicit blocker detection, activity, health, and dashboard launch.

### Explicitly Deferred

- Cloud guarantees, advanced cache behavior, retries/backoff, and write APIs.
- Fuzzy or parent-walking project resolution, provenance metadata, and picker UI.
- Extra global keyboard shortcuts, custom dashboard commands, and exotic
  platform handling.
- Full live OpenCode/Engram E2E coverage; focused contract tests and a stdio
  smoke test are sufficient for this MVP.
- Historical RED-phase evidence, which is unavailable and must be recorded as
  waived rather than fabricated.

## Capabilities

### New Capabilities

- `opencode-engram-sidebar`: Host-loadable sidebar observability and dashboard launch.
- `engram-mcp-observability`: Seven read-only MCP tools and eight resources.
- `engram-adapters`: Local HTTP adapter and composite boundary; cloud is a stub.
- `engram-project-resolution`: Deterministic override/cwd project resolution.
- `engram-sdd-state`: Canonical SDD phase, report, artifact, and blocker state.

### Modified Capabilities

- None; this is a greenfield capability set whose initial specs are being
  reconciled to the actual MVP boundary.

## Contract Corrections

- The resource count is eight, not nine, and the URI scheme is `engram://`.
- Resource correctness is set membership, not registration order.
- Adapters return nullable lookups; tools/resources map absence to protocol
  errors at their boundaries.
- The minimal resolver contract is `string | undefined`.
- Historical TDD RED evidence is unavailable/waived.

## Success Criteria

- The supported TUI plugin loads and renders project, SDD, blocker, activity,
  health, and dashboard states.
- The stdio MCP entrypoint starts and exposes the seven tools and eight resources.
- Local Engram failures are bounded, validated, and actionable.
- Contract tests cover manifests, input/output shapes, errors, URI decoding,
  and stdio startup; typecheck and tests pass.

## Rollback Plan

Disable the local OpenCode plugin/MCP configuration and revert the deliverable
commits. The system is read-only, so no Engram migration is required.

## Dependencies

- `@opencode-ai/plugin/tui`, `@opentui/solid`, `@modelcontextprotocol/sdk`,
  `zod`, `vitest`, and a running local Engram HTTP service when exercising live data.

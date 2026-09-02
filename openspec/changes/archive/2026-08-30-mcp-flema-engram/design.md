# Design: mcp-flema-engram

## Technical Approach

Deliver a local-first, read-only observability surface through two supported host boundaries:

1. An official OpenCode TUI plugin built with `@opencode-ai/plugin/tui`, SolidJS, and the `sidebar_content` slot.
2. A stdio MCP server exposing exactly seven tools and eight `engram://` resources.

Both boundaries consume the same injected `EngramAdapter`. The MVP runtime uses the bounded local HTTP adapter; canonical project and SDD state are composed at the MCP/sidebar boundary from supported local reads.

## Architecture Decisions

### Shared read-only adapter

`EngramAdapter` is the transport-independent boundary for health, projects, observations, searches, and sessions. Entity lookups return the entity or `null`; MCP tools/resources own protocol-specific not-found errors. The local adapter validates every successful response and converts timeout, connection, HTTP, parse, and schema failures to safe errors.

The active MVP runtime is local only. Cloud guarantees, composite cloud fallback, retries/backoff, and advanced cache behavior remain deferred.

### Deterministic project and SDD state

Project resolution uses one stable precedence order: explicit plugin option, `ENGRAM_PROJECT`, then normalized cwd basename. Its minimal result is `string | undefined`; fuzzy matching, parent walking, provenance, confidence, and picker UI are deferred.

SDD state is derived from `sdd/{change}/{artifact}` topic keys. `apply-progress`, `verify-report`, and `archive-report` normalize to canonical phases while retaining each artifact. Blockers require an explicit marker; ordinary decisions and bugfixes are not blockers by type alone.

### Official OpenCode TUI host

The plugin default-exports a `TuiPluginModule`, registers only `sidebar_content`, and renders with SolidJS/OpenTUI primitives. It shows resolved or actionable unresolved project state, health, canonical SDD progress, explicit blockers, recent activity, refresh state, and the dashboard action. Only in-view `r` refresh and `d` dashboard actions are retained.

React rendering, `tui.json`, extra shortcuts/navigation, a project picker, and unsupported host APIs are out of contract.

### Exact MCP surface over stdio

The package entrypoint creates the local adapter and starts `StdioServerTransport` with graceful shutdown. It exposes these seven tools:

- `engram_get_observation`
- `engram_get_project_state`
- `engram_get_session`
- `engram_list_observations`
- `engram_list_projects`
- `engram_list_sessions`
- `engram_search_observations`

It exposes exactly these eight resources; order is not contractual:

- `engram://health`
- `engram://projects`
- `engram://projects/{project}`
- `engram://observations/{id}`
- `engram://sessions/{session_id}`
- `engram://changes`
- `engram://changes/{change_name}/state`
- `engram://changes/{change_name}/artifacts`

Tool payloads and resource contents use compact JSON. Inputs are validated, URI variables decoded, nullable lookups mapped to boundary errors, and local/internal failures sanitized. Session-list tool output is sorted deterministically by `updated_at` descending with an id tie-breaker.

### Detached dashboard launch

Dashboard launch resolves an explicit or conventional `Task-Manager-Portable.html` path and uses `execFile(command, args, options)` without shell interpolation. It calls `unref()`, releases the child stdio pipes, and resolves after the child emits `spawn` rather than waiting for browser exit, so the launcher cannot retain the OpenCode event loop. Missing files and spawn errors return safe results.

Custom dashboard commands, parent-search expansion beyond the retained implementation, and exotic-platform guarantees are deferred.

## Data Flow

```text
OpenCode TUI -> SolidJS sidebar_content -> EngramAdapter -> local Engram HTTP
MCP host     -> stdio MCP server        -> EngramAdapter -> local Engram HTTP
```

Project-state and SDD aggregation remain pure boundary helpers so both surfaces share deterministic models while transport details stay in the adapter.

## Testing Strategy

- Unit tests cover schemas, bounded local adapter behavior, resolver/SDD normalization, sidebar view/action state, and detached dashboard launch.
- In-memory MCP integration tests invoke all retained critical tool/resource paths through the SDK client, including project state, session lookup/miss, and session ordering.
- A real child-process smoke test initializes the declared stdio package command and lists capabilities.
- Vitest V8 coverage is available and reported without an arbitrary threshold.

Native live OpenTUI rendering is not required where the Windows runtime lacks supported FFI. Full live OpenCode/Engram E2E and historical RED reconstruction remain explicitly deferred; current behavior-level evidence must not claim either.

## Rollout and Rollback

Rollout remains the four reconciled implementation work units followed by this focused remediation slice. No data migration is needed because all operations are read-only.

Rollback the remediation slice by reverting its tests, session `updated_at` contract/order changes, detached launcher change, coverage dependency/config, and this design/task reconciliation. The original 17-task implementation remains independently reversible by its existing work-unit boundaries.

## Explicitly Deferred

- Cloud guarantees or active cloud fallback.
- Retries/backoff and advanced cache behavior.
- Fuzzy/parent-walking resolver behavior, provenance, confidence, or picker UI.
- Extra shortcuts/navigation.
- Custom dashboard commands or exotic-platform guarantees.
- Full live OpenCode/Engram E2E.
- Historical RED evidence.

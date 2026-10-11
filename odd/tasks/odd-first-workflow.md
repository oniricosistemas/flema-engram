# ODD Feature: ODD-first workflow visibility

- Feature ID: `odd-first-workflow`
- Status: `in_progress`
- Branch: `feat/odd-first-workflow`
- Branch point: `4dac96e`
- Delivery strategy: `auto-chain`
- Chain strategy: `feature-branch-chain`
- Review budget: approximately 400 authored changed lines per PR slice
- Forecast: 990–1,390 authored changed lines, excluding generated files
- Current review boundary: `b2305d53ad6583c03674869b70ee507285fbf78d`

## Objective

Make the existing OpenCode sidebar and canonical MCP project state ODD-first by consuming the canonical Engram mirror topic `odd/<feature>/tasks`, while preserving legacy SDD data behind explicit opt-in.

## Problem

The plugin currently derives and renders SDD progress unconditionally. Gentle now tracks substantial work through ODD feature documents mirrored to Engram, but the plugin has no ODD task-state contract or renderer. Legacy SDD must remain available without appearing in the default workflow view.

## Why

The default UI should reflect the workflow Gentle currently produces, avoid presenting obsolete SDD state as current, and preserve intentional access to historical SDD projects.

## Scope

- Define a versioned, human-readable ODD feature-document contract carried by observations whose topic is `odd/<feature>/tasks`.
- Derive bounded ODD feature and task progress from recent Engram observations.
- Render ODD progress by default in the current OpenCode sidebar.
- Add per-session explicit legacy SDD mode with a return-to-ODD action.
- Make canonical MCP project state ODD-first with request-level legacy SDD opt-in.
- Preserve dedicated legacy SDD resources as explicit legacy access.

## Non-goals

- Pi extension support.
- Monorepo or package restructuring.
- Historical SDD-to-ODD backfill.
- Exhaustive project inventory beyond the adapter's bounded recent-observation view.
- Changes to Engram server APIs.

## Constraints

- Technical artifacts and UI copy remain in English.
- The canonical producer topic is `odd/<feature>/tasks`; do not invent a second `odd/<feature>/state` authority.
- The mirrored observation contains the full current feature document.
- Invalid ODD documents produce diagnostics and never silently fall back to SDD.
- Default behavior must not derive or render SDD.
- OpenCode session choices are isolated by session and are not persisted across plugin restarts.
- Existing health, refresh, stale-data, project isolation, collapse, and mount-ownership behavior must remain intact.
- Each task closes with a Conventional Commit work-unit commit and recorded verification evidence.

## Canonical task-line contract

A feature document exposes task state through stable checklist lines:

```markdown
- [ ] `ODD-001` **pending** — Define the contract
- [ ] `ODD-002` **in_progress** — Implement the consumer
- [ ] `ODD-003` **blocked** — Resolve an external dependency
- [x] `ODD-004` **done** — Verify the behavior
- [x] `ODD-005` **cancelled** — Remove obsolete scope
```

Allowed states are `pending`, `in_progress`, `blocked`, `done`, and `cancelled`. Completed checkboxes must agree with `done` or `cancelled`; unchecked boxes must agree with the remaining states. The feature identifier comes from the topic key, the title from the top-level heading, and the newest valid observation wins deterministically per project and feature.

## Tasks

- [x] `ODD-001` **done** — Define and derive observation-backed ODD state
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `src/schemas/odd-state.ts`, `src/utils/odd-detector.ts`, `src/index.ts`, `tests/unit/utils/odd-detector.test.ts`, `docs/odd-state-contract.md`, this feature document.
  - Acceptance: validate topic and task-line contract; preserve provenance; isolate projects; deterministically select the newest feature document; report malformed documents without inventing progress.
  - Test-first check: observed RED, GREEN and regression RED/GREEN; 37 focused tests and typecheck pass.
  - Commits: `7c1f153` (`feat(odd): derive task state from Engram mirrors`), `b2305d5` (`fix(odd): preserve precise mirror ordering`).
  - Review: approved and acknowledged; lineage `review-4aff36404f5df546`.
  - Slice: child slice 1, 575 native-counted changed lines. This exceeds the ~400 heuristic because the consumer contract, public API, tests, documentation and recovery document form one cohesive review unit; no code or tests were compressed or omitted.

- [ ] `ODD-002` **in_progress** — Render ODD progress by default in the OpenCode sidebar
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `src/sidebar/hooks/use-engram.ts`, `src/sidebar/components/odd-progress.tsx`, `src/sidebar/plugin.tsx`, relevant sidebar unit tests, `README.md`, this feature document.
  - Acceptance: default refresh derives ODD features only; render task counts and bounded/invalid states; preserve same-project stale data and existing refresh/reactivity behavior.
  - Test-first check: `npm test -- tests/unit/sidebar/hooks/use-engram.test.ts tests/unit/sidebar/plugin.test.tsx tests/unit/sidebar/plugin-reactivity.test.tsx` with observed RED then GREEN.
  - Commit: pending.
  - Review: pending.

- [ ] `ODD-003` **pending** — Add explicit session-scoped legacy SDD mode
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `src/sidebar/plugin.tsx`, `src/sidebar/hooks/use-engram.ts`, relevant sidebar unit tests, `README.md`, this feature document.
  - Acceptance: explicit English actions enable legacy SDD or return to ODD; choices are isolated per session, survive same-session remounts, reset on plugin restart, and stop SDD derivation after returning to ODD.
  - Test-first check: the focused sidebar test command from ODD-002 with observed RED then GREEN.
  - Commit: pending.
  - Review: pending.

- [ ] `ODD-004` **pending** — Align canonical MCP project state with ODD-first behavior
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `src/mcp/tools/get-project-state.ts`, `src/mcp/server.ts`, `tests/integration/mcp-server.test.ts`, `docs/odd-state-contract.md`, `README.md`, this feature document.
  - Acceptance: canonical project state returns ODD by default; `includeLegacySdd: true` explicitly adds legacy SDD; dedicated legacy resources retain behavior; existing tool/resource counts and error handling remain compatible.
  - Test-first check: `npm test -- tests/integration/mcp-server.test.ts` with observed RED then GREEN.
  - Commit: pending.
  - Review: pending.

## Acceptance criteria

- ODD task progress is the default workflow state in the sidebar and canonical MCP project state.
- Legacy SDD state is absent unless explicitly requested.
- ODD data comes from the canonical full-document Engram mirror topic.
- Session-level UI mode does not leak across sessions or survive restart.
- Existing dedicated SDD resources continue to work as explicit legacy access.
- Focused tests, full tests, typecheck, build, and package verification pass.
- Every work unit has a recorded commit identity and review/assessment outcome.

## Verification plan

Per task, run the focused test command test-first. At feature closure run:

```bash
npm run typecheck
npm test
npm run build
npm run verify:package
```

## Progress

- Exploration mapped the current unconditional SDD flow, bounded observation retrieval, session ownership, MCP state, and package boundaries.
- The user authorized the first functional slice: ODD contract and display plus explicit legacy SDD opt-in in the existing OpenCode plugin; Pi migration and monorepo restructuring are deferred.
- The implementation branch was created from `4dac96e`.
- The user selected a feature/tracker branch chain for the forecasted oversized delivery; push and PR creation remain unauthorized.

## Verification evidence

- ODD-001 writer observed meaningful RED across the initial contract tests, then GREEN with 20 focused tests; `npm run typecheck` also passed.
- Parent spot check: `npm test -- tests/unit/utils/odd-detector.test.ts` passed 20/20.
- Work-unit commit: `7c1f153` (`feat(odd): derive task state from Engram mirrors`).
- Independent verification reran the focused tests and typecheck successfully, but source inspection found two uncovered defects: a trailing newline could bypass exact topic matching, and SQLite fractional timestamp precision was lost before newest-document selection.
- Native assessment was initially unassessable because unrelated untracked workspace paths required explicit review-scope declaration; the required high-risk fallback verification path was followed.
- ODD-001 regression correction observed RED (6 failures), then GREEN (37 focused tests); typecheck passed.
- Native review of the complete committed ODD-001 range was approved and acknowledged. Two informational warnings remain as potential later hardening: deterministic collation when feature IDs differ only by locale-sensitive ordering and explicit handling of ordered checklist syntax.

## Next step

Implement ODD-002 test-first: derive ODD state during sidebar refresh and render ODD progress by default without changing session-mode behavior yet.

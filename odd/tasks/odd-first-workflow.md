# ODD Feature: ODD-first workflow visibility

- Feature ID: `odd-first-workflow`
- Status: `final_review`
- Branch: `feat/odd-first-workflow`
- Branch point: `4dac96e`
- Delivery strategy: `auto-chain`
- Chain strategy: `feature-branch-chain`
- Review budget: approximately 400 authored changed lines per PR slice
- Forecast: 990–1,390 authored changed lines, excluding generated files
- Current reviewed boundary: `b2305d53ad6583c03674869b70ee507285fbf78d`
- Implementation boundary: `bfbc6c7fdd8f7e620bbda76c1fad3b17002a50c5`
- Running authored diff: 1,235 changed lines (1,184 additions, 51 deletions) across 16 files

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

- [x] `ODD-002` **done** — Render ODD progress by default in the OpenCode sidebar
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `src/sidebar/hooks/use-engram.ts`, `src/sidebar/components/odd-progress.tsx`, `src/sidebar/plugin.tsx`, relevant sidebar unit tests, `README.md`, this feature document.
  - Acceptance: default refresh derives ODD features only; render task counts and bounded/invalid states; preserve same-project stale data and existing refresh/reactivity behavior.
  - Test-first check: observed RED then GREEN; 78 focused tests and typecheck pass.
  - Commit: `6330817` (`feat(sidebar): show ODD progress by default`).
  - Review: unavailable for the exact per-work-unit range because native START retained the prior cumulative-base selection and rejected the requested `b2305d5..6330817` candidate. The risk-gated high fallback completed with an independent verifier and no deterministic defects.
  - Slice: child slice 2; 245 committed changed lines.

- [x] `ODD-003` **done** — Add explicit session-scoped legacy SDD mode
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `src/sidebar/plugin.tsx`, `src/sidebar/hooks/use-engram.ts`, relevant sidebar unit tests, `README.md`, this feature document.
  - Acceptance: explicit English actions enable legacy SDD or return to ODD; choices are isolated per session, survive same-session remounts, reset on plugin restart, and stop SDD derivation after returning to ODD.
  - Test-first check: observed RED then GREEN; 85 focused tests and typecheck pass.
  - Commit: `59908b9` (`feat(sidebar): add session legacy SDD mode`).
  - Review: unavailable for the exact `6330817..59908b9` work-unit range because native START retained the cumulative feature-base selection. Independent high-fallback verification found no deterministic defects.
  - Slice: child slice 3; 284 committed changed lines.

- [x] `ODD-004` **done** — Align canonical MCP project state with ODD-first behavior
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `src/mcp/tools/get-project-state.ts`, `src/mcp/server.ts`, `tests/integration/mcp-server.test.ts`, `docs/odd-state-contract.md`, `README.md`, this feature document.
  - Acceptance: canonical project state returns ODD by default; `includeLegacySdd: true` explicitly adds legacy SDD; dedicated legacy resources retain behavior; existing tool/resource counts and error handling remain compatible.
  - Test-first check: observed RED then GREEN; 18 focused integration tests and typecheck pass.
  - Commit: `bfbc6c7` (`feat(mcp): expose ODD-first project state`).
  - Review: unavailable for the exact `59908b9..bfbc6c7` work-unit range because native START retained the cumulative feature-base selection. Independent high-fallback verification found no deterministic defects.
  - Slice: child slice 4; 197 committed changed lines.

- [x] `ODD-005` **done** — Isolate project refresh metadata from cross-project observations
  - Route: delegated to `gentle-ai-worker`; source and regression-test write trigger.
  - Surfaces: `src/sidebar/hooks/use-engram.ts`, `tests/unit/sidebar/hooks/use-engram.test.ts`, this feature document.
  - Acceptance: `projectForRefresh` receives only observations for the resolved project while preserving `undefined` when observations are unavailable; mixed-project refreshes cannot alter another project's observation count or activity timestamp.
  - Review source: CodeRabbit finding on PR #20, discussion `4240450418`; independently confirmed as valid.
  - Test-first check: RED at 35 passed/1 failed, then GREEN at 36/36; broader sidebar verification passed 89/89 and typecheck passed.
  - Commit: `0cc6db5` (`fix(sidebar): isolate project refresh metadata`).
  - Review: independent verification passed; cumulative native reviews approved and acknowledged under lineages `review-400deb8ed3de7582` and `review-f6ba507f1d6e80d9`.

- [x] `ODD-006` **done** — Integrate focused child PRs into the tracker
  - Route: parent-orchestrated ancestry-preserving merge commits and retargeting.
  - Acceptance: PRs #19–#22 retain focused diffs, all child checks pass after synchronization, and tracker #18 accumulates the complete feature without merging to `main`.
  - Merge commits: `595b66b` (#19), `cb98756` (#20), `ed711af` (#21), `107d9f2` (#22); synchronization commits `37ac5f1` and `099ffa9` preserve parent changes during retargeting.
  - Verification: exact-head push and pull-request `validate` runs passed for synchronized PRs #21 and #22; PR-Agent and CodeRabbit skip statuses were not counted as review evidence.
  - Review: full 17-file cumulative candidate approved and acknowledged; target `sha256:1be854a84c8bd6b6db1b49ca5c3395cbf4e795cfad74dd611daa8506e22f7c4a`, lineage `review-f6ba507f1d6e80d9`.

- [ ] `ODD-007` **in_progress** — Synchronize, verify, review, and merge the tracker
  - Route: parent-orchestrated final integration and delivery.
  - Acceptance: merge current `main` into the tracker, preserve intended ODD behavior and dependency updates, pass exact-lockfile verification and required CI, complete final review, mark PR #18 ready, merge it to `main`, and verify the resulting default-branch state.
  - Authorization: the user explicitly requested the complete continuation, including the previously listed ready/merge decisions.
  - Integration: commit `f5b77dc` merged `main` at `b9fb403` without conflicts and preserved MCP SDK `^1.31.0`, Vitest/coverage `5.0.4`, and the security-remediation lockfile.
  - Verification: exact `npm ci` passed on Node `v22.23.1`; 151 focused ODD/sidebar/MCP tests passed; typecheck, 389 full tests across 21 files, build, 179-file package verification, and diff hygiene passed.
  - Independent verification: all seven acceptance criteria and ODD-001–ODD-006 passed with no candidate-caused functional defect; the stale delivery status in `docs/odd-first-workflow-tracker.md` was corrected before final review.
  - Risk: item 3 — the final integration changes shared sidebar, MCP, and public package contracts.

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
- ODD-002 observed RED then GREEN; parent and independent verification each passed 78 focused tests and typecheck, with no deterministic defects.
- Exact per-work-unit native review for ODD-002 was unavailable because retained native selection targeted the cumulative branch base; no substitute candidate or approval was invented.
- ODD-003 observed RED then GREEN; parent and independent verification each passed 85 focused tests and typecheck, with no deterministic defects.
- Exact per-work-unit native review for ODD-003 was unavailable for the same retained cumulative-base mismatch; no substitute candidate or approval was invented.
- ODD-004 observed RED then GREEN; parent and independent verification each passed 18 focused integration tests and typecheck, with no deterministic defects.
- Exact per-work-unit native review for ODD-004 was unavailable for the same retained cumulative-base mismatch; no substitute candidate or approval was invented.
- Initial unsanitized full-suite closure had one failure in the unchanged factory attach-host test because inherited `ENGRAM_URL` overrides argv inference. Diagnosis confirmed both factory source and test are byte-identical to base.
- Final process-local sanitized closure passed typecheck, 285 tests across 20 files, build, and package verification for 179 files. No persistent environment configuration was changed.

## Delivery

- Approved issue: [#17](https://github.com/oniricosistemas/flema-engram/issues/17), labeled `type:feature` and `status:approved`.
- Draft/no-merge tracker: [#18](https://github.com/oniricosistemas/flema-engram/pull/18), `feat/odd-first-tracker` → `main`.
- Child 1: [#19](https://github.com/oniricosistemas/flema-engram/pull/19), ODD contract, merged into tracker as `595b66b`.
- Child 2: [#20](https://github.com/oniricosistemas/flema-engram/pull/20), default ODD sidebar plus project-isolation correction, merged as `cb98756` after resolving CodeRabbit discussion `4240450418`.
- Child 3: [#21](https://github.com/oniricosistemas/flema-engram/pull/21), session legacy mode, synchronized and merged as `ed711af`.
- Child 4: [#22](https://github.com/oniricosistemas/flema-engram/pull/22), ODD-first MCP state and closure evidence, synchronized and merged as `107d9f2`.
- The delivery branches preserve the original implementation commits through merge ancestry; each child was retargeted to the tracker before merge.
- Required `validate` checks passed on the exact synchronized heads. Advisory skip and rate-limit statuses were not counted as review evidence.

## Next step

Complete independent and native review of the final candidate, push the exact head, require green CI, then mark PR #18 ready and merge it to `main`. npm publication and deployment remain unauthorized.

## Log

- `L1` — Original feature request and decisions are preserved in the task history above.
- `L2` — User authorization for final integration and delivery: “ok haz todo”.

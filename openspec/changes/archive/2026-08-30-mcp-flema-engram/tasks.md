# Tasks: mcp-flema-engram MVP

## Review Workload Forecast
| Field | Value |
|---|---|
| Estimated changed lines | 900–1,150 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units
| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Types, schemas, bounded local adapter | PR 1 | Standalone foundation; tests included |
| 2 | Deterministic resolver and canonical SDD model | PR 2 | Base PR 1; tests included |
| 3 | Seven tools, eight resources, stdio entrypoint | PR 3 | Base PR 2; MCP contract tests included |
| 4 | Official SolidJS sidebar and dashboard action | PR 4 | Base PR 2; host-contract tests included |

## Phase 1: Foundation (PR 1)
- [x] 1.1 Update `package.json` and `src/adapters/types.ts` for local read-only contracts, official TUI dependencies, and bounded options.
- [x] 1.2 Implement validated schemas/errors in `src/schemas/*` and `src/utils/errors.ts`; test malformed, non-2xx, timeout, and connection boundaries in `tests/unit/adapters/local.test.ts`.
- [x] 1.3 Implement `src/adapters/local.ts`: default/override URL and timeout, encoded queries, supported reads, nullable 404 lookups, and observation/session-derived projects.
- [x] 1.4 Add focused adapter contract tests for bounds, validation, encoding, derivation, arrays, and nullable misses.

## Phase 2: Canonical State (PR 2)
- [x] 2.1 Implement `src/utils/project-resolver.ts` with explicit → `ENGRAM_PROJECT` → cwd-basename precedence and `string | undefined` output.
- [x] 2.2 Test resolver precedence, normalization, blank inputs, and unresolved cwd in `tests/unit/utils/project-resolver.test.ts`.
- [x] 2.3 Implement `src/utils/sdd-detector.ts` canonical phases, report aliases, deterministic state/artifacts, explicit blockers, and project-state aggregation helpers.
- [x] 2.4 Test aliases, archived/in-progress states, artifact retention, explicit blockers, and ordinary decision/bugfix exclusion.

## Phase 3: MCP Surface (PR 3)
- [x] 3.1 Implement `src/mcp/server.ts` and `src/index.ts` with injected adapter, graceful stdio shutdown, exact seven tools, and exact eight `engram://` resources.
- [x] 3.2 Implement seven handlers in `src/mcp/tools/*.ts`: projects, project state, observations, observation lookup, search, sessions, and session lookup with schema validation.
- [x] 3.3 Implement eight handlers in `src/mcp/resources/*.ts` for health, projects, project, observation, session, changes, change state, and artifacts.
- [x] 3.4 Add `tests/integration/mcp-server.test.ts` for set manifests, JSON shapes/MIME, URI decoding, nullable misses, invalid params, unavailable/internal errors, and canonical SDD output.
- [x] 3.5 Add a real child-process stdio smoke test that initializes the declared package command and lists capabilities.

## Phase 4: Sidebar (PR 4)
- [x] 4.1 Replace `src/sidebar/plugin.tsx` host assumptions with `@opencode-ai/plugin/tui`, SolidJS, and `sidebar_content`; retain failure containment.
- [x] 4.2 Wire `src/sidebar/hooks/use-engram.ts` and components for project, health, SDD, explicit blockers, activity, stale/error refresh, and actionable unresolved state.
- [x] 4.3 Keep `src/sidebar/dashboard-launcher.ts` as the minimal in-view dashboard action with safe missing/spawn handling.
- [x] 4.4 Add focused sidebar host/component tests in `tests/unit/sidebar/**` proving slot registration, required states, refresh fallback, and contained render failure.

## Phase 5: Verification Remediation (focused correction slice)
- [x] 5.1 Add direct runtime coverage for valid project-state, valid/missing session tools, and the unresolved-project sidebar hint.
- [x] 5.2 Add `updated_at` to the minimal session contract and schema, retain it in fixtures, and return session tool results in deterministic descending update order.
- [x] 5.3 Launch the dashboard with safe `execFile` arguments, unreference the child, release its pipes, resolve on spawn rather than exit, and cover spawn success/failure behavior.
- [x] 5.4 Install and configure the matching Vitest V8 coverage provider without an arbitrary threshold.
- [x] 5.5 Reconcile `design.md` to the retained local-first MVP contracts and explicit deferrals.
- [x] 5.6 Remediate `resources/list` by using the SDK resource-template listing callback and add a real stdio exact-eight regression test.

## Deferred (not implementation tasks)
Cloud guarantees; retries/backoff; advanced cache; fuzzy resolver; extra shortcuts/picker; custom dashboard commands/exotic platforms; full live E2E; historical RED evidence.

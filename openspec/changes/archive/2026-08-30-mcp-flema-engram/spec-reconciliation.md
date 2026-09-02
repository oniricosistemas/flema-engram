# MVP Spec Reconciliation

## Decision

The MVP is local Engram only and read-only: one official OpenCode TUI sidebar and one runnable stdio MCP server. Main specs were updated directly because this record reconciles the initial contract; the existing eight-resource contract was preserved unchanged.

## Domain Record

| Domain | Retained | Deferred | Corrected |
|---|---|---|---|
| `engram-http-client` | Local defaults/overrides; bounded requests; schema validation and safe errors; supported reads, derivation, and query encoding | Retries/backoff and advanced cache; cloud/auth/write guarantees | Project discovery no longer depends on unsupported `/projects`; resilience no longer implies retries |
| `sidebar-plugin` | Project/health/SDD/blocker/activity states; refresh/stale/error containment; dashboard action | Extra global shortcuts/navigation and picker; custom commands/exotic platforms | Host contract is `@opencode-ai/plugin/tui` + SolidJS + `sidebar_content`; removed invented `tui.json` and React host requirements |
| `engram-adapter` | Shared read-only reads; local validation/errors; project derivation | Cloud guarantees; composite cloud fallback and advanced cache | Lookups return nullable values; project state is composed at consuming boundaries; absence maps to MCP errors |
| `project-resolver` | Deterministic explicit/environment override then cwd basename | Parent walking, fuzzy matching, picker, cache, provenance | Return type is exactly `string \| undefined`; removed object metadata claims |
| `sdd-change-detector` | Topic grouping; canonical states/artifacts; report aliases; blocker surfacing | Fuzzy recovery and historical chronology | `*-report`/`apply-progress` aliases are canonicalized; only explicit markers create blockers |
| `mcp-server` | Read-only injection; seven tools; eight resources; safe MCP errors | Non-stdio transports, writes, cloud hosting, custom commands | Added runnable stdio entrypoint contract; resource order is non-contractual; nullable misses become boundary errors |
| `integration-tests` | Focused HTTP/adapter/MCP/sidebar/resolver/SDD contract evidence | Full live E2E, cloud/cache/retry/exotic-platform matrices, historical RED | Real stdio smoke is required; official SolidJS slot replaces React/manifest evidence; canonical `engram://` is required |

## Counts

- Retained: **7** affected domains.
- Deferred: **7** affected domains.
- Corrected: **7** affected domains.

Each count is the number of affected domains with an explicit decision in that
category; every reconciled domain has retained, deferred, and corrected scope.

## Preserved Separate Contracts

- `mcp-resources` remains exactly eight canonical `engram://` resources with set-based manifest correctness, compact JSON, canonical SDD data, explicit blockers, and MCP boundary errors.
- `mcp-tools` remains seven read-only tools.
- Dashboard launch remains an in-view MVP action; its advanced command/platform guarantees are deferred through the affected sidebar and integration contracts.

## Removed as Impossible or Contradictory

- Nine-resource and `eng-ram://` claims were already replaced by the reconciled resource contract.
- `tui.json`, `src/plugin/index.tsx`, and a default React host component were removed because they are not the official OpenCode TUI API.
- Resolver provenance/confidence output was removed because it contradicts `string | undefined`.
- Adapter-thrown not-found for nullable lookups was removed; absence is translated only at protocol boundaries.
- Historical RED chronology was removed as a required proof because unavailable history cannot be recreated honestly; it remains explicitly waived.

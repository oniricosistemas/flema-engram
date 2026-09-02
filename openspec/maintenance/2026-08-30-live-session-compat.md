# Post-archive maintenance: live session compatibility

- [x] Normalize live recent-session responses that omit `updated_at`, using the validated and normalized `started_at` value.
- [x] Preserve deterministic session ordering by normalized `updated_at` descending with the existing id tie-breaker.
- [x] Retain required validation for `id`, `project`, `started_at`, and `observation_count`.
- [x] Cover the observed live fixture, local project derivation, MCP `engram_list_projects`, and mixed-shape session ordering.

## Evidence

- Live Engram emits timestamps as `YYYY-MM-DD HH:mm:ss`; the adapter boundary narrowly normalizes that observed format to UTC ISO while retaining ISO input support.
- Live `listSessions({ limit: 1 })`: one result, normalized `updated_at === started_at`.
- Live `listProjects()`: 23 projects, including `general`, all with parseable activity timestamps.
- Typecheck passed; focused schema/adapter tests passed 51/51; MCP integration/stdio tests passed 15/15.

The archived change under `openspec/changes/archive/2026-08-30-mcp-flema-engram/` remains unchanged.

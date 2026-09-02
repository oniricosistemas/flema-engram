# Post-archive maintenance: OpenCode TUI configuration

- [x] Keep the local MCP server in `opencode.example.json`.
- [x] Configure the SolidJS TUI module separately through `tui.json` using `https://opencode.ai/tui.json`.
- [x] Keep the official `[plugin, options]` tuple shape.
- [x] Load Engram data automatically when the sidebar starts.
- [x] Register only `Alt+R` for manual refresh; never consume bare `r`.
- [x] Keep dashboard integration deferred with no dashboard setup or keybinding.

## Launch and configuration

OpenCode reads server/runtime configuration from `opencode.json` (or an explicit `OPENCODE_CONFIG`) and TUI configuration from `tui.json`. From this project root in PowerShell, exit any running OpenCode TUI and restart with:

```powershell
$env:OPENCODE_CONFIG = (Resolve-Path .\opencode.example.json); opencode .
```

The checked-in `tui__.json` is a project-local example:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "./src/sidebar/plugin.tsx",
      {}
    ]
  ]
}
```

For a global Windows TUI configuration, use an absolute file URL because the plugin path is resolved from the config that declares it:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:///D:/general/mcp-flema-engram/src/sidebar/plugin.tsx",
      {}
    ]
  ]
}
```

Preserve other global settings and plugins when merging this entry. The production MVP has no logging options and creates no sidebar log files.

Add `"project": "<exact-engram-project>"` to the options object only when the workspace directory cannot identify the intended Engram project. Resolution precedence is:

1. non-empty `project` in the declaring `tui.json`;
2. non-empty `ENGRAM_PROJECT`;
3. automatic workspace candidates: normalized directory basename, then normalized absolute cwd/path.

The candidate is validated against projects derived from recent observations and sessions. Exact names win; one unique case-insensitive match may supply canonical spelling. Windows path comparison normalizes slash direction and drive/path case. Invalid explicit or environment candidates do not fall through to automatic guesses. No match remains unresolved; there is no fuzzy match, parent walking, picker, or first-project fallback.

When Engram is offline, an explicit or environment candidate is shown only as unvalidated. A cwd basename is not preserved because it was only an automatic guess.

## Refresh behavior

The sidebar loads automatically from the host's `sidebar_content` lifecycle. Each slot reserves one session-scoped action mount, registers the visible state owner, and schedules one guarded refresh through the same registry path as `Alt+R`; superseded or hidden mounts cannot start that request. Direct `useEngram` consumers retain their guarded startup fallback, but the host-owned sidebar disables it to avoid duplicate initial requests.

`Alt+R` remains the manual refresh shortcut. It re-runs project resolution and fetches health, derived projects, and project observations. Bare `r` remains normal prompt input. Success feedback appears only after the current visible sidebar reaches terminal success; partial and failed refreshes show actionable stage/endpoint detail while preserving usable or stale data.

The sidebar displays health, resolved project and observation count, canonical SDD progress, explicit blockers, and recent activity. `CHECKING` is shown before the initial response. `OK` requires local health and project observations; `STALE` preserves usable data when a later stage is incomplete; `ERROR` and `OFFLINE` represent unavailable core data.

Observed live Engram behavior may return JSON `null` from filtered recent-observation/session endpoints when no records exist. The adapter normalizes only that filtered null contract to `[]`; malformed non-null payloads remain validation errors.

## Deferred dashboard

Dashboard integration is explicitly deferred. It is not required to configure or use the local sidebar MVP, and the sidebar exposes no dashboard action or `d` keybinding. The reusable launcher remains untouched for a future work unit.

The archived change under `openspec/changes/archive/2026-08-30-mcp-flema-engram/` remains unchanged.

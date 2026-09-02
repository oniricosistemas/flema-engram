# Sidebar Plugin Specification

## Purpose

Render Engram project state inside OpenCode as a keyboard-first sidebar panel, keeping developers aware of SDD progress without leaving the editor.

## Types

```ts
interface SidebarProps {
  adapter: EngramAdapter;
  projectResolver: ProjectResolver;
  dashboardLauncher: DashboardLauncher;
}

interface SidebarViewModel {
  project?: EngramProjectState;
  changes: SddChange[];
  blockers: EngramObservation[];
  recentActivity: EngramObservation[];
  health: "ok" | "stale" | "error" | "offline";
  lastRefreshAt?: string;
  error?: string;
}

type SidebarAction =
  | { type: "refresh" }
  | { type: "openDashboard" }
  | { type: "focusChange"; changeName: string }
  | { type: "focusObservation"; id: number };
```

## Requirements

### Requirement: Plugin Registration

The plugin SHALL register a sidebar panel via `tui.json` and expose an entry point at `src/plugin/index.tsx`.

#### Scenario: Panel appears in OpenCode

- GIVEN `tui.json` declares the plugin
- WHEN OpenCode loads
- THEN the sidebar panel is visible in the UI with the title "Engram"

#### Scenario: Entry point exports a panel component

- GIVEN `src/plugin/index.tsx` exists
- WHEN it is imported by the OpenCode plugin host
- THEN it exports a default React component that accepts `SidebarProps`

### Requirement: Rendered Sections

The sidebar SHALL render project name, health, active SDD changes, blockers, and recent activity.

#### Scenario: Project loaded

- GIVEN the adapter returns a project state with two changes and one blocker
- WHEN the sidebar renders
- THEN it shows the project name, a changes list, a blockers list, and an activity feed

#### Scenario: Empty project

- GIVEN the adapter returns a project state with no changes
- WHEN the sidebar renders
- THEN it shows a friendly empty state and a refresh hint

### Requirement: Keyboard Shortcuts

The sidebar SHALL support keyboard-driven navigation and actions.

#### Scenario: Refresh shortcut

- GIVEN the sidebar has focus
- WHEN the user presses `r`
- THEN data refreshes from the adapter

#### Scenario: Open dashboard shortcut

- GIVEN the sidebar has focus
- WHEN the user presses `d`
- THEN `dashboardLauncher.open()` is invoked

#### Scenario: Navigate changes

- GIVEN the sidebar has focus and multiple changes are listed
- WHEN the user presses `j` / `k`
- THEN the selection moves down / up

### Requirement: Refresh Behavior

The sidebar SHALL refresh automatically on mount and on explicit user action, with debouncing and a visible timestamp.

#### Scenario: Auto-refresh on mount

- GIVEN the panel is newly opened
- WHEN it mounts
- THEN it fetches project state once

#### Scenario: Debounce repeated refreshes

- GIVEN the user presses `r` three times within one second
- WHEN refreshes are debounced
- THEN only one network call is made

#### Scenario: Show last refresh time

- GIVEN a successful refresh at 10:00
- WHEN the sidebar renders
- THEN it displays "Updated 10:00"

### Requirement: Error States

The sidebar SHALL display safe, actionable UI states for offline, stale, and error conditions.

#### Scenario: Engram offline

- GIVEN the adapter rejects with `unavailable`
- WHEN the sidebar renders
- THEN it shows an offline banner and disables automatic refresh

#### Scenario: Partial stale data

- GIVEN a previous refresh succeeded but the current refresh fails
- WHEN the sidebar renders
- THEN it keeps the previous data and shows a stale warning

#### Scenario: Unknown project

- GIVEN the resolver cannot determine a project for the current directory
- WHEN the sidebar renders
- THEN it shows a configuration hint and a manual project picker

### Requirement: Containment

Plugin failures SHALL be contained by the panel and SHALL NOT crash the OpenCode host.

#### Scenario: Renderer throws

- GIVEN the renderer component throws during render
- WHEN the error boundary catches it
- THEN the panel shows a fallback message and a retry action

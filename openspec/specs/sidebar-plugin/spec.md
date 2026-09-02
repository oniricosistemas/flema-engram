# Sidebar Plugin Specification

## Purpose

Expose local Engram and SDD status through the supported OpenCode TUI extension surface.

## Requirements

### Requirement: Official TUI Registration

The plugin MUST use `@opencode-ai/plugin/tui`, SolidJS, and the supported `sidebar_content` slot. It MUST export a host-loadable TUI plugin module and MUST NOT require `tui.json` or React host rendering.

#### Scenario: OpenCode loads the plugin

- GIVEN the plugin is configured through OpenCode's supported plugin mechanism
- WHEN the TUI host loads it
- THEN an Engram view renders in `sidebar_content` using SolidJS

### Requirement: Sidebar Content

The view MUST show the resolved project, local health, normalized SDD changes, explicit blockers, recent activity, and refresh status. Empty and unresolved projects MUST show actionable hints. The production MVP MUST NOT expose diagnostic lines or write sidebar log files.

#### Scenario: Project state is available

- GIVEN local Engram returns a resolved project with changes and one blocker
- WHEN the slot renders
- THEN the project, change progress, blocker, activity, and health are visible

#### Scenario: Project is unresolved

- GIVEN project resolution returns `undefined`
- WHEN the slot renders
- THEN a configuration hint is shown without a manual picker

### Requirement: Refresh and Failure Containment

The plugin MUST start one automatic initial refresh through guarded slot-creation/mount triggers and MUST retain `Alt+R` as manual refresh. It MUST preserve previously loaded data as stale after a later failure and MUST contain rendering or adapter failures without crashing OpenCode. Bare `r` MUST remain normal prompt input.

#### Scenario: Local Engram becomes unavailable

- GIVEN an earlier refresh succeeded
- WHEN a later refresh fails
- THEN prior data remains visible with a safe stale or offline indication

#### Scenario: View rendering fails

- GIVEN the slot view throws
- WHEN the failure boundary handles it
- THEN the slot shows a retryable fallback and the host remains running

## Deferred

- Extra global shortcuts, `j`/`k` navigation, and a manual project picker are deferred.
- React host rendering, invented host manifests, and unsupported OpenCode APIs are out of contract.
- Dashboard UI/actions and remote attach are deferred; neither is a prerequisite for the local sidebar MVP.

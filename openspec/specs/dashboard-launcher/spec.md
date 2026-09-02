# Dashboard Launcher Specification

## Purpose

Launch the portable task manager dashboard (`Task-Manager-Portable.html`) from
the OpenCode sidebar without blocking the host event loop.

## Requirements

### Requirement: Minimal Dashboard Resolution

The launcher MUST resolve an explicit dashboard path when supplied, otherwise
use the retained conventional `Task-Manager-Portable.html` location from its
configured working context. It MUST return a safe not-found result when no
supported location exists.

#### Scenario: Explicit path configured

- GIVEN an existing explicit `htmlPath`
- WHEN `open()` is called
- THEN the launcher opens that file

#### Scenario: Conventional location

- GIVEN no explicit path is set and the configured working context contains
  `Task-Manager-Portable.html`
- WHEN `open()` is called
- THEN the launcher opens that file

#### Scenario: File not found

- GIVEN neither the explicit nor conventional supported location exists
- WHEN `open()` is called
- THEN it returns a safe `{ success: false, error: "Dashboard HTML not found" }`
  result

### Requirement: Safe Non-blocking Launch

The launcher MUST invoke the selected platform command with `execFile(command,
args, options)` without shell interpolation. After the child emits `spawn`, it
MUST call `unref()`, release child stdio pipes, and resolve promptly so the
sidebar remains interactive. Spawn errors MUST return safe failure results.

#### Scenario: Dashboard opens without freezing UI

- GIVEN `open()` is invoked from the sidebar and the command spawns
- WHEN the child emits `spawn`
- THEN the promise resolves promptly, the child is unreferenced, and the
  sidebar remains interactive

#### Scenario: Spawn fails

- GIVEN the selected launch command cannot spawn
- WHEN `open()` is called
- THEN it returns a safe failure result without crashing the sidebar

## Deferred

- Parent-directory walking beyond the retained conventional location is deferred.
- Custom dashboard commands and exact cross-platform/exotic-platform command
  guarantees are deferred.
- Detached-process semantics beyond the non-blocking `spawn`/`unref` behavior
  are deferred.

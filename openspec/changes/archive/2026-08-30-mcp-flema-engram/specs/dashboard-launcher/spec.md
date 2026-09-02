# Dashboard Launcher Specification

## Purpose

Open the portable task manager dashboard HTML file (`Task-Manager-Portable.html`) from the OpenCode sidebar using the user's default browser or a configured command.

## Types

```ts
interface DashboardLauncher {
  open(): Promise<LaunchResult>;
}

interface DashboardLauncherConfig {
  htmlPath?: string;            // explicit path to Task-Manager-Portable.html
  command?: string;             // override command to open the file
  cwd?: string;                 // working directory for resolution
}

interface LaunchResult {
  success: boolean;
  command?: string;
  error?: string;
}

class DashboardLauncherError extends Error {
  code: "not_found" | "spawn_failed" | "platform_unsupported" | "unknown";
}
```

## Requirements

### Requirement: Path Resolution

The launcher SHALL resolve the dashboard HTML file using a configurable explicit path, a set of conventional locations, or the current working directory.

#### Scenario: Explicit path configured

- GIVEN `htmlPath: "/dashboard/Task-Manager-Portable.html"` exists
- WHEN `open()` is called
- THEN it opens that file

#### Scenario: Conventional location

- GIVEN no explicit path is set and `cwd` contains `Task-Manager-Portable.html`
- WHEN `open()` is called
- THEN it opens `cwd/Task-Manager-Portable.html`

#### Scenario: Parent directory search

- GIVEN `cwd` is `/project/docs` and `Task-Manager-Portable.html` is in `/project`
- WHEN `open()` is called
- THEN it walks up and opens `/project/Task-Manager-Portable.html`

#### Scenario: File not found

- GIVEN no `Task-Manager-Portable.html` exists in `cwd` or any parent
- WHEN `open()` is called
- THEN it returns `{ success: false, error: "Dashboard HTML not found" }`

### Requirement: Cross-Platform Launch

The launcher SHALL use the platform-appropriate command to open the HTML file when no custom command is provided.

#### Scenario: Windows default

- GIVEN the platform is Windows
- WHEN `open()` is called
- THEN it spawns `start "" "path"`

#### Scenario: macOS default

- GIVEN the platform is macOS
- WHEN `open()` is called
- THEN it spawns `open "path"`

#### Scenario: Linux default

- GIVEN the platform is Linux
- WHEN `open()` is called
- THEN it spawns `xdg-open "path"`

### Requirement: Custom Command Override

The launcher SHALL allow a custom command to override platform defaults.

#### Scenario: Custom browser

- GIVEN `command: "firefox --new-window"`
- WHEN `open()` is called with path `/x.html`
- THEN it spawns `firefox --new-window /x.html`

### Requirement: Error Handling

The launcher SHALL classify launch failures and never crash the sidebar.

#### Scenario: Spawn fails

- GIVEN the platform command exits with a non-zero code
- WHEN `open()` is called
- THEN it returns `{ success: false, error: "spawn_failed: ..." }`

#### Scenario: Unsupported platform

- GIVEN the platform is neither Windows, macOS, nor Linux
- WHEN `open()` is called
- THEN it returns `{ success: false, error: "platform_unsupported" }`

### Requirement: No Blocking

The launcher SHALL spawn the process detached and return immediately.

#### Scenario: Dashboard opens without freezing UI

- GIVEN `open()` is invoked from the sidebar
- WHEN the command spawns
- THEN the promise resolves promptly and the sidebar remains interactive

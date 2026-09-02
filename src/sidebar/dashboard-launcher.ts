/**
 * DashboardLauncher
 *
 * Opens Task-Manager-Portable.html in the default browser.
 * Handles missing file gracefully.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { platform } from "node:os";

export interface DashboardLauncherOptions {
  /** Custom path to the HTML file */
  htmlPath?: string;
  /** Working directory (defaults to process.cwd()) */
  cwd?: string;
}

export interface LaunchResult {
  success: boolean;
  error?: string;
  path?: string;
}

/**
 * Gets the command and args to open a file in the default browser
 */
function getOpenCommand(): { command: string; args: string[] } {
  switch (platform()) {
    case "win32":
      return { command: "cmd", args: ["/c", "start", ""] };
    case "darwin":
      return { command: "open", args: [] };
    default:
      return { command: "xdg-open", args: [] };
  }
}

/**
 * Finds the Task-Manager-Portable.html file
 */
function findDashboardPath(
  options: DashboardLauncherOptions = {},
): string | null {
  const cwd = options.cwd ?? process.cwd();

  // A configured relative path belongs to this workspace, not the process globally.
  if (options.htmlPath) {
    const pathApi = /^[A-Za-z]:[\\/]/.test(cwd) || cwd.includes("\\")
      ? path.win32
      : path.posix;
    const customPath = pathApi.isAbsolute(options.htmlPath)
      ? options.htmlPath
      : pathApi.resolve(cwd, options.htmlPath);
    if (existsSync(customPath)) {
      return customPath;
    }
    return null;
  }

  const pathApi = /^[A-Za-z]:[\\/]/.test(cwd) || cwd.includes("\\")
    ? path.win32
    : path.posix;
  const conventionalPath = pathApi.join(cwd, "Task-Manager-Portable.html");
  return existsSync(conventionalPath) ? conventionalPath : null;
}

/**
 * Launches the dashboard in the default browser
 *
 * @param options - Configuration options
 * @returns Launch result with success status and any error message
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await launchDashboard();
 * if (result.success) {
 *   console.log(`Opened at ${result.path}`);
 * } else {
 *   console.error(result.error);
 * }
 *
 * // Custom path
 * const result = await launchDashboard({
 *   htmlPath: "/path/to/custom/dashboard.html"
 * });
 * ```
 */
export async function launchDashboard(
  options: DashboardLauncherOptions = {},
): Promise<LaunchResult> {
  const dashboardPath = findDashboardPath(options);

  if (!dashboardPath) {
    return {
      success: false,
      error: options.htmlPath
        ? `Dashboard file not found at configured path: ${options.htmlPath}. Set dashboardPath to an existing Task-Manager-Portable.html file; it is not created automatically.`
        : "Task-Manager-Portable.html not found. Place the external file in the project root or configure dashboardPath; it is not created automatically.",
    };
  }

  return new Promise((resolve) => {
    const { command, args } = getOpenCommand();
    const fullArgs = [...args, dashboardPath];
    let child;
    try {
      child = execFile(command, fullArgs, {
        cwd: options.cwd,
      }, () => {
        // Completion is intentionally ignored: the browser process is detached.
      });
    } catch (error) {
      resolve({
        success: false,
        error: `Failed to open dashboard: ${error instanceof Error ? error.message : String(error)}`,
        path: dashboardPath,
      });
      return;
    }

    child.unref();
    child.stdin?.destroy();
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.once("spawn", () => resolve({ success: true, path: dashboardPath }));
    child.once("error", (error) => resolve({
      success: false,
      error: `Failed to open dashboard: ${error.message}`,
      path: dashboardPath,
    }));
  });
}

/**
 * Checks if the dashboard file exists without launching
 *
 * @param options - Configuration options
 * @returns Object with exists flag and path if found
 */
export function checkDashboardExists(
  options: DashboardLauncherOptions = {},
): { exists: boolean; path: string | null } {
  const path = findDashboardPath(options);
  return {
    exists: path !== null,
    path,
  };
}

export default launchDashboard;

/**
 * Tests for DashboardLauncher
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { launchDashboard, checkDashboardExists } from "../../../src/sidebar/dashboard-launcher.js";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";

// --- Mock fs ---

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// --- Tests ---

describe("checkDashboardExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when file does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = checkDashboardExists({ cwd: "/test" });
    expect(result.exists).toBe(false);
    expect(result.path).toBeNull();
  });

  it("returns true when file exists in project root", () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).includes("Task-Manager-Portable.html");
    });

    const result = checkDashboardExists({ cwd: "/test" });
    expect(result.exists).toBe(true);
    expect(result.path).toContain("Task-Manager-Portable.html");
  });

  it("checks custom path first", () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = checkDashboardExists({
      htmlPath: "/custom/path/dashboard.html",
    });

    expect(result.exists).toBe(true);
    expect(result.path).toBe("/custom/path/dashboard.html");
  });

  it("resolves a configured relative path inside its workspace only", () => {
    vi.mocked(existsSync).mockImplementation(
      (candidate) => String(candidate) === "/worktree-a/dashboards/tasks.html",
    );

    const first = checkDashboardExists({
      cwd: "/worktree-a",
      htmlPath: "./dashboards/tasks.html",
    });
    const second = checkDashboardExists({
      cwd: "/worktree-b",
      htmlPath: "./dashboards/tasks.html",
    });

    expect(first).toEqual({ exists: true, path: "/worktree-a/dashboards/tasks.html" });
    expect(second).toEqual({ exists: false, path: null });
  });

  it("does not search parent or shared dashboard directories", () => {
    vi.mocked(existsSync).mockImplementation((candidate) =>
      String(candidate).includes("/parent/dashboard/Task-Manager-Portable.html")
    );

    expect(checkDashboardExists({ cwd: "/parent/worktree" })).toEqual({
      exists: false,
      path: null,
    });
    expect(existsSync).toHaveBeenCalledTimes(1);
    expect(existsSync).toHaveBeenCalledWith("/parent/worktree/Task-Manager-Portable.html");
  });

  it("returns false for custom path that does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = checkDashboardExists({
      htmlPath: "/nonexistent/path.html",
    });

    expect(result.exists).toBe(false);
  });
});

describe("launchDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when file not found", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await launchDashboard({ cwd: "/test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.error).toContain("not created automatically");
  });

  it("returns error for custom path that does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await launchDashboard({
      htmlPath: "/nonexistent.html",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("/nonexistent.html");
    expect(result.error).toContain("dashboardPath");
    expect(result.error).toContain("not created automatically");
  });

  it("unreferences the launcher, releases its pipes, and resolves on spawn without waiting for exit", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const child = new EventEmitter() as EventEmitter & {
      unref: ReturnType<typeof vi.fn>;
      stdin: { destroy: ReturnType<typeof vi.fn> };
      stdout: { destroy: ReturnType<typeof vi.fn> };
      stderr: { destroy: ReturnType<typeof vi.fn> };
    };
    child.unref = vi.fn();
    child.stdin = { destroy: vi.fn() };
    child.stdout = { destroy: vi.fn() };
    child.stderr = { destroy: vi.fn() };
    vi.mocked(execFile).mockReturnValue(child as any);

    const pending = launchDashboard({ cwd: "/test" });
    child.emit("spawn");
    const result = await pending;

    expect(result.success).toBe(true);
    expect(result.path).toContain("Task-Manager-Portable.html");
    expect(execFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.stringContaining("Task-Manager-Portable.html")]),
      expect.objectContaining({ cwd: "/test" }),
      expect.any(Function),
    );
    expect(child.unref).toHaveBeenCalledOnce();
    expect(child.stdin.destroy).toHaveBeenCalledOnce();
    expect(child.stdout.destroy).toHaveBeenCalledOnce();
    expect(child.stderr.destroy).toHaveBeenCalledOnce();
  });

  it("returns error when the detached child emits a spawn error", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const child = new EventEmitter() as EventEmitter & {
      unref: ReturnType<typeof vi.fn>;
      stdin?: { destroy: ReturnType<typeof vi.fn> };
      stdout?: { destroy: ReturnType<typeof vi.fn> };
      stderr?: { destroy: ReturnType<typeof vi.fn> };
    };
    child.unref = vi.fn();
    vi.mocked(execFile).mockReturnValue(child as any);

    const pending = launchDashboard({ cwd: "/test" });
    child.emit("error", new Error("exec failed"));
    const result = await pending;

    expect(result.success).toBe(false);
    expect(result.error).toContain("exec failed");
    expect(child.unref).toHaveBeenCalledOnce();
  });
});

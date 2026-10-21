import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runMaintenanceCli,
  type MaintenanceCommandRunner,
} from "../../../src/maintenance/cli.js";

const PACKAGE_NAME = "opencode-flema-engram-sidebar";
const roots: string[] = [];

async function fixture(configuredVersion = "0.1.7") {
  const root = await mkdtemp(join(tmpdir(), "flema-update-"));
  roots.push(root);
  const configDir = join(root, "config", "opencode");
  const cacheDir = join(root, "cache", "opencode");
  const configPath = join(configDir, "tui.json");
  const exactPath = join(cacheDir, "packages", `${PACKAGE_NAME}@0.1.8`);
  const stalePath = join(cacheDir, "packages", `${PACKAGE_NAME}@latest`);
  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({
    plugin: [
      "unrelated-plugin",
      [`${PACKAGE_NAME}@${configuredVersion}`, { baseUrl: "https://user:secret@example.test" }],
    ],
  }, null, 2));
  for (const [path, specVersion, installedVersion] of [
    [exactPath, "0.1.8", "0.1.8"],
    [stalePath, "0.1.7", "0.1.7"],
  ] as const) {
    const installedDir = join(path, "node_modules", PACKAGE_NAME);
    await mkdir(installedDir, { recursive: true });
    await writeFile(join(path, "package.json"), JSON.stringify({
      dependencies: { [PACKAGE_NAME]: specVersion },
    }));
    await writeFile(join(installedDir, "package.json"), JSON.stringify({
      name: PACKAGE_NAME,
      version: installedVersion,
    }));
  }
  return { root, configDir, cacheDir, configPath, exactPath, stalePath };
}

function runner(
  fixtureData: Awaited<ReturnType<typeof fixture>>,
  calls: string[][],
  onInstall?: () => Promise<void>,
  version = "1.18.33",
): MaintenanceCommandRunner {
  return async (command, args) => {
    calls.push([command, ...args]);
    if (command !== "opencode") return { code: 127, stdout: "", stderr: "not found" };
    if (args.join(" ") === "--version") return { code: 0, stdout: `${version}\n`, stderr: "" };
    if (args.join(" ") === "debug paths") {
      return {
        code: 0,
        stdout: `cache      ${fixtureData.cacheDir}\nconfig     ${fixtureData.configDir}\n`,
        stderr: "",
      };
    }
    await onInstall?.();
    return { code: 0, stdout: "installed\n", stderr: "" };
  };
}

function outputs() {
  let stdout = "";
  let stderr = "";
  return {
    stdout: (text: string) => { stdout += text; },
    stderr: (text: string) => { stderr += text; },
    read: () => ({ stdout, stderr }),
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("safe plugin update", () => {
  it("previews the exact install, backup, and manifest-bound cleanup without mutation", async () => {
    const state = await fixture();
    const configBefore = await readFile(state.configPath, "utf8");
    const calls: string[][] = [];
    const output = outputs();

    const exitCode = await runMaintenanceCli(["update", "--dry-run", "--json"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    const result = output.read();
    expect(exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      dryRun: true,
      packageName: PACKAGE_NAME,
      targetVersion: "0.1.8",
      configPath: state.configPath,
      backupPath: `${state.configPath}.pre-flema-update-20261021T190000000Z`,
      installCommand: ["opencode", "plugin", `${PACKAGE_NAME}@0.1.8`, "--force", "--global"],
      staleWrappers: [{ path: state.stalePath, expectedVersion: "0.1.7" }],
    });
    expect(await readFile(state.configPath, "utf8")).toBe(configBefore);
    await expect(stat(state.stalePath)).resolves.toBeDefined();
    expect(calls).toHaveLength(2);
    expect(result.stdout).not.toContain("user");
    expect(result.stdout).not.toContain("secret");
  });

  it("cancels without changing config, cache, or invoking the installer", async () => {
    const state = await fixture();
    const configBefore = await readFile(state.configPath, "utf8");
    const calls: string[][] = [];
    const confirm = vi.fn(async () => false);
    const output = outputs();

    const exitCode = await runMaintenanceCli(["update"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      confirm,
      ...output,
    });

    expect(exitCode).toBe(0);
    expect(output.read()).toEqual({
      stdout: `Update preview: run opencode plugin ${PACKAGE_NAME}@0.1.8 --force --global; back up ${state.configPath}; remove 1 manifest-verified stale wrapper(s).\nUpdate cancelled; no changes made.\n`,
      stderr: "",
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(2);
    expect(await readFile(state.configPath, "utf8")).toBe(configBefore);
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("returns structured JSON when interactive confirmation is declined", async () => {
    const state = await fixture();
    const calls: string[][] = [];
    const output = outputs();

    const exitCode = await runMaintenanceCli(["update", "--json"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      confirm: async () => false,
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(0);
    expect(output.read().stderr).toBe("");
    expect(JSON.parse(output.read().stdout)).toMatchObject({
      plan: { dryRun: true, targetVersion: "0.1.8" },
      result: { applied: false, cancelled: true },
    });
    expect(calls).toHaveLength(2);
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("backs up config, installs the exact version, removes only the verified stale wrapper, and verifies", async () => {
    const state = await fixture("0.1.8");
    const configBefore = await readFile(state.configPath, "utf8");
    const calls: string[][] = [];
    const output = outputs();
    const backupPath = `${state.configPath}.pre-flema-update-20261021T190000000Z`;

    const exitCode = await runMaintenanceCli(["update", "--yes", "--json"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(0);
    expect(output.read().stderr).toBe("");
    expect(JSON.parse(output.read().stdout)).toEqual({
      plan: {
        dryRun: true,
        packageName: PACKAGE_NAME,
        targetVersion: "0.1.8",
        configPath: state.configPath,
        backupPath,
        installCommand: ["opencode", "plugin", `${PACKAGE_NAME}@0.1.8`, "--force", "--global"],
        staleWrappers: [{ path: state.stalePath, expectedVersion: "0.1.7" }],
      },
      result: {
        applied: true,
        packageName: PACKAGE_NAME,
        targetVersion: "0.1.8",
        backupPath,
        installedSpec: `${PACKAGE_NAME}@0.1.8`,
        removedStaleWrappers: [state.stalePath],
        verification: {
          configured: true,
          installedVersion: "0.1.8",
          staleWrappers: 0,
        },
      },
    });
    expect(await readFile(backupPath, "utf8")).toBe(configBefore);
    await expect(stat(state.stalePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(state.exactPath)).resolves.toBeDefined();
    expect(calls.at(-1)).toEqual([
      "opencode", "plugin", `${PACKAGE_NAME}@0.1.8`, "--force", "--global",
    ]);
    expect(output.read().stdout).not.toContain("user");
    expect(output.read().stdout).not.toContain("secret");
  });

  it("refuses a config race before backup, installer, or cache mutation", async () => {
    const state = await fixture();
    const calls: string[][] = [];
    const output = outputs();
    const raced = `${await readFile(state.configPath, "utf8")}\n`;

    const exitCode = await runMaintenanceCli(["update"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      confirm: async () => {
        await writeFile(state.configPath, raced);
        return true;
      },
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(1);
    expect(output.read()).toEqual({
      stdout: `Update preview: run opencode plugin ${PACKAGE_NAME}@0.1.8 --force --global; back up ${state.configPath}; remove 1 manifest-verified stale wrapper(s).\n`,
      stderr: "Flema Engram maintenance failed: Configuration changed after preview; no changes were applied\n",
    });
    expect(calls).toHaveLength(2);
    await expect(stat(`${state.configPath}.pre-flema-update-20261021T190000000Z`)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("preserves a stale wrapper whose manifest changes after installation", async () => {
    const state = await fixture("0.1.8");
    const calls: string[][] = [];
    const output = outputs();
    const staleManifest = join(state.stalePath, "node_modules", PACKAGE_NAME, "package.json");

    const exitCode = await runMaintenanceCli(["update", "--yes"], {
      cwd: state.root,
      runCommand: runner(state, calls, async () => {
        await writeFile(staleManifest, JSON.stringify({ name: PACKAGE_NAME, version: "9.9.9" }));
      }),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(1);
    expect(output.read().stdout).toContain("Update preview:");
    expect(output.read().stderr).toContain("Stale wrapper changed after preview; refusing to remove it");
    await expect(stat(state.stalePath)).resolves.toBeDefined();
    expect(JSON.parse(await readFile(staleManifest, "utf8"))).toMatchObject({ version: "9.9.9" });
  });

  it.each(["wrapper", "installed"] as const)(
    "preserves a stale wrapper when the %s manifest changes without changing its version fields",
    async (kind) => {
      const state = await fixture("0.1.8");
      const calls: string[][] = [];
      const output = outputs();
      const manifestPath = kind === "wrapper"
        ? join(state.stalePath, "package.json")
        : join(state.stalePath, "node_modules", PACKAGE_NAME, "package.json");

      const exitCode = await runMaintenanceCli(["update", "--yes"], {
        cwd: state.root,
        runCommand: runner(state, calls, async () => {
          const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
          manifest.unrelated = "changed";
          await writeFile(manifestPath, JSON.stringify(manifest));
        }),
        fetchLatestVersion: async () => "0.1.8",
        now: () => new Date("2026-10-21T19:00:00.000Z"),
        ...output,
      });

      expect(exitCode).toBe(1);
      expect(output.read().stderr).toContain("Stale wrapper changed after preview; refusing to remove it");
      await expect(stat(state.stalePath)).resolves.toBeDefined();
    },
  );

  it.each(["cache-root", "dependency-parent"] as const)(
    "refuses cleanup through a symlinked %s",
    async (kind) => {
      const { lstat, rename, symlink } = await import("node:fs/promises");
      const state = await fixture("0.1.8");
      const calls: string[][] = [];
      const output = outputs();

      const exitCode = await runMaintenanceCli(["update", "--yes"], {
        cwd: state.root,
        runCommand: runner(state, calls, async () => {
          const source = kind === "cache-root"
            ? state.cacheDir
            : join(state.stalePath, "node_modules");
          const destination = join(state.root, `moved-${kind}`);
          await rename(source, destination);
          await symlink(destination, source);
        }),
        fetchLatestVersion: async () => "0.1.8",
        now: () => new Date("2026-10-21T19:00:00.000Z"),
        ...output,
      });

      expect(exitCode).toBe(1);
      expect(output.read().stderr).not.toBe("");
      await expect(lstat(state.stalePath)).resolves.toBeDefined();
      expect(output.read().stdout).not.toContain("Update applied and verified");
    },
  );

  it("uses the native OpenCode 2 add command in previews", async () => {
    const state = await fixture();
    const calls: string[][] = [];
    const output = outputs();

    const exitCode = await runMaintenanceCli(["update", "--dry-run", "--json"], {
      cwd: state.root,
      runCommand: runner(state, calls, undefined, "2.0.19"),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(output.read().stdout).installCommand).toEqual([
      "opencode", "plugin", "add", `${PACKAGE_NAME}@0.1.8`,
    ]);
  });
});

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chmod, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fsHooks = vi.hoisted(() => ({
  afterWrite: undefined as undefined | ((path: string) => Promise<void>),
  afterRm: undefined as undefined | ((path: string) => Promise<void>),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      const result = await actual.writeFile(...args);
      if (typeof args[0] === "string") await fsHooks.afterWrite?.(args[0]);
      return result;
    },
    rm: async (...args: Parameters<typeof actual.rm>) => {
      const result = await actual.rm(...args);
      if (typeof args[0] === "string") await fsHooks.afterRm?.(args[0]);
      return result;
    },
  };
});
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
  fsHooks.afterWrite = undefined;
  fsHooks.afterRm = undefined;
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

  it("treats closed stdin as a structured cancellation", async () => {
    const state = await fixture();
    const scriptPath = join(state.root, "closed-stdin.mjs");
    const moduleUrl = new URL("../../../src/maintenance/cli.ts", import.meta.url).href;
    await writeFile(scriptPath, `import { runMaintenanceCli } from ${JSON.stringify(moduleUrl)};
process.exitCode = await runMaintenanceCli(["update", "--json"], {
  cwd: ${JSON.stringify(state.root)},
  fetchLatestVersion: async () => "0.1.8",
  runCommand: async (_command, args) => ({
    code: 0,
    stderr: "",
    stdout: args[0] === "--version"
      ? "1.18.33"
      : ${JSON.stringify(`cache ${state.cacheDir}\nconfig ${state.configDir}\n`)},
  }),
});\n`);

    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolveResult, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", scriptPath], {
          cwd: process.cwd(),
          env: process.env,
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
        child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
        child.once("error", reject);
        child.once("close", (code) => resolveResult({ code, stdout, stderr }));
        child.stdin.end();
      },
    );

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).result).toEqual({ applied: false, cancelled: true });
    expect(result.stderr).toBe(
      "Apply this exact-version update and verified stale-wrapper cleanup? [y/N] ",
    );
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  }, 30_000);

  it("backs up config with its private mode, installs, removes only the verified stale wrapper, and verifies", async () => {
    const state = await fixture("0.1.8");
    await chmod(state.configPath, 0o600);
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
    expect((await stat(backupPath)).mode & 0o777).toBe(0o600);
    await expect(stat(state.stalePath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(state.exactPath)).resolves.toBeDefined();
    expect(calls.at(-1)).toEqual([
      "opencode", "plugin", `${PACKAGE_NAME}@0.1.8`, "--force", "--global",
    ]);
    expect(output.read().stdout).not.toContain("user");
    expect(output.read().stdout).not.toContain("secret");
  });

  it("rejects combining dry-run with automatic confirmation before inspection", async () => {
    const output = outputs();

    const exitCode = await runMaintenanceCli(["update", "--dry-run", "--yes"], output);

    expect(exitCode).toBe(1);
    expect(output.read()).toEqual({
      stdout: "",
      stderr: "--dry-run and --yes cannot be combined\nRun `flema-engram --help` for usage.\n",
    });
  });

  it("bounds a hung installer and reports the retained backup", async () => {
    const state = await fixture("0.1.8");
    const calls: string[][] = [];
    const output = outputs();
    const baseRunner = runner(state, calls);
    const backupPath = `${state.configPath}.pre-flema-update-20261021T190000000Z`;

    const exitCode = await runMaintenanceCli(["update", "--yes"], {
      cwd: state.root,
      runCommand: async (command, args, options) => {
        if (args[0] === "--version" || args.join(" ") === "debug paths") {
          return baseRunner(command, args);
        }
        return new Promise((resolveResult) => {
          options?.signal?.addEventListener("abort", () => {
            resolveResult({ code: 1, stdout: "", stderr: "private timeout diagnostic" });
          }, { once: true });
        });
      },
      fetchLatestVersion: async () => "0.1.8",
      installerTimeoutMs: 10,
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(1);
    expect(output.read()).toEqual({
      stdout: `Update preview: run opencode plugin ${PACKAGE_NAME}@0.1.8 --force --global; back up ${state.configPath}; remove 1 manifest-verified stale wrapper(s).\n`,
      stderr: `Flema Engram maintenance failed: OpenCode installer timed out; configuration backup retained at ${backupPath}\n`,
    });
    await expect(stat(backupPath)).resolves.toBeDefined();
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("retains the backup and stale wrapper when the installer fails", async () => {
    const state = await fixture("0.1.8");
    const calls: string[][] = [];
    const output = outputs();
    const baseRunner = runner(state, calls);
    const backupPath = `${state.configPath}.pre-flema-update-20261021T190000000Z`;

    const exitCode = await runMaintenanceCli(["update", "--yes"], {
      cwd: state.root,
      runCommand: async (command, args) => {
        const result = await baseRunner(command, args);
        return args[0] === "--version" || args.join(" ") === "debug paths"
          ? result
          : { code: 1, stdout: "", stderr: "registry credential sentinel" };
      },
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(1);
    expect(output.read().stderr).toBe(
      `Flema Engram maintenance failed: OpenCode installer failed; configuration backup retained at ${backupPath}\n`,
    );
    expect(output.read().stderr).not.toContain("sentinel");
    await expect(stat(backupPath)).resolves.toBeDefined();
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("retains the backup and stale wrapper when installation does not pin config", async () => {
    const state = await fixture();
    const calls: string[][] = [];
    const output = outputs();
    const backupPath = `${state.configPath}.pre-flema-update-20261021T190000000Z`;

    const exitCode = await runMaintenanceCli(["update", "--yes"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(1);
    expect(output.read().stderr).toBe(
      `Flema Engram maintenance failed: OpenCode installer did not pin ${PACKAGE_NAME}@0.1.8; backup retained at ${backupPath}\n`,
    );
    await expect(stat(backupPath)).resolves.toBeDefined();
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("reports the exact backup when installation produces the wrong package version", async () => {
    const state = await fixture("0.1.8");
    const calls: string[][] = [];
    const output = outputs();
    const backupPath = `${state.configPath}.pre-flema-update-20261021T190000000Z`;
    const exactManifest = join(state.exactPath, "node_modules", PACKAGE_NAME, "package.json");

    const exitCode = await runMaintenanceCli(["update", "--yes"], {
      cwd: state.root,
      runCommand: runner(state, calls, async () => {
        await writeFile(exactManifest, JSON.stringify({ name: PACKAGE_NAME, version: "0.1.7" }));
      }),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(1);
    expect(output.read().stderr).toBe(
      `Flema Engram maintenance failed: OpenCode installer did not produce the expected package version; backup retained at ${backupPath}\n`,
    );
    await expect(stat(backupPath)).resolves.toBeDefined();
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("reports stale wrappers observed after cleanup instead of a constant", async () => {
    const state = await fixture("0.1.8");
    const calls: string[][] = [];
    const output = outputs();
    fsHooks.afterRm = async (path) => {
      if (path !== state.stalePath) return;
      const installedDir = join(path, "node_modules", PACKAGE_NAME);
      await mkdir(installedDir, { recursive: true });
      await writeFile(join(path, "package.json"), JSON.stringify({
        dependencies: { [PACKAGE_NAME]: "0.1.7" },
      }));
      await writeFile(join(installedDir, "package.json"), JSON.stringify({
        name: PACKAGE_NAME,
        version: "0.1.7",
      }));
    };

    const exitCode = await runMaintenanceCli(["update", "--yes", "--json"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(output.read().stdout).result.verification.staleWrappers).toBe(1);
    await expect(stat(state.stalePath)).resolves.toBeDefined();
  });

  it("backs up verified bytes and refuses a config race before the installer", async () => {
    const state = await fixture("0.1.8");
    const configBefore = await readFile(state.configPath, "utf8");
    const backupPath = `${state.configPath}.pre-flema-update-20261021T190000000Z`;
    const racedConfig = `${configBefore}\n`;
    const calls: string[][] = [];
    const output = outputs();
    fsHooks.afterWrite = async (path) => {
      if (path === backupPath) await writeFile(state.configPath, racedConfig);
    };

    const exitCode = await runMaintenanceCli(["update", "--yes", "--json"], {
      cwd: state.root,
      runCommand: runner(state, calls),
      fetchLatestVersion: async () => "0.1.8",
      now: () => new Date("2026-10-21T19:00:00.000Z"),
      ...output,
    });

    expect(exitCode).toBe(1);
    expect(output.read()).toEqual({
      stdout: "",
      stderr: "Flema Engram maintenance failed: Configuration changed after backup; no installer was invoked\n",
    });
    expect(await readFile(backupPath, "utf8")).toBe(configBefore);
    expect(await readFile(state.configPath, "utf8")).toBe(racedConfig);
    expect(calls).toHaveLength(2);
    await expect(stat(state.stalePath)).resolves.toBeDefined();
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
    expect(output.read().stderr).toBe(
      `Flema Engram maintenance failed: Plugin update was installed and verified, but stale-wrapper cleanup failed; removed: none; backup retained at ${state.configPath}.pre-flema-update-20261021T190000000Z; cause: Stale wrapper changed after preview; refusing to remove it\n`,
    );
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

  it.each(["wrapper", "installed"] as const)(
    "rejects a non-object %s manifest with the controlled cleanup error",
    async (kind) => {
      const state = await fixture("0.1.8");
      const calls: string[][] = [];
      const output = outputs();
      const manifestPath = kind === "wrapper"
        ? join(state.stalePath, "package.json")
        : join(state.stalePath, "node_modules", PACKAGE_NAME, "package.json");

      const exitCode = await runMaintenanceCli(["update", "--yes", "--json"], {
        cwd: state.root,
        runCommand: runner(state, calls),
        fetchLatestVersion: async () => "0.1.8",
        now: () => {
          writeFileSync(manifestPath, "null");
          return new Date("2026-10-21T19:00:00.000Z");
        },
        ...output,
      });

      expect(exitCode).toBe(1);
      expect(output.read().stderr).toBe(
        `Flema Engram maintenance failed: Plugin update was installed and verified, but stale-wrapper cleanup failed; removed: none; backup retained at ${state.configPath}.pre-flema-update-20261021T190000000Z; cause: Stale wrapper changed after preview; refusing to remove it\n`,
      );
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
      expect(output.read().stderr).toBe(
        `Flema Engram maintenance failed: Plugin update was installed and verified, but stale-wrapper cleanup failed; removed: none; backup retained at ${state.configPath}.pre-flema-update-20261021T190000000Z; cause: Stale wrapper changed after preview; refusing to remove it\n`,
      );
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

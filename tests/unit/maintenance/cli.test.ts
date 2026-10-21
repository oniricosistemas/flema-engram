import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runMaintenanceCli,
  type MaintenanceCommandRunner,
} from "../../../src/maintenance/cli.js";

const PACKAGE_NAME = "opencode-flema-engram-sidebar";
const SECRET_URL = "https://user:secret@example.test:7437";
const roots: string[] = [];

async function createFixture(): Promise<{
  root: string;
  configDir: string;
  cacheDir: string;
  configPath: string;
  stalePath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "flema-maintenance-"));
  roots.push(root);
  const configDir = join(root, "config", "opencode");
  const cacheDir = join(root, "cache", "opencode");
  const configPath = join(configDir, "tui.json");
  const exactPath = join(cacheDir, "packages", `${PACKAGE_NAME}@0.1.8`);
  const stalePath = join(cacheDir, "packages", `${PACKAGE_NAME}@latest`);
  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({
    $schema: "https://opencode.ai/tui.json",
    plugin: [
      "opencode-subagent-statusline",
      [`${PACKAGE_NAME}@0.1.8`, { baseUrl: SECRET_URL }],
    ],
  }, null, 2));
  for (const [wrapperPath, version] of [[exactPath, "0.1.8"], [stalePath, "0.1.7"]] as const) {
    const packagePath = join(wrapperPath, "node_modules", PACKAGE_NAME);
    await mkdir(packagePath, { recursive: true });
    await writeFile(join(wrapperPath, "package.json"), JSON.stringify({
      dependencies: { [PACKAGE_NAME]: version },
    }));
    await writeFile(join(packagePath, "package.json"), JSON.stringify({
      name: PACKAGE_NAME,
      version,
    }));
  }
  return { root, configDir, cacheDir, configPath, stalePath };
}

function commandRunner(configDir: string, cacheDir: string, calls: string[][]): MaintenanceCommandRunner {
  return async (command, args) => {
    calls.push([command, ...args]);
    if (command !== "opencode") return { code: 127, stdout: "", stderr: "not found" };
    if (args.join(" ") === "--version") {
      return { code: 0, stdout: "1.18.33\n", stderr: "" };
    }
    if (args.join(" ") === "debug paths") {
      return {
        code: 0,
        stdout: `cache      ${cacheDir}\nconfig     ${configDir}\n`,
        stderr: "",
      };
    }
    throw new Error(`Unexpected mutation command: ${[command, ...args].join(" ")}`);
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("maintenance CLI", () => {
  it("reports exact and stale cached versions without reflecting configured credentials", async () => {
    const fixture = await createFixture();
    const calls: string[][] = [];
    let stdout = "";
    let stderr = "";

    const exitCode = await runMaintenanceCli(["doctor", "--json"], {
      cwd: fixture.root,
      runCommand: commandRunner(fixture.configDir, fixture.cacheDir, calls),
      fetchLatestVersion: async () => "0.1.8",
      stdout: (text) => { stdout += text; },
      stderr: (text) => { stderr += text; },
    });

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      status: "stale-cache",
      packageName: PACKAGE_NAME,
      openCodeVersion: "1.18.33",
      latestVersion: "0.1.8",
      configPaths: [fixture.configPath],
      configuredSpecs: [`${PACKAGE_NAME}@0.1.8`],
      installations: [
        { spec: `${PACKAGE_NAME}@0.1.8`, wrapperVersion: "0.1.8", installedVersion: "0.1.8", stale: false },
        { spec: `${PACKAGE_NAME}@latest`, wrapperVersion: "0.1.7", installedVersion: "0.1.7", stale: true },
      ],
    });
    expect(stdout).not.toContain("user");
    expect(stdout).not.toContain("secret");
    expect(calls).toEqual([
      ["opencode", "--version"],
      ["opencode", "debug", "paths"],
    ]);
  });

  it("rejects unknown arguments without reading or changing the environment", async () => {
    const calls: string[][] = [];
    let stdout = "";
    let stderr = "";

    const exitCode = await runMaintenanceCli(["doctor", "--automatic"], {
      runCommand: async (command, args) => {
        calls.push([command, ...args]);
        throw new Error("must not run");
      },
      fetchLatestVersion: async () => {
        throw new Error("must not fetch");
      },
      stdout: (text) => { stdout += text; },
      stderr: (text) => { stderr += text; },
    });

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("Unknown option: --automatic\nRun `flema-engram --help` for usage.\n");
    expect(calls).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateCoreEntrypoint,
  validatePackageEntrypoint,
  validatePackageManifest,
  validatePiEntrypoint,
  validateTarballFiles,
} from "../../../scripts/package-verifier.mjs";

const packageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("npm package contract", () => {
  it("prepares the selected Pi sidebar release version", () => {
    expect(packageJson.version).toBe("0.4.0");
  });

  it("publishes the official OpenCode TUI subpath from compiled output", () => {
    expect(validatePackageManifest(packageJson)).toEqual([]);
  });

  it("publishes compiled core and Pi entrypoints with a Pi package manifest", () => {
    expect(packageJson.exports).toMatchObject({
      "./core": { import: "./dist/core.js", types: "./dist/core.d.ts" },
      "./pi": { import: "./dist/pi.js", types: "./dist/pi.d.ts" },
    });
    expect(packageJson.pi).toEqual({ extensions: ["./dist/pi.js"] });
    expect(packageJson.keywords).toContain("pi-package");
  });

  it("publishes the maintenance CLI beside the existing MCP binary", () => {
    expect(packageJson.bin).toEqual({
      "flema-engram": "dist/maintenance.js",
      "mcp-flema-engram": "dist/stdio.js",
    });
  });

  it("accepts a minimal compiled package containing every public entrypoint", () => {
    expect(validateTarballFiles([
      "package.json",
      "README.md",
      "LICENSE",
      "dist/index.js",
      "dist/index.d.ts",
      "dist/sidebar/plugin.js",
      "dist/sidebar/plugin.d.ts",
      "dist/core.js",
      "dist/core.d.ts",
      "dist/pi.js",
      "dist/pi.d.ts",
      "dist/pi/sidebar.js",
      "dist/pi/sidebar.d.ts",
      "dist/stdio.js",
      "dist/maintenance.js",
    ])).toEqual([]);
  });

  it("requires the compiled core and Pi files in the tarball", () => {
    expect(validateTarballFiles([
      "package.json",
      "README.md",
      "LICENSE",
      "dist/index.js",
      "dist/index.d.ts",
      "dist/sidebar/plugin.js",
      "dist/sidebar/plugin.d.ts",
      "dist/stdio.js",
      "dist/maintenance.js",
    ])).toEqual([
      "missing dist/core.js",
      "missing dist/core.d.ts",
      "missing dist/pi.js",
      "missing dist/pi.d.ts",
      "missing dist/pi/sidebar.js",
      "missing dist/pi/sidebar.d.ts",
    ]);
  });

  it("accepts a compiled host-neutral core", () => {
    expect(validateCoreEntrypoint({
      createEngramReadController: () => undefined,
      resolveProject: () => undefined,
    })).toEqual([]);
    expect(validateCoreEntrypoint({})).toEqual([
      "./core must export createEngramReadController",
      "./core must export resolveProject",
    ]);
  });

  it("accepts a compiled Pi extension factory", () => {
    expect(validatePiEntrypoint({ default: () => undefined })).toEqual([]);
    expect(validatePiEntrypoint({ default: {} })).toEqual([
      "./pi default export must be an extension factory",
    ]);
  });

  it("accepts a root entrypoint that supports both OpenCode TUI contracts and a named MCP API", () => {
    expect(validatePackageEntrypoint({
      default: { id: "engram-sidebar", tui: () => undefined, setup: () => undefined },
      EngramMcpServer: class EngramMcpServer {},
    })).toEqual([]);
  });

  it("rejects a root entrypoint without the default TUI or named MCP export", () => {
    expect(validatePackageEntrypoint({ default: {} })).toEqual([
      "root default export must have id engram-sidebar",
      "root default export must provide a tui function",
      "root default export must provide a setup function",
      "root entrypoint must retain the named EngramMcpServer export",
    ]);
  });

  it("rejects missing entrypoints and forbidden development paths", () => {
    const violations = validateTarballFiles([
      "package.json",
      "src/sidebar/plugin.tsx",
      "tests/unit/sidebar/plugin.test.tsx",
      "openspec/specs/sidebar-plugin/spec.md",
      "opencode.example.json",
      "debug.log",
    ]);

    expect(violations).toEqual([
      "missing README.md",
      "missing LICENSE",
      "missing dist/index.js",
      "missing dist/index.d.ts",
      "missing dist/sidebar/plugin.js",
      "missing dist/sidebar/plugin.d.ts",
      "missing dist/core.js",
      "missing dist/core.d.ts",
      "missing dist/pi.js",
      "missing dist/pi.d.ts",
      "missing dist/pi/sidebar.js",
      "missing dist/pi/sidebar.d.ts",
      "missing dist/stdio.js",
      "missing dist/maintenance.js",
      "forbidden src/sidebar/plugin.tsx",
      "forbidden tests/unit/sidebar/plugin.test.tsx",
      "forbidden openspec/specs/sidebar-plugin/spec.md",
      "forbidden opencode.example.json",
      "forbidden debug.log",
    ]);
  });
});

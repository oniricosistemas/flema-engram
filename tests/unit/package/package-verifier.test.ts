import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validatePackageManifest,
  validateTarballFiles,
} from "../../../scripts/package-verifier.mjs";

const packageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("npm package contract", () => {
  it("publishes the official OpenCode TUI subpath from compiled output", () => {
    expect(validatePackageManifest(packageJson)).toEqual([]);
  });

  it("accepts a minimal compiled package containing the TUI entrypoint", () => {
    expect(validateTarballFiles([
      "package.json",
      "README.md",
      "LICENSE",
      "dist/index.js",
      "dist/index.d.ts",
      "dist/sidebar/plugin.js",
      "dist/sidebar/plugin.d.ts",
      "dist/stdio.js",
    ])).toEqual([]);
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
      "missing dist/stdio.js",
      "forbidden src/sidebar/plugin.tsx",
      "forbidden tests/unit/sidebar/plugin.test.tsx",
      "forbidden openspec/specs/sidebar-plugin/spec.md",
      "forbidden opencode.example.json",
      "forbidden debug.log",
    ]);
  });
});

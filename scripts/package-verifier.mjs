import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXPECTED_PACKAGE_NAME = "opencode-flema-engram-sidebar";
const REQUIRED_FILES = [
  "package.json",
  "README.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/sidebar/plugin.js",
  "dist/sidebar/plugin.d.ts",
  "dist/stdio.js",
];
const FORBIDDEN_PATHS = [
  /^(?:src|tests|openspec|scripts|node_modules|\.atl|\.github)\//,
  /^(?:opencode(?:\.example)?\.json|tui__\.json)$/,
  /^(?:\.env(?:\..*)?|.*\.log)$/,
];

export function validatePackageManifest(manifest) {
  const violations = [];
  const exportsMap = manifest.exports;
  const rootExport = exportsMap?.["."];
  const tuiExport = exportsMap?.["./tui"];

  if (manifest.name !== EXPECTED_PACKAGE_NAME) {
    violations.push(`package name must be ${EXPECTED_PACKAGE_NAME}`);
  }
  if (manifest.type !== "module") violations.push("package type must be module");
  if (manifest.main !== undefined) {
    violations.push("main must be omitted so OpenCode does not detect a server plugin target");
  }
  if (rootExport?.import !== "./dist/index.js" || rootExport?.types !== "./dist/index.d.ts") {
    violations.push("root export must resolve compiled JavaScript and declarations");
  }
  if (
    tuiExport?.import !== "./dist/sidebar/plugin.js"
    || tuiExport?.types !== "./dist/sidebar/plugin.d.ts"
  ) {
    violations.push("./tui export must resolve the compiled default TUI module and declarations");
  }
  if (manifest.bin?.["mcp-flema-engram"] !== "dist/stdio.js") {
    violations.push("MCP bin must resolve dist/stdio.js");
  }
  if (JSON.stringify(manifest.files) !== JSON.stringify(["dist", "README.md", "LICENSE"])) {
    violations.push("files allowlist must contain only dist, README.md, and LICENSE");
  }

  return violations;
}

export function validatePackageEntrypoint(entrypoint) {
  const violations = [];

  if (entrypoint.default?.id !== "engram-sidebar") {
    violations.push("root default export must have id engram-sidebar");
  }
  if (typeof entrypoint.default?.tui !== "function") {
    violations.push("root default export must provide a tui function");
  }
  if (typeof entrypoint.EngramMcpServer !== "function") {
    violations.push("root entrypoint must retain the named EngramMcpServer export");
  }

  return violations;
}

export function validateTarballFiles(files) {
  const normalized = files.map((path) => path.replaceAll("\\", "/"));
  const violations = REQUIRED_FILES
    .filter((required) => !normalized.includes(required))
    .map((required) => `missing ${required}`);

  for (const path of normalized) {
    if (FORBIDDEN_PATHS.some((pattern) => pattern.test(path))) {
      violations.push(`forbidden ${path}`);
    }
  }

  return violations;
}

function npmPackDryRun(cwd) {
  const args = ["pack", "--dry-run", "--json", "--ignore-scripts"];
  if (process.env.npm_execpath) {
    return execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, encoding: "utf8" });
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return execFileSync(npm, args, { cwd, encoding: "utf8" });
}

async function main() {
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const manifestViolations = validatePackageManifest(manifest);
  const entrypoint = await import(new URL("../dist/index.js", import.meta.url).href);
  const entrypointViolations = validatePackageEntrypoint(entrypoint);
  const packResult = JSON.parse(npmPackDryRun(projectRoot));
  const files = packResult[0]?.files?.map((entry) => entry.path) ?? [];
  const violations = [
    ...manifestViolations,
    ...entrypointViolations,
    ...validateTarballFiles(files),
  ];

  if (violations.length > 0) {
    console.error(`Package verification failed:\n- ${violations.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Package verification passed (${files.length} files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Package verification failed:\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

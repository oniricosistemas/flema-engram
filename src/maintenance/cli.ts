import { spawn } from "node:child_process";
import type { Dirent } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

const PACKAGE_NAME = "opencode-flema-engram-sidebar";
const REGISTRY_TIMEOUT_MS = 5_000;
const HELP = `Usage: flema-engram <command> [options]

Commands:
  doctor [--json]   Inspect OpenCode configuration and cached versions

Options:
  --help                      Show this help
`;

export interface MaintenanceCommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type MaintenanceCommandRunner = (
  command: string,
  args: string[],
) => Promise<MaintenanceCommandResult>;

export interface MaintenanceCliDependencies {
  cwd?: string;
  runCommand?: MaintenanceCommandRunner;
  fetchLatestVersion?: () => Promise<string>;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

interface RuntimePaths {
  cacheDir: string;
  configDir: string;
}

interface Installation {
  path: string;
  spec: string;
  wrapperVersion: string;
  installedVersion: string;
  stale: boolean;
}

interface Inspection {
  status: "current" | "stale-cache" | "outdated" | "not-configured";
  packageName: string;
  openCodeVersion: string;
  latestVersion: string;
  configPaths: string[];
  configuredSpecs: string[];
  installations: Installation[];
  runtimePaths: RuntimePaths;
}

function defaultRunCommand(command: string, args: string[]): Promise<MaintenanceCommandResult> {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      resolveResult({ code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.once("close", (code) => {
      resolveResult({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function defaultFetchLatestVersion(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("npm registry request timed out");
    }
    throw error;
  }
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || typeof (body as { version?: unknown }).version !== "string") {
    throw new Error("npm registry response did not contain a version");
  }
  return (body as { version: string }).version;
}

function parseRuntimePaths(output: string): RuntimePaths {
  const values = new Map<string, string>();
  for (const line of output.split(/\r?\n/u)) {
    const match = /^(cache|config)\s+(.+)$/u.exec(line.trim());
    if (match?.[1] && match[2]) values.set(match[1], match[2].trim());
  }
  const cacheDir = values.get("cache");
  const configDir = values.get("config");
  if (!cacheDir || !configDir) throw new Error("OpenCode did not report config and cache paths");
  return { cacheDir: resolve(cacheDir), configDir: resolve(configDir) };
}

function packageNameFromSpec(spec: string): string {
  const trimmed = spec.trim();
  if (trimmed.startsWith("@")) {
    const slash = trimmed.indexOf("/");
    const versionAt = trimmed.indexOf("@", slash + 1);
    return versionAt < 0 ? trimmed : trimmed.slice(0, versionAt);
  }
  const versionAt = trimmed.indexOf("@");
  return versionAt < 0 ? trimmed : trimmed.slice(0, versionAt);
}

function collectConfiguredSpecs(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    if (packageNameFromSpec(value) === PACKAGE_NAME) output.push(value);
    return;
  }
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    if (typeof entry === "string") collectConfiguredSpecs(entry, output);
    else if (Array.isArray(entry) && entry.length > 0) collectConfiguredSpecs(entry[0], output);
  }
}

async function existingConfigPaths(configDir: string, cwd: string): Promise<string[]> {
  const candidates = [join(configDir, "tui.json")];
  let current = resolve(cwd);
  while (true) {
    candidates.push(join(current, ".opencode", "tui.json"));
    const parent = dirname(current);
    if (parent === current || current === parse(current).root) break;
    current = parent;
  }
  const output: string[] = [];
  for (const candidate of candidates) {
    try {
      const stat = await lstat(candidate);
      if (stat.isFile() && !output.includes(candidate)) output.push(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return output;
}

async function readConfiguredSpecs(paths: string[]): Promise<string[]> {
  const specs: string[] = [];
  for (const path of paths) {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!parsed || typeof parsed !== "object") continue;
    const root = parsed as { plugin?: unknown; plugins?: unknown };
    collectConfiguredSpecs(root.plugin, specs);
    collectConfiguredSpecs(root.plugins, specs);
  }
  return [...new Set(specs)];
}

async function inspectInstallations(cacheDir: string, latestVersion: string): Promise<Installation[]> {
  const packagesDir = join(cacheDir, "packages");
  let entries: Dirent<string>[];
  try {
    entries = await readdir(packagesDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const prefix = `${PACKAGE_NAME}@`;
  const installations: Installation[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
    const path = join(packagesDir, entry.name);
    try {
      const wrapper = JSON.parse(await readFile(join(path, "package.json"), "utf8")) as {
        dependencies?: Record<string, unknown>;
      };
      const installed = JSON.parse(
        await readFile(join(path, "node_modules", PACKAGE_NAME, "package.json"), "utf8"),
      ) as { name?: unknown; version?: unknown };
      const wrapperVersion = wrapper.dependencies?.[PACKAGE_NAME];
      if (
        typeof wrapperVersion !== "string"
        || installed.name !== PACKAGE_NAME
        || typeof installed.version !== "string"
      ) continue;
      const spec = entry.name;
      const mutable = spec === `${PACKAGE_NAME}@latest`;
      installations.push({
        path,
        spec,
        wrapperVersion,
        installedVersion: installed.version,
        stale: mutable && installed.version !== latestVersion,
      });
    } catch {
      continue;
    }
  }
  return installations.sort((left, right) => left.spec.localeCompare(right.spec));
}

function classify(configuredSpecs: string[], installations: Installation[], latestVersion: string): Inspection["status"] {
  if (configuredSpecs.length === 0) return "not-configured";
  if (installations.some(({ stale }) => stale)) return "stale-cache";
  if (!configuredSpecs.some((spec) => spec === `${PACKAGE_NAME}@${latestVersion}`)) return "outdated";
  return "current";
}

async function inspect(dependencies: Required<Pick<MaintenanceCliDependencies, "runCommand" | "fetchLatestVersion">> & { cwd: string }): Promise<Inspection> {
  const versionResult = await dependencies.runCommand("opencode", ["--version"]);
  if (versionResult.code !== 0) throw new Error("Unable to determine OpenCode version");
  const pathsResult = await dependencies.runCommand("opencode", ["debug", "paths"]);
  if (pathsResult.code !== 0) throw new Error("Unable to determine OpenCode paths");
  const runtimePaths = parseRuntimePaths(pathsResult.stdout);
  const latestVersion = await dependencies.fetchLatestVersion();
  const configPaths = await existingConfigPaths(runtimePaths.configDir, dependencies.cwd);
  const configuredSpecs = await readConfiguredSpecs(configPaths);
  const installations = await inspectInstallations(runtimePaths.cacheDir, latestVersion);
  return {
    status: classify(configuredSpecs, installations, latestVersion),
    packageName: PACKAGE_NAME,
    openCodeVersion: versionResult.stdout.trim(),
    latestVersion,
    configPaths,
    configuredSpecs,
    installations,
    runtimePaths,
  };
}

function doctorJson(inspection: Inspection): Record<string, unknown> {
  return {
    status: inspection.status,
    packageName: inspection.packageName,
    openCodeVersion: inspection.openCodeVersion,
    latestVersion: inspection.latestVersion,
    configPaths: inspection.configPaths,
    configuredSpecs: inspection.configuredSpecs,
    installations: inspection.installations.map(({ spec, wrapperVersion, installedVersion, stale }) => ({
      spec,
      wrapperVersion,
      installedVersion,
      stale,
    })),
  };
}

function parseArgs(argv: string[]): { command: "doctor" | "help"; json: boolean } | { error: string } {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return { command: "help", json: false };
  }
  const command = argv[0];
  if (command !== "doctor") return { error: `Unknown command: ${command}` };
  let json = false;
  for (const arg of argv.slice(1)) {
    if (arg === "--json") json = true;
    else return { error: `Unknown option: ${arg}` };
  }
  return { command, json };
}

export async function runMaintenanceCli(
  argv: string[],
  dependencies: MaintenanceCliDependencies = {},
): Promise<number> {
  const stdout = dependencies.stdout ?? ((text: string) => process.stdout.write(text));
  const stderr = dependencies.stderr ?? ((text: string) => process.stderr.write(text));
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    stderr(`${parsed.error}\nRun \`flema-engram --help\` for usage.\n`);
    return 1;
  }
  if (parsed.command === "help") {
    stdout(HELP);
    return 0;
  }
  try {
    const inspection = await inspect({
      cwd: dependencies.cwd ?? process.cwd(),
      runCommand: dependencies.runCommand ?? defaultRunCommand,
      fetchLatestVersion: dependencies.fetchLatestVersion ?? defaultFetchLatestVersion,
    });
    if (parsed.json) stdout(`${JSON.stringify(doctorJson(inspection), null, 2)}\n`);
    else stdout(`Flema Engram: ${inspection.status} (installed ${inspection.installations.map(({ installedVersion }) => installedVersion).join(", ") || "none"}; latest ${inspection.latestVersion})\n`);
    return 0;
  } catch (error) {
    stderr(`Flema Engram maintenance failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

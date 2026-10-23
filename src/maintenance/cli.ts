import { spawn } from "node:child_process";
import type { Dirent } from "node:fs";
import { chmod, lstat, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";

const PACKAGE_NAME = "opencode-flema-engram-sidebar";
const REGISTRY_TIMEOUT_MS = 5_000;
const HELP = `Usage: flema-engram <command> [options]

Commands:
  doctor [--json]                    Inspect configuration and cached versions
  update [--dry-run] [--yes] [--json]  Preview or apply a verified exact-version update

Options:
  --dry-run   Print the immutable update plan without changing files
  --yes       Apply without the interactive confirmation (the plan is still printed)
  --help      Show this help
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
  confirm?: (message: string) => Promise<boolean>;
  now?: () => Date;
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

interface StaleWrapperPlan {
  path: string;
  expectedVersion: string;
  wrapperManifestSnapshot: Buffer;
  packageManifestSnapshot: Buffer;
}

interface UpdatePlan {
  dryRun: true;
  packageName: string;
  targetVersion: string;
  configPath: string;
  backupPath: string;
  installCommand: string[];
  staleWrappers: StaleWrapperPlan[];
  configSnapshot: Buffer;
  configMode: number;
  cacheDir: string;
  cacheRealPath: string;
  packagesRealPath: string;
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
      const file = await stat(candidate);
      if (file.isFile() && !output.includes(candidate)) output.push(candidate);
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

function backupTimestamp(date: Date): string {
  return date.toISOString().replaceAll(/[-:.]/gu, "");
}

function installCommand(openCodeVersion: string, targetVersion: string): string[] {
  const major = Number.parseInt(openCodeVersion.split(".")[0] ?? "", 10);
  if (!Number.isFinite(major)) throw new Error("OpenCode returned an invalid version");
  if (major >= 2) return ["opencode", "plugin", "add", `${PACKAGE_NAME}@${targetVersion}`];
  return ["opencode", "plugin", `${PACKAGE_NAME}@${targetVersion}`, "--force", "--global"];
}

async function createUpdatePlan(inspection: Inspection, now: Date): Promise<UpdatePlan> {
  const configPath = join(inspection.runtimePaths.configDir, "tui.json");
  if (!inspection.configPaths.includes(configPath)) throw new Error("Global tui.json was not found");
  const configMode = (await stat(configPath)).mode & 0o777;
  const packagesPath = join(inspection.runtimePaths.cacheDir, "packages");
  const cacheStat = await lstat(inspection.runtimePaths.cacheDir);
  const packagesStat = await lstat(packagesPath);
  if (
    cacheStat.isSymbolicLink()
    || packagesStat.isSymbolicLink()
    || !cacheStat.isDirectory()
    || !packagesStat.isDirectory()
  ) {
    throw new Error("OpenCode cache paths must be ordinary directories");
  }
  const staleWrappers = await Promise.all(
    inspection.installations.filter(({ stale }) => stale).map(async ({ path, installedVersion }) => ({
      path,
      expectedVersion: installedVersion,
      wrapperManifestSnapshot: await readFile(join(path, "package.json")),
      packageManifestSnapshot: await readFile(
        join(path, "node_modules", PACKAGE_NAME, "package.json"),
      ),
    })),
  );
  return {
    dryRun: true,
    packageName: PACKAGE_NAME,
    targetVersion: inspection.latestVersion,
    configPath,
    backupPath: `${configPath}.pre-flema-update-${backupTimestamp(now)}`,
    installCommand: installCommand(inspection.openCodeVersion, inspection.latestVersion),
    staleWrappers,
    configSnapshot: await readFile(configPath),
    configMode,
    cacheDir: inspection.runtimePaths.cacheDir,
    cacheRealPath: await realpath(inspection.runtimePaths.cacheDir),
    packagesRealPath: await realpath(packagesPath),
  };
}

function publicUpdatePlan(plan: UpdatePlan): Record<string, unknown> {
  return {
    dryRun: plan.dryRun,
    packageName: plan.packageName,
    targetVersion: plan.targetVersion,
    configPath: plan.configPath,
    backupPath: plan.backupPath,
    installCommand: plan.installCommand,
    staleWrappers: plan.staleWrappers.map(({ path, expectedVersion }) => ({
      path,
      expectedVersion,
    })),
  };
}

function containedBy(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation !== "" && !relation.startsWith("..") && !isAbsolute(relation);
}

async function removeVerifiedStaleWrapper(candidate: StaleWrapperPlan, plan: UpdatePlan): Promise<void> {
  const packagesPath = join(plan.cacheDir, "packages");
  const cacheStat = await lstat(plan.cacheDir);
  const packagesStat = await lstat(packagesPath);
  const candidateStat = await lstat(candidate.path);
  if (
    cacheStat.isSymbolicLink()
    || packagesStat.isSymbolicLink()
    || candidateStat.isSymbolicLink()
    || !cacheStat.isDirectory()
    || !packagesStat.isDirectory()
    || !candidateStat.isDirectory()
  ) {
    throw new Error("Stale wrapper changed after preview; refusing to remove it");
  }
  const cacheReal = await realpath(plan.cacheDir);
  const packagesReal = await realpath(packagesPath);
  const candidateReal = await realpath(candidate.path);
  if (cacheReal !== plan.cacheRealPath || packagesReal !== plan.packagesRealPath) {
    throw new Error("OpenCode cache paths changed after preview; refusing cleanup");
  }
  if (!containedBy(packagesReal, candidateReal)) {
    throw new Error("Stale wrapper escaped the package cache; refusing to remove it");
  }
  const nodeModulesPath = join(candidateReal, "node_modules");
  const packageDirectoryPath = join(nodeModulesPath, PACKAGE_NAME);
  const nodeModulesStat = await lstat(nodeModulesPath);
  const packageDirectoryStat = await lstat(packageDirectoryPath);
  if (
    nodeModulesStat.isSymbolicLink()
    || packageDirectoryStat.isSymbolicLink()
    || !nodeModulesStat.isDirectory()
    || !packageDirectoryStat.isDirectory()
  ) {
    throw new Error("Stale wrapper changed after preview; refusing to remove it");
  }
  if (!containedBy(candidateReal, await realpath(nodeModulesPath))) {
    throw new Error("Stale wrapper dependency tree escaped its wrapper; refusing cleanup");
  }
  if (!containedBy(nodeModulesPath, await realpath(packageDirectoryPath))) {
    throw new Error("Stale wrapper escaped the package cache; refusing to remove it");
  }
  const wrapperManifestPath = join(candidateReal, "package.json");
  const packageManifestPath = join(packageDirectoryPath, "package.json");
  const wrapperStat = await lstat(wrapperManifestPath);
  const packageStat = await lstat(packageManifestPath);
  if (
    wrapperStat.isSymbolicLink()
    || packageStat.isSymbolicLink()
    || !wrapperStat.isFile()
    || !packageStat.isFile()
  ) {
    throw new Error("Stale wrapper changed after preview; refusing to remove it");
  }
  const wrapperBytes = await readFile(wrapperManifestPath);
  const packageBytes = await readFile(packageManifestPath);
  if (
    !wrapperBytes.equals(candidate.wrapperManifestSnapshot)
    || !packageBytes.equals(candidate.packageManifestSnapshot)
  ) {
    throw new Error("Stale wrapper changed after preview; refusing to remove it");
  }
  const wrapper: unknown = JSON.parse(wrapperBytes.toString("utf8"));
  const installed: unknown = JSON.parse(packageBytes.toString("utf8"));
  if (
    !wrapper
    || typeof wrapper !== "object"
    || Array.isArray(wrapper)
    || !("dependencies" in wrapper)
    || !wrapper.dependencies
    || typeof wrapper.dependencies !== "object"
    || Array.isArray(wrapper.dependencies)
    || !installed
    || typeof installed !== "object"
    || Array.isArray(installed)
    || !("name" in installed)
    || !("version" in installed)
    || (wrapper.dependencies as Record<string, unknown>)[PACKAGE_NAME] !== candidate.expectedVersion
    || installed.name !== PACKAGE_NAME
    || installed.version !== candidate.expectedVersion
  ) {
    throw new Error("Stale wrapper changed after preview; refusing to remove it");
  }
  await rm(candidateReal, { recursive: true, force: false });
}

async function configuredWithExactVersion(configPath: string, targetVersion: string): Promise<boolean> {
  const specs = await readConfiguredSpecs([configPath]);
  const expected = `${PACKAGE_NAME}@${targetVersion}`;
  return specs.length === 1 && specs[0] === expected;
}

async function exactInstalledVersion(cacheDir: string, targetVersion: string): Promise<string | null> {
  try {
    const raw = await readFile(
      join(cacheDir, "packages", `${PACKAGE_NAME}@${targetVersion}`, "node_modules", PACKAGE_NAME, "package.json"),
      "utf8",
    );
    const manifest = JSON.parse(raw) as { name?: unknown; version?: unknown };
    return manifest.name === PACKAGE_NAME && typeof manifest.version === "string"
      ? manifest.version
      : null;
  } catch {
    return null;
  }
}

async function defaultConfirm(message: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const closed = new Promise<string>((resolveClosed) => {
      prompt.once("close", () => resolveClosed(""));
    });
    const answer = await Promise.race([
      prompt.question(`${message} [y/N] `),
      closed,
    ]);
    return /^y(?:es)?$/iu.test(answer.trim());
  } finally {
    prompt.close();
  }
}

function parseArgs(argv: string[]): {
  command: "doctor" | "update" | "help";
  json: boolean;
  dryRun: boolean;
  yes: boolean;
} | { error: string } {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return { command: "help", json: false, dryRun: false, yes: false };
  }
  const command = argv[0];
  if (command !== "doctor" && command !== "update") return { error: `Unknown command: ${command}` };
  let json = false;
  let dryRun = false;
  let yes = false;
  for (const arg of argv.slice(1)) {
    if (arg === "--json") json = true;
    else if (arg === "--dry-run" && command === "update") dryRun = true;
    else if (arg === "--yes" && command === "update") yes = true;
    else return { error: `Unknown option: ${arg}` };
  }
  if (dryRun && yes) return { error: "--dry-run and --yes cannot be combined" };
  return { command, json, dryRun, yes };
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
    if (parsed.command === "doctor") {
      if (parsed.json) stdout(`${JSON.stringify(doctorJson(inspection), null, 2)}\n`);
      else stdout(`Flema Engram: ${inspection.status} (installed ${inspection.installations.map(({ installedVersion }) => installedVersion).join(", ") || "none"}; latest ${inspection.latestVersion})\n`);
      return 0;
    }

    const plan = await createUpdatePlan(
      inspection,
      (dependencies.now ?? (() => new Date()))(),
    );
    const visiblePlan = publicUpdatePlan(plan);
    if (parsed.dryRun) {
      if (parsed.json) stdout(`${JSON.stringify(visiblePlan, null, 2)}\n`);
      else stdout(`Update preview: run ${plan.installCommand.join(" ")}; back up ${plan.configPath}; remove ${plan.staleWrappers.length} manifest-verified stale wrapper(s). No changes made.\n`);
      return 0;
    }

    const preview = `Update preview: run ${plan.installCommand.join(" ")}; back up ${plan.configPath}; remove ${plan.staleWrappers.length} manifest-verified stale wrapper(s).\n`;
    if (!parsed.json) stdout(preview);
    if (!parsed.yes) {
      const confirmed = await (dependencies.confirm ?? defaultConfirm)(
        "Apply this exact-version update and verified stale-wrapper cleanup?",
      );
      if (!confirmed) {
        if (parsed.json) {
          stdout(`${JSON.stringify({
            plan: visiblePlan,
            result: { applied: false, cancelled: true },
          }, null, 2)}\n`);
        } else {
          stdout("Update cancelled; no changes made.\n");
        }
        return 0;
      }
    }

    const currentConfig = await readFile(plan.configPath);
    if (!currentConfig.equals(plan.configSnapshot)) {
      throw new Error("Configuration changed after preview; no changes were applied");
    }
    const currentMode = (await stat(plan.configPath)).mode & 0o777;
    if (currentMode !== plan.configMode) {
      throw new Error("Configuration permissions changed after preview; no changes were applied");
    }
    await writeFile(plan.backupPath, plan.configSnapshot, {
      flag: "wx",
      mode: plan.configMode,
    });
    await chmod(plan.backupPath, plan.configMode);
    const configAfterBackup = await readFile(plan.configPath);
    if (!configAfterBackup.equals(plan.configSnapshot)) {
      throw new Error("Configuration changed after backup; no installer was invoked");
    }
    const [command, ...args] = plan.installCommand;
    if (!command) throw new Error("Update plan did not contain an installer command");
    const installResult = await (dependencies.runCommand ?? defaultRunCommand)(command, args);
    if (installResult.code !== 0) {
      throw new Error(`OpenCode installer failed; configuration backup retained at ${plan.backupPath}`);
    }
    if (!(await configuredWithExactVersion(plan.configPath, plan.targetVersion))) {
      throw new Error(`OpenCode installer did not pin ${PACKAGE_NAME}@${plan.targetVersion}; backup retained`);
    }
    const installedVersion = await exactInstalledVersion(plan.cacheDir, plan.targetVersion);
    if (installedVersion !== plan.targetVersion) {
      throw new Error(`OpenCode installer did not produce the expected package version; backup retained`);
    }

    const removedStaleWrappers: string[] = [];
    for (const candidate of plan.staleWrappers) {
      try {
        await removeVerifiedStaleWrapper(candidate, plan);
        removedStaleWrappers.push(candidate.path);
      } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        const removed = removedStaleWrappers.join(", ") || "none";
        throw new Error(
          `Plugin update was installed and verified, but stale-wrapper cleanup failed; removed: ${removed}; backup retained at ${plan.backupPath}; cause: ${cause}`,
          { cause: error },
        );
      }
    }
    const result = {
      applied: true,
      packageName: PACKAGE_NAME,
      targetVersion: plan.targetVersion,
      backupPath: plan.backupPath,
      installedSpec: `${PACKAGE_NAME}@${plan.targetVersion}`,
      removedStaleWrappers,
      verification: {
        configured: true,
        installedVersion,
        staleWrappers: 0,
      },
    };
    if (parsed.json) stdout(`${JSON.stringify({ plan: visiblePlan, result }, null, 2)}\n`);
    else stdout(`Update applied and verified: ${PACKAGE_NAME}@${plan.targetVersion}. Restart OpenCode.\n`);
    return 0;
  } catch (error) {
    stderr(`Flema Engram maintenance failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

import path from "node:path";

import type { EngramAdapter } from "../adapters/types.js";

export interface ProjectResolutionOptions {
  explicitProject?: string;
  envProject?: string;
}

export type ProjectCandidateSource = "explicit" | "environment" | "cwd";
export type ProjectValidation =
  | "exact"
  | "case-insensitive"
  | "ambiguous"
  | "no-match"
  | "offline"
  | "no-candidate";

export interface ProjectResolution {
  projectName?: string;
  candidate?: string;
  source?: ProjectCandidateSource;
  validation: ProjectValidation;
}

interface ProjectCandidate {
  name: string;
  source: ProjectCandidateSource;
  pathLike?: boolean;
}

function nonBlank(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate ? candidate : undefined;
}

export function resolveProjectName(
  cwd: string,
  options: ProjectResolutionOptions = {},
): string | undefined {
  const explicit = nonBlank(options.explicitProject);
  if (explicit) return explicit;

  const environment = nonBlank(options.envProject ?? process.env.ENGRAM_PROJECT);
  if (environment) return environment;

  const candidate = nonBlank(cwd);
  if (!candidate) return undefined;

  const pathApi = /^[A-Za-z]:[\\/]/.test(candidate) || candidate.includes("\\")
    ? path.win32
    : path.posix;
  const resolved = pathApi.resolve(candidate);
  if (resolved === pathApi.parse(resolved).root) return undefined;

  return normalizeProjectName(pathApi.basename(resolved));
}

/**
 * Resolves one workspace candidate and validates it against live Engram data.
 * A candidate is never promoted to projectName unless Engram confirms it.
 */
export async function resolveProject(
  adapter: Pick<EngramAdapter, "listProjects">,
  cwd: string,
  options: ProjectResolutionOptions = {},
): Promise<ProjectResolution> {
  const candidates = resolveProjectCandidates(cwd, options);
  if (candidates.length === 0) return { validation: "no-candidate" };

  let knownNames: string[];
  try {
    knownNames = (await adapter.listProjects()).map((project) => project.name);
  } catch {
    const candidate = candidates[0]!;
    return {
      candidate: candidate.source === "cwd" ? undefined : candidate.name,
      source: candidate.source,
      validation: "offline",
    };
  }

  let unresolved: ProjectResolution | undefined;
  for (const candidate of candidates) {
    const resolution = matchProjectCandidate(knownNames, candidate);
    if (resolution.projectName) return resolution;
    if (resolution.validation === "ambiguous" || !unresolved) unresolved = resolution;
  }

  return unresolved ?? { validation: "no-candidate" };
}

function matchProjectCandidate(
  knownNames: string[],
  candidate: ProjectCandidate,
): ProjectResolution {
  const exactMatches = knownNames.filter((name) => name === candidate.name);
  if (exactMatches.length === 1) {
    return {
      projectName: exactMatches[0],
      candidate: candidate.name,
      source: candidate.source,
      validation: "exact",
    };
  }
  if (exactMatches.length > 1) {
    return { candidate: candidate.name, source: candidate.source, validation: "ambiguous" };
  }

  const foldedCandidate = candidate.name.toLowerCase();
  let foldedMatches = knownNames.filter(
    (name) => name.toLowerCase() === foldedCandidate,
  );
  if (candidate.pathLike) {
    const normalizedCandidate = normalizePathForComparison(candidate.name);
    foldedMatches = knownNames.filter((name) =>
      name.toLowerCase() === foldedCandidate
      || normalizePathForComparison(name) === normalizedCandidate,
    );
  }
  if (foldedMatches.length === 1) {
    return {
      projectName: foldedMatches[0],
      candidate: candidate.name,
      source: candidate.source,
      validation: "case-insensitive",
    };
  }

  return {
    candidate: candidate.name,
    source: candidate.source,
    validation: foldedMatches.length > 1 ? "ambiguous" : "no-match",
  };
}

function resolveProjectCandidates(
  cwd: string,
  options: ProjectResolutionOptions,
): ProjectCandidate[] {
  const explicit = nonBlank(options.explicitProject);
  if (explicit) return [{ name: explicit, source: "explicit" }];

  const environment = nonBlank(options.envProject ?? process.env.ENGRAM_PROJECT);
  if (environment) return [{ name: environment, source: "environment" }];

  const name = resolveProjectName(cwd, { envProject: "" });
  if (!name) return [];

  const candidates: ProjectCandidate[] = [{ name, source: "cwd" }];
  const absolutePath = resolveAbsolutePath(cwd);
  if (absolutePath && absolutePath !== name) {
    candidates.push({ name: absolutePath, source: "cwd", pathLike: true });
  }
  return candidates;
}

function resolveAbsolutePath(cwd: string): string | undefined {
  const candidate = nonBlank(cwd);
  if (!candidate) return undefined;
  const pathApi = /^[A-Za-z]:[\\/]/.test(candidate) || candidate.includes("\\")
    ? path.win32
    : path.posix;
  const resolved = pathApi.normalize(pathApi.resolve(candidate));
  return resolved === pathApi.parse(resolved).root ? undefined : resolved;
}

function normalizePathForComparison(value: string): string {
  return value.trim().replace(/[\\/]+/g, "\\").replace(/\\+$/, "").toLowerCase();
}

export function normalizeProjectName(name: string): string | undefined {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, "-");
  return /[\p{L}\p{N}]/u.test(normalized) ? normalized : undefined;
}

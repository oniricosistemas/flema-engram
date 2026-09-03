import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";
import type {
  EngramAdapter,
  HealthStatus,
  Observation,
  Project,
} from "../../adapters/types.js";
import { collectBlockers, groupByChange, type SDDChange } from "../../utils/sdd-detector.js";
import type { ProjectResolution } from "../../utils/project-resolver.js";
import { EngramUnavailable } from "../../utils/errors.js";

export type SidebarHealth = "loading" | "ok" | "stale" | "error" | "offline";

export interface SidebarViewModel {
  projectName?: string;
  project?: Project;
  resolution?: ProjectResolution;
  changes: SDDChange[];
  blockers: Observation[];
  recentActivity: Observation[];
  health: SidebarHealth;
  loading: boolean;
  lastRefreshAt?: Date;
  error?: string;
  terminal?: SidebarTerminalState;
}

export interface SidebarTerminalState {
  status: "loading" | SidebarRefreshOutcomeStatus;
  stage: SidebarOperationStage | "mounted" | "refresh";
  health: SidebarHealth;
  observationCount: number;
}

export interface UseEngramOptions {
  projectName?: string;
  resolution?: ProjectResolution;
  initialError?: string;
  pollInterval?: number;
  enabled?: boolean;
  autoRefresh?: boolean;
  resolveProject?: () => Promise<ProjectResolution>;
  now?: () => Date;
  stageTimeoutMs?: number;
}

export interface UseEngramReturn {
  state: Accessor<SidebarViewModel>;
  refresh: () => Promise<SidebarRefreshOutcome>;
}

const DEFAULT_POLL_INTERVAL = 30_000;
const DEFAULT_STAGE_TIMEOUT_MS = 5_000;
const SIDEBAR_OBSERVATION_LIMIT = 20;
const OBSERVATION_FALLBACK_LIMIT = 100;
const EMPTY_STATE: SidebarViewModel = {
  changes: [],
  blockers: [],
  recentActivity: [],
  health: "loading",
  loading: true,
  terminal: { status: "loading", stage: "mounted", health: "loading", observationCount: 0 },
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export interface SidebarRefreshInput {
  health?: HealthStatus;
  projects?: Project[];
  observations?: Observation[];
  projectName?: string;
  resolution?: ProjectResolution;
  errors?: unknown[];
  failures?: SidebarRefreshFailure[];
  warnings?: string[];
  stages?: SidebarStageTransition[];
  now: Date;
}

export type SidebarRefreshStage = "project-resolution" | "health" | "projects" | "observations" | "refresh";

export interface SidebarRefreshFailure {
  stage: SidebarRefreshStage;
  endpoint?: string;
  reason: unknown;
}

export type SidebarRefreshOutcomeStatus = "success" | "partial" | "failed";
export type SidebarTransitionStatus = "started" | SidebarRefreshOutcomeStatus | "skipped";
export type SidebarOperationStage =
  | "project-resolution"
  | "health"
  | "projects"
  | "filtered-observations"
  | "fallback-observations"
  | "reducing"
  | "terminal";

export interface SidebarStageTransition {
  stage: SidebarOperationStage;
  status: SidebarTransitionStatus;
  endpoint?: string;
  count?: number;
  message?: string;
}

export interface SidebarRefreshOutcome {
  status: SidebarRefreshOutcomeStatus;
  summary: string;
  failures: SidebarRefreshFailure[];
  warnings: string[];
  stages: SidebarStageTransition[];
}

interface CanonicalObservationResult {
  observations: Observation[];
  warning?: string;
}

export function reduceSidebarRefresh(
  current: SidebarViewModel,
  input: SidebarRefreshInput,
): SidebarViewModel {
  const localAvailable = input.health?.local.available === true;
  const observationsAvailable = input.observations !== undefined;
  const criticalFailure = input.failures?.some((failure) =>
    failure.stage === "project-resolution"
    || failure.stage === "health"
    || failure.stage === "observations"
    || failure.stage === "refresh"
  ) === true;
  const coreComplete = localAvailable && observationsAvailable && !criticalFailure;
  const partial = input.projects !== undefined || (observationsAvailable && projectNameFor(input) !== undefined);
  const health: SidebarHealth = coreComplete
    ? "ok"
    : partial || current.lastRefreshAt
      ? "stale"
      : input.health
        ? "error"
        : "offline";
  const activity = input.observations ?? current.recentActivity;
  const projectName = input.resolution
    ? input.resolution.projectName
    : input.projectName ?? current.projectName;
  const failure = input.failures?.[0];
  const error = input.errors?.[0];
  const warning = input.warnings?.[0];

  const reduced: SidebarViewModel = {
    projectName,
    resolution: input.resolution ?? current.resolution,
    project: projectForRefresh(current.project, input.projects, input.observations, projectName),
    changes: input.observations ? groupByChange(input.observations) : current.changes,
    blockers: input.observations ? collectBlockers(input.observations) : current.blockers,
    recentActivity: [...activity]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
      .slice(0, 5),
    health,
    loading: false,
    lastRefreshAt: coreComplete ? input.now : current.lastRefreshAt,
    error: failure
      ? describeFailure(failure, input)
      : error !== undefined
      ? messageOf(error)
      : warning
        ? warning
        : localAvailable
          ? coreComplete ? undefined : "Engram observations unavailable"
           : input.health ? "Engram health check failed" : "Engram is offline",
  };
  reduced.terminal = {
    status: outcomeFor(input).status,
    stage: "terminal",
    health: reduced.health,
    observationCount: input.observations?.length ?? current.terminal?.observationCount ?? 0,
  };
  return reduced;
}

export async function fetchSidebarRefresh(
  adapter: EngramAdapter,
  options: Pick<UseEngramOptions, "projectName" | "resolution" | "resolveProject" | "now" | "stageTimeoutMs"> & {
    onTransition?: (transition: SidebarStageTransition) => void;
  } = {},
): Promise<SidebarRefreshInput> {
  const stageTimeoutMs = options.stageTimeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  let resolution = options.resolution;
  const failures: SidebarRefreshFailure[] = [];
  const stages: SidebarStageTransition[] = [];
  const transition = (stage: SidebarStageTransition): void => {
    stages.push(stage);
    options.onTransition?.(stage);
  };
  if (options.resolveProject) {
    transition({ stage: "project-resolution", status: "started", endpoint: defaultEndpoint("project-resolution") });
    try {
      resolution = await withStageTimeout(
        options.resolveProject(),
        "project resolution",
        stageTimeoutMs,
        defaultEndpoint("project-resolution"),
      );
      if (resolution.validation === "offline") {
        const failure = {
          stage: "project-resolution",
          reason: new Error("Engram project validation was unavailable"),
        } satisfies SidebarRefreshFailure;
        failures.push(failure);
        transition({
          stage: "project-resolution",
          status: "failed",
          endpoint: defaultEndpoint("project-resolution"),
          message: messageOf(failure.reason),
        });
      } else {
        transition({ stage: "project-resolution", status: "success", endpoint: defaultEndpoint("project-resolution") });
      }
    } catch (reason) {
      const failure = failureFor("project-resolution", reason);
      failures.push(failure);
      transition({
        stage: "project-resolution",
        status: "failed",
        endpoint: failure.endpoint,
        message: messageOf(reason),
      });
    }
  } else {
    transition({
      stage: "project-resolution",
      status: resolution || options.projectName ? "success" : "skipped",
      endpoint: defaultEndpoint("project-resolution"),
    });
  }
  const projectName = resolution ? resolution.projectName : options.projectName;
  const healthRequest = trackRequest(
    Promise.resolve().then(() => adapter.health()),
    "health",
    stageTimeoutMs,
    transition,
  );
  const projectsRequest = trackRequest(
    Promise.resolve().then(() => adapter.listProjects()),
    "projects",
    stageTimeoutMs,
    transition,
  );
  const observationsRequest = fetchCanonicalObservations(adapter, projectName, stageTimeoutMs, transition);
  const [health, projects, canonicalObservations] = await Promise.allSettled([
    healthRequest,
    projectsRequest,
    observationsRequest,
  ]);

  if (health.status === "rejected") failures.push(failureFor("health", health.reason));
  if (projects.status === "rejected") failures.push(failureFor("projects", projects.reason));
  if (canonicalObservations.status === "rejected") {
    failures.push(failureFor("observations", canonicalObservations.reason));
  }

  return {
    health: health.status === "fulfilled" ? health.value : undefined,
    projects: projects.status === "fulfilled" ? projects.value : undefined,
    observations: canonicalObservations.status === "fulfilled"
      ? canonicalObservations.value.observations
      : undefined,
    projectName,
    resolution,
    errors: [health, projects, canonicalObservations]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason),
    failures: failures.length ? failures : undefined,
    warnings: canonicalObservations.status === "fulfilled" && canonicalObservations.value.warning
      ? [canonicalObservations.value.warning]
      : undefined,
    stages,
    now: options.now?.() ?? new Date(),
  };
}

function projectNameFor(input: SidebarRefreshInput): string | undefined {
  return input.resolution ? input.resolution.projectName : input.projectName;
}

async function fetchCanonicalObservations(
  adapter: EngramAdapter,
  projectName: string | undefined,
  timeoutMs: number,
  onTransition: (transition: SidebarStageTransition) => void,
): Promise<CanonicalObservationResult> {
  const endpoint = defaultEndpoint("observations");
  if (!projectName) {
    onTransition({ stage: "filtered-observations", status: "skipped", endpoint, count: 0 });
    onTransition({ stage: "fallback-observations", status: "skipped", endpoint, count: 0 });
    return { observations: [] };
  }

  const deadline = Date.now() + timeoutMs;
  const run = async (stage: "filtered-observations" | "fallback-observations", request: () => Promise<Observation[]>) => {
    onTransition({ stage, status: "started", endpoint });
    try {
      const observations = await withStageTimeout(
        Promise.resolve().then(request),
        stage === "filtered-observations" ? "filtered observations request" : "fallback observations request",
        Math.max(0, deadline - Date.now()),
        endpoint,
      );
      onTransition({ stage, status: "success", endpoint, count: observations.length });
      return observations;
    } catch (reason) {
      onTransition({ stage, status: "failed", endpoint, message: messageOf(reason) });
      throw reason;
    }
  };

  const filtered = await run("filtered-observations", () => adapter.listObservations({
    project: projectName,
    limit: SIDEBAR_OBSERVATION_LIMIT,
  }));
  if (filtered.length > 0 && filtered.every((observation) => observation.project === projectName)) {
    onTransition({ stage: "fallback-observations", status: "skipped", endpoint });
    return { observations: filtered };
  }

  const unfiltered = await run(
    "fallback-observations",
    () => adapter.listObservations({ limit: OBSERVATION_FALLBACK_LIMIT }),
  );
  const observations = unfiltered
    .filter((observation) => observation.project === projectName)
    .slice(0, SIDEBAR_OBSERVATION_LIMIT);
  const reason = filtered.length === 0
    ? "Filtered observations returned no records"
    : "Filtered observations returned cross-project records";

  return {
    observations,
    warning: `${reason}; used bounded unfiltered fallback (limit ${OBSERVATION_FALLBACK_LIMIT}) with exact project matching for ${projectName}.`,
  };
}

function projectForRefresh(
  current: Project | undefined,
  projects: Project[] | undefined,
  observations: Observation[] | undefined,
  projectName: string | undefined,
): Project | undefined {
  if (!projectName) return undefined;

  const refreshed = projects?.find((project) => project.name === projectName);
  const previous = current?.name === projectName ? current : undefined;
  if (observations === undefined) return previous ?? refreshed;

  const base = refreshed ?? previous;
  if (!base && observations.length === 0) return undefined;

  const latestObservation = observations.reduce<string | undefined>(
    (latest, observation) => !latest || observation.updated_at > latest
      ? observation.updated_at
      : latest,
    undefined,
  );
  const lastActiveAt = base?.lastActiveAt ?? latestObservation;

  if (!lastActiveAt) return undefined;

  return {
    name: projectName,
    observationCount: observations.length,
    lastActiveAt,
    scopes: base?.scopes ?? [...new Set(observations.map((observation) => observation.scope))].sort(),
  };
}

export function useEngram(
  adapter: EngramAdapter,
  options: UseEngramOptions = {},
): UseEngramReturn {
  const [state, setState] = createSignal<SidebarViewModel>({
    ...EMPTY_STATE,
    projectName: options.projectName,
    resolution: options.resolution,
    error: options.initialError,
  });
  let generation = 0;
  let disposed = false;
  let initialRefreshStarted = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let initialResolutionPending = hasValidatedProjectName(options.resolution);

  const runRefresh = async (): Promise<SidebarRefreshOutcome> => {
    const currentGeneration = ++generation;
    const useInitialResolution = initialResolutionPending;
    initialResolutionPending = false;
    setState((current) => ({
      ...current,
      loading: true,
      terminal: {
        status: "loading",
        stage: "refresh",
        health: current.health,
        observationCount: current.terminal?.observationCount ?? current.project?.observationCount ?? 0,
      },
    }));

    try {
      const input = await fetchSidebarRefresh(adapter, {
        ...options,
        resolveProject: useInitialResolution ? undefined : options.resolveProject,
        onTransition: (transition) => {
          if (currentGeneration === generation) {
            setState((current) => ({
              ...current,
              terminal: {
                status: "loading",
                stage: transition.stage,
                health: current.health,
                observationCount: transition.stage.includes("observations") && transition.count !== undefined
                  ? transition.count
                  : current.terminal?.observationCount ?? 0,
              },
            }));
          }
        },
      });
      if (currentGeneration !== generation) return outcomeFor(input);
      const reducingTransition = { stage: "reducing", status: "success" } satisfies SidebarStageTransition;
      input.stages?.push(reducingTransition);
      setState((current) => ({
        ...current,
        terminal: {
          status: "loading",
          stage: "reducing",
          health: current.health,
          observationCount: input.observations?.length ?? current.terminal?.observationCount ?? 0,
        },
      }));
      const outcome = outcomeFor(input);
      setState((current) => reduceSidebarRefresh(current, input));
      const terminalTransition = { stage: "terminal", status: outcome.status, message: outcome.summary } satisfies SidebarStageTransition;
      outcome.stages.push(terminalTransition);
      return outcome;
    } catch (reason) {
      const failure = { stage: "refresh", reason } satisfies SidebarRefreshFailure;
      if (currentGeneration !== generation) {
        return outcomeFor({ failures: [failure], now: options.now?.() ?? new Date() });
      }
      const current = state();
      const input: SidebarRefreshInput = {
        projectName: current.projectName ?? options.projectName,
        resolution: current.resolution ?? options.resolution,
        failures: [failure],
        now: options.now?.() ?? new Date(),
      };
      setState((current) => reduceSidebarRefresh(current, input));
      const outcome = outcomeFor(input);
      const terminalTransition = {
        stage: "terminal",
        status: "failed",
        message: outcome.summary,
      } satisfies SidebarStageTransition;
      outcome.stages.push(terminalTransition);
      return outcome;
    }
  };

  const refresh = (): Promise<SidebarRefreshOutcome> => {
    initialRefreshStarted = true;
    return runRefresh();
  };

  const startInitialRefresh = (): void => {
    if (disposed || initialRefreshStarted) return;
    initialRefreshStarted = true;
    if (options.enabled === false) {
      setState((current) => ({ ...current, loading: false }));
      return;
    }

    void runRefresh();
  };

  onMount(() => {
    if (options.autoRefresh !== false) startInitialRefresh();
    if (options.enabled !== false && pollTimer === undefined) {
      pollTimer = setInterval(() => void runRefresh(), options.pollInterval ?? DEFAULT_POLL_INTERVAL);
    }
  });

  // Direct hook consumers retain a guarded fallback. The OpenCode slot disables it
  // because sidebar_content owns startup through its current action mount.
  if (options.autoRefresh !== false) queueMicrotask(startInitialRefresh);
  onCleanup(() => {
    disposed = true;
    generation += 1;
    if (pollTimer !== undefined) clearInterval(pollTimer);
  });

  return { state, refresh };
}

function failureFor(stage: SidebarRefreshStage, reason: unknown): SidebarRefreshFailure {
  return {
    stage,
    endpoint: reason instanceof EngramUnavailable ? reason.endpoint : defaultEndpoint(stage),
    reason,
  };
}

function defaultEndpoint(stage: SidebarRefreshStage): string | undefined {
  if (stage === "project-resolution") return "/observations/recent + /sessions/recent";
  if (stage === "health") return "/health";
  if (stage === "projects") return "/observations/recent + /sessions/recent";
  if (stage === "observations") return "/observations/recent";
  return undefined;
}

function hasValidatedProjectName(resolution: ProjectResolution | undefined): boolean {
  return Boolean(
    resolution?.projectName
    && (resolution.validation === "exact" || resolution.validation === "case-insensitive"),
  );
}

function withStageTimeout<T>(
  promise: Promise<T>,
  stage: string,
  timeoutMs: number,
  endpoint?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new EngramUnavailable(`${stage} timed out after ${timeoutMs}ms`, undefined, {
        kind: "timeout",
        endpoint,
      }));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timeoutId);
        reject(reason);
      },
    );
  });
}

async function trackRequest<T>(
  promise: Promise<T>,
  stage: "health" | "projects",
  timeoutMs: number,
  onTransition: (transition: SidebarStageTransition) => void,
): Promise<T> {
  const endpoint = defaultEndpoint(stage);
  onTransition({ stage, status: "started", endpoint });
  try {
    const value = await withStageTimeout(promise, `${stage} request`, timeoutMs, endpoint);
    onTransition({
      stage,
      status: "success",
      endpoint,
      count: Array.isArray(value) ? value.length : undefined,
    });
    return value;
  } catch (reason) {
    onTransition({ stage, status: "failed", endpoint, message: messageOf(reason) });
    throw reason;
  }
}

export function outcomeFor(input: SidebarRefreshInput): SidebarRefreshOutcome {
  const failures = input.failures ?? [];
  const warnings = input.warnings ?? [];
  const coreComplete = input.health?.local.available === true
    && input.observations !== undefined
    && !failures.some((failure) => failure.stage !== "projects");
  const hasUsableData = input.health !== undefined
    || input.projects !== undefined
    || input.observations !== undefined;
  const status: SidebarRefreshOutcomeStatus = coreComplete && failures.length === 0 && warnings.length === 0
    ? "success"
    : hasUsableData
      ? "partial"
      : "failed";
  const firstFailure = failures[0];
  const summary = firstFailure
    ? `${firstFailure.endpoint ? `${firstFailure.stage} ${firstFailure.endpoint}` : firstFailure.stage}: ${messageOf(firstFailure.reason)}`
    : warnings[0]
      ?? (status === "success" ? "Refresh complete" : "required refresh data unavailable");

  return {
    status,
    summary,
    failures,
    warnings,
    stages: [...(input.stages ?? [])],
  };
}

function describeFailure(failure: SidebarRefreshFailure, input: SidebarRefreshInput): string {
  const location = failure.endpoint ? `${failure.stage} ${failure.endpoint}` : failure.stage;
  const projects = input.projects === undefined ? "unavailable" : String(input.projects.length);
  const observations = input.observations === undefined ? "unavailable" : String(input.observations.length);
  return `${location}: ${messageOf(failure.reason)} (projects=${projects}, observations=${observations})`;
}

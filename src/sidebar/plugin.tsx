/** @jsxImportSource @opentui/solid */

import { createSignal, ErrorBoundary, onCleanup, type Accessor, type JSX } from "solid-js";
import type {
  TuiPluginApi,
  TuiPluginModule,
  TuiSlotContext,
  TuiSlotPlugin,
} from "@opencode-ai/plugin/tui";
import { LocalEngramAdapter } from "../adapters/local.js";
import type { EngramAdapter } from "../adapters/types.js";
import { resolveProject, type ProjectResolution } from "../utils/project-resolver.js";
import { activityLines, type ActivityFeedProps } from "./components/activity-feed.js";
import { blockerLines, type BlockersProps } from "./components/blockers.js";
import { phaseProgressLines, type PhaseProgressProps } from "./components/phase-progress.js";
import { projectLines, type ProjectListProps } from "./components/project-list.js";
import { useEngram } from "./hooks/use-engram.js";
import type { SidebarRefreshOutcome, SidebarViewModel } from "./hooks/use-engram.js";

export interface EngramTuiOptions {
  enabled?: boolean;
  project?: string;
  pollInterval?: number;
}

export interface EngramSidebarProps {
  adapter: EngramAdapter;
  projectName?: string;
  projectResolution?: ProjectResolution;
  initialError?: string;
  pollInterval?: number;
  theme?: TuiSlotContext["theme"];
  actionRegistry: SidebarActionRegistry;
  actionMount?: SidebarActionMount;
  sessionId?: string;
  resolveProject?: () => Promise<ProjectResolution>;
}

export interface EngramTuiDependencies {
  adapter?: EngramAdapter;
  cwd?: string;
  renderSidebar?: (props: EngramSidebarProps) => JSX.Element;
  actionRegistry?: SidebarActionRegistry;
}

export interface SidebarActionDependencies {
  refresh: () => Promise<SidebarRefreshOutcome | void>;
  setStatus: (status: string) => void;
  state?: Accessor<SidebarViewModel>;
  isCurrent?: () => boolean;
}

export interface SidebarActionRegistry {
  activate: (dependencies: SidebarActionDependencies, sessionId?: string) => () => void;
  createMount: (sessionId?: string) => SidebarActionMount;
  current: (sessionId?: string) => SidebarActionDependencies | undefined;
  run: (key: string, sessionId?: string, visibleSession?: () => string | undefined) => Promise<boolean>;
}

export interface SidebarActionMount {
  activate: (dependencies: SidebarActionDependencies) => () => void;
  scheduleInitialRefresh: (visibleSession: () => string | undefined) => void;
  dispose: () => void;
}

export const REFRESH_SHORTCUT = "alt+r";
const REFRESH_STAGE_TIMEOUT_HINT = "5s per request";

export function createSidebarActionRegistry(): SidebarActionRegistry {
  const defaultSession = "engram-default-session";
  const instances = new Map<string, { token: symbol; dependencies?: SidebarActionDependencies }>();
  let routePendingOwner: symbol | undefined;

  const createMount = (requestedSession?: string): SidebarActionMount => {
    const sessionId = requestedSession ?? defaultSession;
    const token = Symbol("engram-sidebar-mount");
    let initialRefreshScheduled = false;
    let initialRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    instances.set(sessionId, { token });

    const dispose = () => {
      if (initialRefreshTimer !== undefined) clearTimeout(initialRefreshTimer);
      if (instances.get(sessionId)?.token === token) instances.delete(sessionId);
    };

    return {
      activate(dependencies) {
        const active = instances.get(sessionId);
        if (active?.token === token) active.dependencies = dependencies;
        return dispose;
      },
      scheduleInitialRefresh(visibleSession) {
        if (initialRefreshScheduled) return;
        initialRefreshScheduled = true;
        routePendingOwner = token;
        initialRefreshTimer = setTimeout(() => {
          initialRefreshTimer = undefined;
          const active = instances.get(sessionId);
          const currentSession = () => visibleSession() ?? (routePendingOwner === token ? sessionId : undefined);
          if (active?.token !== token || !active.dependencies || currentSession() !== sessionId) return;
          void runCurrent(REFRESH_SHORTCUT, sessionId, currentSession, token);
        }, 0);
      },
      dispose,
    };
  };

  const runCurrent = async (
    key: string,
    sessionId: string,
    visibleSession: () => string | undefined,
    expectedToken?: symbol,
  ): Promise<boolean> => {
    const active = instances.get(sessionId);
    if (!active?.dependencies || (expectedToken && active.token !== expectedToken)) return false;
    if (visibleSession() !== sessionId) return false;
    return handleSidebarKey(key, {
      ...active.dependencies,
      isCurrent: () => instances.get(sessionId)?.token === active.token && visibleSession() === sessionId,
    });
  };

  return {
    activate(dependencies, requestedSession) {
      return createMount(requestedSession).activate(dependencies);
    },
    createMount,
    current(sessionId = defaultSession) {
      return instances.get(sessionId)?.dependencies;
    },
    async run(key, requestedSession, visibleSession = () => requestedSession ?? defaultSession) {
      const sessionId = requestedSession ?? defaultSession;
      return runCurrent(key, sessionId, visibleSession);
    },
  };
}

export function describeSidebar(state: SidebarViewModel, actionStatus?: string): string[] {
  const health = healthPresentation(state.health);
  const lines = [
    "🧠 Engram",
    `${health.icon} Health: ${healthLabel(state.health)}`,
    ...projectLines({
      projectName: state.projectName,
      project: state.project,
      resolution: state.resolution,
    }),
    ...phaseProgressLines(state.changes),
    ...blockerLines(state.blockers),
    ...activityLines(state.recentActivity),
    `🔄 [${REFRESH_SHORTCUT}] Refresh`,
  ];
  if (state.loading) lines.splice(2, 0, loadingStatus(state));
  if (state.health === "offline") lines.splice(2, 0, `⚠️ Engram is offline; press ${REFRESH_SHORTCUT} to retry.`);
  if (state.health === "stale") lines.splice(2, 0, `🕒 Showing stale data; press ${REFRESH_SHORTCUT} to retry.`);
  if (state.error) lines.splice(state.health === "offline" || state.health === "stale" ? 3 : 2, 0, `⚠️ Detail: ${state.error}`);
  if (actionStatus) lines.push(actionStatus);
  return lines;
}

function loadingStatus(state: SidebarViewModel): string {
  const stage = state.terminal?.stage;
  let label: string;
  switch (stage) {
    case "project-resolution":
      label = "project resolution";
      break;
    case "health":
      label = "health";
      break;
    case "projects":
      label = "projects";
      break;
    case "filtered-observations":
    case "fallback-observations":
      label = "observations";
      break;
    case "reducing":
      label = "reducing";
      break;
    default:
      label = "starting refresh";
  }
  return `⏳ Loading: ${label} (${REFRESH_STAGE_TIMEOUT_HINT}; no ETA).`;
}

export async function handleSidebarKey(
  key: string,
  dependencies: SidebarActionDependencies,
): Promise<boolean> {
  if (key === REFRESH_SHORTCUT) {
    dependencies.setStatus("🔄 Refreshing…");
    try {
      const outcome = await dependencies.refresh();
      const visibleState = dependencies.state?.();
      const terminal = visibleState?.terminal;
      const reachedVisibleSuccess = outcome?.status === "success"
        && dependencies.isCurrent?.() !== false
        && visibleState?.loading === false
        && visibleState.health === "ok"
        && terminal?.status === "success"
        && terminal.stage === "terminal";
      dependencies.setStatus(reachedVisibleSuccess
        ? "✅ Refreshed"
        : `⚠️ Refresh incomplete: ${outcome?.status !== "success"
          ? outcome?.summary ?? "refresh returned no terminal outcome"
          : `stage=${terminal?.stage ?? "unbound"}`}`);
    } catch (error) {
      dependencies.setStatus(`💔 Refresh failed: ${failureMessage(error)}`);
    }
    return true;
  }
  return false;
}

export type SafeSidebarRender =
  | { ok: true; element: JSX.Element }
  | { ok: false; error: string };

export function renderSidebarSafely(
  render: (props: EngramSidebarProps) => JSX.Element,
  props: EngramSidebarProps,
): SafeSidebarRender {
  try {
    return { ok: true, element: render(props) };
  } catch (error) {
    return { ok: false, error: failureMessage(error) };
  }
}

function asOptions(input: Record<string, unknown> | undefined): EngramTuiOptions {
  return {
    enabled: typeof input?.enabled === "boolean" ? input.enabled : undefined,
    project: typeof input?.project === "string" ? input.project : undefined,
    pollInterval: typeof input?.pollInterval === "number" && input.pollInterval > 0
      ? input.pollInterval
      : undefined,
  };
}

function healthLabel(health: ReturnType<typeof useEngram>["state"] extends () => infer State
  ? State extends { health: infer Health } ? Health : never
  : never): string {
  if (health === "loading") return "CHECKING";
  return String(health).toUpperCase();
}

function healthPresentation(
  health: ReturnType<typeof useEngram>["state"] extends () => infer State
    ? State extends { health: infer Health } ? Health : never
    : never,
): { icon: string; color: "success" | "error" | "warning" } {
  switch (health) {
    case "ok":
      return { icon: "🟢", color: "success" };
    case "error":
    case "offline":
      return { icon: "💔", color: "error" };
    default:
      return { icon: "⚠️", color: "warning" };
  }
}

export function EngramSidebar(props: EngramSidebarProps) {
  const engram = useEngram(props.adapter, {
    projectName: props.projectName,
    resolution: props.projectResolution,
    initialError: props.initialError,
    pollInterval: props.pollInterval,
    resolveProject: props.resolveProject,
    autoRefresh: false,
  });
  const [actionStatus, setActionStatus] = createSignal<string>();
  const text = createSidebarTextAccessor(engram.state, actionStatus);

  const actionDependencies = {
    refresh: engram.refresh,
    setStatus: setActionStatus,
    state: engram.state,
  } satisfies SidebarActionDependencies;
  const deactivate = props.actionMount
    ? props.actionMount.activate(actionDependencies)
    : props.actionRegistry.activate(actionDependencies, props.sessionId);
  onCleanup(deactivate);

  return (
    <ErrorBoundary fallback={(error) => <text>{`Engram sidebar unavailable: ${String(error)}`}</text>}>
      <text fg={props.theme?.current.text}>{text()}</text>
    </ErrorBoundary>
  );
}

export function createSidebarTextAccessor(
  state: Accessor<SidebarViewModel>,
  actionStatus: Accessor<string | undefined>,
): Accessor<string> {
  return () => describeSidebar(state(), actionStatus()).join("\n");
}

export interface SidebarSectionAccessors {
  project: Pick<ProjectListProps, "projectName" | "project" | "resolution">;
  changes: PhaseProgressProps["changes"];
  blockers: BlockersProps["blockers"];
  activity: ActivityFeedProps["observations"];
}

export function createSidebarSectionAccessors(
  state: () => SidebarViewModel,
): SidebarSectionAccessors {
  return {
    project: {
      projectName: () => state().projectName,
      project: () => state().project,
      resolution: () => state().resolution,
    },
    changes: () => state().changes,
    blockers: () => state().blockers,
    activity: () => state().recentActivity,
  };
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createEngramTuiPlugin(
  dependencies: EngramTuiDependencies = {},
): TuiPluginModule & { id: string } {
  const adapter = dependencies.adapter ?? new LocalEngramAdapter();
  const cwd = dependencies.cwd ?? process.cwd();
  const renderSidebar = dependencies.renderSidebar ?? ((props) => <EngramSidebar {...props} />);
  const actionRegistry = dependencies.actionRegistry ?? createSidebarActionRegistry();
  return {
    id: "engram-sidebar",
    tui: async (api, rawOptions) => {
      const options = asOptions(rawOptions);
      if (options.enabled === false) return;

      let projectResolution: ProjectResolution;
      let initialError: string | undefined;
      try {
        projectResolution = await resolveProject(adapter, cwd, {
          explicitProject: options.project,
        });
        if (projectResolution.validation === "offline") {
          initialError = "Engram project validation was unavailable during startup";
        }
      } catch (error) {
        projectResolution = { validation: "offline" };
        initialError = `Initial project resolution failed: ${failureMessage(error)}`;
      }

      api.keymap.registerLayer({
        mode: "base",
        commands: [
          {
            name: "engram.refresh",
            title: "Refresh Engram sidebar",
            category: "Engram",
            run: () => {
              const sessionId = currentRouteSession(api.route.current);
              return sessionId
                ? actionRegistry.run(REFRESH_SHORTCUT, sessionId, () => currentRouteSession(api.route.current))
                : false;
            },
          },
        ],
        bindings: [
          { key: REFRESH_SHORTCUT, cmd: "engram.refresh", desc: "Refresh Engram sidebar" },
        ],
      });

      const slot: TuiSlotPlugin = {
        slots: {
          sidebar_content(context: TuiSlotContext, _props: { session_id: string }) {
            const actionMount = actionRegistry.createMount(_props.session_id);
            const result = renderSidebarSafely(renderSidebar, {
              adapter,
              projectName: projectResolution.projectName,
              projectResolution,
              initialError,
              pollInterval: options.pollInterval,
              theme: context.theme,
              actionRegistry,
              actionMount,
              sessionId: _props.session_id,
              resolveProject: () => resolveProject(adapter, cwd, {
                explicitProject: options.project,
              }),
            });
            if (result.ok) {
              actionMount.scheduleInitialRefresh(() => currentRouteSession(api.route.current));
            } else {
              actionMount.dispose();
            }
            return result.ok
              ? result.element
              : <text>{`Engram sidebar unavailable: ${result.error}`}</text>;
          },
        },
      };

      api.slots.register(slot);
    },
  };
}

const plugin = createEngramTuiPlugin();

export default plugin;

export { ActivityFeed } from "./components/activity-feed.js";
export { Blockers } from "./components/blockers.js";
export { PhaseProgress } from "./components/phase-progress.js";
export { ProjectList } from "./components/project-list.js";
export { useEngram } from "./hooks/use-engram.js";
export type {
  SidebarHealth,
  SidebarRefreshInput,
  SidebarRefreshOutcome,
  SidebarRefreshOutcomeStatus,
  SidebarStageTransition,
  SidebarViewModel,
  UseEngramOptions,
  UseEngramReturn,
} from "./hooks/use-engram.js";

function currentRouteSession(route: TuiPluginApi["route"]["current"]): string | undefined {
  return route.name === "session" && typeof route.params?.sessionID === "string"
    ? route.params.sessionID
    : undefined;
}

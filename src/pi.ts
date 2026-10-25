import type { EngramAdapter } from "./adapters/types.js";
import { createConfiguredAdapter } from "./adapters/factory.js";
import {
  createEngramReadController,
  type EngramReadController,
  type SidebarRefreshOutcome,
  type SidebarViewModel,
} from "./viewer/core.js";
import {
  resolveProject as resolveValidatedProject,
  type ProjectResolution,
} from "./utils/project-resolver.js";

const UI_KEY = "flema-engram";
const REFRESH_COMMAND = "engram-refresh";
const MEMORY_SAVE_TOOLS = new Set(["mem_save", "save_memory"]);

export interface PiExtensionUi {
  setStatus: (key: string, value: string | undefined) => void;
  setWidget: (
    key: string,
    value: string[] | undefined,
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ) => void;
  notify: (message: string, level?: "info" | "warning" | "error") => void;
}

export interface PiExtensionContext {
  cwd: string;
  hasUI: boolean;
  ui: PiExtensionUi;
}

export interface PiToolResultEvent {
  type: "tool_result";
  toolName: string;
  isError: boolean;
}

export interface PiExtensionApi {
  on: (
    event: string,
    handler: (event: Record<string, unknown>, context: PiExtensionContext) => unknown,
  ) => () => void;
  registerCommand: (
    name: string,
    command: {
      description: string;
      handler: (args: string, context: PiExtensionContext) => unknown;
    },
  ) => void;
}

export interface PiEngramExtensionDependencies {
  createAdapter?: () => EngramAdapter;
  resolveProject?: (adapter: EngramAdapter, cwd: string) => Promise<ProjectResolution>;
}

interface ActiveViewer {
  controller: EngramReadController;
  context: PiExtensionContext;
  token: symbol;
}

export function createPiEngramExtension(
  dependencies: PiEngramExtensionDependencies = {},
): (pi: PiExtensionApi) => void {
  const createAdapter = dependencies.createAdapter ?? (() => createConfiguredAdapter());
  const resolveProject = dependencies.resolveProject
    ?? ((adapter, cwd) => resolveValidatedProject(adapter, cwd));

  return (pi) => {
    let active: ActiveViewer | undefined;

    const clearUi = (context: PiExtensionContext): void => {
      if (!context.hasUI) return;
      context.ui.setStatus(UI_KEY, undefined);
      context.ui.setWidget(UI_KEY, undefined);
    };

    const stopActive = (): void => {
      if (!active) return;
      active.controller.dispose();
      clearUi(active.context);
      active = undefined;
    };

    const renderUnavailable = (context: PiExtensionContext): void => {
      context.ui.setStatus(UI_KEY, "Engram unavailable");
      context.ui.setWidget(UI_KEY, ["Engram unavailable"], { placement: "belowEditor" });
    };

    const refreshActive = async (): Promise<SidebarRefreshOutcome | undefined> => {
      const current = active;
      if (!current) return undefined;
      const outcome = await current.controller.refresh();
      return active?.token === current.token ? outcome : undefined;
    };

    pi.on("session_start", async (_event, context) => {
      stopActive();
      if (!context.hasUI) return;

      try {
        const adapter = createAdapter();
        const token = Symbol("pi-engram-session");
        const controller = createEngramReadController(adapter, {
          resolveProject: () => resolveProject(adapter, context.cwd),
          onState: (state) => {
            if (active?.token !== token) return;
            renderState(context, state);
          },
        });
        active = { controller, context, token };
        await refreshActive();
      } catch {
        stopActive();
        renderUnavailable(context);
      }
    });

    pi.on("tool_result", async (event, _context) => {
      const result = event as unknown as PiToolResultEvent;
      if (result.isError || !MEMORY_SAVE_TOOLS.has(result.toolName)) return;
      await refreshActive();
    });

    pi.on("session_shutdown", (_event, _context) => {
      stopActive();
    });

    pi.registerCommand(REFRESH_COMMAND, {
      description: "Refresh the Flema Engram status and widget",
      handler: async (_args, context) => {
        if (!active) {
          context.ui.notify("Engram viewer is not active", "warning");
          return;
        }
        const outcome = await refreshActive();
        if (outcome?.status === "success") {
          context.ui.notify("Engram refreshed", "info");
        } else {
          context.ui.notify("Engram refresh incomplete", "warning");
        }
      },
    });
  };
}

function renderState(context: PiExtensionContext, state: SidebarViewModel): void {
  const health = state.health.toUpperCase();
  const project = state.projectName ?? "unresolved project";
  const progress = aggregateOddProgress(state);
  const blockerCount = state.blockers.length + progress.blocked;
  const statusParts = [`Engram ${health}`, project];
  if (progress.total > 0) statusParts.push(`ODD ${progress.done}/${progress.total}`);
  if (blockerCount > 0) statusParts.push(`${blockerCount} blocked`);
  context.ui.setStatus(UI_KEY, statusParts.join(" · "));

  const lines = [`Engram · ${project} [${health}]`];
  lines.push(progress.total > 0
    ? `ODD ${progress.done}/${progress.total} done · ${progress.inProgress} active · ${blockerCount} blocked`
    : "ODD no tracked feature");
  const latest = state.recentActivity[0];
  if (latest) lines.push(`Latest: ${latest.title}`);
  context.ui.setWidget(UI_KEY, lines, { placement: "belowEditor" });
}

function aggregateOddProgress(state: SidebarViewModel): {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
} {
  return (state.odd?.features ?? []).reduce(
    (total, feature) => ({
      total: total.total + feature.progress.total,
      done: total.done + feature.progress.done,
      inProgress: total.inProgress + feature.progress.in_progress,
      blocked: total.blocked + feature.progress.blocked,
    }),
    { total: 0, done: 0, inProgress: 0, blocked: 0 },
  );
}

export default createPiEngramExtension();

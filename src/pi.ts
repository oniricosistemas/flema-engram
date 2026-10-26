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
import {
  attachGentleShellRailPanel,
  createPiSidebarPanel,
  type GentleShellRailAttachment,
  type PiSidebarPanel,
  type PiSidebarTheme,
  type PiSidebarTui,
} from "./pi/sidebar.js";

const UI_KEY = "flema-engram";
const REFRESH_COMMAND = "engram-refresh";
const SIDEBAR_COMMAND = "engram-sidebar";
const SIDEBAR_COLLAPSE_COMMAND = "engram-sidebar-collapse";
const WIDGET_COMMAND = "engram-widget";
const MEMORY_SAVE_TOOLS = new Set(["mem_save", "save_memory"]);

export interface PiExtensionOverlayHandle {
  setHidden: (hidden: boolean) => void;
  isHidden?: () => boolean;
}

export interface PiExtensionUi {
  setStatus: (key: string, value: string | undefined) => void;
  setWidget: (
    key: string,
    value: string[] | undefined,
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ) => void;
  notify: (message: string, level?: "info" | "warning" | "error") => void;
  custom?: (
    factory: (
      tui: PiSidebarTui,
      theme: PiSidebarTheme,
      keybindings: unknown,
      done: (value: unknown) => void,
    ) => PiSidebarPanel | Promise<PiSidebarPanel>,
    options: {
      overlay: true;
      overlayOptions: {
        anchor: "bottom-right";
        width: number;
        minWidth: number;
        maxHeight: string;
        margin: { right: number; bottom: number };
        nonCapturing: true;
        visible: (terminalWidth: number, terminalHeight: number) => boolean;
      };
      onHandle: (handle: PiExtensionOverlayHandle) => void;
    },
  ) => Promise<unknown>;
}

export interface PiExtensionContext {
  cwd: string;
  hasUI: boolean;
  mode?: "tui" | "rpc" | "json" | "print";
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
  widgetVisible: boolean;
}

interface SidebarPresentation {
  token: symbol;
  visible: boolean;
  collapsed: boolean;
  panel?: PiSidebarPanel;
  rail?: GentleShellRailAttachment;
  handle?: PiExtensionOverlayHandle;
  finish?: () => void;
}

export function createPiEngramExtension(
  dependencies: PiEngramExtensionDependencies = {},
): (pi: PiExtensionApi) => void {
  const createAdapter = dependencies.createAdapter ?? (() => createConfiguredAdapter());
  const resolveProject = dependencies.resolveProject
    ?? ((adapter, cwd) => resolveValidatedProject(adapter, cwd));

  return (pi) => {
    let active: ActiveViewer | undefined;
    let presentation: SidebarPresentation | undefined;
    let sessionToken: symbol | undefined;

    const clearUi = (context: PiExtensionContext): void => {
      if (!context.hasUI) return;
      context.ui.setStatus(UI_KEY, undefined);
      context.ui.setWidget(UI_KEY, undefined);
    };

    const syncPresentation = (current: SidebarPresentation): void => {
      current.rail?.setVisible(current.visible);
      current.rail?.invalidate();
      current.handle?.setHidden(!current.visible || current.rail?.isActive() === true);
    };

    const stopPresentation = (): void => {
      const current = presentation;
      presentation = undefined;
      if (!current) return;
      current.rail?.dispose();
      current.finish?.();
    };

    const stopActive = (): void => {
      stopPresentation();
      if (!active) return;
      active.controller.dispose();
      clearUi(active.context);
      active = undefined;
    };

    const mountSidebar = (
      context: PiExtensionContext,
      token: symbol,
      getState: () => SidebarViewModel,
    ): void => {
      if (context.mode !== "tui" || !context.ui.custom) return;
      const current: SidebarPresentation = {
        token,
        visible: true,
        collapsed: false,
      };
      presentation = current;

      void context.ui.custom(
        (tui, theme, _keybindings, done) => {
          const panel = createPiSidebarPanel(tui, theme, getState());
          panel.setCollapsed(current.collapsed);
          if (presentation?.token !== token) {
            done(undefined);
            return panel;
          }
          current.finish = () => done(undefined);
          current.panel = panel;
          current.rail = attachGentleShellRailPanel(tui, panel);
          syncPresentation(current);
          return panel;
        },
        {
          overlay: true,
          overlayOptions: {
            anchor: "bottom-right",
            width: 48,
            minWidth: 29,
            maxHeight: "70%",
            margin: { right: 2, bottom: 1 },
            nonCapturing: true,
            visible: (terminalWidth) =>
              current.visible && current.rail?.isActive() !== true && terminalWidth >= 100,
          },
          onHandle: (handle) => {
            current.handle = handle;
            syncPresentation(current);
          },
        },
      ).catch(() => {
        if (presentation?.token === token) {
          context.ui.notify("Engram sidebar unavailable", "warning");
        }
      }).finally(() => {
        current.rail?.dispose();
        if (presentation?.token === token) presentation = undefined;
      });
    };

    const renderUnavailable = (context: PiExtensionContext): void => {
      context.ui.setStatus(UI_KEY, "Engram unavailable");
      context.ui.setWidget(UI_KEY, undefined);
    };

    const refreshActive = async (): Promise<SidebarRefreshOutcome | undefined> => {
      const current = active;
      if (!current) return undefined;
      const outcome = await current.controller.refresh();
      return active?.token === current.token ? outcome : undefined;
    };

    pi.on("session_start", async (_event, context) => {
      stopActive();
      const token = Symbol("pi-engram-session");
      sessionToken = token;
      if (!context.hasUI) return;

      try {
        const adapter = createAdapter();
        const controller = createEngramReadController(adapter, {
          resolveProject: () => resolveProject(adapter, context.cwd),
          onState: (state) => {
            if (active?.token !== token) return;
            renderState(context, state, active.widgetVisible);
            if (presentation?.token === token) {
              presentation.panel?.setState(state);
              presentation.rail?.invalidate();
            }
          },
        });
        active = { controller, context, token, widgetVisible: false };
        mountSidebar(context, token, controller.getState);
        await refreshActive();
      } catch {
        if (sessionToken !== token) return;
        stopActive();
        renderUnavailable(context);
      }
    });

    pi.on("tool_result", async (event, _context) => {
      if (!isPiToolResultEvent(event) || event.isError || !MEMORY_SAVE_TOOLS.has(event.toolName)) return;
      await refreshActive();
    });

    pi.on("session_shutdown", (_event, _context) => {
      sessionToken = undefined;
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

    pi.registerCommand(SIDEBAR_COMMAND, {
      description: "Show or hide the Flema Engram sidebar",
      handler: async (_args, context) => {
        if (!active || !presentation) {
          context.ui.notify("Engram sidebar is not active", "warning");
          return;
        }
        presentation.visible = !presentation.visible;
        syncPresentation(presentation);
        context.ui.notify(`Engram sidebar ${presentation.visible ? "shown" : "hidden"}`, "info");
      },
    });

    pi.registerCommand(SIDEBAR_COLLAPSE_COMMAND, {
      description: "Collapse or expand the Flema Engram sidebar",
      handler: async (_args, context) => {
        if (!active || !presentation) {
          context.ui.notify("Engram sidebar is not active", "warning");
          return;
        }
        presentation.collapsed = !presentation.collapsed;
        presentation.panel?.setCollapsed(presentation.collapsed);
        presentation.rail?.invalidate();
        context.ui.notify(`Engram sidebar ${presentation.collapsed ? "collapsed" : "expanded"}`, "info");
      },
    });

    pi.registerCommand(WIDGET_COMMAND, {
      description: "Show or hide the compact Flema Engram widget for this session",
      handler: async (_args, context) => {
        if (!active) {
          context.ui.notify("Engram viewer is not active", "warning");
          return;
        }
        active.widgetVisible = !active.widgetVisible;
        renderState(active.context, active.controller.getState(), active.widgetVisible);
        context.ui.notify(`Engram widget ${active.widgetVisible ? "shown" : "hidden"}`, "info");
      },
    });
  };
}

function isPiToolResultEvent(event: Record<string, unknown>): event is Record<string, unknown> & PiToolResultEvent {
  return typeof event.toolName === "string" && typeof event.isError === "boolean";
}

function renderState(
  context: PiExtensionContext,
  state: SidebarViewModel,
  widgetVisible = false,
): void {
  const health = state.health.toUpperCase();
  const project = state.projectName ?? "unresolved project";
  const progress = aggregateOddProgress(state);
  const blockerCount = state.blockers.length + progress.blocked;
  const statusParts = [`Engram ${health}`, project];
  if (progress.total > 0) statusParts.push(`ODD ${progress.done}/${progress.total}`);
  if (blockerCount > 0) statusParts.push(`${blockerCount} blocked`);
  context.ui.setStatus(UI_KEY, statusParts.join(" · "));

  if (!widgetVisible) {
    context.ui.setWidget(UI_KEY, undefined);
    return;
  }

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

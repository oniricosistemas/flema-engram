/** @vitest-environment node */
/** @jsxImportSource @opentui/solid */

import { describe, expect, it, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";
import type {
  TuiPluginApi,
  TuiPluginMeta,
  TuiSlotPlugin,
} from "@opencode-ai/plugin/tui";
import type {
  EngramAdapter,
  HealthStatus,
  Observation,
  Project,
  Session,
} from "../../../src/adapters/types.js";
import {
  createEngramTuiPlugin,
  createSidebarTextAccessor,
  createSidebarSectionAccessors,
  createSidebarActionRegistry,
  describeSidebar,
  handleSidebarKey,
  REFRESH_SHORTCUT,
  renderSidebarSafely,
  type EngramSidebarProps,
} from "../../../src/sidebar/plugin.js";
import { createActivityFeedView } from "../../../src/sidebar/components/activity-feed.js";
import { createBlockersView } from "../../../src/sidebar/components/blockers.js";
import { createPhaseProgressView } from "../../../src/sidebar/components/phase-progress.js";
import { createProjectListView } from "../../../src/sidebar/components/project-list.js";
import { reduceSidebarRefresh, type SidebarViewModel } from "../../../src/sidebar/hooks/use-engram.js";
import type { SidebarRefreshOutcome } from "../../../src/sidebar/hooks/use-engram.js";
import { groupByChange, collectBlockers } from "../../../src/utils/sdd-detector.js";

function observation(overrides: Partial<Observation>): Observation {
  return {
    id: 1,
    type: "architecture",
    title: "Apply sidebar",
    topic_key: "sdd/mcp-flema-engram/apply-progress",
    content: "Slice 4 is active",
    project: "mcp-flema-engram",
    scope: "project",
    updated_at: "2026-08-30T19:00:00.000Z",
    created_at: "2026-08-30T19:00:00.000Z",
    ...overrides,
  };
}

function adapter(overrides: Partial<EngramAdapter> = {}): EngramAdapter {
  return {
    health: vi.fn().mockResolvedValue({
      local: { available: true, version: "1.15.3" },
    } satisfies HealthStatus),
    listProjects: vi.fn().mockResolvedValue([
      {
        name: "mcp-flema-engram",
        observationCount: 2,
        lastActiveAt: "2026-08-30T19:00:00.000Z",
        scopes: ["project"],
      },
    ] satisfies Project[]),
    listObservations: vi.fn().mockResolvedValue([
      observation({}),
      observation({
        id: 2,
        type: "blocker",
        title: "Blocked by host API",
        topic_key: "notes/sidebar",
        content: "Status: blocked",
      }),
    ]),
    getObservation: vi.fn().mockResolvedValue(null),
    searchObservations: vi.fn().mockResolvedValue([] satisfies Observation[]),
    listSessions: vi.fn().mockResolvedValue([] satisfies Session[]),
    getSession: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

type RegisteredKeymapLayer = {
  mode?: string;
  commands: Array<{ name: string; run: () => unknown }>;
  bindings: Array<{ key: string; cmd: string; desc?: string }>;
};

async function registerHost(
  plugin = createEngramTuiPlugin({ adapter: adapter(), cwd: "/work/mcp-flema-engram" }),
  options?: Record<string, unknown>,
  route: { name: "home" } | { name: "session"; params: { sessionID: string } } | (() => { name: "home" } | { name: "session"; params: { sessionID: string } }) = {
    name: "session",
    params: { sessionID: "test" },
  },
): Promise<{ slot?: TuiSlotPlugin; layer?: RegisteredKeymapLayer }> {
  let registered: TuiSlotPlugin | undefined;
  let layer: RegisteredKeymapLayer | undefined;
  const api = {
    route: { get current() { return typeof route === "function" ? route() : route; } },
    keymap: {
      registerLayer(candidate: RegisteredKeymapLayer) {
        layer = candidate;
        return vi.fn();
      },
    },
    slots: {
      register(slot: TuiSlotPlugin) {
        registered = slot;
        return "engram-test-slot";
      },
    },
  } as unknown as TuiPluginApi;

  await plugin.tui(api, options, {
    id: "engram-sidebar",
    source: "file",
    spec: "./src/sidebar/plugin.tsx",
    target: "./src/sidebar/plugin.tsx",
    state: "first",
    first_time: 0,
    last_time: 0,
    time_changed: 0,
    load_count: 1,
    fingerprint: "test",
  } satisfies TuiPluginMeta);

  return { slot: registered, layer };
}

async function register(
  plugin = createEngramTuiPlugin({ adapter: adapter(), cwd: "/work/mcp-flema-engram" }),
  options?: Record<string, unknown>,
): Promise<TuiSlotPlugin | undefined> {
  return (await registerHost(plugin, options)).slot;
}

describe("official OpenCode TUI plugin", () => {
  it("updates actual child view accessors after async load and a modified refresh", async () => {
    const refreshedActivity = [
      observation({ id: 3, title: "Refreshed apply", updated_at: "2026-09-01T12:01:00.000Z" }),
      observation({
        id: 4,
        type: "blocker",
        title: "Refreshed blocker",
        topic_key: "notes/sidebar-refresh",
        content: "Status: blocked",
        updated_at: "2026-09-01T12:02:00.000Z",
      }),
    ];
    const loadedProject: Project = {
      name: "mcp-flema-engram",
      observationCount: 99,
      lastActiveAt: "2026-09-01T12:02:00.000Z",
      scopes: ["project"],
    };
    const initialState: SidebarViewModel = {
      projectName: "mcp-flema-engram",
      changes: [],
      blockers: [],
      recentActivity: [],
      health: "loading",
      loading: true,
    };
    // OpenTUI's native test renderer cannot load its FFI in this Windows Node runtime.
    // Exercise the same view accessors consumed by each rendered <For> instead.
    const reactive = createRoot((dispose) => {
      const [state, setState] = createSignal(initialState);
      const sections = createSidebarSectionAccessors(state);
      return {
        dispose,
        state,
        setState,
        projectView: createProjectListView(sections.project),
        phaseView: createPhaseProgressView(sections.changes),
        blockersView: createBlockersView(sections.blockers),
        activityView: createActivityFeedView(sections.activity),
        sidebarLines: () => describeSidebar(state()),
      };
    });
    const visibleLines = () => [
      ...reactive.projectView(),
      ...reactive.phaseView(),
      ...reactive.blockersView.lines(),
      ...reactive.activityView(),
    ];

    expect(visibleLines()).toContain("  🗂️ No indexed observations yet.");
    expect(visibleLines()).toContain("    💤 No recent activity.");
    expect(visibleLines()).toContain("📁 Project: mcp-flema-engram");
    expect(reactive.sidebarLines()).toContain("⚠️ Health: CHECKING");

    await Promise.resolve();
    reactive.setState((current) => reduceSidebarRefresh(current, {
      health: { local: { available: true } },
      projects: [loadedProject],
      observations: [observation({})],
      projectName: "mcp-flema-engram",
      warnings: ["Project index unavailable"],
      now: new Date("2026-09-01T12:01:00.000Z"),
    }));

    expect(visibleLines()).toContain("  🗂️ Indexed observations: 1");
    expect(visibleLines()).toContain("📁 Project: mcp-flema-engram");
    expect(visibleLines()).toContain("    • mcp-flema-engram: in-progress (apply)");
    expect(visibleLines()).toContain("    • Apply sidebar");
    expect(reactive.sidebarLines()).toContain("🟢 Health: OK");
    expect(reactive.sidebarLines()).toContain("⚠️ Detail: Project index unavailable");

    const actionRegistry = createSidebarActionRegistry();
    actionRegistry.activate({
      refresh: async () => {
        await Promise.resolve();
        reactive.setState((current) => reduceSidebarRefresh(current, {
          health: { local: { available: true } },
          projects: [loadedProject],
          observations: refreshedActivity,
          projectName: "mcp-flema-engram",
          now: new Date("2026-09-01T12:02:00.000Z"),
        }));
      },
      setStatus: vi.fn(),
    });

    expect(await actionRegistry.run(REFRESH_SHORTCUT)).toBe(true);
    expect(visibleLines()).toContain("  🗂️ Indexed observations: 2");
    expect(visibleLines()).toContain("    • Refreshed apply");
    expect(visibleLines()).toContain("    • Refreshed blocker");
    reactive.dispose();
  });

  it("shows an honest checking label before the first health response", () => {
    const lines = describeSidebar({
      changes: [],
      blockers: [],
      recentActivity: [],
      health: "loading",
      loading: true,
    });

    expect(lines).toContain("⚠️ Health: CHECKING");
    expect(lines.join("\n")).not.toContain("ERROR");
    expect(lines.join("\n")).not.toContain("OFFLINE");
  });

  it("maps every loading stage to its user-facing status", () => {
    const stages = [
      [undefined, "starting refresh"],
      ["mounted", "starting refresh"],
      ["refresh", "starting refresh"],
      ["project-resolution", "project resolution"],
      ["health", "health"],
      ["projects", "projects"],
      ["filtered-observations", "observations"],
      ["fallback-observations", "observations"],
      ["reducing", "reducing"],
      ["terminal", "starting refresh"],
    ] as const;

    for (const [stage, label] of stages) {
      const terminal = stage === undefined
        ? {}
        : { terminal: { status: "loading" as const, stage, health: "loading" as const, observationCount: 0 } };
      const lines = describeSidebar({
        changes: [], blockers: [], recentActivity: [], health: "loading", loading: true,
        ...terminal,
      });
      expect(lines).toContain(`⏳ Loading: ${label} (5s per request; no ETA).`);
    }
  });

  it("registers only the supported sidebar_content slot", async () => {
    const slot = await register();

    expect(slot?.slots.sidebar_content).toEqual(expect.any(Function));
    expect(Object.keys(slot?.slots ?? {})).toEqual(["sidebar_content"]);
  });

  it("auto-refreshes the visible slot exactly once through its mounted action owner", async () => {
    const registry = createSidebarActionRegistry();
    const refresh = vi.fn();
    let visibleText = "";
    const plugin = createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry: registry,
      renderSidebar: (props) => {
        const [state, setState] = createSignal<SidebarViewModel>({
          projectName: "mcp-flema-engram",
          changes: [], blockers: [], recentActivity: [], health: "loading", loading: true,
        });
        const text = createSidebarTextAccessor(state, () => undefined);
        refresh.mockImplementation(async () => {
          setState((current) => reduceSidebarRefresh(current, {
            health: { local: { available: true } },
            projects: [{ name: "mcp-flema-engram", observationCount: 2, lastActiveAt: "2026-09-01T12:00:00.000Z", scopes: ["project"] }],
            observations: [observation({}), observation({ id: 2, type: "blocker", title: "Native blocker", content: "Status: blocked" })],
            projectName: "mcp-flema-engram",
            now: new Date("2026-09-01T12:00:00.000Z"),
          }));
          visibleText = text();
          return successfulOutcome();
        });
        props.actionMount?.activate({ refresh, state, setStatus: vi.fn() });
        return null as never;
      },
    });
    const { slot } = await registerHost(plugin, undefined, {
      name: "session",
      params: { sessionID: "visible" },
    });

    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());

    expect(visibleText).toContain("🟢 Health: OK");
    expect(visibleText).toContain("🗂️ Indexed observations: 2");
    expect(visibleText).toContain("📊 SDD Progress");
    expect(visibleText).toContain("Native blocker");
    expect(visibleText).toContain("📝 Recent Activity");
  });

  it("starts one initial refresh from mounted slot identity while the route is briefly home", async () => {
    const registry = createSidebarActionRegistry();
    let route: { name: "home" } | { name: "session"; params: { sessionID: string } } = { name: "home" };
    let finishRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    const refresh = vi.fn();
    let visibleText = () => "";
    const plugin = createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry: registry,
      renderSidebar: (props) => {
        const [state, setState] = createSignal<SidebarViewModel>({
          projectName: "mcp-flema-engram",
          changes: [], blockers: [], recentActivity: [], health: "loading", loading: true,
          terminal: { status: "loading", stage: "mounted", health: "loading", observationCount: 0 },
        });
        visibleText = createSidebarTextAccessor(state, () => undefined);
        refresh.mockImplementation(async () => {
          setState((current) => ({
            ...current,
            terminal: { status: "loading", stage: "health", health: "loading", observationCount: 0 },
          }));
          await refreshGate;
          setState((current) => reduceSidebarRefresh(current, {
            health: { local: { available: true } },
            projects: [{
              name: "mcp-flema-engram",
              observationCount: 0,
              lastActiveAt: "2026-09-01T12:00:00.000Z",
              scopes: ["project"],
            }],
            observations: [],
            projectName: "mcp-flema-engram",
            now: new Date("2026-09-01T12:00:00.000Z"),
          }));
          return successfulOutcome();
        });
        props.actionMount?.activate({ refresh, state, setStatus: vi.fn() });
        return null as never;
      },
    });
    const { slot } = await registerHost(plugin, undefined, () => route);

    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());

    expect(visibleText()).toContain("⏳ Loading: health");
    expect(visibleText()).toContain("5s per request; no ETA");

    route = { name: "session", params: { sessionID: "visible" } };
    finishRefresh?.();
    await vi.waitFor(() => expect(visibleText()).toContain("🟢 Health: OK"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(refresh).toHaveBeenCalledOnce();
    expect(registry.current("visible")?.state?.().terminal).toMatchObject({
      status: "success",
      stage: "terminal",
    });
    expect(visibleText()).not.toContain("Health: CHECKING");
  });

  it("refreshes only the newest mounted slot while the route is briefly home", async () => {
    const registry = createSidebarActionRegistry();
    const refreshes: Array<ReturnType<typeof vi.fn>> = [];
    const plugin = createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry: registry,
      renderSidebar: (props) => {
        const refresh = vi.fn().mockResolvedValue(successfulOutcome());
        refreshes.push(refresh);
        props.actionMount?.activate(actionDependencies(refresh));
        return null as never;
      },
    });
    const { slot } = await registerHost(plugin, undefined, { name: "home" });

    slot?.slots.sidebar_content({} as never, { session_id: "hidden" });
    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    await vi.waitFor(() => expect(refreshes[2]).toHaveBeenCalledOnce());

    expect(refreshes[0]).not.toHaveBeenCalled();
    expect(refreshes[1]).not.toHaveBeenCalled();
    expect(refreshes.flatMap((refresh) => refresh.mock.calls)).toHaveLength(1);
    expect(registry.current("visible")?.refresh).toBe(refreshes[2]);
  });

  it("lets only the latest remount own the session's automatic refresh", async () => {
    const registry = createSidebarActionRegistry();
    const refreshes: Array<ReturnType<typeof vi.fn>> = [];
    const cleanups: Array<() => void> = [];
    const plugin = createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry: registry,
      renderSidebar: (props) => {
        const refresh = vi.fn().mockResolvedValue(successfulOutcome());
        refreshes.push(refresh);
        cleanups.push(props.actionMount!.activate(actionDependencies(refresh)));
        return null as never;
      },
    });
    const { slot } = await registerHost(plugin, undefined, {
      name: "session",
      params: { sessionID: "visible" },
    });

    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    cleanups[0]?.();
    await vi.waitFor(() => expect(refreshes[1]).toHaveBeenCalledOnce());

    expect(refreshes[0]).not.toHaveBeenCalled();
    expect(registry.current("visible")?.refresh).toBe(refreshes[1]);
  });

  it("does not let a hidden slot auto-refresh or replace the visible mounted state", async () => {
    const registry = createSidebarActionRegistry();
    const refreshBySession = new Map<string, ReturnType<typeof vi.fn>>();
    const plugin = createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry: registry,
      renderSidebar: (props) => {
        const refresh = vi.fn().mockResolvedValue(successfulOutcome());
        refreshBySession.set(props.sessionId!, refresh);
        props.actionMount?.activate(actionDependencies(refresh));
        return null as never;
      },
    });
    const { slot } = await registerHost(plugin, undefined, {
      name: "session",
      params: { sessionID: "visible" },
    });

    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    slot?.slots.sidebar_content({} as never, { session_id: "hidden" });
    await vi.waitFor(() => expect(refreshBySession.get("visible")).toHaveBeenCalledOnce());

    expect(refreshBySession.get("hidden")).not.toHaveBeenCalled();
    expect(registry.current("visible")?.refresh).toBe(refreshBySession.get("visible"));
  });

  it("settles a failed slot startup through the same truthful action path", async () => {
    const registry = createSidebarActionRegistry();
    const setStatus = vi.fn();
    let visibleText = "";
    const refresh = vi.fn();
    const plugin = createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry: registry,
      renderSidebar: (props) => {
        const [state, setState] = createSignal<SidebarViewModel>({
          projectName: "mcp-flema-engram",
          changes: [], blockers: [], recentActivity: [], health: "loading", loading: true,
        });
        const text = createSidebarTextAccessor(state, () => undefined);
        refresh.mockImplementation(async () => {
          const failure = { stage: "health" as const, endpoint: "/health", reason: new Error("connection refused") };
          setState((current) => reduceSidebarRefresh(current, {
            projectName: "mcp-flema-engram",
            failures: [failure],
            now: new Date("2026-09-01T12:00:00.000Z"),
          }));
          visibleText = text();
          return {
            status: "failed",
            summary: "health /health: connection refused",
            failures: [failure],
            warnings: [],
            stages: [],
          } satisfies SidebarRefreshOutcome;
        });
        props.actionMount?.activate({ refresh, state, setStatus });
        return null as never;
      },
    });
    const { slot } = await registerHost(plugin, undefined, {
      name: "session",
      params: { sessionID: "visible" },
    });

    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());

    expect(setStatus).toHaveBeenNthCalledWith(1, "🔄 Refreshing…");
    expect(setStatus).toHaveBeenNthCalledWith(2, "⚠️ Refresh incomplete: health /health: connection refused");
    expect(visibleText).toContain("💔 Health: OFFLINE");
    expect(visibleText).not.toContain("Health: CHECKING");
  });

  it("does not register when disabled by OpenCode plugin options", async () => {
    const { slot, layer } = await registerHost(undefined, { enabled: false });

    expect(slot).toBeUndefined();
    expect(layer).toBeUndefined();
  });

  it("ignores obsolete debug options without creating logs or exposing debug props", async () => {
    let received: EngramSidebarProps | undefined;
    const createDebugLog = vi.fn();
    const slot = await register(createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      createDebugLog,
      renderSidebar: (props) => {
        received = props;
        return null as never;
      },
    } as never), { debug: true, debugLogPath: "D:\\logs\\engram-sidebar.jsonl" });

    slot?.slots.sidebar_content({} as never, { session_id: "debug" });

    expect(createDebugLog).not.toHaveBeenCalled();
    expect(received).not.toHaveProperty("debug");
    expect(received).not.toHaveProperty("debugLogPath");
    expect(received).not.toHaveProperty("debugLog");
  });

  it("registers only a non-text base-mode refresh binding through the official host keymap", async () => {
    const { layer } = await registerHost();

    expect(layer?.mode).toBe("base");
    expect(layer?.bindings).toEqual([
      { key: REFRESH_SHORTCUT, cmd: "engram.refresh", desc: "Refresh Engram sidebar" },
    ]);
    expect(layer?.bindings.some((binding) => binding.key === "r")).toBe(false);
    expect(layer?.commands.map((command) => command.name)).toEqual(["engram.refresh"]);
  });

  it("leaves bare prompt letters untouched and dispatches only the modified refresh shortcut", async () => {
    const actionRegistry = createSidebarActionRegistry();
    const refresh = vi.fn().mockResolvedValue(successfulOutcome());
    const setStatus = vi.fn();
    actionRegistry.activate({ ...actionDependencies(refresh), setStatus }, "test");
    const { layer } = await registerHost(createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry,
    }));
    let input = "";

    const dispatchKey = async (key: string) => {
      const binding = layer?.bindings.find((candidate) => candidate.key === key);
      if (!binding) {
        input += key;
        return false;
      }
      const command = layer?.commands.find((candidate) => candidate.name === binding.cmd);
      await command?.run();
      return true;
    };

    for (const key of "mira como estamos recargando") {
      expect(await dispatchKey(key)).toBe(false);
    }
    expect(input).toBe("mira como estamos recargando");
    expect(refresh).not.toHaveBeenCalled();

    expect(await dispatchKey(REFRESH_SHORTCUT)).toBe(true);
    expect(input).toBe("mira como estamos recargando");
    expect(refresh).toHaveBeenCalledOnce();
    expect(setStatus).toHaveBeenNthCalledWith(1, "🔄 Refreshing…");
    expect(setStatus).toHaveBeenNthCalledWith(2, "✅ Refreshed");
  });

  it("shows a truthful warning when Alt+R completes with a partial refresh", async () => {
    const setStatus = vi.fn();
    const refresh = vi.fn().mockResolvedValue({
      status: "partial",
      summary: "observations /observations/recent: timed out after 10ms",
      failures: [{ stage: "observations", endpoint: "/observations/recent", reason: new Error("timed out after 10ms") }],
      warnings: [],
      stages: [],
    } satisfies SidebarRefreshOutcome);

    expect(await handleSidebarKey(REFRESH_SHORTCUT, {
      refresh,
      setStatus,
      state: () => ({
        changes: [], blockers: [], recentActivity: [], health: "stale", loading: false,
        terminal: { status: "partial", stage: "terminal", health: "stale", observationCount: 0 },
      }),
      isCurrent: () => true,
    })).toBe(true);
    expect(setStatus).toHaveBeenNthCalledWith(1, "🔄 Refreshing…");
    expect(setStatus).toHaveBeenNthCalledWith(
      2,
      "⚠️ Refresh incomplete: observations /observations/recent: timed out after 10ms",
    );
    expect(setStatus).not.toHaveBeenCalledWith("✅ Refreshed");
  });

  it("keeps only the current sidebar action dependencies active", async () => {
    const registry = createSidebarActionRegistry();
    const firstRefresh = vi.fn().mockResolvedValue(undefined);
    const secondRefresh = vi.fn().mockResolvedValue(undefined);
    const firstCleanup = registry.activate({
      refresh: firstRefresh,
      setStatus: vi.fn(),
    });
    const secondCleanup = registry.activate({
      refresh: secondRefresh,
      setStatus: vi.fn(),
    });

    firstCleanup();
    expect(await registry.run(REFRESH_SHORTCUT)).toBe(true);
    expect(firstRefresh).not.toHaveBeenCalled();
    expect(secondRefresh).toHaveBeenCalledOnce();

    secondCleanup();
    expect(await registry.run(REFRESH_SHORTCUT)).toBe(false);
  });

  it("binds rendering and Alt+R to the identical current session state accessor", async () => {
    const registry = createSidebarActionRegistry();
    const reactive = createRoot((dispose) => {
      const [state, setState] = createSignal<SidebarViewModel>({
        projectName: "nukestats",
        changes: [],
        blockers: [],
        recentActivity: [],
        health: "loading",
        loading: true,
        terminal: { status: "loading", stage: "mounted", health: "loading", observationCount: 0 },
      });
      return {
        dispose,
        state,
        setState,
        text: createSidebarTextAccessor(state, () => undefined),
      };
    });
    const refresh = vi.fn(async () => {
      reactive.setState((current) => reduceSidebarRefresh(current, {
        health: { local: { available: true } },
        projects: [{ name: "nukestats", observationCount: 20, lastActiveAt: "2026-09-01T12:00:00.000Z", scopes: ["project"] }],
        observations: Array.from({ length: 20 }, (_, index) => observation({ id: index + 1, project: "nukestats", title: `Activity ${index + 1}` })),
        projectName: "nukestats",
        now: new Date("2026-09-01T12:00:00.000Z"),
      }));
      return successfulOutcome();
    });
    registry.activate({ state: reactive.state, refresh, setStatus: vi.fn() }, "visible-session");

    expect(registry.current("visible-session")?.state).toBe(reactive.state);
    expect(await registry.run(REFRESH_SHORTCUT, "visible-session")).toBe(true);
    expect(reactive.text()).toContain("🟢 Health: OK");
    expect(reactive.text()).toContain("🗂️ Indexed observations: 20");
    expect(reactive.text()).toContain("• Activity 20");
    expect(reactive.text()).not.toContain("terminal=");
    reactive.dispose();
  });

  it("routes Alt+R to the latest mounted slot even when an older slot activates later", async () => {
    const registry = createSidebarActionRegistry();
    const refreshBySession = new Map<string, ReturnType<typeof vi.fn>>();
    const rendered: EngramSidebarProps[] = [];
    const plugin = createEngramTuiPlugin({
      adapter: adapter(),
      cwd: "/work/mcp-flema-engram",
      actionRegistry: registry,
      renderSidebar: (props) => {
        const session = String(refreshBySession.size + 1);
        const refresh = vi.fn().mockResolvedValue(undefined);
        refreshBySession.set(session, refresh);
        rendered.push(props);
        return null as never;
      },
    });
    const { slot, layer } = await registerHost(plugin, undefined, {
      name: "session",
      params: { sessionID: "visible" },
    });

    slot?.slots.sidebar_content({} as never, { session_id: "old" });
    slot?.slots.sidebar_content({} as never, { session_id: "visible" });
    rendered[1]?.actionRegistry.activate(actionDependencies(refreshBySession.get("2")!), rendered[1].sessionId);
    rendered[0]?.actionRegistry.activate(actionDependencies(refreshBySession.get("1")!), rendered[0].sessionId);
    await layer?.commands[0]?.run();

    expect(refreshBySession.get("1")).not.toHaveBeenCalled();
    expect(refreshBySession.get("2")).toHaveBeenCalledOnce();
  });

  it("keeps a remounted session active when the superseded instance cleans up", async () => {
    const registry = createSidebarActionRegistry();
    const owner = "same-session";
    const oldRefresh = vi.fn().mockResolvedValue(undefined);
    const currentRefresh = vi.fn().mockResolvedValue(undefined);
    const cleanupOld = registry.activate(actionDependencies(oldRefresh), owner);
    registry.activate(actionDependencies(currentRefresh), owner);

    cleanupOld();
    expect(await registry.run(REFRESH_SHORTCUT, owner)).toBe(true);
    expect(oldRefresh).not.toHaveBeenCalled();
    expect(currentRefresh).toHaveBeenCalledOnce();
  });

  it("routes by the current session and cannot leave a visible remount stale", async () => {
    const registry = createSidebarActionRegistry();
    const hidden = actionDependencies(vi.fn().mockResolvedValue(successfulOutcome()));
    const stale = actionDependencies(vi.fn().mockResolvedValue(successfulOutcome()));
    const visible = actionDependencies(vi.fn().mockResolvedValue(successfulOutcome()));
    registry.activate(hidden, "hidden-session");
    const cleanupStale = registry.activate(stale, "visible-session");
    registry.activate(visible, "visible-session");

    cleanupStale();
    expect(await registry.run(REFRESH_SHORTCUT, "visible-session")).toBe(true);
    expect(hidden.refresh).not.toHaveBeenCalled();
    expect(stale.refresh).not.toHaveBeenCalled();
    expect(visible.refresh).toHaveBeenCalledOnce();
  });

  it("does not claim Alt+R success after the visible route changes", async () => {
    const registry = createSidebarActionRegistry();
    let visibleSession = "first-session";
    const setStatus = vi.fn();
    const dependencies = actionDependencies(vi.fn(async () => {
      visibleSession = "second-session";
      return successfulOutcome();
    }));
    registry.activate({ ...dependencies, setStatus }, "first-session");

    expect(await registry.run(
      REFRESH_SHORTCUT,
      "first-session",
      () => visibleSession,
    )).toBe(true);
    expect(setStatus).toHaveBeenNthCalledWith(1, "🔄 Refreshing…");
    expect(setStatus).toHaveBeenNthCalledWith(2, "⚠️ Refresh incomplete: stage=terminal");
    expect(setStatus).not.toHaveBeenCalledWith("✅ Refreshed");
  });

  it("registers the sidebar with an explicit startup resolution failure", async () => {
    const localAdapter = adapter({
      listProjects: vi.fn().mockRejectedValue(new Error("project endpoint unavailable")),
    });
    let received: EngramSidebarProps | undefined;

    const { slot, layer } = await registerHost(createEngramTuiPlugin({
      adapter: localAdapter,
      cwd: "/work/mcp-flema-engram",
      renderSidebar: (props) => {
        received = props;
        return null as never;
      },
    }));
    slot?.slots.sidebar_content({} as never, { session_id: "failed-startup" });

    expect(slot?.slots.sidebar_content).toEqual(expect.any(Function));
    expect(layer?.bindings[0]?.key).toBe(REFRESH_SHORTCUT);
    expect(received?.projectName).toBeUndefined();
    expect(received?.projectResolution).toMatchObject({ validation: "offline" });
    expect(received?.initialError).toContain("project validation was unavailable during startup");
  });

  it("renders project as the parent of indented sidebar categories with refresh only", async () => {
    const activity = [
      observation({}),
      observation({ id: 2, type: "blocker", title: "Blocked by host API", topic_key: "notes/sidebar", content: "Status: blocked" }),
    ];
    const lines = describeSidebar({
      projectName: "mcp-flema-engram",
      project: {
        name: "mcp-flema-engram",
        observationCount: 2,
        lastActiveAt: "2026-08-30T19:00:00.000Z",
        scopes: ["project"],
      },
      changes: groupByChange(activity),
      blockers: collectBlockers(activity),
      recentActivity: activity,
      health: "ok",
      loading: false,
    });

    expect(lines).toContain("🟢 Health: OK");
    expect(lines).toContain("📁 Project: mcp-flema-engram");
    expect(lines).toContain("  🗂️ Indexed observations: 2");
    expect(lines).toContain("  📊 SDD Progress");
    expect(lines).toContain("    • mcp-flema-engram: in-progress (apply)");
    expect(lines).toContain("  🚧 Blockers");
    expect(lines).toContain("    • Blocked by host API");
    expect(lines).toContain("  📝 Recent Activity");
    expect(lines).toContain(`🔄 [${REFRESH_SHORTCUT}] Refresh`);
    expect(lines.join("\n")).not.toContain("Dashboard");
  });

  it("preserves useful indented empty states for every project category", () => {
    const lines = describeSidebar({
      projectName: "mcp-flema-engram",
      project: {
        name: "mcp-flema-engram",
        observationCount: 0,
        lastActiveAt: "2026-08-31T12:00:00.000Z",
        scopes: ["project"],
      },
      changes: [],
      blockers: [],
      recentActivity: [],
      health: "error",
      loading: false,
    });

    expect(lines).toEqual([
      "🧠 Engram",
      "💔 Health: ERROR",
      "📁 Project: mcp-flema-engram",
      "  🗂️ Indexed observations: 0",
      "  📊 SDD Progress",
      "    ℹ️ No active SDD changes.",
      "  🚧 Blockers",
      "    ✅ No explicit blockers.",
      "  📝 Recent Activity",
      "    💤 No recent activity.",
      `🔄 [${REFRESH_SHORTCUT}] Refresh`,
    ]);
  });

  it("keeps the host usable and reports offline state when Engram fails", async () => {
    const lines = describeSidebar({
      projectName: "mcp-flema-engram",
      changes: [],
      blockers: [],
      recentActivity: [],
      health: "offline",
      loading: false,
      error: "connection refused",
    });

    expect(lines).toContain("💔 Health: OFFLINE");
    expect(lines).toContain(`⚠️ Engram is offline; press ${REFRESH_SHORTCUT} to retry.`);
    expect(lines).toContain("📁 Project: mcp-flema-engram");
  });

  it("shows partial-data details without blanking successful sidebar sections", () => {
    const lines = describeSidebar({
      projectName: "mcp-flema-engram",
      project: {
        name: "mcp-flema-engram",
        observationCount: 2,
        lastActiveAt: "2026-08-30T19:00:00.000Z",
        scopes: ["project"],
      },
      changes: groupByChange([observation({})]),
      blockers: [],
      recentActivity: [observation({})],
      health: "stale",
      loading: false,
      error: "Observations unavailable",
    });

    expect(lines).toContain("⚠️ Health: STALE");
    expect(lines).toContain("⚠️ Detail: Observations unavailable");
    expect(lines).toContain("  🗂️ Indexed observations: 2");
    expect(lines).toContain("    • mcp-flema-engram: in-progress (apply)");
  });

  it("keeps the health label OK while exposing an auxiliary project warning", () => {
    const lines = describeSidebar({
      projectName: "mcp-flema-engram",
      changes: groupByChange([observation({})]),
      blockers: [],
      recentActivity: [observation({})],
      health: "ok",
      loading: false,
      error: "Project index unavailable",
    });

    expect(lines).toContain("🟢 Health: OK");
    expect(lines).toContain("⚠️ Detail: Project index unavailable");
    expect(lines).toContain("    • Apply sidebar");
  });

  it("shows an actionable configuration hint when project resolution is unresolved", () => {
    const lines = describeSidebar({
      changes: [],
      blockers: [],
      recentActivity: [],
      health: "ok",
      loading: false,
    });

    expect(lines).toContain("📁 Project: unresolved");
    expect(lines).toContain("💡 Set project in workspace tui.json, ENGRAM_PROJECT, or open OpenCode from a project directory.");
    expect(lines.join("\n")).not.toContain("picker");
  });

  it("marks an offline explicit candidate as unvalidated instead of selecting it", () => {
    const lines = describeSidebar({
      resolution: {
        candidate: "alpha",
        source: "explicit",
        validation: "offline",
      },
      changes: [],
      blockers: [],
      recentActivity: [],
      health: "offline",
      loading: false,
    });

    expect(lines).toContain("📁 Project: unresolved");
    expect(lines).toContain("⚠️ Unvalidated explicit candidate: alpha (Engram offline).");
  });

  it("does not dispatch the deferred dashboard key", async () => {
    const refresh = vi.fn();
    const setStatus = vi.fn();
    const handled = await handleSidebarKey("d", {
      refresh,
      setStatus,
      state: () => ({
        changes: [], blockers: [], recentActivity: [], health: "loading", loading: true,
        terminal: { status: "loading", stage: "mounted", health: "loading", observationCount: 0 },
      }),
      isCurrent: () => true,
    });

    expect(handled).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("refreshes only on the modified shortcut and ignores bare r", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      refresh,
      setStatus: vi.fn(),
      state: () => ({
        changes: [], blockers: [], recentActivity: [], health: "ok" as const, loading: false,
        terminal: { status: "success" as const, stage: "terminal" as const, health: "ok" as const, observationCount: 0 },
      }),
      isCurrent: () => true,
    };

    expect(await handleSidebarKey("r", dependencies)).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(await handleSidebarKey(REFRESH_SHORTCUT, dependencies)).toBe(true);
    expect(await handleSidebarKey("x", dependencies)).toBe(false);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("contains a synchronous sidebar renderer failure", async () => {
    const result = renderSidebarSafely(
      () => {
        throw new Error("render exploded");
      },
      {
        adapter: adapter(),
        actionRegistry: createSidebarActionRegistry(),
      },
    );

    expect(result).toEqual({ ok: false, error: "render exploded" });
  });

  it("resolves the workspace before registration and passes it into the mounted sidebar", async () => {
    let received: EngramSidebarProps | undefined;
    const localAdapter = adapter({
      listProjects: vi.fn().mockResolvedValue([
        {
          name: "Canonical-Project",
          observationCount: 1,
          lastActiveAt: "2026-08-31T00:00:00.000Z",
          scopes: ["project"],
        },
      ]),
    });

    const slot = await register(createEngramTuiPlugin({
      adapter: localAdapter,
      cwd: "/work/ignored",
      renderSidebar: (props) => {
        received = props;
        return null as never;
      },
    }), { project: "canonical-project" });
    slot?.slots.sidebar_content({} as never, { session_id: "test" });

    expect(received?.projectName).toBe("Canonical-Project");
    expect(received?.projectResolution).toMatchObject({
      projectName: "Canonical-Project",
      validation: "case-insensitive",
    });
    expect(received?.initialError).toBeUndefined();
    await expect(received?.resolveProject?.()).resolves.toMatchObject({
      projectName: "Canonical-Project",
      validation: "case-insensitive",
    });
    expect(localAdapter.listProjects).toHaveBeenCalledTimes(2);
  });

});

function successfulOutcome(): SidebarRefreshOutcome {
  return {
    status: "success",
    summary: "Refresh complete",
    failures: [],
    warnings: [],
    stages: [],
  };
}

function actionDependencies(refresh: ReturnType<typeof vi.fn>) {
  const state = () => ({
    changes: [],
    blockers: [],
    recentActivity: [],
    health: "ok" as const,
    loading: false,
    terminal: { status: "success" as const, stage: "terminal" as const, health: "ok" as const, observationCount: 20 },
  });
  return { refresh, setStatus: vi.fn(), state, isCurrent: () => true };
}

import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { EngramAdapter, HealthStatus, Observation, Project, Session } from "../../../../src/adapters/types.js";
import {
  fetchSidebarRefresh,
  reduceSidebarRefresh,
  useEngram,
  type SidebarRefreshOutcome,
  type SidebarViewModel,
  type UseEngramOptions,
} from "../../../../src/sidebar/hooks/use-engram.js";

const project: Project = {
  name: "mcp-flema-engram",
  observationCount: 2,
  lastActiveAt: "2026-08-30T19:00:00.000Z",
  scopes: ["project"],
};

const activity: Observation[] = [
  {
    id: 1,
    type: "architecture",
    title: "Apply sidebar",
    topic_key: "sdd/mcp-flema-engram/apply-progress",
    content: "Slice 4",
    project: "mcp-flema-engram",
    scope: "project",
    updated_at: "2026-08-30T19:00:00.000Z",
    created_at: "2026-08-30T19:00:00.000Z",
  },
  {
    id: 2,
    type: "blocker",
    title: "Waiting for host",
    topic_key: "notes/sidebar",
    content: "Status: blocked",
    project: "mcp-flema-engram",
    scope: "project",
    updated_at: "2026-08-30T19:01:00.000Z",
    created_at: "2026-08-30T19:01:00.000Z",
  },
];

const initial: SidebarViewModel = {
  projectName: "mcp-flema-engram",
  changes: [],
  blockers: [],
  recentActivity: [],
  health: "error",
  loading: true,
};

describe("sidebar refresh behavior", () => {
  it("automatically runs one initial refresh and reaches populated terminal state", async () => {
    const localAdapter = adapterForRefresh();
    const resolve = vi.fn().mockResolvedValue({
      projectName: "mcp-flema-engram",
      candidate: "mcp-flema-engram",
      source: "cwd",
      validation: "exact",
    });
    const mounted = createRoot((dispose) => {
      const engram = useEngram(localAdapter, {
        resolution: {
          projectName: "mcp-flema-engram",
          candidate: "mcp-flema-engram",
          source: "cwd",
          validation: "exact",
        },
        resolveProject: resolve,
        pollInterval: 60_000,
      });
      return { ...engram, dispose };
    });

    expect(mounted.state().health).toBe("loading");
    await vi.waitFor(() => expect(mounted.state().terminal?.status).toBe("success"));

    expect(mounted.state().health).toBe("ok");
    expect(mounted.state().project?.observationCount).toBe(2);
    expect(mounted.state().changes.map((change) => change.name)).toEqual(["mcp-flema-engram"]);
    expect(mounted.state().recentActivity.map((item) => item.id)).toEqual([2, 1]);
    expect(resolve).not.toHaveBeenCalled();
    expect(localAdapter.health).toHaveBeenCalledOnce();
    expect(localAdapter.listProjects).toHaveBeenCalledOnce();
    expect(localAdapter.listObservations).toHaveBeenCalledOnce();
    mounted.dispose();
  });

  it("does not start an initial request when the sidebar hook is disabled", async () => {
    const localAdapter = adapterForRefresh();
    const mounted = createRoot((dispose) => {
      const engram = useEngram(localAdapter, { enabled: false, pollInterval: 60_000 });
      return { ...engram, dispose };
    });

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(localAdapter.health).not.toHaveBeenCalled();
    expect(localAdapter.listProjects).not.toHaveBeenCalled();
    expect(localAdapter.listObservations).not.toHaveBeenCalled();
    mounted.dispose();
  });

  it("supports explicit host ownership without also starting the hook fallback", async () => {
    const localAdapter = adapterForRefresh();
    const mounted = createRoot((dispose) => {
      const engram = useEngram(localAdapter, {
        autoRefresh: false,
        projectName: "mcp-flema-engram",
        pollInterval: 60_000,
      });
      return { ...engram, dispose };
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localAdapter.health).not.toHaveBeenCalled();

    await mounted.refresh();
    expect(localAdapter.health).toHaveBeenCalledOnce();
    expect(mounted.state().health).toBe("ok");
    mounted.dispose();
  });

  it("returns complete success only when every refresh stage succeeds", async () => {
    const mounted = createRoot((dispose) => {
      const engram = useEngram(adapterForRefresh(), {
        projectName: "mcp-flema-engram",
        pollInterval: 60_000,
      });
      return { ...engram, dispose };
    });

    const outcome: SidebarRefreshOutcome = await mounted.refresh();

    expect(outcome).toMatchObject({ status: "success", failures: [], warnings: [] });
    expect(outcome.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "project-resolution", status: "success" }),
      expect.objectContaining({ stage: "health", status: "success", endpoint: "/health" }),
      expect.objectContaining({ stage: "projects", status: "success" }),
      expect.objectContaining({ stage: "filtered-observations", status: "success" }),
      expect.objectContaining({ stage: "fallback-observations", status: "skipped" }),
      expect.objectContaining({ stage: "reducing", status: "success" }),
      expect.objectContaining({ stage: "terminal", status: "success" }),
    ]));
    mounted.dispose();
  });

  it("returns a partial outcome with endpoint detail when observations fail", async () => {
    const mounted = createRoot((dispose) => {
      const engram = useEngram(adapterForRefresh({
        listObservations: vi.fn().mockRejectedValue(new Error("observation endpoint unavailable")),
      }), {
        projectName: "mcp-flema-engram",
        pollInterval: 60_000,
      });
      return { ...engram, dispose };
    });

    const outcome = await mounted.refresh();

    expect(outcome.status).toBe("partial");
    expect(outcome.summary).toContain("observations /observations/recent");
    expect(outcome.failures).toEqual([
      expect.objectContaining({ stage: "observations", endpoint: "/observations/recent" }),
    ]);
    expect(mounted.state().loading).toBe(false);
    mounted.dispose();
  });

  it("returns failed when no refresh category remains available", async () => {
    const unavailable = new Error("Engram unavailable");
    const mounted = createRoot((dispose) => {
      const engram = useEngram(adapterForRefresh({
        health: vi.fn().mockRejectedValue(unavailable),
        listProjects: vi.fn().mockRejectedValue(unavailable),
        listObservations: vi.fn().mockRejectedValue(unavailable),
      }), {
        projectName: "mcp-flema-engram",
        pollInterval: 60_000,
      });
      return { ...engram, dispose };
    });

    const outcome = await mounted.refresh();

    expect(outcome.status).toBe("failed");
    expect(outcome.failures.map((failure) => failure.stage)).toEqual(["health", "projects", "observations"]);
    expect(outcome.stages.at(-1)).toMatchObject({ stage: "terminal", status: "failed" });
    expect(mounted.state().loading).toBe(false);
    mounted.dispose();
  });

  it("bounds a hanging filtered observation request and records terminal diagnostics", async () => {
    const transitions: unknown[] = [];
    const input = await fetchSidebarRefresh(adapterForRefresh({
      listObservations: vi.fn(() => new Promise<Observation[]>(() => undefined)),
    }), {
      projectName: "mcp-flema-engram",
      stageTimeoutMs: 10,
      onTransition: (transition) => transitions.push(transition),
    });

    expect(input.failures).toEqual([
      expect.objectContaining({ stage: "observations", endpoint: "/observations/recent" }),
    ]);
    expect(transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "filtered-observations", status: "failed", endpoint: "/observations/recent" }),
    ]));
  });

  it("bounds a hanging fallback within the complete observation deadline", async () => {
    const transitions: unknown[] = [];
    const listObservations = vi.fn()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise<Observation[]>(() => undefined));

    const input = await fetchSidebarRefresh(adapterForRefresh({ listObservations }), {
      projectName: "mcp-flema-engram",
      stageTimeoutMs: 10,
      onTransition: (transition) => transitions.push(transition),
    });

    expect(listObservations).toHaveBeenCalledTimes(2);
    expect(input.failures?.[0]).toMatchObject({ stage: "observations", endpoint: "/observations/recent" });
    expect(transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "filtered-observations", status: "success", count: 0 }),
      expect.objectContaining({ stage: "fallback-observations", status: "failed", endpoint: "/observations/recent" }),
    ]));
  });

  it("keeps the startup project visible while mounted refresh re-resolves asynchronously", async () => {
    let finishResolution: ((resolution: {
      projectName: string;
      candidate: string;
      source: "cwd";
      validation: "exact";
    }) => void) | undefined;
    const resolution = new Promise<{
      projectName: string;
      candidate: string;
      source: "cwd";
      validation: "exact";
    }>((resolve) => {
      finishResolution = resolve;
    });
    const mounted = createRoot((dispose) => {
      const engram = useEngram(adapterForRefresh(), {
        projectName: "mcp-flema-engram",
        resolution: {
          projectName: "mcp-flema-engram",
          candidate: "mcp-flema-engram",
          source: "cwd",
          validation: "exact",
        },
        resolveProject: () => resolution,
        pollInterval: 60_000,
      });
      void engram.refresh();
      return { ...engram, dispose };
    });

    expect(mounted.state().projectName).toBe("mcp-flema-engram");
    expect(mounted.state().resolution?.validation).toBe("exact");
    expect(mounted.state().loading).toBe(true);

    finishResolution?.({
      projectName: "mcp-flema-engram",
      candidate: "mcp-flema-engram",
      source: "cwd",
      validation: "exact",
    });
    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(mounted.state().projectName).toBe("mcp-flema-engram");
    expect(mounted.state().recentActivity.map((item) => item.id)).toEqual([2, 1]);
    mounted.dispose();
  });

  it("uses a validated startup resolution for the first refresh without resolving twice", async () => {
    const localAdapter = adapterForRefresh();
    const resolve = vi.fn(() => new Promise<never>(() => undefined));
    const mounted = createRoot((dispose) => {
      const engram = useEngram(localAdapter, {
        resolution: {
          projectName: "mcp-flema-engram",
          candidate: "mcp-flema-engram",
          source: "cwd",
          validation: "exact",
        },
        resolveProject: resolve,
        pollInterval: 60_000,
        stageTimeoutMs: 10,
      });
      void engram.refresh();
      return { ...engram, dispose };
    });

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(resolve).not.toHaveBeenCalled();
    expect(localAdapter.health).toHaveBeenCalledOnce();
    expect(localAdapter.listProjects).toHaveBeenCalledOnce();
    expect(localAdapter.listObservations).toHaveBeenCalledOnce();
    expect(mounted.state().health).toBe("ok");
    expect(mounted.state().recentActivity.map((item) => item.id)).toEqual([2, 1]);
    mounted.dispose();
  });

  it("re-resolves after the startup refresh when refresh is requested explicitly", async () => {
    const localAdapter = adapterForRefresh();
    const resolve = vi.fn().mockResolvedValue({
      projectName: "mcp-flema-engram",
      candidate: "mcp-flema-engram",
      source: "cwd",
      validation: "exact",
    });
    const mounted = createRoot((dispose) => {
      const engram = useEngram(localAdapter, {
        resolution: {
          projectName: "mcp-flema-engram",
          candidate: "mcp-flema-engram",
          source: "cwd",
          validation: "exact",
        },
        resolveProject: resolve,
        pollInterval: 60_000,
      });
      return { ...engram, dispose };
    });

    await mounted.refresh();
    expect(resolve).not.toHaveBeenCalled();

    await mounted.refresh();
    expect(resolve).toHaveBeenCalledOnce();
    expect(localAdapter.health).toHaveBeenCalledTimes(2);
    expect(localAdapter.listProjects).toHaveBeenCalledTimes(2);
    expect(localAdapter.listObservations).toHaveBeenCalledTimes(2);
    mounted.dispose();
  });

  it("completes the mounted initial refresh with canonical observation data", async () => {
    const localAdapter = adapterForRefresh();
    const mounted = mountEngram(localAdapter, vi.fn().mockResolvedValue({
      projectName: "mcp-flema-engram",
      candidate: "mcp-flema-engram",
      source: "cwd",
      validation: "exact",
    }));

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(mounted.state().health).toBe("ok");
    expect(mounted.state().project?.observationCount).toBe(2);
    expect(mounted.state().recentActivity.map((item) => item.id)).toEqual([2, 1]);
    mounted.dispose();
  });

  it("exits CHECKING and identifies project resolution failures without suppressing HTTP stages", async () => {
    const localAdapter = adapterForRefresh();
    const mounted = mountEngram(localAdapter, vi.fn().mockRejectedValue(new Error("resolver exploded")));

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(mounted.state().health).toBe("stale");
    expect(mounted.state().error).toContain("project-resolution");
    expect(mounted.state().error).toContain("resolver exploded");
    expect(mounted.state().error).toContain("observations=0");
    expect(localAdapter.health).toHaveBeenCalledOnce();
    expect(localAdapter.listProjects).toHaveBeenCalledOnce();
    mounted.dispose();
  });

  it("times out a hanging resolver and renders terminal project-resolution failure detail", async () => {
    const localAdapter = adapterForRefresh();
    const mounted = createRoot((dispose) => {
      const engram = useEngram(localAdapter, {
        resolveProject: () => new Promise<never>(() => undefined),
        pollInterval: 60_000,
        stageTimeoutMs: 10,
      });
      void engram.refresh();
      return { ...engram, dispose };
    });

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(mounted.state().health).not.toBe("loading");
    expect(mounted.state().error).toContain("project-resolution");
    expect(mounted.state().error).toContain("timed out after 10ms");
    expect(localAdapter.health).toHaveBeenCalledOnce();
    expect(localAdapter.listProjects).toHaveBeenCalledOnce();
    mounted.dispose();
  });

  it("times out a hanging adapter stage while preserving successful partial data", async () => {
    const localAdapter = adapterForRefresh({
      health: vi.fn(() => new Promise<HealthStatus>(() => undefined)),
    });
    const mounted = createRoot((dispose) => {
      const engram = useEngram(localAdapter, {
        projectName: "mcp-flema-engram",
        pollInterval: 60_000,
        stageTimeoutMs: 10,
      });
      void engram.refresh();
      return { ...engram, dispose };
    });

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(mounted.state().health).toBe("stale");
    expect(mounted.state().error).toContain("health /health");
    expect(mounted.state().error).toContain("timed out after 10ms");
    expect(mounted.state().recentActivity.map((item) => item.id)).toEqual([2, 1]);
    mounted.dispose();
  });

  it("treats an offline resolver result as a failed stage and settles offline when no HTTP data succeeds", async () => {
    const failure = new Error("service unavailable");
    const localAdapter = adapterForRefresh({
      health: vi.fn().mockRejectedValue(failure),
      listProjects: vi.fn().mockRejectedValue(failure),
    });
    const mounted = mountEngram(localAdapter, vi.fn().mockResolvedValue({
      validation: "offline",
      source: "cwd",
    }));

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(mounted.state().health).toBe("offline");
    expect(mounted.state().error).toContain("project-resolution");
    expect(mounted.state().error).toContain("projects=unavailable");
    mounted.dispose();
  });

  it("preserves canonical observations and reports the health endpoint when health fails", async () => {
    const localAdapter = adapterForRefresh({
      health: vi.fn().mockRejectedValue(new Error("connection refused")),
    });

    const input = await fetchSidebarRefresh(localAdapter, { projectName: "mcp-flema-engram" });
    const next = reduceSidebarRefresh(initial, input);

    expect(next.loading).toBe(false);
    expect(next.health).toBe("stale");
    expect(next.recentActivity.map((item) => item.id)).toEqual([2, 1]);
    expect(next.error).toContain("health /health");
    expect(next.error).toContain("observations=2");
  });

  it("preserves successful health and projects while identifying an observations failure", async () => {
    const localAdapter = adapterForRefresh({
      listObservations: vi.fn().mockRejectedValue(new Error("invalid observation payload")),
    });

    const input = await fetchSidebarRefresh(localAdapter, { projectName: "mcp-flema-engram" });
    const next = reduceSidebarRefresh(initial, input);

    expect(next.loading).toBe(false);
    expect(next.health).toBe("stale");
    expect(next.project?.name).toBe("mcp-flema-engram");
    expect(next.error).toContain("observations /observations/recent");
    expect(next.error).toContain("projects=1");
  });

  it("never leaves loading stuck when an unexpected refresh orchestration failure escapes", async () => {
    const mounted = mountEngram(adapterForRefresh(), () => {
      throw new Error("synchronous resolver failure");
    });

    await vi.waitFor(() => expect(mounted.state().loading).toBe(false));

    expect(mounted.state().health).not.toBe("loading");
    expect(mounted.state().error).toContain("project-resolution");
    mounted.dispose();
  });

  it("uses a bounded unfiltered fallback and exact canonical filtering when the server filter returns empty", async () => {
    const crossProject = { ...activity[0]!, id: 3, project: "nukestats", title: "Other project" };
    const canonical = { ...activity[0]!, project: "igextractor", title: "Extractor JSON activity" };
    const adapter = {
      health: vi.fn().mockResolvedValue({ local: { available: true } }),
      listProjects: vi.fn().mockResolvedValue([
        { ...project, name: "igextractor", observationCount: 0 },
      ]),
      listObservations: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([crossProject, canonical]),
    } as unknown as EngramAdapter;

    const input = await fetchSidebarRefresh(adapter, { projectName: "igextractor" });
    const next = reduceSidebarRefresh(initial, input);

    expect(adapter.listObservations).toHaveBeenNthCalledWith(1, { project: "igextractor", limit: 20 });
    expect(adapter.listObservations).toHaveBeenNthCalledWith(2, { limit: 100 });
    expect(input.observations?.map((item) => item.title)).toEqual(["Extractor JSON activity"]);
    expect(input.warnings).toEqual([
      "Filtered observations returned no records; used bounded unfiltered fallback (limit 100) with exact project matching for igextractor.",
    ]);
    expect(next.project?.observationCount).toBe(1);
    expect(next.recentActivity.map((item) => item.project)).toEqual(["igextractor"]);
    expect(next.health).toBe("ok");
    expect(next.error).toBe(input.warnings?.[0]);
  });

  it("rejects cross-project filtered results and uses only exact matches from the bounded fallback", async () => {
    const canonical = { ...activity[0]!, id: 4, project: "nukestats", title: "Nukestats JSON activity" };
    const crossProject = { ...activity[1]!, id: 5, project: "igextractor", title: "Extractor activity" };
    const adapter = {
      health: vi.fn().mockResolvedValue({ local: { available: true } }),
      listProjects: vi.fn().mockResolvedValue([
        { ...project, name: "nukestats", observationCount: 99 },
      ]),
      listObservations: vi.fn()
        .mockResolvedValueOnce([canonical, crossProject])
        .mockResolvedValueOnce([crossProject, canonical]),
    } as unknown as EngramAdapter;

    const input = await fetchSidebarRefresh(adapter, { projectName: "nukestats" });
    const next = reduceSidebarRefresh(initial, input);

    expect(input.observations?.map((item) => item.title)).toEqual(["Nukestats JSON activity"]);
    expect(input.warnings?.[0]).toContain("cross-project records");
    expect(next.project?.observationCount).toBe(1);
    expect(next.recentActivity.map((item) => item.project)).toEqual(["nukestats"]);
    expect(next.recentActivity.map((item) => item.title)).not.toContain("Extractor activity");
  });

  it("prefers verified server filtering without requesting the fallback", async () => {
    const canonical = activity.map((item) => ({ ...item, project: "igextractor" }));
    const adapter = {
      health: vi.fn().mockResolvedValue({ local: { available: true } }),
      listProjects: vi.fn().mockResolvedValue([
        { ...project, name: "igextractor", observationCount: 0 },
      ]),
      listObservations: vi.fn().mockResolvedValue(canonical),
    } as unknown as EngramAdapter;

    const input = await fetchSidebarRefresh(adapter, { projectName: "igextractor" });
    const next = reduceSidebarRefresh(initial, input);

    expect(adapter.listObservations).toHaveBeenCalledOnce();
    expect(input.warnings).toBeUndefined();
    expect(next.project?.observationCount).toBe(2);
    expect(next.recentActivity.map((item) => item.project)).toEqual(["igextractor", "igextractor"]);
  });

  it("does not request or display unfiltered observations for an unresolved project", async () => {
    const adapter = {
      health: vi.fn().mockResolvedValue({ local: { available: true } }),
      listProjects: vi.fn().mockResolvedValue([project]),
      listObservations: vi.fn().mockResolvedValue(activity),
    } as unknown as EngramAdapter;

    const input = await fetchSidebarRefresh(adapter);
    const next = reduceSidebarRefresh({ ...initial, projectName: undefined }, input);

    expect(adapter.listObservations).not.toHaveBeenCalled();
    expect(input.observations).toEqual([]);
    expect(next.projectName).toBeUndefined();
    expect(next.recentActivity).toEqual([]);
  });

  it("does not hide a malformed filtered payload behind the unfiltered fallback", async () => {
    const validationError = new Error("Engram returned an invalid response");
    const adapter = {
      health: vi.fn().mockResolvedValue({ local: { available: true } }),
      listProjects: vi.fn().mockResolvedValue([project]),
      listObservations: vi.fn().mockRejectedValue(validationError),
    } as unknown as EngramAdapter;

    const input = await fetchSidebarRefresh(adapter, { projectName: "igextractor" });

    expect(adapter.listObservations).toHaveBeenCalledOnce();
    expect(input.observations).toBeUndefined();
    expect(input.errors).toEqual([validationError]);
    expect(input.warnings).toBeUndefined();
  });

  it("re-resolves the project before fetching every live sidebar category", async () => {
    const calls: string[] = [];
    const adapter: EngramAdapter = {
      health: vi.fn(async () => {
        calls.push("health");
        return { local: { available: true } } satisfies HealthStatus;
      }),
      listProjects: vi.fn(async () => {
        calls.push("projects");
        return [project];
      }),
      listObservations: vi.fn(async (query) => {
        calls.push(`observations:${query?.project}`);
        return activity;
      }),
      getObservation: vi.fn().mockResolvedValue(null),
      searchObservations: vi.fn().mockResolvedValue([] satisfies Observation[]),
      listSessions: vi.fn().mockResolvedValue([] satisfies Session[]),
      getSession: vi.fn().mockResolvedValue(null),
    };
    const resolve = vi.fn(async () => {
      calls.push("resolve");
      return {
        projectName: "mcp-flema-engram",
        candidate: "mcp-flema-engram",
        source: "cwd" as const,
        validation: "exact" as const,
      };
    });

    const input = await fetchSidebarRefresh(adapter, {
      resolveProject: resolve,
      now: () => new Date("2026-08-31T12:00:00.000Z"),
    });

    expect(calls).toEqual([
      "resolve",
      "health",
      "projects",
      "observations:mcp-flema-engram",
    ]);
    expect(input.resolution?.validation).toBe("exact");
    expect(input.projects).toEqual([project]);
    expect(input.observations).toEqual(activity);
  });

  it("derives the visible project, canonical SDD state, blockers, activity, and health", () => {
    const refreshedAt = new Date("2026-08-30T19:02:00.000Z");

    const next = reduceSidebarRefresh(initial, {
      health: { local: { available: true, version: "1.15.3" } },
      projects: [project],
      observations: activity,
      projectName: "mcp-flema-engram",
      now: refreshedAt,
    });

    expect(next.health).toBe("ok");
    expect(next.project).toEqual(project);
    expect(next.changes.map((change) => change.name)).toEqual(["mcp-flema-engram"]);
    expect(next.blockers.map((blocker) => blocker.title)).toEqual(["Waiting for host"]);
    expect(next.recentActivity.map((item) => item.id)).toEqual([2, 1]);
    expect(next.lastRefreshAt).toEqual(refreshedAt);
    expect(next.terminal).toEqual({
      status: "success",
      stage: "terminal",
      health: "ok",
      observationCount: 2,
    });
  });

  it("preserves the last good data and reports stale after a failed refresh", () => {
    const previous = reduceSidebarRefresh(initial, {
      health: { local: { available: true } },
      projects: [project],
      observations: activity,
      projectName: "mcp-flema-engram",
      now: new Date("2026-08-30T19:02:00.000Z"),
    });

    const next = reduceSidebarRefresh(previous, {
      projectName: "mcp-flema-engram",
      errors: [new Error("connection refused")],
      now: new Date("2026-08-30T19:03:00.000Z"),
    });

    expect(next.health).toBe("stale");
    expect(next.project).toEqual(project);
    expect(next.recentActivity.map((item) => item.id)).toEqual([2, 1]);
    expect(next.lastRefreshAt).toEqual(previous.lastRefreshAt);
    expect(next.error).toBe("connection refused");
  });

  it("keeps health OK and fresh observations visible when only project derivation fails", () => {
    const refreshedAt = new Date("2026-08-30T19:03:00.000Z");

    const next = reduceSidebarRefresh(initial, {
      health: { local: { available: true } },
      observations: activity,
      projectName: "mcp-flema-engram",
      errors: [new Error("Project index unavailable")],
      now: refreshedAt,
    });

    expect(next.health).toBe("ok");
    expect(next.recentActivity.map((item) => item.id)).toEqual([2, 1]);
    expect(next.lastRefreshAt).toEqual(refreshedAt);
    expect(next.error).toBe("Project index unavailable");
  });

  it("shows successful project data with a warning state when observation retrieval fails", () => {
    const next = reduceSidebarRefresh(initial, {
      health: { local: { available: true } },
      projects: [project],
      projectName: "mcp-flema-engram",
      errors: [new Error("Observations unavailable")],
      now: new Date("2026-08-30T19:03:00.000Z"),
    });

    expect(next.health).toBe("stale");
    expect(next.project).toEqual(project);
    expect(next.recentActivity).toEqual([]);
    expect(next.error).toBe("Observations unavailable");
  });

  it("refreshes every endpoint again after re-resolution", async () => {
    const localAdapter = {
      health: vi.fn().mockResolvedValue({ local: { available: true } }),
      listProjects: vi.fn().mockResolvedValue([project]),
      listObservations: vi.fn().mockResolvedValue(activity),
    } as unknown as EngramAdapter;
    const resolve = vi.fn().mockResolvedValue({
      projectName: "mcp-flema-engram",
      candidate: "mcp-flema-engram",
      source: "cwd",
      validation: "exact",
    });

    await fetchSidebarRefresh(localAdapter, { resolveProject: resolve });
    await fetchSidebarRefresh(localAdapter, { resolveProject: resolve });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(localAdapter.health).toHaveBeenCalledTimes(2);
    expect(localAdapter.listProjects).toHaveBeenCalledTimes(2);
    expect(localAdapter.listObservations).toHaveBeenCalledTimes(2);
  });

  it("reports offline without fabricating data when the first refresh fails", () => {
    const next = reduceSidebarRefresh(initial, {
      projectName: "mcp-flema-engram",
      errors: [new Error("connection refused")],
      now: new Date("2026-08-30T19:03:00.000Z"),
    });

    expect(next.health).toBe("offline");
    expect(next.recentActivity).toEqual([]);
    expect(next.lastRefreshAt).toBeUndefined();
  });

  it("does not silently select the first known project when resolution is unresolved", () => {
    const next = reduceSidebarRefresh({ ...initial, projectName: undefined }, {
      health: { local: { available: true } },
      projects: [project],
      observations: [],
      now: new Date("2026-08-30T19:03:00.000Z"),
    });

    expect(next.projectName).toBeUndefined();
    expect(next.project).toBeUndefined();
  });

  it("clears a previously resolved project when live resolution becomes unresolved", () => {
    const next = reduceSidebarRefresh(initial, {
      health: { local: { available: true } },
      projects: [project],
      observations: [],
      resolution: { validation: "no-match", candidate: "renamed", source: "cwd" },
      now: new Date("2026-08-31T12:00:00.000Z"),
    });

    expect(next.projectName).toBeUndefined();
    expect(next.project).toBeUndefined();
    expect(next.resolution?.validation).toBe("no-match");
  });
});

function adapterForRefresh(overrides: Partial<EngramAdapter> = {}): EngramAdapter {
  return {
    health: vi.fn().mockResolvedValue({ local: { available: true } }),
    listProjects: vi.fn().mockResolvedValue([project]),
    listObservations: vi.fn().mockResolvedValue(activity),
    getObservation: vi.fn().mockResolvedValue(null),
    searchObservations: vi.fn().mockResolvedValue([]),
    listSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function mountEngram(adapter: EngramAdapter, resolveProject: NonNullable<UseEngramOptions["resolveProject"]>) {
  return createRoot((dispose) => {
    const engram = useEngram(adapter, { resolveProject, pollInterval: 60_000 });
    void engram.refresh();
    return { ...engram, dispose };
  });
}

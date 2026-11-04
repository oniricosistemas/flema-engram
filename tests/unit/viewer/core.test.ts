import { describe, expect, it, vi } from "vitest";
import type { EngramAdapter, Observation } from "../../../src/adapters/types.js";
import { CompositeEngramAdapter } from "../../../src/adapters/composite.js";
import { EngramUnavailable } from "../../../src/utils/errors.js";
import { createEngramReadController } from "../../../src/core.js";

const observation: Observation = {
  id: 1,
  type: "architecture",
  title: "Pi viewer",
  topic_key: "odd/pi-engram-viewer/tasks",
  content: "# Pi viewer\n\n## Tasks\n- [ ] **T1** — Extract core",
  project: "flema-engram",
  scope: "project",
  created_at: "2026-10-25T00:00:00.000Z",
  updated_at: "2026-10-25T00:00:00.000Z",
};

function adapter(overrides: Partial<EngramAdapter> = {}): EngramAdapter {
  return {
    health: vi.fn().mockResolvedValue({ local: { available: true } }),
    listProjects: vi.fn().mockResolvedValue([]),
    listObservations: vi.fn().mockResolvedValue([observation]),
    search: vi.fn().mockResolvedValue([]),
    listSessions: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("host-neutral Engram read controller", () => {
  it("refreshes without a Solid owner and rejects late state after disposal", async () => {
    let release!: (value: Observation[]) => void;
    const pending = new Promise<Observation[]>((resolve) => {
      release = resolve;
    });
    const local = adapter({ listObservations: vi.fn(() => pending) });
    const states: string[] = [];
    const controller = createEngramReadController(local, {
      projectName: "flema-engram",
      onState: (state) => states.push(`${state.loading}:${state.health}`),
    });

    const refresh = controller.refresh();
    expect(controller.getState().loading).toBe(true);
    controller.dispose();
    const stateCountAtDispose = states.length;
    release([observation]);
    await refresh;

    expect(controller.getState().lastRefreshAt).toBeUndefined();
    expect(states).toHaveLength(stateCountAtDispose);
  });

  it("does not touch the adapter when refreshed after disposal", async () => {
    const local = adapter();
    const controller = createEngramReadController(local, { projectName: "flema-engram" });
    controller.dispose();

    const outcome = await controller.refresh();

    expect(outcome).toMatchObject({
      status: "failed",
      summary: "Engram controller is disposed",
    });
    expect(local.health).not.toHaveBeenCalled();
    expect(local.listProjects).not.toHaveBeenCalled();
    expect(local.listObservations).not.toHaveBeenCalled();
  });

  it("publishes a project-scoped successful refresh", async () => {
    const controller = createEngramReadController(adapter(), { projectName: "flema-engram" });

    const outcome = await controller.refresh();

    expect(outcome.status).toBe("success");
    expect(controller.getState()).toMatchObject({
      projectName: "flema-engram",
      health: "ok",
      loading: false,
      observations: [observation],
    });
  });

  it("invalidates adapter reads before every refresh so a recent save is immediately visible", async () => {
    let observations = [{ ...observation, title: "Before save" }];
    const local = adapter({
      listObservations: vi.fn(async () => observations),
    });
    const composite = new CompositeEngramAdapter([local]);
    const controller = createEngramReadController(composite, { projectName: "flema-engram" });

    await controller.refresh();
    expect(controller.getState().recentActivity[0]?.title).toBe("Before save");

    observations = [{
      ...observation,
      id: 2,
      title: "Saved locally",
      updated_at: "2026-10-25T00:01:00.000Z",
    }];
    await controller.refresh();

    expect(controller.getState().recentActivity[0]?.title).toBe("Saved locally");
    expect(local.listObservations).toHaveBeenCalledTimes(2);
  });

  it("shows the fresh local save when the cloud-first source becomes unavailable", async () => {
    const cloud = adapter({
      health: vi.fn().mockResolvedValue({ local: { available: false }, cloud: { available: true } }),
      listObservations: vi.fn()
        .mockResolvedValueOnce([{ ...observation, title: "Cloud before save" }])
        .mockRejectedValueOnce(new EngramUnavailable("Cloud offline")),
    });
    const localSave = {
      ...observation,
      id: 2,
      title: "Saved locally while cloud is offline",
      updated_at: "2026-10-25T00:01:00.000Z",
    };
    const local = adapter({ listObservations: vi.fn().mockResolvedValue([localSave]) });
    const composite = new CompositeEngramAdapter([cloud, local], { fallbackOnEmpty: true });
    const controller = createEngramReadController(composite, { projectName: "flema-engram" });

    await controller.refresh();
    expect(controller.getState().recentActivity[0]?.title).toBe("Cloud before save");

    await controller.refresh();

    expect(controller.getState().recentActivity[0]?.title).toBe("Saved locally while cloud is offline");
    expect(local.listObservations).toHaveBeenCalledOnce();
  });
});

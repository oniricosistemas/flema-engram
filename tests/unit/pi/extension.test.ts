import { describe, expect, it, vi } from "vitest";
import type { EngramAdapter, Observation } from "../../../src/adapters/types.js";
import {
  createPiEngramExtension,
  type PiExtensionApi,
  type PiExtensionContext,
} from "../../../src/pi.js";

const observation: Observation = {
  id: 7,
  type: "architecture",
  title: "Pi viewer",
  topic_key: "odd/pi-engram-viewer/tasks",
  content: "# ODD Feature: Pi viewer\n\n## Tasks\n- [x] `T1` **done** — Core\n- [ ] `T2` **pending** — Pi",
  project: "flema-engram",
  scope: "project",
  created_at: "2026-10-25T00:00:00.000Z",
  updated_at: "2026-10-25T00:00:00.000Z",
};

function adapter(): EngramAdapter {
  return {
    health: vi.fn().mockResolvedValue({ local: { available: true } }),
    listProjects: vi.fn().mockResolvedValue([]),
    listObservations: vi.fn().mockResolvedValue([observation]),
    search: vi.fn().mockResolvedValue([]),
    listSessions: vi.fn().mockResolvedValue([]),
  };
}

function harness(hasUI = true) {
  const handlers = new Map<string, Array<(event: any, context: PiExtensionContext) => unknown>>();
  const commands = new Map<string, { handler: (args: string, context: PiExtensionContext) => unknown }>();
  const ui = {
    setStatus: vi.fn(),
    setWidget: vi.fn(),
    notify: vi.fn(),
  };
  const context: PiExtensionContext = { cwd: "/workspace/flema-engram", hasUI, ui };
  const pi: PiExtensionApi = {
    on: vi.fn((event, handler) => {
      const registered = handlers.get(event) ?? [];
      registered.push(handler);
      handlers.set(event, registered);
      return () => undefined;
    }),
    registerCommand: vi.fn((name, command) => commands.set(name, command)),
  };
  const emit = async (event: string, payload: Record<string, unknown> = {}) => {
    for (const handler of handlers.get(event) ?? []) await handler({ type: event, ...payload }, context);
  };
  return { pi, context, ui, commands, emit };
}

describe("Pi Engram viewer extension", () => {
  it("registers without starting work, then renders named status and compact widget on session start", async () => {
    const local = adapter();
    const host = harness();
    createPiEngramExtension({
      createAdapter: () => local,
      resolveProject: vi.fn().mockResolvedValue({ projectName: "flema-engram", validation: "exact" }),
    })(host.pi);

    expect(local.health).not.toHaveBeenCalled();
    await host.emit("session_start", { reason: "startup" });

    expect(local.health).toHaveBeenCalledOnce();
    expect(host.ui.setStatus).toHaveBeenLastCalledWith("flema-engram", expect.stringContaining("Engram OK"));
    expect(host.ui.setWidget).toHaveBeenLastCalledWith(
      "flema-engram",
      expect.arrayContaining([
        expect.stringContaining("flema-engram"),
        expect.stringContaining("ODD 1/2"),
      ]),
      { placement: "belowEditor" },
    );
  });

  it("refreshes after a successful Engram memory save but ignores failed or unrelated tools", async () => {
    const local = adapter();
    const host = harness();
    createPiEngramExtension({
      createAdapter: () => local,
      resolveProject: vi.fn().mockResolvedValue({ projectName: "flema-engram", validation: "exact" }),
    })(host.pi);
    await host.emit("session_start", { reason: "startup" });
    vi.mocked(local.health).mockClear();

    await host.emit("tool_result", { toolName: "mem_save", isError: false });
    await host.emit("tool_result", { toolName: "mem_save", isError: true });
    await host.emit("tool_result", { toolName: "write", isError: false });

    expect(local.health).toHaveBeenCalledOnce();
  });

  it("replaces session ownership without publishing a late refresh from the old session", async () => {
    let releaseOld!: (value: Observation[]) => void;
    const oldObservations = new Promise<Observation[]>((resolve) => {
      releaseOld = resolve;
    });
    const oldAdapter = adapter();
    vi.mocked(oldAdapter.listObservations).mockImplementation(() => oldObservations);
    const newObservation = { ...observation, project: "next-project", title: "New session" };
    const newAdapter = adapter();
    vi.mocked(newAdapter.listObservations).mockResolvedValue([newObservation]);
    const createAdapter = vi.fn()
      .mockReturnValueOnce(oldAdapter)
      .mockReturnValueOnce(newAdapter);
    const resolveProject = vi.fn()
      .mockResolvedValueOnce({ projectName: "old-project", validation: "exact" })
      .mockResolvedValueOnce({ projectName: "next-project", validation: "exact" });
    const host = harness();
    createPiEngramExtension({ createAdapter, resolveProject })(host.pi);

    const oldStart = host.emit("session_start", { reason: "startup" });
    await Promise.resolve();
    await host.emit("session_start", { reason: "resume" });
    releaseOld([{ ...observation, project: "old-project", title: "Old session" }]);
    await oldStart;

    expect(host.ui.setStatus).toHaveBeenLastCalledWith("flema-engram", expect.stringContaining("next-project"));
    expect(JSON.stringify(host.ui.setStatus.mock.calls.at(-1))).not.toContain("old-project");
  });

  it("supports manual refresh and clears owned UI on shutdown", async () => {
    const local = adapter();
    const host = harness();
    createPiEngramExtension({
      createAdapter: () => local,
      resolveProject: vi.fn().mockResolvedValue({ projectName: "flema-engram", validation: "exact" }),
    })(host.pi);
    await host.emit("session_start", { reason: "startup" });
    vi.mocked(local.health).mockClear();

    await host.commands.get("engram-refresh")?.handler("", { ...host.context });
    expect(local.health).toHaveBeenCalledOnce();
    expect(host.ui.notify).toHaveBeenLastCalledWith("Engram refreshed", "info");

    await host.emit("session_shutdown");
    expect(host.ui.setStatus).toHaveBeenLastCalledWith("flema-engram", undefined);
    expect(host.ui.setWidget).toHaveBeenLastCalledWith("flema-engram", undefined);
  });

  it("contains startup failures without exposing endpoint credentials", async () => {
    const host = harness();
    createPiEngramExtension({
      createAdapter: () => {
        throw new Error("https://user:credential@example.test");
      },
    })(host.pi);

    await expect(host.emit("session_start", { reason: "startup" })).resolves.toBeUndefined();

    const rendered = JSON.stringify([...host.ui.setStatus.mock.calls, ...host.ui.setWidget.mock.calls]);
    expect(rendered).toContain("Engram unavailable");
    expect(rendered).not.toContain("credential");
    expect(rendered).not.toContain("user");
  });

  it("does not fetch or render in a host mode without UI", async () => {
    const local = adapter();
    const host = harness(false);
    createPiEngramExtension({ createAdapter: () => local })(host.pi);

    await host.emit("session_start", { reason: "startup" });
    await host.emit("tool_result", { toolName: "mem_save", isError: false });

    expect(local.health).not.toHaveBeenCalled();
    expect(host.ui.setStatus).not.toHaveBeenCalled();
    expect(host.ui.setWidget).not.toHaveBeenCalled();
  });
});

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
    custom: vi.fn(() => new Promise<void>(() => undefined)),
  };
  const context: PiExtensionContext = {
    cwd: "/workspace/flema-engram",
    hasUI,
    mode: hasUI ? "tui" : "print",
    ui,
  };
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
  it("registers without starting work, then renders status with the compact widget hidden by default", async () => {
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
    expect(host.ui.setWidget).toHaveBeenLastCalledWith("flema-engram", undefined);
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
    await host.emit("tool_result", { toolName: "mem_save", isError: 0 });

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
    await vi.waitFor(() => expect(oldAdapter.listObservations).toHaveBeenCalled());
    await host.emit("session_start", { reason: "resume" });
    releaseOld([{ ...observation, project: "old-project", title: "Old session" }]);
    await oldStart;

    expect(host.ui.setStatus).toHaveBeenLastCalledWith("flema-engram", expect.stringContaining("next-project"));
    expect(JSON.stringify(host.ui.setStatus.mock.calls.at(-1))).not.toContain("old-project");
  });

  it("shows and hides the compact widget independently for the current session", async () => {
    const local = adapter();
    const host = harness();
    createPiEngramExtension({
      createAdapter: () => local,
      resolveProject: vi.fn().mockResolvedValue({ projectName: "flema-engram", validation: "exact" }),
    })(host.pi);
    await host.emit("session_start", { reason: "startup" });
    host.ui.setWidget.mockClear();

    await host.commands.get("engram-widget")?.handler("", host.context);
    expect(host.ui.setWidget).toHaveBeenLastCalledWith(
      "flema-engram",
      expect.arrayContaining([
        expect.stringContaining("flema-engram"),
        expect.stringContaining("ODD 1/2"),
      ]),
      { placement: "belowEditor" },
    );
    expect(host.ui.notify).toHaveBeenLastCalledWith("Engram widget shown", "info");

    await host.commands.get("engram-widget")?.handler("", host.context);
    expect(host.ui.setWidget).toHaveBeenLastCalledWith("flema-engram", undefined);
    expect(host.ui.notify).toHaveBeenLastCalledWith("Engram widget hidden", "info");

    await host.commands.get("engram-widget")?.handler("", host.context);
    await host.emit("session_start", { reason: "resume" });
    expect(host.ui.setWidget).toHaveBeenLastCalledWith("flema-engram", undefined);
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
    expect(host.ui.custom).not.toHaveBeenCalled();
  });

  it("mounts a passive themed sidebar with independent show and collapse commands", async () => {
    const local = adapter();
    const host = harness();
    createPiEngramExtension({
      createAdapter: () => local,
      resolveProject: vi.fn().mockResolvedValue({ projectName: "flema-engram", validation: "exact" }),
    })(host.pi);

    await host.emit("session_start", { reason: "startup" });

    expect(host.ui.custom).toHaveBeenCalledOnce();
    const [factory, options] = host.ui.custom.mock.calls[0] as unknown as [
      (tui: any, theme: any, keybindings: unknown, done: (value: void) => void) => any,
      { overlay: boolean; overlayOptions: Record<string, any>; onHandle: (handle: any) => void },
    ];
    const tui = { mode: "fullscreen", terminal: { columns: 160, rows: 40 }, requestRender: vi.fn() };
    const theme = {
      fg: (token: string, text: string) => `<${token}>${text}</${token}>`,
      bold: (text: string) => `<bold>${text}</bold>`,
    };
    const done = vi.fn();
    const panel = factory(tui, theme, undefined, done);
    const handle = { setHidden: vi.fn(), isHidden: vi.fn(() => false) };
    options.onHandle(handle);

    expect(options.overlay).toBe(true);
    expect(options.overlayOptions).toMatchObject({
      anchor: "bottom-right",
      width: 48,
      minWidth: 29,
      maxHeight: "70%",
      nonCapturing: true,
    });
    expect(options.overlayOptions.visible(120, 40)).toBe(true);
    expect(panel.render(48).join("\n")).toContain("flema-engram");

    await host.commands.get("engram-sidebar-collapse")?.handler("", host.context);
    expect(panel.render(48).join("\n")).toContain("▶ 🧠 Engram");

    await host.commands.get("engram-sidebar")?.handler("", host.context);
    expect(handle.setHidden).toHaveBeenLastCalledWith(true);
    expect(host.ui.notify).toHaveBeenLastCalledWith("Engram sidebar hidden", "info");

    await host.emit("session_shutdown");
    await host.emit("session_shutdown");
    expect(done).toHaveBeenCalledOnce();
  });

  it("rejects a stale sidebar factory after session replacement", async () => {
    const firstAdapter = adapter();
    const secondAdapter = adapter();
    const host = harness();
    createPiEngramExtension({
      createAdapter: vi.fn().mockReturnValueOnce(firstAdapter).mockReturnValueOnce(secondAdapter),
      resolveProject: vi.fn()
        .mockResolvedValueOnce({ projectName: "first-project", validation: "exact" })
        .mockResolvedValueOnce({ projectName: "second-project", validation: "exact" }),
    })(host.pi);

    await host.emit("session_start", { reason: "startup" });
    const firstFactory = host.ui.custom.mock.calls[0]?.[0] as any;
    await host.emit("session_start", { reason: "resume" });
    const secondFactory = host.ui.custom.mock.calls[1]?.[0] as any;
    const tui = { mode: "fullscreen", terminal: { columns: 160, rows: 40 }, requestRender: vi.fn() };
    const theme = { fg: (_token: string, text: string) => text, bold: (text: string) => text };
    const staleDone = vi.fn();
    const currentDone = vi.fn();

    firstFactory(tui, theme, undefined, staleDone);
    const currentPanel = secondFactory(tui, theme, undefined, currentDone);

    expect(staleDone).toHaveBeenCalledOnce();
    expect(currentPanel.render(48).join("\n")).toContain("second-project");
    expect(currentDone).not.toHaveBeenCalled();
  });

  it("contains sidebar mount failures without exposing error details", async () => {
    const host = harness();
    host.ui.custom.mockRejectedValueOnce(new Error("https://user:secret@example.test"));
    createPiEngramExtension({ createAdapter: adapter })(host.pi);

    await host.emit("session_start", { reason: "startup" });
    await vi.waitFor(() => {
      expect(host.ui.notify).toHaveBeenCalledWith("Engram sidebar unavailable", "warning");
    });

    expect(JSON.stringify(host.ui.notify.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(host.ui.notify.mock.calls)).not.toContain("user");
  });
});

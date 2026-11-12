import { describe, expect, it, vi } from "vitest";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Observation } from "../../../src/adapters/types.js";
import type { SidebarViewModel } from "../../../src/viewer/core.js";
import {
  attachGentleShellRailPanel,
  createPiSidebarPanel,
  GENTLE_SHELL_SIDEBAR_STATE,
  visibleTextWidth,
  type PiSidebarPanel,
  type PiSidebarTheme,
} from "../../../src/pi/sidebar.js";

const blocker: Observation = {
  id: 7,
  type: "blocker",
  title: "Waiting for an upstream OpenTUI release",
  content: "Blocked",
  project: "flema-engram",
  scope: "project",
  created_at: "2026-10-25T00:00:00.000Z",
  updated_at: "2026-10-25T00:00:00.000Z",
};

function state(overrides: Partial<SidebarViewModel> = {}): SidebarViewModel {
  return {
    projectName: "flema-engram",
    changes: [],
    blockers: [blocker],
    recentActivity: [{ ...blocker, id: 8, title: "Published Pi viewer" }],
    health: "ok",
    loading: false,
    ...overrides,
  };
}

function taggedTheme(version: () => string): PiSidebarTheme {
  return {
    fg: (token, text) => `<${version()}:${token}>${text}</${version()}:${token}>`,
    bold: (text) => `<${version()}:bold>${text}</${version()}:bold>`,
  };
}

function stripTags(value: string): string {
  return value.replace(/<\/?[^>]+>/g, "");
}

describe("Pi Engram sidebar panel", () => {
  it("renders a bounded expanded sidebar from the shared view model", () => {
    const tui = { requestRender: vi.fn() };
    const panel = createPiSidebarPanel(tui, taggedTheme(() => "dark"), state());

    const lines = panel.render(30);
    const plain = lines.map(stripTags);

    expect(plain).toEqual(expect.arrayContaining([
      expect.stringContaining("▼ 🧠 Engram"),
      expect.stringContaining("flema-engram"),
      expect.stringContaining("Blockers"),
      expect.stringContaining("Recent"),
    ]));
    expect(plain.every((line) => visibleTextWidth(line) <= 30)).toBe(true);
  });

  it("keeps the legacy overlay framed and gives Gentle Shell 4.6 its own panel card", () => {
    const legacyTui = { requestRender: vi.fn() };
    const legacy = createPiSidebarPanel(legacyTui, taggedTheme(() => "dark"), state());
    const legacyLines = legacy.render(48).map(stripTags);
    expect(legacyLines[0]).toMatch(/^╭─ ▼ 🧠 Engram/);
    expect(legacyLines.at(-1)).toMatch(/^╰─+╯$/);

    const original = {
      surface: "panel" as const,
      render: () => ["▾ INTEGRATIONS"],
      invalidate: vi.fn(),
    };
    const parts = new Map([["footer", original]]);
    const modernTui = {
      mode: "fullscreen",
      requestRender: vi.fn(),
      terminal: { [GENTLE_SHELL_SIDEBAR_STATE]: { active: true, parts } },
    };
    const modern = createPiSidebarPanel(modernTui, {
      fg: (_token, text) => text,
      bold: (text) => text,
    }, state());
    const overlayLines = modern.render(48).map(stripTags);
    const panelSection = modern.createPanelSection();
    const panelLines = panelSection.render(48).map(stripTags);
    const attachment = attachGentleShellRailPanel(
      modernTui,
      modern,
      panelSection,
      modern.createGroupedPanelSection(),
    );
    const wrapper = parts.get("footer")!;
    const attachedLines = wrapper.render(48).map(stripTags);

    expect(overlayLines[0]).toMatch(/^╭─ ▼ 🧠 Engram/);
    expect(panelLines[0]).toBe("");
    expect(panelLines[1]).toMatch(/^╭─ ▼ 🧠 Engram/);
    expect(panelLines.at(-1)).toMatch(/^╰─+╯$/);
    expect(attachedLines[1]).toBe("");
    expect(attachedLines[2]).toMatch(/^╭─ ▼ 🧠 Engram/);
    expect(wrapper.surface).toBe("panel");
    expect(panelLines.join("\n")).toContain("flema-engram · OK");
    expect(panelLines.every((line) => visibleTextWidth(line) <= 48)).toBe(true);
    attachment?.dispose();
    expect(parts.get("footer")).toBe(original);
  });

  it("contains component render failures and clamps rows using the host width metric", () => {
    const footerLine = "host footer text wider than the rail";
    const participantLine = "🧠 " + "long content ".repeat(5);
    const original = {
      render: () => [footerLine],
      invalidate: vi.fn(),
      digest: () => "footer",
    };
    const parts = new Map([["footer", original]]);
    const tui = {
      mode: "fullscreen",
      requestRender: vi.fn(),
      terminal: { [GENTLE_SHELL_SIDEBAR_STATE]: { active: true, parts } },
    };
    const failing = attachGentleShellRailPanel(tui, {
      render: () => { throw new Error("broken extension row"); },
      invalidate: vi.fn(),
      digest: () => "failing",
    });
    const wide = attachGentleShellRailPanel(tui, {
      render: () => [participantLine],
      invalidate: vi.fn(),
      digest: () => "wide",
    });
    const width = 16;
    const lines = parts.get("footer")!.render(width);

    expect(lines).toEqual([
      truncateToWidth(footerLine, width),
      truncateToWidth(participantLine, width),
    ]);
    expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);

    failing?.dispose();
    wide?.dispose();
    expect(parts.get("footer")).toBe(original);
  });

  it("contains card-group callback failures without losing the rail", () => {
    const original = {
      render: () => ["host footer"],
      invalidate: vi.fn(),
      digest: () => "footer",
      cardGroups: () => { throw new Error("broken card group"); },
    };
    const parts = new Map([["footer", original]]);
    const tui = {
      mode: "fullscreen",
      requestRender: vi.fn(),
      terminal: { [GENTLE_SHELL_SIDEBAR_STATE]: { active: true, parts } },
    };
    const attachment = attachGentleShellRailPanel(tui, {
      render: () => ["independent panel"],
      invalidate: vi.fn(),
      digest: () => "panel",
    });
    const wrapper = parts.get("footer") as typeof original & {
      cardGroups?: (width: number) => { groups: Array<{ start: number; end: number }> };
    };

    expect(wrapper.render(24)).toEqual(["host footer", "independent panel"]);
    expect(wrapper.cardGroups?.(24)).toEqual({
      groups: [{ start: 0, end: 1 }, { start: 1, end: 2 }],
    });

    attachment?.dispose();
    expect(parts.get("footer")).toBe(original);
  });

  it("groups the modern rail rows into one independent native card", () => {
    const original = {
      surface: "panel" as const,
      render: () => ["▾ INTEGRATIONS", "  1 MCP namespace"],
      invalidate: vi.fn(),
      digest: () => "integrations",
      cardGroups: () => ({ groups: [{ start: 0, end: 2 }] }),
    };
    const parts = new Map([["footer", original]]);
    const tui = {
      mode: "fullscreen",
      requestRender: vi.fn(),
      terminal: { [GENTLE_SHELL_SIDEBAR_STATE]: { active: true, parts } },
    };
    const panel = createPiSidebarPanel(tui, taggedTheme(() => "dark"), state());
    const panelSection = panel.createPanelSection();
    const groupedPanel = panel.createGroupedPanelSection();
    const attachment = attachGentleShellRailPanel(tui, panel, panelSection, groupedPanel);
    const wrapper = parts.get("footer") as typeof original & {
      cardGroups?: (width: number) => { groups: Array<{ start: number; end: number }>; loose?: number[] };
    };
    const lines = wrapper.render(48).map(stripTags);

    expect(wrapper.surface).toBe("panel");
    expect(lines.slice(0, 2)).toEqual(["▾ INTEGRATIONS", "  1 MCP namespace"]);
    expect(lines[2]).toBe("");
    expect(lines[3]).toContain("🧠 ENGRAM");
    expect(lines.slice(3).some((line) => /[╭╮╰╯│]/.test(line))).toBe(false);
    expect(wrapper.cardGroups?.(48)).toEqual({
      groups: [{ start: 0, end: 2 }, { start: 3, end: lines.length }],
    });

    attachment?.dispose();
    expect(parts.get("footer")).toBe(original);
  });

  it("collapses to a compact framed summary and can expand again", () => {
    const tui = { requestRender: vi.fn() };
    const panel = createPiSidebarPanel(tui, taggedTheme(() => "dark"), state());

    panel.setCollapsed(true);
    expect(panel.isCollapsed()).toBe(true);
    expect(panel.render(48).map(stripTags)).toEqual([
      expect.stringMatching(/^╭─ ▶ 🧠 Engram .*╮$/),
      expect.stringMatching(/^│ flema-engram · OK\s+│$/),
      expect.stringMatching(/^╰─+╯$/),
    ]);

    panel.setCollapsed(false);
    expect(panel.isCollapsed()).toBe(false);
    expect(panel.render(48).map(stripTags).join("\n")).toContain("Blockers");
    expect(tui.requestRender).toHaveBeenCalledTimes(2);
  });

  it("S8 frames both views with an integrated title, semantic colors and visible-width padding", () => {
    let version = "dark";
    const panel = createPiSidebarPanel({ requestRender: vi.fn() }, taggedTheme(() => version), state({
      projectName: "界界 café",
      blockers: [{ ...blocker, title: "界".repeat(40) }],
    }));
    for (const collapsed of [false, true]) {
      panel.setCollapsed(collapsed);
      for (const width of [18, 30, 48]) {
        const rendered = panel.render(width);
        const plain = rendered.map(stripTags);
        expect(plain[0]).toMatch(/^╭─ [▼▶] 🧠 Engram .*╮$/);
        expect(plain.at(-1)).toMatch(/^╰─+╯$/);
        expect(plain.slice(1, -1).every((line) => line.startsWith("│ ") && line.endsWith(" │"))).toBe(true);
        expect(plain.every((line) => visibleTextWidth(line) === width)).toBe(true);
        expect(plain.join("\n")).toContain("界界 café");
        if (!collapsed) expect(plain.join("\n")).toContain("…");
        expect(rendered[0]).toContain(`<${version}:border>╭─ `);
        expect(rendered[0]).toContain(`<${version}:accent>`);
        expect(rendered.slice(1, -1).every((line) => line.startsWith(`<${version}:border>│`))).toBe(true);
        expect(rendered.at(-1)).toBe(`<${version}:border>${plain.at(-1)}</${version}:border>`);
        expect(rendered.join("\n")).not.toContain(`<${version}:dim>`);
      }
      version = "light";
      expect(panel.render(30).join("\n")).not.toContain("<dark:");
    }
    for (const width of [0, 1, 2, 3, 4, 5, 8, 12]) {
      for (const collapsed of [false, true]) {
        panel.setCollapsed(collapsed);
        const plain = panel.render(width).map(stripTags);
        if (width === 0) expect(plain).toEqual([]);
        else expect(plain.length).toBeGreaterThan(0);
        expect(plain.every((line) => visibleTextWidth(line) <= width)).toBe(true);
        if (width >= 2) {
          expect(plain[0]).toMatch(/^╭.*╮$/);
          expect(plain.at(-1)).toMatch(/^╰.*╯$/);
        }
      }
    }
  });

  it("applies the active theme during every render without refetching state", () => {
    let version = "dark";
    const tui = { requestRender: vi.fn() };
    const panel = createPiSidebarPanel(tui, taggedTheme(() => version), state());

    expect(panel.render(48).join("\n")).toContain("<dark:accent>");
    version = "light";
    expect(panel.render(48).join("\n")).toContain("<light:accent>");
    expect(panel.render(48).join("\n")).not.toContain("<dark:accent>");
  });

  it("uses only Pi semantic theme tokens supported by the host", () => {
    const supported = new Set(["accent", "border", "success", "error", "warning", "muted", "dim", "text"]);
    const theme: PiSidebarTheme = {
      fg: (token, text) => {
        if (!supported.has(token)) throw new Error(`unsupported theme token: ${token}`);
        return text;
      },
      bold: (text) => text,
    };
    const panel = createPiSidebarPanel({ requestRender: vi.fn() }, theme, state());

    expect(() => panel.render(48)).not.toThrow();
  });

  it("S7 consumes left title press and toggles only on left title click", () => {
    const tui = { requestRender: vi.fn() };
    const panel = createPiSidebarPanel(tui, taggedTheme(() => "dark"), state());
    const event = { type: "click", button: "left", x: 4, y: 0, width: 48, height: 10, modifiers: {} };
    const digest = panel.digest();
    const lines = panel.render(48);
    for (const change of [
      { button: "right" }, { button: "middle" }, { y: 1 }, { y: -1 },
      { x: -1 }, { x: 48 }, { width: 0 }, { height: 0 },
      ...["release", "move", "drag", "wheel"].map((type) => ({ type })),
    ]) {
      expect(panel.handleMouse?.({ ...event, ...change })).toBeUndefined();
      expect(panel.digest()).toBe(digest);
      expect(panel.render(48)).toEqual(lines);
      expect(tui.requestRender).not.toHaveBeenCalled();
    }
    expect(panel.handleMouse?.({ ...event, type: "press" })).toEqual({ handled: true, render: false });
    expect(panel.digest()).toBe(digest);
    expect(tui.requestRender).not.toHaveBeenCalled();
    expect(panel.handleMouse?.(event)).toEqual({ handled: true, render: true });
    expect(panel.isCollapsed()).toBe(true);
    expect(panel.render(48).map(stripTags).join("\n")).not.toContain("Blockers");
    expect(tui.requestRender).toHaveBeenCalledTimes(1);
    expect(panel.handleMouse?.({ ...event, height: 3 })).toEqual({ handled: true, render: true });
    expect(panel.isCollapsed()).toBe(false);
    expect(tui.requestRender).toHaveBeenCalledTimes(2);
  });

  it("preserves mouse results and translates only local y/height for rail participants", () => {
    const original = component(["host", "footer"]);
    const parts = new Map([["footer", original]]);
    const tui = {
      mode: "fullscreen", requestRender: vi.fn(),
      terminal: { [GENTLE_SHELL_SIDEBAR_STATE]: { active: true, parts } },
    };
    const result = { handled: true, render: false };
    const peer = { ...component(["peer"]), handleMouse: vi.fn(() => result) };
    const attachment = attachGentleShellRailPanel(tui, peer)!;
    const wrapper = parts.get("footer")!;
    wrapper.render(48);
    const event = { type: "press", button: "left", x: 4, y: 2, width: 48, height: 3, modifiers: { shift: true } };
    expect(wrapper.handleMouse?.(event)).toBe(result);
    expect(peer.handleMouse).toHaveBeenLastCalledWith({ ...event, y: 0, height: 1 });
    const before = wrapper.digest();
    result.render = true;
    expect(wrapper.handleMouse?.({ ...event, type: "click" })).toBe(result);
    expect(wrapper.digest()).not.toBe(before);
    attachment.setVisible(false);
    wrapper.render(48);
    peer.handleMouse.mockClear();
    expect(wrapper.handleMouse?.(event)).toBeUndefined();
    expect(peer.handleMouse).not.toHaveBeenCalled();
    attachment.dispose();
    expect(parts.get("footer")).toBe(original);
  });

  it("mounts into the Gentle Shell rail, toggles visibility, and restores the host", () => {
    const original = component(["host status"]);
    const parts = new Map([["footer", original]]);
    const terminal = {
      columns: 160,
      rows: 40,
      [GENTLE_SHELL_SIDEBAR_STATE]: { active: true, ownsHost: () => true, parts },
    };
    const tui = { mode: "fullscreen", terminal, requestRender: vi.fn() };
    const panel = component(["engram panel"]);

    const attachment = attachGentleShellRailPanel(tui, panel);

    expect(attachment?.isMounted()).toBe(true);
    expect(parts.get("footer")).not.toBe(original);
    expect(parts.get("footer")?.render(48)).toEqual(["host status", "engram panel"]);

    attachment?.setVisible(false);
    expect(parts.get("footer")?.render(48)).toEqual(["host status"]);
    attachment?.setVisible(true);
    expect(parts.get("footer")?.render(48)).toEqual(["host status", "engram panel"]);

    attachment?.dispose();
    expect(parts.get("footer")).toBe(original);
  });

  it("shares one rail wrapper across independent participants", () => {
    const original = component(["host status"]);
    const parts = new Map([["footer", original]]);
    const terminal = {
      columns: 160,
      rows: 40,
      [GENTLE_SHELL_SIDEBAR_STATE]: { active: true, parts },
    };
    const tui = { mode: "fullscreen", terminal, requestRender: vi.fn() };

    const first = attachGentleShellRailPanel(tui, component(["first"]));
    const wrapper = parts.get("footer");
    const second = attachGentleShellRailPanel(tui, component(["second"]));

    expect(parts.get("footer")).toBe(wrapper);
    expect(wrapper?.render(48)).toEqual(["host status", "first", "second"]);

    first?.dispose();
    expect(wrapper?.render(48)).toEqual(["host status", "second"]);
    second?.dispose();
    expect(parts.get("footer")).toBe(original);
  });
});

function component(lines: string[]): PiSidebarPanel {
  let collapsed = false;
  return {
    render: () => lines,
    invalidate: vi.fn(),
    digest: () => JSON.stringify(lines),
    setState: vi.fn(),
    setCollapsed: (value) => {
      collapsed = value;
    },
    isCollapsed: () => collapsed,
  };
}

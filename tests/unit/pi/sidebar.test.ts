import { describe, expect, it, vi } from "vitest";
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

  it("collapses to a single themed summary row and can expand again", () => {
    const tui = { requestRender: vi.fn() };
    const panel = createPiSidebarPanel(tui, taggedTheme(() => "dark"), state());

    panel.setCollapsed(true);
    expect(panel.isCollapsed()).toBe(true);
    expect(panel.render(48).map(stripTags)).toEqual([
      expect.stringMatching(/^▶ 🧠 Engram · flema-engram · OK/),
    ]);

    panel.setCollapsed(false);
    expect(panel.isCollapsed()).toBe(false);
    expect(panel.render(48).map(stripTags).join("\n")).toContain("Blockers");
    expect(tui.requestRender).toHaveBeenCalledTimes(2);
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

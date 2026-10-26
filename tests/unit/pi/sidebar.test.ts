import { describe, expect, it, vi } from "vitest";
import type { Observation } from "../../../src/adapters/types.js";
import type { SidebarViewModel } from "../../../src/viewer/core.js";
import {
  createPiSidebarPanel,
  visibleTextWidth,
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
});

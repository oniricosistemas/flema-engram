/** @vitest-environment node */
/** @jsxImportSource @opentui/solid */

import { createRoot, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { EngramAdapter } from "../../../src/adapters/types.js";
import {
  createSidebarActionRegistry,
  EngramSidebar,
} from "../../../src/sidebar/plugin.js";
import type { SidebarViewModel } from "../../../src/sidebar/hooks/use-engram.js";

const mocks = vi.hoisted(() => ({
  jsx: vi.fn((type: unknown, props: Record<string, unknown>) => ({ type, props })),
  useEngram: vi.fn(),
}));

vi.mock("@opentui/solid/jsx-runtime", () => ({
  Fragment: Symbol("Fragment"),
  jsx: mocks.jsx,
  jsxs: mocks.jsx,
}));

vi.mock("@opentui/solid/jsx-dev-runtime", () => ({
  Fragment: Symbol("Fragment"),
  jsxDEV: mocks.jsx,
}));

vi.mock("../../../src/sidebar/hooks/use-engram.js", () => ({
  useEngram: mocks.useEngram,
}));

interface RenderedNode {
  type: unknown;
  props: {
    children?: unknown;
  };
}

describe("EngramSidebar rendering", () => {
  it("passes an accessor child to OpenTUI so refreshed text remains reactive", () => {
    createRoot((dispose) => {
      const [state, setState] = createSignal<SidebarViewModel>({
        changes: [],
        blockers: [],
        recentActivity: [],
        health: "loading",
        loading: true,
      });
      mocks.useEngram.mockReturnValue({ state, refresh: vi.fn() });

      const rendered = EngramSidebar({
        adapter: {} as EngramAdapter,
        actionRegistry: createSidebarActionRegistry(),
      }) as unknown as RenderedNode;
      const textNode = rendered.props.children as RenderedNode;
      const text = textNode.props.children;

      expect(textNode.type).toBe("text");
      expect(text).toEqual(expect.any(Function));
      expect((text as () => string)()).toContain("Health: CHECKING");

      setState((current) => ({
        ...current,
        health: "ok",
        loading: false,
      }));

      expect((text as () => string)()).toContain("Health: OK");
      expect((text as () => string)()).not.toContain("Health: CHECKING");
      dispose();
    });
  });
});

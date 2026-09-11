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
    onMouseDown?: () => void;
  };
}

describe("EngramSidebar rendering", () => {
  it("passes accessor children to OpenTUI so refreshed text remains reactive", () => {
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
      const boxNode = rendered.props.children as RenderedNode;
      expect(boxNode.type).toBe("box");

      const children = (Array.isArray(boxNode.props.children)
        ? boxNode.props.children
        : [boxNode.props.children]) as RenderedNode[];
      expect(children).toHaveLength(2);
      const [headerNode, bodyNode] = children;
      expect(headerNode.type).toBe("text");
      expect(bodyNode.type).toBe("text");

      const header = headerNode.props.children;
      const body = bodyNode.props.children;
      expect(header).toEqual(expect.any(Function));
      expect(body).toEqual(expect.any(Function));
      expect((header as () => string)()).toBe("▼ 🧠 Engram");
      expect((body as () => string)()).toContain("Health: CHECKING");

      setState((current) => ({
        ...current,
        health: "ok",
        loading: false,
      }));

      expect((body as () => string)()).toContain("Health: OK");
      expect((body as () => string)()).not.toContain("Health: CHECKING");
      dispose();
    });
  });

  it("wires the header click handler to the same collapse toggle as alt+c", () => {
    createRoot((dispose) => {
      const [state] = createSignal<SidebarViewModel>({
        changes: [],
        blockers: [],
        recentActivity: [],
        health: "ok",
        loading: false,
      });
      mocks.useEngram.mockReturnValue({ state, refresh: vi.fn() });

      const rendered = EngramSidebar({
        adapter: {} as EngramAdapter,
        actionRegistry: createSidebarActionRegistry(),
      }) as unknown as RenderedNode;
      const boxNode = rendered.props.children as RenderedNode;
      const [headerNode, bodyNode] = boxNode.props.children as RenderedNode[];
      const header = headerNode.props.children as () => string;
      const body = bodyNode.props.children as () => string;

      // The mocked JSX runtime captures props, so onMouseDown here is the exact
      // closure the real <text> node receives. Invoking it simulates the click
      // path (a true mouse-event dispatch needs the OpenTUI FFI host, which is
      // unavailable in this node test runtime).
      expect(headerNode.props.onMouseDown).toEqual(expect.any(Function));
      expect(bodyNode.props.onMouseDown).toBeUndefined();

      headerNode.props.onMouseDown?.();
      expect(header()).toBe("▶ 🧠 Engram");
      expect(body()).toBe("");

      headerNode.props.onMouseDown?.();
      expect(header()).toBe("▼ 🧠 Engram");
      expect(body()).toContain("[alt+c] Collapse");
      dispose();
    });
  });
});

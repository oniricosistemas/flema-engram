/** @vitest-environment node */
/** @jsxImportSource @opentui/solid */

import { createRoot, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { EngramAdapter } from "../../../src/adapters/types.js";
import { deriveODDState } from "../../../src/utils/odd-detector.js";
import {
  createSidebarActionRegistry,
  EngramSidebar,
} from "../../../src/sidebar/plugin.js";
import type { SidebarViewModel } from "../../../src/sidebar/hooks/use-engram.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require("../../../package.json") as { version: string };

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
  it("switches reactive body progress through the mounted action without fetching again", async () => {
    const actual = await vi.importActual<typeof import("../../../src/sidebar/hooks/use-engram.js")>("../../../src/sidebar/hooks/use-engram.js");
    const observations = [{
      id: 1, type: "architecture", title: "Legacy apply", scope: "project", project: "example",
      topic_key: "sdd/legacy/apply-progress", content: "Applying",
      updated_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z",
    }, {
      id: 2, type: "architecture", title: "Mirror", scope: "project", project: "example",
      topic_key: "odd/current/tasks",
      content: "# ODD Feature: Current workflow\n## Tasks\n- [ ] `ODD-001` **in_progress** — Render",
      updated_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z",
    }];
    const listObservations = vi.fn().mockResolvedValue(observations);
    const adapter = {
      health: vi.fn().mockResolvedValue({ local: { available: true } }),
      listProjects: vi.fn().mockResolvedValue([]), listObservations,
    } as unknown as EngramAdapter;
    const registry = createSidebarActionRegistry();
    const mounted = createRoot((dispose) => {
      const hook = actual.useEngram(adapter, { projectName: "example", autoRefresh: false });
      mocks.useEngram.mockReturnValue(hook);
      const rendered = EngramSidebar({ adapter, actionRegistry: registry, sessionId: "A" }) as unknown as RenderedNode;
      const box = rendered.props.children as RenderedNode;
      const [header, body] = box.props.children as RenderedNode[];
      return { hook, dispose, header, body: body.props.children as () => string };
    });
    try {
      await mounted.hook.refresh();
      expect(mounted.body()).toContain("Current workflow [current]");
      await registry.run("engram.workflow.legacy-sdd", "A");
      expect(mounted.body()).toContain("Workflow: Legacy SDD (session only)");
      expect(mounted.body()).toContain("legacy: in-progress (apply)");
      expect(mounted.body()).not.toContain("ODD Progress");
      mounted.header.props.onMouseDown?.();
      expect(mounted.body()).toBe("");
      await registry.run("engram.workflow.odd", "A");
      mounted.header.props.onMouseDown?.();
      expect(mounted.body()).toContain("Workflow: ODD");
      expect(mounted.body()).toContain("Current workflow [current]");
      expect(mounted.body()).not.toContain("SDD Progress");
      expect(listObservations).toHaveBeenCalledOnce();
    } finally {
      mounted.dispose();
    }
  });

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
      expect((header as () => string)()).toBe(`▼ 🧠 Engram v${PKG_VERSION}`);
      expect((body as () => string)()).toContain("Health: CHECKING");
      expect((body as () => string)()).toContain("No valid ODD features");

      setState((current) => ({
        ...current,
        health: "ok",
        loading: false,
        odd: deriveODDState([{
          id: 1, type: "architecture", title: "Mirror", scope: "project", project: "example",
          topic_key: "odd/reactivity/tasks",
          content: "# ODD Feature: Reactive workflow\n## Tasks\n- [ ] `ODD-001` **in_progress** — Render",
          updated_at: "2026-09-01T00:00:00Z", created_at: "2026-09-01T00:00:00Z",
        }]),
      }));

      expect((body as () => string)()).toContain("Health: OK");
      expect((body as () => string)()).not.toContain("Health: CHECKING");
      expect((body as () => string)()).toContain("Reactive workflow [reactivity]: 0/1 done");
      expect((body as () => string)()).not.toContain("No valid ODD features");
      expect((body as () => string)()).not.toContain("SDD Progress");
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
      expect(header()).toBe(`▶ 🧠 Engram v${PKG_VERSION}`);
      expect(body()).toBe("");

      headerNode.props.onMouseDown?.();
      expect(header()).toBe(`▼ 🧠 Engram v${PKG_VERSION}`);
      expect(body()).toContain("[alt+c] Collapse");
      dispose();
    });
  });
});

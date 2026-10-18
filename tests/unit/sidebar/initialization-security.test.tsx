/** @vitest-environment node */
/** @jsxImportSource @opentui/solid */

import { expect, it, vi } from "vitest";

vi.mock("@opentui/solid/jsx-dev-runtime", () => ({
  jsxDEV: (type: unknown, props: unknown) => ({ type, props }),
}));

import { createEngramTuiPlugin } from "../../../src/sidebar/plugin.js";

interface RenderedNode {
  props: { children: unknown };
}

it("contains endpoint initialization failures without reflecting credentials", async () => {
  const password = "sidebar-password";
  const token = "sidebar-token";
  const cases = [
    [
      { cloudUrl: `https://user:${password}@[` },
      "Invalid cloud baseUrl: expected a valid URL",
    ],
    [
      { cloudUrl: `https://user:${password}@host:99999/?token=${token}` },
      "Invalid cloud baseUrl: expected a valid URL",
    ],
    [
      { baseUrl: `https://user:${password}@[` },
      "Invalid baseUrl: expected an http(s) URL",
    ],
    [
      { baseUrl: `ftp://user:${password}@host` },
      "Invalid baseUrl: expected an http(s) URL",
    ],
    [{ baseUrl: "" }, "Invalid baseUrl: expected an http(s) URL"],
  ] as const;

  for (const [options, diagnostic] of cases) {
    let renderedSlot: (() => RenderedNode) | undefined;
    const registerLayer = vi.fn();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    try {
      const api = {
        slots: {
          register(value: { slots: { sidebar_content: () => RenderedNode } }) {
            renderedSlot = value.slots.sidebar_content;
          },
        },
        keymap: { registerLayer },
      };

      await expect(
        createEngramTuiPlugin().tui(api as never, { ...options, token }),
      ).resolves.toBeUndefined();

      const rendered = renderedSlot?.();
      expect(rendered?.props.children).toBe(
        `Engram sidebar unavailable: ${diagnostic}`,
      );
      expect(JSON.stringify(rendered)).not.toContain(password);
      expect(JSON.stringify(rendered)).not.toContain(token);
      expect(registerLayer).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  }
});

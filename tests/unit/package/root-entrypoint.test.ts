import { describe, expect, it } from "vitest";
import plugin, {
  EngramMcpServer,
  createEngramTuiPlugin,
} from "../../../src/index.js";

describe("package root entrypoint", () => {
  it("is an OpenCode TUI plugin while retaining the named MCP API", () => {
    expect(plugin).toMatchObject({
      id: "engram-sidebar",
      tui: expect.any(Function),
    });
    expect(createEngramTuiPlugin).toEqual(expect.any(Function));
    expect(EngramMcpServer).toEqual(expect.any(Function));
  });
});

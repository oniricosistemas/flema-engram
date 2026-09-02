import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import opencodeConfig from "../../../opencode.example.json";
import tuiConfig from "../../../tui__.json";

describe("OpenCode project configuration", () => {
  it("keeps the MCP example in the official OpenCode config file", () => {
    expect(opencodeConfig).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: {
        engram: {
          type: "local",
          command: ["npm", "run", "mcp"],
          enabled: true,
        },
      },
    });
  });

  it("keeps the TUI example and guidance clean, automatic, and dashboard-independent", () => {
    const guidance = readFileSync(new URL("../../../openspec/maintenance/2026-08-30-tui-config.md", import.meta.url), "utf8");

    expect(tuiConfig).toEqual({
      $schema: "https://opencode.ai/tui.json",
      plugin: [["./src/sidebar/plugin.tsx", {}]],
    });
    expect(guidance).toContain("loads automatically");
    expect(guidance).toContain("Alt+R");
    expect(guidance).toContain("Dashboard integration is explicitly deferred");
    expect(guidance).not.toMatch(/debugLogPath|JSONL|diagnostic log|dashboard prerequisite/i);
  });
});

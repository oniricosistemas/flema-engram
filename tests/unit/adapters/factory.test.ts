import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadEngramConfig, createConfiguredAdapter } from "../../../src/adapters/factory.js";
import { CompositeEngramAdapter } from "../../../src/adapters/composite.js";
import { LocalEngramAdapter } from "../../../src/adapters/local.js";

describe("adapters/factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prioritizes options over env vars and file config", () => {
    const config = loadEngramConfig({
      cloudUrl: "https://options.cloud",
      token: "options-token",
      baseUrl: "http://options.local",
    });

    expect(config).toEqual({
      cloudUrl: "https://options.cloud",
      localUrl: "http://options.local",
      token: "options-token",
    });
  });

  it("reads from process.env if options are not supplied", () => {
    process.env.ENGRAM_CLOUD_URL = "https://env.cloud";
    process.env.ENGRAM_CLOUD_TOKEN = "env-token";
    process.env.ENGRAM_URL = "http://env.local";

    const config = loadEngramConfig();

    expect(config).toEqual({
      cloudUrl: "https://env.cloud",
      localUrl: "http://env.local",
      token: "env-token",
    });
  });

  it("creates a CompositeEngramAdapter when cloudUrl is present", () => {
    const adapter = createConfiguredAdapter({
      cloudUrl: "https://cloud.test",
      token: "token123",
    });

    expect(adapter).toBeInstanceOf(CompositeEngramAdapter);
  });

  it("creates a LocalEngramAdapter when cloudUrl is absent", () => {
    delete process.env.ENGRAM_CLOUD_URL;
    delete process.env.ENGRAM_CLOUD_TOKEN;

    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const adapter = createConfiguredAdapter();

    expect(adapter).toBeInstanceOf(LocalEngramAdapter);
  });

  it("extracts attach host from process.argv", () => {
    const originalArgv = process.argv;
    try {
      process.argv = ["node", "opencode", "attach", "http:192.168.1.192:4100"];
      const config = loadEngramConfig();
      expect(config.localUrl).toBe("http://192.168.1.192:7437");
    } finally {
      process.argv = originalArgv;
    }
  });
});

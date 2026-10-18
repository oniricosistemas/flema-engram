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
    vi.useRealTimers();
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

  it("prioritizes an explicit local endpoint and accepts a positive finite timeout", () => {
    process.env.ENGRAM_URL = "http://env.local";
    process.env.ENGRAM_BASE_URL = "http://env-base.local";
    const originalArgv = process.argv;
    try {
      process.argv = ["node", "opencode", "attach", "http:192.168.1.192:4100"];

      expect(loadEngramConfig({
        baseUrl: "http://workspace.local:7437",
        timeoutMs: 1_250,
      })).toMatchObject({
        localUrl: "http://workspace.local:7437",
        timeoutMs: 1_250,
      });
    } finally {
      process.argv = originalArgv;
    }
  });

  it("uses the adapter default when timeout configuration is absent or invalid", () => {
    for (const timeoutMs of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(loadEngramConfig({ timeoutMs }).timeoutMs).toBeUndefined();
    }
  });

  it("propagates timeoutMs from the public factory to the local request abort", async () => {
    vi.useFakeTimers();
    delete process.env.ENGRAM_CLOUD_URL;
    delete process.env.ENGRAM_CLOUD_TOKEN;
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    let requestSignal: AbortSignal | undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const request = createConfiguredAdapter({
      baseUrl: "http://workspace.local:7437",
      timeoutMs: 1_250,
    }).health();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://workspace.local:7437/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const rejectedRequest = expect(request).rejects.toMatchObject({
      message: "Engram request timed out",
      kind: "timeout",
    });
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1_249);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejectedRequest;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an explicitly empty endpoint instead of inferring a fallback", () => {
    const originalArgv = process.argv;
    try {
      for (const argv of [
        ["node", "opencode"],
        ["node", "opencode", "attach", "http:192.168.1.192:4100"],
      ]) {
        process.argv = argv;
        expect(() => createConfiguredAdapter({ baseUrl: "" }))
          .toThrow("Invalid baseUrl: expected an http(s) URL");
      }
    } finally {
      process.argv = originalArgv;
    }
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
    delete process.env.ENGRAM_URL;
    delete process.env.ENGRAM_BASE_URL;
    try {
      process.argv = ["node", "opencode", "attach", "http:192.168.1.192:4100"];
      const config = loadEngramConfig();
      expect(config.localUrl).toBe("http://192.168.1.192:7437");
    } finally {
      process.argv = originalArgv;
    }
  });
});

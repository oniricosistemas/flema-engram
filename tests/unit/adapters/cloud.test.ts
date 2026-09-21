import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CloudEngramAdapter } from "../../../src/adapters/cloud.js";
import { EngramUnavailable, ValidationError } from "../../../src/utils/errors.js";

describe("CloudEngramAdapter", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws on invalid baseUrl during construction", () => {
    expect(() => new CloudEngramAdapter({ baseUrl: "not-a-url" })).toThrow(/Invalid cloud baseUrl/);
  });

  it("throws on invalid timeoutMs during construction", () => {
    expect(() => new CloudEngramAdapter({ timeoutMs: -1 })).toThrow(/Invalid timeoutMs/);
  });

  it("returns unavailable health when no baseUrl is provided", async () => {
    const adapter = new CloudEngramAdapter();
    const health = await adapter.health();
    expect(health).toEqual({ local: { available: false }, cloud: { available: false } });
  });

  it("returns cloud health when server responds ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ service: "engram-cloud", status: "ok" }),
    } as unknown as Response);

    const adapter = new CloudEngramAdapter({ baseUrl: "https://cloud.test", token: "secret-token", fetcher: global.fetch });
    const health = await adapter.health();

    expect(health).toEqual({ local: { available: false }, cloud: { available: true } });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://cloud.test/health",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret-token" },
      }),
    );
  });

  it("returns cloud unavailable health on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const adapter = new CloudEngramAdapter({ baseUrl: "https://cloud.test", fetcher: global.fetch });
    const health = await adapter.health();

    expect(health).toEqual({ local: { available: false }, cloud: { available: false } });
  });

  it("fetches observations successfully with auth headers", async () => {
    const mockObs = [
      {
        id: 1,
        type: "decision",
        title: "Test Obs",
        topic_key: "key/1",
        content: "Content",
        project: "my-proj",
        scope: "project",
        updated_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockObs),
    } as unknown as Response);

    const adapter = new CloudEngramAdapter({ baseUrl: "https://cloud.test", token: "tok123", fetcher: global.fetch });
    const res = await adapter.listObservations({ project: "my-proj", limit: 5 });

    expect(res).toHaveLength(1);
    expect(res[0]?.title).toBe("Test Obs");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://cloud.test/observations/recent?project=my-proj&limit=5",
      expect.objectContaining({
        headers: { Authorization: "Bearer tok123" },
      }),
    );
  });

  it("throws EngramUnavailable on 404 for list request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const adapter = new CloudEngramAdapter({ baseUrl: "https://cloud.test", fetcher: global.fetch });
    await expect(adapter.listObservations()).rejects.toThrow(EngramUnavailable);
  });

  it("returns null for getObservation when HTTP 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const adapter = new CloudEngramAdapter({ baseUrl: "https://cloud.test", fetcher: global.fetch });
    const res = await adapter.getObservation(999);
    expect(res).toBeNull();
  });

  it("validates empty search query", async () => {
    const adapter = new CloudEngramAdapter({ baseUrl: "https://cloud.test" });
    await expect(adapter.searchObservations("   ")).rejects.toThrow(ValidationError);
  });
});

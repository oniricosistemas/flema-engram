import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LocalEngramAdapter } from "../../../src/adapters/local.js";
import { EngramUnavailable, ValidationError } from "../../../src/utils/errors.js";
import { liveRecentSessionsResponse } from "../../fixtures/engram-recent-sessions.js";
import { liveRecentObservationsResponse } from "../../fixtures/engram-recent-observations.js";

// --- Mock fetch setup ---

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function networkError(): never {
  throw new TypeError("fetch failed");
}

function timeoutError(): never {
  const err = new DOMException("The operation was aborted.", "AbortError");
  throw err;
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// --- health() ---

describe("LocalEngramAdapter.health", () => {
  it("returns health status from GET /health", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ service: "engram", status: "ok", version: "1.2.3" })
    );
    const adapter = new LocalEngramAdapter();
    const result = await adapter.health();
    expect(result.local.available).toBe(true);
    expect(result.local.version).toBe("1.2.3");
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/health");
  });

  it("throws EngramUnavailable on network error", async () => {
    mockFetch.mockImplementationOnce(networkError);
    const adapter = new LocalEngramAdapter();
    await expect(adapter.health()).rejects.toMatchObject({
      name: "EngramUnavailable",
      kind: "connection",
      message: "Engram is unavailable",
    });
  });

  it("throws EngramUnavailable on timeout", async () => {
    mockFetch.mockImplementationOnce(timeoutError);
    const adapter = new LocalEngramAdapter();
    await expect(adapter.health()).rejects.toMatchObject({
      kind: "timeout",
      message: "Engram request timed out",
    });
  });

  it("aborts a request after the configured timeout bound", async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementationOnce((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      }),
    );
    const adapter = new LocalEngramAdapter({ timeoutMs: 10 });

    const request = expect(adapter.health()).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(10);

    await request;
  });

  it("uses a 5000 ms timeout by default", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null = null;
    mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      });
    });
    const request = expect(new LocalEngramAdapter().health()).rejects.toMatchObject({ kind: "timeout" });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await request;
  });

  it("categorizes malformed and schema-invalid responses", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ service: "engram", status: 42 }));
    const adapter = new LocalEngramAdapter();

    await expect(adapter.health()).rejects.toMatchObject({ kind: "parse" });
    await expect(adapter.health()).rejects.toMatchObject({ kind: "validation" });
  });

  it("categorizes non-2xx responses without leaking response bodies", async () => {
    mockFetch.mockResolvedValueOnce(new Response("secret upstream detail", { status: 503 }));
    const adapter = new LocalEngramAdapter();

    await expect(adapter.health()).rejects.toMatchObject({
      kind: "http",
      statusCode: 503,
      message: "Engram request failed with HTTP 503",
    });
  });
});

// --- listProjects() ---

describe("LocalEngramAdapter.listProjects", () => {
  it("derives distinct projects from supported observation and session reads", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([
        { id: 1, type: "decision", title: "T1", content: "c", project: "proj-a", scope: "project", updated_at: "2024-01-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" },
        { id: 2, type: "manual", title: "T2", topic_key: "k2", content: "c", project: "proj-a", scope: "personal", updated_at: "2024-01-03T00:00:00Z", created_at: "2024-01-03T00:00:00Z" },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { id: "s1", project: "proj-b", started_at: "2024-01-02T00:00:00Z", updated_at: "2024-01-03T00:00:00Z", observation_count: 4 },
      ]));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.listProjects();
    expect(result).toEqual([
      { name: "proj-a", observationCount: 2, lastActiveAt: "2024-01-03T00:00:00Z", scopes: ["personal", "project"] },
      { name: "proj-b", observationCount: 0, lastActiveAt: "2024-01-03T00:00:00Z", scopes: [] },
    ]);
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:7437/observations/recent?limit=100",
      "http://127.0.0.1:7437/sessions/recent?limit=100",
    ]);
  });

  it("returns empty array when no projects", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse([]));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.listProjects();
    expect(result).toEqual([]);
  });

  it("derives a project from the live recent-session shape without updated_at", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(liveRecentSessionsResponse));

    const result = await new LocalEngramAdapter().listProjects();

    expect(result).toEqual([
      {
        name: "general",
        observationCount: 0,
        lastActiveAt: "2026-08-30T23:31:35Z",
        scopes: [],
      },
    ]);
  });
});

// --- listObservations() ---

describe("LocalEngramAdapter.listObservations", () => {
  it("accepts the real igextractor and nukestats JSON activity response shapes", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(liveRecentObservationsResponse.igextractor))
      .mockResolvedValueOnce(jsonResponse(liveRecentObservationsResponse.nukestats));
    const adapter = new LocalEngramAdapter();

    const igextractor = await adapter.listObservations({ project: "igextractor", limit: 20 });
    const nukestats = await adapter.listObservations({ project: "nukestats", limit: 20 });

    expect(igextractor).toEqual([
      expect.objectContaining({
        id: 558,
        project: "igextractor",
        content: JSON.stringify({ command: "extract", status: "completed" }),
        updated_at: "2026-06-29T13:20:29Z",
      }),
    ]);
    expect(nukestats).toEqual([
      expect.objectContaining({
        id: 738,
        project: "nukestats",
        topic_key: "",
        updated_at: "2026-08-09T21:52:06Z",
      }),
    ]);
  });

  it("returns observations from GET /observations/recent", async () => {
    const observations = [
      { id: 1, type: "decision", title: "T1", topic_key: "k1", content: "c", project: "p", scope: "project", updated_at: "2024-01-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(observations));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.listObservations({ project: "myproj", limit: 5 });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/observations/recent");
    expect(url).toContain("project=myproj");
    expect(url).toContain("limit=5");
  });

  it("throws EngramUnavailable on fetch error", async () => {
    mockFetch.mockImplementationOnce(networkError);
    const adapter = new LocalEngramAdapter();
    await expect(adapter.listObservations()).rejects.toBeInstanceOf(EngramUnavailable);
  });

  it("normalizes a filtered null no-records response without accepting malformed payloads", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse({ observations: [] }));
    const adapter = new LocalEngramAdapter();

    await expect(adapter.listObservations({ project: "missing" })).resolves.toEqual([]);
    await expect(adapter.listObservations({ project: "missing" })).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("keeps an unfiltered null response invalid", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null));

    await expect(new LocalEngramAdapter().listObservations()).rejects.toMatchObject({
      kind: "validation",
    });
  });
});

// --- getObservation() ---

describe("LocalEngramAdapter.getObservation", () => {
  it("returns observation by id", async () => {
    const obs = { id: 42, type: "bugfix", title: "Fix", topic_key: "k", content: "x", project: "p", scope: "personal", updated_at: "2024-01-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" };
    mockFetch.mockResolvedValueOnce(jsonResponse(obs));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.getObservation(42);
    expect(result?.id).toBe(42);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/observations/42");
  });

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.getObservation(999);
    expect(result).toBeNull();
  });
});

// --- searchObservations() ---

describe("LocalEngramAdapter.searchObservations", () => {
  it("uses the supported search endpoint and percent-encodes the query", async () => {
    const obsA = { id: 1, type: "decision", title: "T", topic_key: "k", content: "c", project: "p", scope: "project", updated_at: "2024-01-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" };
    const obsB = { id: 2, type: "bugfix", title: "T2", topic_key: "k2", content: "c2", project: "p", scope: "project", updated_at: "2024-01-01T00:00:00Z", created_at: "2024-01-01T00:00:00Z" };
    mockFetch.mockResolvedValueOnce(jsonResponse([obsA, obsB]));

    const adapter = new LocalEngramAdapter();
    const result = await adapter.searchObservations("foo bar", { project: "a/b", limit: 2 });
    expect(result.map((o) => o.id)).toEqual([1, 2]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7437/search?q=foo%20bar&project=a%2Fb&limit=2",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects a blank query before sending a request", async () => {
    const adapter = new LocalEngramAdapter();
    await expect(adapter.searchObservations("   ")).rejects.toBeInstanceOf(ValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// --- listSessions() ---

describe("LocalEngramAdapter.listSessions", () => {
  it("returns sessions from GET /sessions/recent", async () => {
    const sessions = [
      { id: "s1", project: "p", started_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-02T00:00:00Z", observation_count: 3 },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(sessions));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.listSessions({ project: "p" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("s1");
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/sessions/recent");
    expect(url).toContain("project=p");
  });

  it("normalizes the live recent-session fixture for deterministic consumers", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(liveRecentSessionsResponse));

    const result = await new LocalEngramAdapter().listSessions({ limit: 1 });

    expect(result).toEqual([
      {
        ...liveRecentSessionsResponse[0],
        started_at: "2026-08-30T23:31:35Z",
        updated_at: "2026-08-30T23:31:35Z",
      },
    ]);
  });

  it("normalizes a filtered null no-records response without accepting malformed payloads", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }));
    const adapter = new LocalEngramAdapter();

    await expect(adapter.listSessions({ project: "missing" })).resolves.toEqual([]);
    await expect(adapter.listSessions({ project: "missing" })).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("keeps an unfiltered null response invalid", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null));

    await expect(new LocalEngramAdapter().listSessions()).rejects.toMatchObject({
      kind: "validation",
    });
  });
});

// --- getSession() ---

describe("LocalEngramAdapter.getSession", () => {
  it("returns the session shape exposed by the local endpoint", async () => {
    const session = {
      id: "s1",
      project: "p",
      started_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T01:00:00Z",
      observation_count: 2,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(session));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.getSession("s1");
    expect(result?.id).toBe("s1");
    expect(result).toEqual(session);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/sessions/s1");
  });

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const adapter = new LocalEngramAdapter();
    const result = await adapter.getSession("nonexistent");
    expect(result).toBeNull();
  });
});

// --- constructor options ---

describe("LocalEngramAdapter constructor", () => {
  it("uses custom baseUrl and timeout", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ service: "engram", status: "ok", version: "1.0.0" }));
    const adapter = new LocalEngramAdapter({ baseUrl: "http://custom:9999/", timeoutMs: 1000 });
    await adapter.health();
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toMatch(/^http:\/\/custom:9999/);
    expect(url).not.toContain("9999//health");
  });

  it("rejects invalid configuration before sending a request", () => {
    expect(() => new LocalEngramAdapter({ baseUrl: "file:///tmp/engram" })).toThrow("Invalid baseUrl");
    expect(() => new LocalEngramAdapter({ timeoutMs: 0 })).toThrow("Invalid timeoutMs");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

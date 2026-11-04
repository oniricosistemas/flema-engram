import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CompositeEngramAdapter } from "../../../src/adapters/composite.js";
import { EngramUnavailable, NotImplemented } from "../../../src/utils/errors.js";
import type {
  EngramAdapter,
  HealthStatus,
  Project,
  Observation,
  Session,
  SessionWithObservations,
} from "../../../src/adapters/types.js";

// --- Mock adapter factory ---

function createMockAdapter(overrides: Partial<EngramAdapter> = {}): EngramAdapter {
  return {
    health: vi.fn().mockResolvedValue({ local: { available: true } } satisfies HealthStatus),
    listProjects: vi.fn().mockResolvedValue([] satisfies Project[]),
    listObservations: vi.fn().mockResolvedValue([] satisfies Observation[]),
    getObservation: vi.fn().mockResolvedValue(null),
    searchObservations: vi.fn().mockResolvedValue([] satisfies Observation[]),
    listSessions: vi.fn().mockResolvedValue([] satisfies Session[]),
    getSession: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeObs(id: number): Observation {
  return {
    id,
    type: "manual",
    title: `Obs ${id}`,
    topic_key: `key/${id}`,
    content: `content ${id}`,
    project: "test-proj",
    scope: "project",
    updated_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Constructor ---

describe("CompositeEngramAdapter constructor", () => {
  it("throws when given empty adapter list", () => {
    expect(() => new CompositeEngramAdapter([])).toThrow("at least one adapter");
  });
});

// --- Fallback order ---

describe("CompositeEngramAdapter fallback", () => {
  it("combines health status from all adapters", async () => {
    const primary = createMockAdapter({
      health: vi.fn().mockResolvedValue({ local: { available: true, version: "1.0" } }),
    });
    const fallback = createMockAdapter({
      health: vi.fn().mockResolvedValue({ local: { available: false }, cloud: { available: true } }),
    });

    const composite = new CompositeEngramAdapter([primary, fallback]);
    const result = await composite.health();

    expect(result.local.available).toBe(true);
    expect(result.cloud?.available).toBe(true);
    expect(primary.health).toHaveBeenCalledOnce();
    expect(fallback.health).toHaveBeenCalledOnce();
  });

  it("falls back to second adapter when first throws EngramUnavailable", async () => {
    const primary = createMockAdapter({
      health: vi.fn().mockRejectedValue(new EngramUnavailable("local down")),
    });
    const fallback = createMockAdapter({
      health: vi.fn().mockResolvedValue({ local: { available: false }, cloud: { available: true } }),
    });

    const composite = new CompositeEngramAdapter([primary, fallback]);
    const result = await composite.health();

    expect(result.cloud?.available).toBe(true);
    expect(primary.health).toHaveBeenCalledOnce();
    expect(fallback.health).toHaveBeenCalledOnce();
  });

  it("throws EngramUnavailable when all adapters fail", async () => {
    const primary = createMockAdapter({
      health: vi.fn().mockRejectedValue(new EngramUnavailable("primary down")),
    });
    const fallback = createMockAdapter({
      health: vi.fn().mockRejectedValue(new EngramUnavailable("fallback down")),
    });

    const composite = new CompositeEngramAdapter([primary, fallback]);
    await expect(composite.health()).rejects.toThrow(EngramUnavailable);
  });

  it("re-throws non-EngramUnavailable errors immediately", async () => {
    const primary = createMockAdapter({
      listProjects: vi.fn().mockRejectedValue(new Error("unexpected")),
    });
    const fallback = createMockAdapter();

    const composite = new CompositeEngramAdapter([primary, fallback]);
    await expect(composite.listProjects()).rejects.toThrow("unexpected");
    expect(fallback.listProjects).not.toHaveBeenCalled();
  });
});

// --- listObservations fallback ---

describe("CompositeEngramAdapter.listObservations fallback", () => {
  it("keeps empty array as success unless empty-result fallback is enabled", async () => {
    const primary = createMockAdapter({
      listObservations: vi.fn().mockResolvedValue([]),
    });
    const fallback = createMockAdapter({
      listObservations: vi.fn().mockResolvedValue([makeObs(1)]),
    });

    const composite = new CompositeEngramAdapter([primary, fallback]);

    await expect(composite.listObservations({ project: "p" })).resolves.toEqual([]);
    expect(primary.listObservations).toHaveBeenCalledOnce();
    expect(fallback.listObservations).not.toHaveBeenCalled();
  });

  it("falls back to second adapter for listObservations", async () => {
    const obs = makeObs(1);
    const primary = createMockAdapter({
      listObservations: vi.fn().mockRejectedValue(new EngramUnavailable("down")),
    });
    const fallback = createMockAdapter({
      listObservations: vi.fn().mockResolvedValue([obs]),
    });

    const composite = new CompositeEngramAdapter([primary, fallback]);
    const result = await composite.listObservations({ project: "p" });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(1);
    expect(fallback.listObservations).toHaveBeenCalledWith({ project: "p" });
  });

  it("with empty-result fallback, prefers a non-empty cloud result and falls back to local when cloud has none", async () => {
    const cloudObservation = { ...makeObs(1), project: "cloud-proj" };
    const localObservation = { ...makeObs(2), project: "local-proj" };
    const cloud = createMockAdapter({
      listProjects: vi.fn().mockResolvedValue([{ name: "cloud-proj", observationCount: 1, lastActiveAt: "2024-01-01T00:00:00Z", scopes: ["project"] }]),
      listObservations: vi.fn(async ({ project }: { project?: string }) => project === "cloud-proj" ? [cloudObservation] : []),
    });
    const local = createMockAdapter({
      listProjects: vi.fn().mockResolvedValue([{ name: "local-proj", observationCount: 1, lastActiveAt: "2024-01-02T00:00:00Z", scopes: ["project"] }]),
      listObservations: vi.fn(async ({ project }: { project?: string }) => project === "local-proj" ? [localObservation] : []),
    });

    const composite = new CompositeEngramAdapter([cloud, local], { fallbackOnEmpty: true });

    await expect(composite.listObservations({ project: "cloud-proj" })).resolves.toEqual([cloudObservation]);
    await expect(composite.listObservations({ project: "local-proj" })).resolves.toEqual([localObservation]);
    await expect(composite.listProjects()).resolves.toEqual([
      expect.objectContaining({ name: "cloud-proj" }),
      expect.objectContaining({ name: "local-proj" }),
    ]);
    expect(cloud.listObservations).toHaveBeenCalledTimes(2);
    expect(local.listObservations).toHaveBeenCalledTimes(1);
  });
});

// --- Cache hit ---

describe("CompositeEngramAdapter cache", () => {
  it("returns cached result on second call within TTL", async () => {
    const obs = makeObs(1);
    const adapter = createMockAdapter({
      listObservations: vi.fn().mockResolvedValue([obs]),
    });

    const composite = new CompositeEngramAdapter([adapter]);

    const first = await composite.listObservations({ project: "p" });
    const second = await composite.listObservations({ project: "p" });

    expect(first).toEqual(second);
    expect(adapter.listObservations).toHaveBeenCalledOnce();
  });

  it("re-fetches after cache TTL expires", async () => {
    const obs1 = makeObs(1);
    const obs2 = makeObs(2);
    const adapter = createMockAdapter({
      listObservations: vi.fn()
        .mockResolvedValueOnce([obs1])
        .mockResolvedValueOnce([obs2]),
    });

    const composite = new CompositeEngramAdapter([adapter]);

    const first = await composite.listObservations({ project: "p" });
    expect(first[0]!.id).toBe(1);

    // Advance time past TTL
    vi.advanceTimersByTime(31_000);

    const second = await composite.listObservations({ project: "p" });
    expect(second[0]!.id).toBe(2);
    expect(adapter.listObservations).toHaveBeenCalledTimes(2);
  });

  it("does not let an older in-flight request repopulate cache after invalidation", async () => {
    let releaseOld!: (value: Observation[]) => void;
    const oldRequest = new Promise<Observation[]>((resolve) => {
      releaseOld = resolve;
    });
    const fresh = makeObs(2);
    const adapter = createMockAdapter({
      listObservations: vi.fn()
        .mockReturnValueOnce(oldRequest)
        .mockResolvedValueOnce([fresh]),
    });
    const composite = new CompositeEngramAdapter([adapter]);

    const pendingOld = composite.listObservations({ project: "p" });
    composite.clearCache();
    await expect(composite.listObservations({ project: "p" })).resolves.toEqual([fresh]);
    releaseOld([makeObs(1)]);
    await pendingOld;

    await expect(composite.listObservations({ project: "p" })).resolves.toEqual([fresh]);
    expect(adapter.listObservations).toHaveBeenCalledTimes(2);
  });

  it("caches getObservation by id", async () => {
    const obs = makeObs(42);
    const adapter = createMockAdapter({
      getObservation: vi.fn().mockResolvedValue(obs),
    });

    const composite = new CompositeEngramAdapter([adapter]);

    const first = await composite.getObservation(42);
    const second = await composite.getObservation(42);

    expect(first).toEqual(second);
    expect(adapter.getObservation).toHaveBeenCalledOnce();
  });

  it("does not cache different query params", async () => {
    const obs1 = makeObs(1);
    const obs2 = makeObs(2);
    const adapter = createMockAdapter({
      searchObservations: vi.fn()
        .mockResolvedValueOnce([obs1])
        .mockResolvedValueOnce([obs2]),
    });

    const composite = new CompositeEngramAdapter([adapter]);

    const first = await composite.searchObservations("query-a");
    const second = await composite.searchObservations("query-b");

    expect(first[0]!.id).toBe(1);
    expect(second[0]!.id).toBe(2);
    expect(adapter.searchObservations).toHaveBeenCalledTimes(2);
  });
});

// --- All adapters fail for listProjects ---

describe("CompositeEngramAdapter all-adapters-fail", () => {
  it("throws EngramUnavailable when all adapters fail for listProjects", async () => {
    const a1 = createMockAdapter({
      listProjects: vi.fn().mockRejectedValue(new EngramUnavailable("a1 down")),
    });
    const a2 = createMockAdapter({
      listProjects: vi.fn().mockRejectedValue(new EngramUnavailable("a2 down")),
    });

    const composite = new CompositeEngramAdapter([a1, a2]);
    await expect(composite.listProjects()).rejects.toThrow(EngramUnavailable);
  });
});

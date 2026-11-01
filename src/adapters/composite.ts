import type {
  EngramAdapter,
  EngramTargets,
  HealthStatus,
  Project,
  Observation,
  ListObservationsOpts,
  SearchOpts,
  Session,
  ListSessionsOpts,
} from "./types.js";
import { EngramUnavailable } from "../utils/errors.js";

const CACHE_TTL_MS = 30_000;
const DEFAULT_MAX_CACHE_SIZE = 100;

function isEmptyResult(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.length === 0);
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class CompositeEngramAdapter implements EngramAdapter {
  private readonly adapters: EngramAdapter[];
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize: number;
  private readonly fallbackOnEmpty: boolean;

  constructor(adapters: EngramAdapter[], opts?: { maxCacheSize?: number; fallbackOnEmpty?: boolean }) {
    const filtered = adapters.filter((a): a is EngramAdapter => a != null);
    if (filtered.length === 0) {
      throw new Error("CompositeEngramAdapter requires at least one adapter");
    }
    this.adapters = filtered;
    this.fallbackOnEmpty = opts?.fallbackOnEmpty ?? false;
    const size = opts?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`Invalid maxCacheSize: ${size}`);
    }
    this.maxCacheSize = size;
  }

  describeTargets(): EngramTargets {
    const targets: EngramTargets = {};
    for (const adapter of this.adapters) {
      if (typeof adapter.describeTargets === "function") {
        const info = adapter.describeTargets();
        if (info.localUrl && !targets.localUrl) targets.localUrl = info.localUrl;
        if (info.cloudUrl && !targets.cloudUrl) targets.cloudUrl = info.cloudUrl;
      }
    }
    return targets;
  }

  async health(): Promise<HealthStatus> {
    const results = await Promise.allSettled(
      this.adapters.map((adapter) => adapter.health()),
    );

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<HealthStatus> => r.status === "fulfilled",
    );

    if (fulfilled.length === 0) {
      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      )?.reason;
      throw new EngramUnavailable("All adapters failed health check", firstError instanceof Error ? firstError : undefined);
    }

    let localAvailable = false;
    let localVersion: string | undefined;
    let cloudAvailable = false;

    for (const res of fulfilled) {
      if (res.value.local.available) {
        localAvailable = true;
        if (res.value.local.version) localVersion = res.value.local.version;
      }
      if (res.value.cloud?.available) {
        cloudAvailable = true;
      }
    }

    return {
      local: { available: localAvailable, version: localVersion },
      cloud: { available: cloudAvailable },
    };
  }

  async listProjects(): Promise<Project[]> {
    return this.cached("listProjects", () => this.fallbackOnEmpty
      ? this.listProjectsAcrossAdapters()
      : this.invokeWithFallback((adapter) => adapter.listProjects()));
  }

  async listObservations(opts?: ListObservationsOpts): Promise<Observation[]> {
    const key = `listObservations:${JSON.stringify(opts ?? {}, Object.keys(opts ?? {}).sort())}`;
    return this.cached(key, () =>
      this.invokeWithFallback((adapter) => adapter.listObservations(opts)),
    );
  }

  async getObservation(id: number): Promise<Observation | null> {
    return this.cached(`getObservation:${id}`, () =>
      this.invokeWithFallback((adapter) => adapter.getObservation(id)),
    );
  }

  async searchObservations(query: string, opts?: SearchOpts): Promise<Observation[]> {
    const key = `searchObservations:${query}:${JSON.stringify(opts ?? {}, Object.keys(opts ?? {}).sort())}`;
    return this.cached(key, () =>
      this.invokeWithFallback((adapter) => adapter.searchObservations(query, opts)),
    );
  }

  async listSessions(opts?: ListSessionsOpts): Promise<Session[]> {
    const key = `listSessions:${JSON.stringify(opts ?? {}, Object.keys(opts ?? {}).sort())}`;
    return this.cached(key, () =>
      this.invokeWithFallback((adapter) => adapter.listSessions(opts)),
    );
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.cached(`getSession:${sessionId}`, () =>
      this.invokeWithFallback((adapter) => adapter.getSession(sessionId)),
    );
  }

  private async invokeWithFallback<T>(
    call: (adapter: EngramAdapter) => Promise<T>,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < this.adapters.length; i++) {
      const adapter = this.adapters[i];
      if (!adapter) continue;
      try {
        const result = await call(adapter);
        if (this.fallbackOnEmpty && isEmptyResult(result) && i < this.adapters.length - 1) {
          continue;
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (!(err instanceof EngramUnavailable)) {
          throw new EngramUnavailable(
            `Adapter call failed: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err : undefined,
          );
        }
        lastError = err;
      }
    }

    throw new EngramUnavailable(
      `All adapters failed`,
      lastError,
    );
  }

  private async listProjectsAcrossAdapters(): Promise<Project[]> {
    const projects = new Map<string, Project>();
    let lastError: Error | undefined;
    let succeeded = false;

    for (const adapter of this.adapters) {
      try {
        const adapterProjects = await adapter.listProjects();
        succeeded = true;
        for (const project of adapterProjects) {
          if (!projects.has(project.name)) projects.set(project.name, project);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!succeeded && lastError) {
      throw new EngramUnavailable("All adapters failed", lastError);
    }
    return [...projects.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.value as unknown as T;
    }

    const value = await fn();
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

    // Evict oldest entries when cache exceeds max size
    while (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    return value;
  }
}

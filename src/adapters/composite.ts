import type {
  EngramAdapter,
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

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class CompositeEngramAdapter implements EngramAdapter {
  private readonly adapters: EngramAdapter[];
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize: number;

  constructor(adapters: EngramAdapter[], opts?: { maxCacheSize?: number }) {
    const filtered = adapters.filter((a): a is EngramAdapter => a != null);
    if (filtered.length === 0) {
      throw new Error("CompositeEngramAdapter requires at least one adapter");
    }
    this.adapters = filtered;
    const size = opts?.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`Invalid maxCacheSize: ${size}`);
    }
    this.maxCacheSize = size;
  }

  async health(): Promise<HealthStatus> {
    return this.invokeWithFallback(
      (adapter) => adapter.health(),
    );
  }

  async listProjects(): Promise<Project[]> {
    return this.cached("listProjects", () =>
      this.invokeWithFallback((adapter) => adapter.listProjects()),
    );
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
        return await call(adapter);
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

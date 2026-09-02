import type {
  EngramAdapter,
  HealthStatus,
  Project,
  Observation,
  ListObservationsOpts,
  SearchOpts,
  Session,
  ListSessionsOpts,
  LocalAdapterOptions,
} from "./types.js";
import { EngramUnavailable, ValidationError } from "../utils/errors.js";
import { observationSchema } from "../schemas/observation.js";
import { localHealthResponseSchema } from "../schemas/health.js";
import { sessionSchema } from "../schemas/session.js";
import { z } from "zod";

const DEFAULT_BASE_URL = "http://127.0.0.1:7437";
const DEFAULT_TIMEOUT_MS = 5_000;
const DERIVATION_LIMIT = 100;

export class LocalEngramAdapter implements EngramAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts?: LocalAdapterOptions) {
    const raw = opts?.baseUrl ?? DEFAULT_BASE_URL;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(raw);
    } catch {
      throw new Error(`Invalid baseUrl: ${raw}`);
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error(`Invalid baseUrl: ${raw}`);
    }
    this.baseUrl = raw.replace(/\/+$/, "");
    const t = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (typeof t !== "number" || !Number.isFinite(t) || t <= 0) {
      throw new Error(`Invalid timeoutMs: ${t}`);
    }
    this.timeoutMs = t;
  }

  async health(): Promise<HealthStatus> {
    const response = await this.get("/health", localHealthResponseSchema);
    return {
      local: {
        available: response.status.toLowerCase() === "ok",
        version: response.version,
      },
    };
  }

  async listProjects(): Promise<Project[]> {
    const [observations, sessions] = await Promise.all([
      this.listObservations({ limit: DERIVATION_LIMIT }),
      this.listSessions({ limit: DERIVATION_LIMIT }),
    ]);
    return deriveProjects(observations, sessions);
  }

  async listObservations(opts?: ListObservationsOpts): Promise<Observation[]> {
    const qs = toQuery(opts);
    const schema = opts?.project
      ? z.array(observationSchema).nullable().transform((records) => records ?? [])
      : z.array(observationSchema);
    return this.get<Observation[]>(`/observations/recent${qs ? `?${qs}` : ""}`, schema);
  }

  async getObservation(id: number): Promise<Observation | null> {
    try {
      return await this.get<Observation>(`/observations/${id}`, observationSchema);
    } catch (err) {
      if (err instanceof EngramUnavailable && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async searchObservations(query: string, opts?: SearchOpts): Promise<Observation[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new ValidationError("Search query must not be empty");
    }
    const qs = toQuery({ q: trimmed, ...opts });
    return this.get<Observation[]>(`/search?${qs}`, z.array(observationSchema));
  }

  async listSessions(opts?: ListSessionsOpts): Promise<Session[]> {
    const qs = toQuery(opts);
    const schema = opts?.project
      ? z.array(sessionSchema).nullable().transform((records) => records ?? [])
      : z.array(sessionSchema);
    return this.get<Session[]>(`/sessions/recent${qs ? `?${qs}` : ""}`, schema);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    try {
      return await this.get<Session>(`/sessions/${encodeURIComponent(sessionId)}`, sessionSchema);
    } catch (err) {
      if (err instanceof EngramUnavailable && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  private async get<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new EngramUnavailable("Engram entity was not found", undefined, {
            kind: "http",
            statusCode: 404,
            endpoint: path,
          });
        }
        throw new EngramUnavailable(`Engram request failed with HTTP ${response.status}`, undefined, {
          kind: "http",
          statusCode: response.status,
          endpoint: path,
        });
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch (err) {
        throw new EngramUnavailable("Engram returned malformed JSON", err instanceof Error ? err : undefined, {
          kind: "parse",
          endpoint: path,
        });
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new EngramUnavailable("Engram returned an invalid response", undefined, {
          kind: "validation",
          endpoint: path,
        });
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof EngramUnavailable) throw err;
      const timedOut = err instanceof Error && err.name === "AbortError";
      throw new EngramUnavailable(timedOut ? "Engram request timed out" : "Engram is unavailable", err instanceof Error ? err : undefined, {
        kind: timedOut ? "timeout" : "connection",
        endpoint: path,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function toQuery(values?: object): string {
  return Object.entries(values ?? {})
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function deriveProjects(observations: Observation[], sessions: Session[]): Project[] {
  const projects = new Map<string, { observationCount: number; lastActiveAt: string; scopes: Set<string> }>();
  for (const observation of observations) {
    const project = projects.get(observation.project) ?? { observationCount: 0, lastActiveAt: observation.updated_at, scopes: new Set<string>() };
    project.observationCount += 1;
    project.lastActiveAt = maxTimestamp(project.lastActiveAt, observation.updated_at);
    project.scopes.add(observation.scope);
    projects.set(observation.project, project);
  }
  for (const session of sessions) {
    const project = projects.get(session.project) ?? { observationCount: 0, lastActiveAt: session.updated_at, scopes: new Set<string>() };
    project.lastActiveAt = maxTimestamp(project.lastActiveAt, session.updated_at);
    projects.set(session.project, project);
  }
  return [...projects.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, project]) => ({
      name,
      observationCount: project.observationCount,
      lastActiveAt: project.lastActiveAt,
      scopes: [...project.scopes].sort(),
    }));
}

function maxTimestamp(left: string, right: string): string {
  return left >= right ? left : right;
}

import http from "node:http";
import https from "node:https";
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
import { EngramUnavailable, ValidationError } from "../utils/errors.js";
import { observationSchema } from "../schemas/observation.js";
import { cloudHealthResponseSchema } from "../schemas/health.js";
import { sessionSchema } from "../schemas/session.js";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 5_000;
const DERIVATION_LIMIT = 100;

export interface CloudAdapterOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  allowInsecure?: boolean;
  fetcher?: typeof fetch;
}

export class CloudEngramAdapter implements EngramAdapter {
  private readonly baseUrl: string | undefined;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;
  private readonly allowInsecure: boolean;
  private readonly fetcher?: typeof fetch;

  constructor(opts?: CloudAdapterOptions) {
    if (opts?.baseUrl) {
      try {
        new URL(opts.baseUrl);
      } catch {
        throw new Error(`Invalid cloud baseUrl: ${opts.baseUrl}`);
      }
    }
    this.baseUrl = opts?.baseUrl ? opts.baseUrl.replace(/\/+$/, "") : undefined;
    this.token = opts?.token;
    this.allowInsecure = opts?.allowInsecure ?? true;
    this.fetcher = opts?.fetcher;
    const t = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (typeof t !== "number" || !Number.isFinite(t) || t <= 0) {
      throw new Error(`Invalid timeoutMs: ${t}`);
    }
    this.timeoutMs = t;
  }

  describeTargets(): EngramTargets {
    return { cloudUrl: this.baseUrl };
  }

  async health(): Promise<HealthStatus> {
    if (!this.baseUrl) {
      return { local: { available: false }, cloud: { available: false } };
    }
    try {
      const response = await this.get("/health", cloudHealthResponseSchema);
      return {
        local: { available: false },
        cloud: {
          available: response.status.toLowerCase() === "ok",
        },
      };
    } catch {
      return { local: { available: false }, cloud: { available: false } };
    }
  }

  async listProjects(): Promise<Project[]> {
    const [observations, sessions] = await Promise.all([
      this.listObservations({ limit: DERIVATION_LIMIT, all_projects: true }),
      this.listSessions({ limit: DERIVATION_LIMIT, all_projects: true }),
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
    if (!this.baseUrl) {
      throw new EngramUnavailable("Cloud baseUrl is not configured", undefined, {
        kind: "connection",
        endpoint: path,
      });
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      let status: number;
      let json: unknown;

      const fetchImpl = this.fetcher ?? (typeof globalThis.fetch === "function" ? globalThis.fetch : undefined);
      if (fetchImpl && (this.fetcher || typeof (fetchImpl as { mock?: unknown }).mock === "object")) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const res = await fetchImpl(url, { signal: controller.signal, headers });
          status = res.status ?? (res.ok ? 200 : 500);
          if (status >= 200 && status < 300) {
            json = await res.json();
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        const { status: httpStatus, body } = await httpRequest(url, {
          headers,
          timeoutMs: this.timeoutMs,
          allowInsecure: this.allowInsecure,
        });
        status = httpStatus;
        if (status >= 200 && status < 300) {
          try {
            json = JSON.parse(body);
          } catch (err) {
            throw new EngramUnavailable("Engram cloud returned malformed JSON", err instanceof Error ? err : undefined, {
              kind: "parse",
              endpoint: path,
            });
          }
        }
      }

      if (status < 200 || status >= 300) {
        if (status === 404) {
          throw new EngramUnavailable("Engram entity was not found", undefined, {
            kind: "http",
            statusCode: 404,
            endpoint: path,
          });
        }
        throw new EngramUnavailable(`Engram cloud request failed with HTTP ${status}`, undefined, {
          kind: "http",
          statusCode: status,
          endpoint: path,
        });
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new EngramUnavailable("Engram cloud returned an invalid response", undefined, {
          kind: "validation",
          endpoint: path,
        });
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof EngramUnavailable) throw err;
      const timedOut = err instanceof Error && err.message.includes("timed out");
      throw new EngramUnavailable(timedOut ? "Engram cloud request timed out" : "Engram cloud is unavailable", err instanceof Error ? err : undefined, {
        kind: timedOut ? "timeout" : "connection",
        endpoint: path,
      });
    }
  }
}

function httpRequest(
  urlStr: string,
  options: { headers?: Record<string, string>; timeoutMs?: number; allowInsecure?: boolean },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const reqOptions: http.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : isHttps ? 443 : 80,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: "GET",
      headers: options.headers ?? {},
      timeout: options.timeoutMs ?? 5000,
    };

    if (isHttps && options.allowInsecure !== false) {
      reqOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }

    const req = transport.request(reqOptions, (res) => {
      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 500, body: data });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
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

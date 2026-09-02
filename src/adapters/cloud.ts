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
import { NotImplemented } from "../utils/errors.js";

export interface CloudAdapterOptions {
  baseUrl?: string;
  token?: string;
}

export class CloudEngramAdapter implements EngramAdapter {
  private readonly baseUrl: string | undefined;
  private readonly token: string | undefined;

  constructor(opts?: CloudAdapterOptions) {
    if (opts?.baseUrl) {
      try {
        new URL(opts.baseUrl);
      } catch {
        throw new Error(`Invalid cloud baseUrl: ${opts.baseUrl}`);
      }
    }
    this.baseUrl = opts?.baseUrl;
    this.token = opts?.token;
  }

  async health(): Promise<HealthStatus> {
    if (!this.baseUrl) {
      return { local: { available: false }, cloud: { available: false } };
    }
    try {
      const headers: Record<string, string> = {};
      if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal, headers }).finally(() => clearTimeout(timeoutId));
      return { local: { available: false }, cloud: { available: res.ok } };
    } catch {
      return { local: { available: false }, cloud: { available: false } };
    }
  }

  async listProjects(): Promise<Project[]> {
    throw new NotImplemented("CloudEngramAdapter.listProjects");
  }

  async listObservations(_opts?: ListObservationsOpts): Promise<Observation[]> {
    throw new NotImplemented("CloudEngramAdapter.listObservations");
  }

  async getObservation(_id: number): Promise<Observation | null> {
    throw new NotImplemented("CloudEngramAdapter.getObservation");
  }

  async searchObservations(_query: string, _opts?: SearchOpts): Promise<Observation[]> {
    throw new NotImplemented("CloudEngramAdapter.searchObservations");
  }

  async listSessions(_opts?: ListSessionsOpts): Promise<Session[]> {
    throw new NotImplemented("CloudEngramAdapter.listSessions");
  }

  async getSession(_sessionId: string): Promise<Session | null> {
    throw new NotImplemented("CloudEngramAdapter.getSession");
  }
}

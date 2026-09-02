export interface EngramAdapter {
  health(): Promise<HealthStatus>;
  listProjects(): Promise<Project[]>;
  listObservations(opts?: ListObservationsOpts): Promise<Observation[]>;
  getObservation(id: number): Promise<Observation | null>;
  searchObservations(query: string, opts?: SearchOpts): Promise<Observation[]>;
  listSessions(opts?: ListSessionsOpts): Promise<Session[]>;
  getSession(sessionId: string): Promise<Session | null>;
}

export interface LocalAdapterOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface HealthStatus {
  local: { available: boolean; version?: string };
  cloud?: { available: boolean };
}

export interface Project {
  name: string;
  observationCount: number;
  lastActiveAt: string;
  scopes: string[];
}

export interface Observation {
  id: number;
  type: string;
  title: string;
  topic_key: string;
  content: string;
  project: string;
  scope: "project" | "personal";
  updated_at: string;
  created_at: string;
}

export interface ListObservationsOpts {
  project?: string;
  type?: string;
  scope?: "project" | "personal";
  topic_key_prefix?: string;
  since?: string;
  until?: string;
  limit?: number;
  cursor?: number;
}

export interface SearchOpts {
  project?: string;
  limit?: number;
}

export interface Session {
  id: string;
  project: string;
  started_at: string;
  updated_at: string;
  observation_count: number;
}

export interface SessionWithObservations extends Session {
  observations: Observation[];
}

export interface ListSessionsOpts {
  project?: string;
  limit?: number;
}

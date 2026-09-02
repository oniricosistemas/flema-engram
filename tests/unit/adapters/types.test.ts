import { describe, it, expectTypeOf } from "vitest";
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
} from "../../../src/adapters/types.js";

describe("EngramAdapter types", () => {
  it("has correct method signatures", () => {
    // Verify the interface has the expected methods by creating a mock
    const mock: EngramAdapter = {
      health: async () => ({ local: { available: true } }),
      listProjects: async () => [],
      listObservations: async () => [],
      getObservation: async () => null,
      searchObservations: async () => [],
      listSessions: async () => [],
      getSession: async () => null,
    };

    expectTypeOf(mock.health).toEqualTypeOf<() => Promise<HealthStatus>>();
    expectTypeOf(mock.listProjects).toEqualTypeOf<() => Promise<Project[]>>();
    expectTypeOf(mock.listObservations).toEqualTypeOf<
      (opts?: ListObservationsOpts) => Promise<Observation[]>
    >();
    expectTypeOf(mock.getObservation).toEqualTypeOf<
      (id: number) => Promise<Observation | null>
    >();
    expectTypeOf(mock.searchObservations).toEqualTypeOf<
      (query: string, opts?: SearchOpts) => Promise<Observation[]>
    >();
    expectTypeOf(mock.listSessions).toEqualTypeOf<
      (opts?: ListSessionsOpts) => Promise<Session[]>
    >();
    expectTypeOf(mock.getSession).toEqualTypeOf<
      (sessionId: string) => Promise<Session | null>
    >();
  });

  it("HealthStatus has correct shape", () => {
    const status: HealthStatus = {
      local: { available: true, version: "1.0.0" },
      cloud: { available: false },
    };
    expectTypeOf(status.local.available).toEqualTypeOf<boolean>();
    expectTypeOf(status.local.version).toEqualTypeOf<string | undefined>();
  });

  it("Observation has correct fields", () => {
    const obs: Observation = {
      id: 1,
      type: "decision",
      title: "Test",
      topic_key: "test/key",
      content: "content",
      project: "proj",
      scope: "project",
      updated_at: "2024-01-01T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
    };
    expectTypeOf(obs.scope).toEqualTypeOf<"project" | "personal">();
  });

  it("models the session shape returned by the local endpoint", () => {
    const session: Session = {
      id: "s1",
      project: "proj",
      started_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T01:00:00Z",
      observation_count: 5,
    };
    expectTypeOf(session).toMatchTypeOf<Session>();
  });

  it("exposes bounded local HTTP options", () => {
    const options: LocalAdapterOptions = {
      baseUrl: "http://127.0.0.1:7437",
      timeoutMs: 5_000,
    };
    expectTypeOf(options.timeoutMs).toEqualTypeOf<number | undefined>();
  });
});

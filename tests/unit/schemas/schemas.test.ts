import { describe, it, expect } from "vitest";
import { z } from "zod";
import { observationSchema } from "../../../src/schemas/observation.js";
import { projectSchema } from "../../../src/schemas/project.js";
import {
  sessionSchema,
  sessionWithObservationsSchema,
} from "../../../src/schemas/session.js";

// --- Observation schema ---

describe("observationSchema", () => {
  const valid = {
    id: 1,
    type: "decision",
    title: "Chose Zustand",
    topic_key: "architecture/state",
    content: "Replaced Redux with Zustand",
    project: "my-app",
    scope: "project",
    updated_at: "2024-01-15T10:30:00Z",
    created_at: "2024-01-15T10:00:00Z",
  };

  it("accepts valid observation", () => {
    const result = observationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = observationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty string fields", () => {
    const result = observationSchema.safeParse({ ...valid, type: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime strings", () => {
    const result = observationSchema.safeParse({ ...valid, updated_at: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("normalizes live SQLite timestamps to UTC ISO timestamps", () => {
    expect(observationSchema.parse({
      ...valid,
      updated_at: "2026-08-30 23:29:11",
      created_at: "2026-08-30 23:29:10",
    })).toMatchObject({
      updated_at: "2026-08-30T23:29:11Z",
      created_at: "2026-08-30T23:29:10Z",
    });
  });

  it("rejects invalid scope", () => {
    const result = observationSchema.safeParse({ ...valid, scope: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects non-number id", () => {
    const result = observationSchema.safeParse({ ...valid, id: "1" });
    expect(result.success).toBe(false);
  });

  it("strips unknown fields (passthrough off)", () => {
    const result = observationSchema.safeParse({ ...valid, extra: "field" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("extra");
    }
  });
});

// --- Project schema ---

describe("projectSchema", () => {
  const valid = {
    name: "my-app",
    observationCount: 42,
    lastActiveAt: "2024-01-15T10:00:00Z",
    scopes: ["project", "personal"],
  };

  it("accepts valid project", () => {
    const result = projectSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = projectSchema.safeParse({ observationCount: 1, lastActiveAt: "2024-01-01", scopes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = projectSchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime in lastActiveAt", () => {
    const result = projectSchema.safeParse({ ...valid, lastActiveAt: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects non-array scopes", () => {
    const result = projectSchema.safeParse({ ...valid, scopes: "project" });
    expect(result.success).toBe(false);
  });

  it("accepts empty scopes array", () => {
    const result = projectSchema.safeParse({ ...valid, scopes: [] });
    expect(result.success).toBe(true);
  });
});

// --- Session schema ---

describe("sessionSchema", () => {
  const valid = {
    id: "sess-abc-123",
    project: "my-app",
    started_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T11:00:00Z",
    observation_count: 5,
  };

  it("accepts valid session", () => {
    const result = sessionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("normalizes a missing updated_at to started_at", () => {
    const { updated_at: _updatedAt, ...liveSession } = valid;

    expect(sessionSchema.parse(liveSession)).toEqual({
      ...liveSession,
      updated_at: liveSession.started_at,
    });
  });

  it("normalizes the live SQLite started_at before applying the fallback", () => {
    expect(sessionSchema.parse({
      id: "live-session",
      project: "general",
      started_at: "2026-08-30 23:31:35",
      observation_count: 1,
    })).toEqual({
      id: "live-session",
      project: "general",
      started_at: "2026-08-30T23:31:35Z",
      updated_at: "2026-08-30T23:31:35Z",
      observation_count: 1,
    });
  });

  it("rejects missing id", () => {
    const result = sessionSchema.safeParse({ project: "p", started_at: "t", observation_count: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects empty id", () => {
    const result = sessionSchema.safeParse({ ...valid, id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime in started_at", () => {
    const result = sessionSchema.safeParse({ ...valid, started_at: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime in updated_at", () => {
    const result = sessionSchema.safeParse({ ...valid, updated_at: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects non-number observation_count", () => {
    const result = sessionSchema.safeParse({ ...valid, observation_count: "5" });
    expect(result.success).toBe(false);
  });

  it.each(["project", "started_at", "observation_count"] as const)(
    "still rejects a missing required %s",
    (field) => {
      const candidate: Partial<typeof valid> = { ...valid };
      delete candidate[field];

      expect(sessionSchema.safeParse(candidate).success).toBe(false);
    },
  );
});

// --- SessionWithObservations schema ---

describe("sessionWithObservationsSchema", () => {
  const validSession = {
    id: "sess-1",
    project: "p",
    started_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T01:00:00Z",
    observation_count: 1,
  };

  const validObs = {
    id: 1,
    type: "manual",
    title: "T",
    topic_key: "k",
    content: "c",
    project: "p",
    scope: "project",
    updated_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
  };

  it("accepts session with observations array", () => {
    const result = sessionWithObservationsSchema.safeParse({
      ...validSession,
      observations: [validObs],
    });
    expect(result.success).toBe(true);
  });

  it("accepts session with empty observations", () => {
    const result = sessionWithObservationsSchema.safeParse({
      ...validSession,
      observations: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid observation in array", () => {
    const result = sessionWithObservationsSchema.safeParse({
      ...validSession,
      observations: [{ id: "not-a-number" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing observations field", () => {
    const result = sessionWithObservationsSchema.safeParse(validSession);
    expect(result.success).toBe(false);
  });
});

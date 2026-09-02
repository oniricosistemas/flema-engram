import { describe, expect, it } from "vitest";
import type { Observation } from "../../../src/adapters/types.js";
import {
  collectBlockers,
  groupByChange,
  normalizePhase,
  parseSDDTopicKey,
} from "../../../src/utils/sdd-detector.js";

function observation(
  id: number,
  topic_key: string,
  overrides: Partial<Observation> = {},
): Observation {
  const day = String(id).padStart(2, "0");
  return {
    id,
    type: "manual",
    title: `Artifact ${id}`,
    topic_key,
    content: "Artifact content",
    project: "demo",
    scope: "project",
    updated_at: `2026-08-${day}T00:00:00.000Z`,
    created_at: `2026-08-${day}T00:00:00.000Z`,
    ...overrides,
  };
}

describe("SDD topic normalization", () => {
  it("Given report aliases, when normalized, then canonical phases are returned", () => {
    expect(normalizePhase("apply-progress")).toBe("apply");
    expect(normalizePhase("verify-report")).toBe("verify");
    expect(normalizePhase("archive-report")).toBe("archive");
  });

  it("Given canonical and unknown keys, when parsed, then only recognized SDD keys survive", () => {
    expect(parseSDDTopicKey("sdd/add-auth/spec")).toEqual({
      changeName: "add-auth",
      phase: "spec",
      artifact: "spec",
    });
    expect(parseSDDTopicKey("architecture/auth-model")).toBeNull();
    expect(parseSDDTopicKey("sdd/add-auth/other")).toBeNull();
  });
});

describe("groupByChange", () => {
  it("Given report artifacts, when grouped, then aliases, state, and artifacts are canonical", () => {
    const changes = groupByChange([
      observation(1, "sdd/release/proposal"),
      observation(2, "sdd/release/verify-report"),
      observation(3, "sdd/release/archive-report"),
    ]);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      name: "release",
      state: "archived",
      latestAt: "2026-08-03T00:00:00.000Z",
    });
    expect(changes[0]!.phases.map(({ phase }) => phase)).toEqual([
      "proposal",
      "verify",
      "archive",
    ]);
    expect(changes[0]!.artifacts).toEqual([
      expect.objectContaining({ kind: "proposal", topicKey: "sdd/release/proposal" }),
      expect.objectContaining({ kind: "verify", topicKey: "sdd/release/verify-report" }),
      expect.objectContaining({ kind: "archive", topicKey: "sdd/release/archive-report" }),
    ]);
  });

  it("Given active artifacts, when grouped, then state and phase progress are deterministic", () => {
    const [change] = groupByChange([
      observation(2, "sdd/feature/design"),
      observation(1, "sdd/feature/spec"),
      observation(4, "architecture/unrelated"),
    ]);

    expect(change).toMatchObject({ name: "feature", state: "in-progress" });
    expect(change!.phases).toEqual([
      expect.objectContaining({ phase: "spec", status: "done" }),
      expect.objectContaining({ phase: "design", status: "in-progress" }),
    ]);
  });

  it("Given duplicate canonical phases, when grouped, then every artifact is retained", () => {
    const [change] = groupByChange([
      observation(1, "sdd/feature/apply"),
      observation(2, "sdd/feature/apply-progress"),
    ]);

    expect(change!.phases).toEqual([
      expect.objectContaining({ phase: "apply", observationId: 2 }),
    ]);
    expect(change!.artifacts.map(({ topicKey }) => topicKey)).toEqual([
      "sdd/feature/apply",
      "sdd/feature/apply-progress",
    ]);
  });
});

describe("collectBlockers", () => {
  it("Given explicit markers, when blockers are collected, then they are newest first", () => {
    const blockers = collectBlockers([
      observation(1, "sdd/x/apply-progress", {
        type: "blocker",
        title: "Dependency unavailable",
      }),
      observation(3, "sdd/x/verify-report", {
        content: "Status: blocked\nBlocker: waiting for approval",
      }),
      observation(2, "sdd/x/tasks", { title: "Blocked: API decision" }),
    ]);

    expect(blockers.map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it("Given ordinary decisions and bugfixes, when blockers are collected, then neither is inferred", () => {
    expect(
      collectBlockers([
        observation(1, "sdd/x/design", { type: "decision" }),
        observation(2, "sdd/x/apply-progress", { type: "bugfix" }),
      ]),
    ).toEqual([]);
  });
});

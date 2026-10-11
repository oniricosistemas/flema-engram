import { describe, expect, it } from "vitest";
import type { Observation } from "../../../src/adapters/types.js";
import { deriveODDState, parseODDTopicKey } from "../../../src/utils/odd-detector.js";
import { oddStateSchema } from "../../../src/schemas/odd-state.js";

const task = (id: string, status = "pending", checked = false) =>
  `- [${checked ? "x" : " "}] \`${id}\` **${status}** — Task ${id}`;
const document = (...tasks: string[]) => `# ODD Feature: Release\n\n## Tasks\n${tasks.join("\n")}\n\n## Progress\n- [ ] Not a task`;
function observation(id: number, overrides: Partial<Observation> = {}): Observation {
  return {
    id, type: "manual", title: "Mirror", topic_key: "odd/release/tasks",
    content: document(task("ODD-001")), project: "demo", scope: "project",
    updated_at: "2026-08-01T00:00:00.000Z", created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ODD document contract", () => {
  it("accepts only exact canonical topic keys", () => {
    expect(parseODDTopicKey("odd/release/tasks")).toEqual({ featureId: "release" });
    for (const key of ["odd/release/state", "odd//tasks", "odd/a/b/tasks", "odd/ /tasks", "sdd/release/tasks", "odd/release/tasks/"]) {
      expect(parseODDTopicKey(key)).toBeNull();
    }
  });

  it.each(["\n", "\r", "\r\n", "\u2028", "\u2029", " ", "/extra"])("rejects topic suffix %j without deriving a feature", suffix => {
    const topic_key = `odd/release/tasks${suffix}`;
    expect(parseODDTopicKey(topic_key)).toBeNull();
    const result = deriveODDState([observation(1, { topic_key })]);
    expect(result.features).toEqual([]);
    expect(result.diagnostics.map(d => d.code)).toEqual(["invalid_topic"]);
  });

  it("derives all explicit states, counts, version and source provenance", () => {
    const result = deriveODDState([observation(7, { content: document(
      task("ODD-001"), task("ODD-002", "in_progress"), task("ODD-003", "blocked"),
      task("ODD-004", "done", true), task("ODD-005", "cancelled", true),
    ) })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.features[0]).toMatchObject({
      version: 1, featureId: "release", title: "Release",
      provenance: { observationId: 7, topicKey: "odd/release/tasks", project: "demo", updatedAt: "2026-08-01T00:00:00.000Z" },
      progress: { total: 5, pending: 1, in_progress: 1, blocked: 1, done: 1, cancelled: 1 },
    });
    expect(result.features[0]!.tasks.map(t => t.id)).toEqual(["ODD-001", "ODD-002", "ODD-003", "ODD-004", "ODD-005"]);
    expect(result.bounded).toBe(true);
    expect(oddStateSchema.safeParse(result).success).toBe(true);
  });

  it("ignores fenced examples and checklists outside Tasks, including nested fences", () => {
    const content = ["~~~markdown", "# ODD Feature: Fake", "## Tasks", task("EXAMPLE"), "~~~", "# ODD Feature: Real", "## Objective", "- [ ] unrelated", "## Tasks", "```markdown", task("FAKE", "done"), "```", task("REAL"), "### Notes", "~~~", task("FAKE2"), "~~~", "## Verification", task("OUTSIDE")].join("\n");
    const result = deriveODDState([observation(1, { content })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.features[0]!.title).toBe("Real");
    expect(result.features[0]!.tasks.map(t => t.id)).toEqual(["REAL"]);
  });

  it.each([
    [document(task("A", "done")), "checkbox_status_mismatch"],
    [document(task("A", "pending", true)), "checkbox_status_mismatch"],
    [document(task("A", "unknown")), "invalid_task"],
    [document("- [ ] Missing stable ID"), "invalid_task"],
    [document(task("A"), task("A")), "duplicate_task_id"],
    [document(task("has spaces")), "invalid_task"],
    [document("- [ ] `A` **pending** — "), "invalid_task"],
    [document(task("A")) + "\n# ODD Feature: Duplicate", "invalid_heading"],
    [document(task("A")) + "\n```", "unclosed_fence"],
    ["## Tasks\n" + task("A"), "invalid_heading"],
    ["# ODD Feature: Release", "invalid_tasks_section"],
    [document(), "empty_tasks"],
    [document(task("A")) + "\n## Tasks\n" + task("B"), "invalid_tasks_section"],
    ["{\"tasks\": []}", "invalid_heading"],
  ])("rejects malformed documents with diagnostics: %s", (content, code) => {
    const result = deriveODDState([observation(9, { content })]);
    expect(result.features).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, provenance: expect.objectContaining({ observationId: 9 }) }));
  });

  it("isolates projects and chooses newest valid timestamps with ID ties independently of order", () => {
    const input = [
      observation(1), observation(2, { updated_at: "2026-08-02 00:00:00" }),
      observation(3, { updated_at: "2026-08-02T00:00:00Z" }),
      observation(4, { project: "other" }),
      observation(5, { updated_at: "2026-08-03T00:00:00Z", content: "broken" }),
      observation(6, { topic_key: "odd/another/tasks" }),
    ];
    const result = deriveODDState(input);
    expect(result).toEqual(deriveODDState([...input].reverse()));
    expect(result.features.map(f => [f.provenance.project, f.featureId, f.provenance.observationId])).toEqual([
      ["demo", "another", 6], ["demo", "release", 3], ["other", "release", 4],
    ]);
    expect(result.diagnostics.map(d => d.code)).toEqual(["invalid_heading", "invalid_tasks_section"]);
    expect(result.diagnostics.every(d => d.provenance.observationId === 5)).toBe(true);
  });

  it.each([
    ["2026-08-01 00:00:00.1", "2026-08-01 00:00:00.9"],
    ["2026-08-01 00:00:00.123456788", "2026-08-01 00:00:00.123456789"],
    ["2026-08-01T00:00:00.100Z", "2026-08-01T00:00:00.900Z"],
    ["2026-08-01T00:00:00.123456788Z", "2026-08-01T00:00:00.123456789Z"],
    ["2026-08-01T00:00:00.123456788Z", "2026-08-01 00:00:00.123456789"],
    ["2026-08-01 00:00:00.9", "2026-08-01T00:00:00.901Z"],
    ["2026-08-01 00:00:00.999999999", "2026-08-01T00:00:01Z"],
  ])("orders fractional instants %s < %s before observation IDs", (older, newer) => {
    const input = [observation(99, { updated_at: older }), observation(1, { updated_at: newer })];
    const result = deriveODDState(input);
    expect(result.diagnostics).toEqual([]);
    expect(result.features[0]!.provenance).toMatchObject({ observationId: 1, updatedAt: newer });
    expect(result).toEqual(deriveODDState([...input].reverse()));
  });

  it.each([
    ["2026-08-01 00:00:00.1", "2026-08-01T00:00:00.100000000Z"],
    ["2026-08-01 00:00:00.1234567890", "2026-08-01T00:00:00.123456789Z"],
    ["2026-08-01 00:00:00.000000000", "2026-08-01T00:00:00Z"],
  ])("uses ID ties only for equal instants %s = %s", (sqlite, iso) => {
    const input = [observation(99, { updated_at: sqlite }), observation(1, { updated_at: iso })];
    const result = deriveODDState(input);
    expect(result.diagnostics).toEqual([]);
    expect(result.features[0]!.provenance.observationId).toBe(99);
    expect(result).toEqual(deriveODDState([...input].reverse()));
  });

  it("handles CRLF and long fences without treating shorter fences as closure", () => {
    const content = ["# ODD Feature: Release", "## Tasks", "````markdown", "```", task("FAKE"), "````", task("REAL")].join("\r\n");
    const result = deriveODDState([observation(1, { content, updated_at: "2026-08-01 00:00:00" })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.features[0]!.tasks.map(t => t.id)).toEqual(["REAL"]);
    expect(result.features[0]!.provenance.updatedAt).toBe("2026-08-01 00:00:00");
  });

  it("reports invalid ODD topics and timestamps without deriving SDD or fake progress", () => {
    const result = deriveODDState([
      observation(1, { topic_key: "odd/release/state" }),
      observation(2, { updated_at: "not-a-date" }),
      observation(3, { topic_key: "sdd/release/tasks" }),
    ]);
    expect(result.features).toEqual([]);
    expect(result.diagnostics.map(d => d.code)).toEqual(["invalid_topic", "invalid_timestamp"]);
    expect(deriveODDState([])).toEqual({ bounded: true, features: [], diagnostics: [] });
  });
});

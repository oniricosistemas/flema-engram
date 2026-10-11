import type { Observation } from "../adapters/types.js";
import { oddTaskSchema } from "../schemas/odd-state.js";
import type { ODDDiagnostic, ODDFeature, ODDProvenance, ODDState, ODDTask } from "../schemas/odd-state.js";
import { engramTimestampSchema } from "../schemas/timestamp.js";

export function parseODDTopicKey(topicKey: string): { featureId: string } | null {
  const match = /^odd\/([^/\s]+)\/tasks$/.exec(topicKey);
  return match && match[0] === topicKey ? { featureId: match[1]! } : null;
}

const TASK_LINE = /^- \[([ x])\] `([^`]+)` \*\*([^*]+)\*\* — (\S.*)$/;

type OrderingTimestamp = { wholeSecond: number; fraction: string };

function orderingTimestamp(original: string, normalized: string): OrderingTimestamp {
  // Validation normalizes SQLite timestamps without their fraction; Date.parse
  // also truncates ISO sub-millisecond digits. Keep the original digits separately.
  return {
    wholeSecond: Date.parse(normalized.replace(/\.\d+(?=Z$)/, "")),
    fraction: /\.(\d+)/.exec(original)?.[1] ?? "",
  };
}

function compareTimestamps(a: OrderingTimestamp, b: OrderingTimestamp): number {
  if (a.wholeSecond !== b.wholeSecond) return a.wholeSecond - b.wholeSecond;
  const precision = Math.max(a.fraction.length, b.fraction.length);
  const left = a.fraction.padEnd(precision, "0");
  const right = b.fraction.padEnd(precision, "0");
  return left === right ? 0 : left > right ? 1 : -1;
}

function parseDocument(observation: Observation, featureId: string, provenance: ODDProvenance): {
  feature?: ODDFeature;
  diagnostics: ODDDiagnostic[];
} {
  const diagnostics: ODDDiagnostic[] = [];
  const report = (code: ODDDiagnostic["code"], message: string, line?: number) => {
    diagnostics.push({ code, message, provenance, ...(line ? { line } : {}) });
  };
  const tasks: ODDTask[] = [];
  const ids = new Set<string>();
  const titles: string[] = [];
  let sections = 0;
  let inTasks = false;
  let fence: { marker: string; length: number } | undefined;

  for (const [index, raw] of observation.content.split(/\r?\n/).entries()) {
    const line = index + 1;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(raw);
    if (fence) {
      if (fenceMatch && fenceMatch[1]![0] === fence.marker &&
          fenceMatch[1]!.length >= fence.length && !fenceMatch[2]!.trim()) fence = undefined;
      continue;
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1]![0]!, length: fenceMatch[1]!.length };
      continue;
    }
    const heading = /^# ODD Feature: (\S.*)$/.exec(raw);
    if (heading) titles.push(heading[1]!.trim());
    if (/^#{1,2}(?:\s|$)/.test(raw)) {
      inTasks = /^## Tasks\s*$/.test(raw);
      if (inTasks) sections++;
      continue;
    }
    if (!inTasks || !/^\s*[-*+]\s+\[/.test(raw)) continue;
    const match = TASK_LINE.exec(raw);
    const parsed = oddTaskSchema.safeParse(match && {
      id: match[2], status: match[3], title: match[4]!.trim(),
    });
    if (!match || !parsed.success) {
      report("invalid_task", "Expected a canonical task checklist line with stable ID, status and title.", line);
      continue;
    }
    const task = parsed.data;
    if ((match[1] === "x") !== (task.status === "done" || task.status === "cancelled")) {
      report("checkbox_status_mismatch", "Checkbox must agree with explicit task status.", line);
    }
    if (ids.has(task.id)) report("duplicate_task_id", `Duplicate task ID: ${task.id}.`, line);
    ids.add(task.id);
    tasks.push(task);
  }
  if (fence) report("unclosed_fence", "Markdown fence must be closed.");
  if (titles.length !== 1) report("invalid_heading", "Expected exactly one top-level ODD Feature heading.");
  if (sections !== 1) report("invalid_tasks_section", "Expected exactly one Tasks section.");
  if (sections === 1 && tasks.length === 0 && diagnostics.length === 0) {
    report("empty_tasks", "Tasks section must contain at least one canonical task.");
  }
  if (diagnostics.length) return { diagnostics };
  const progress: ODDFeature["progress"] = {
    total: tasks.length, pending: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0,
  };
  for (const task of tasks) progress[task.status]++;
  return { diagnostics, feature: { version: 1, featureId, title: titles[0]!, tasks, progress, provenance } };
}

/** Derive only from supplied observations; no history fetch, SDD fallback or inferred progress. */
export function deriveODDState(observations: readonly Observation[]): ODDState {
  const diagnostics: ODDDiagnostic[] = [];
  const latest = new Map<string, { feature: ODDFeature; timestamp: OrderingTimestamp }>();
  for (const observation of observations) {
    if (!observation.topic_key.startsWith("odd/")) continue;
    const provenance: ODDProvenance = {
      observationId: observation.id, topicKey: observation.topic_key,
      project: observation.project, updatedAt: observation.updated_at,
    };
    const topic = parseODDTopicKey(observation.topic_key);
    if (!topic) {
      diagnostics.push({ code: "invalid_topic", message: "Expected odd/<feature-id>/tasks.", provenance });
      continue;
    }
    const timestamp = engramTimestampSchema.safeParse(observation.updated_at);
    if (!timestamp.success) {
      diagnostics.push({ code: "invalid_timestamp", message: "Expected a valid Engram timestamp.", provenance });
      continue;
    }
    const parsed = parseDocument(observation, topic.featureId, provenance);
    diagnostics.push(...parsed.diagnostics);
    if (!parsed.feature) continue;
    const key = JSON.stringify([observation.project, topic.featureId]);
    const current = latest.get(key);
    const time = orderingTimestamp(observation.updated_at, timestamp.data);
    const comparison = current ? compareTimestamps(time, current.timestamp) : 1;
    if (!current || comparison > 0 ||
        (comparison === 0 && observation.id > current.feature.provenance.observationId)) {
      latest.set(key, { feature: parsed.feature, timestamp: time });
    }
  }
  return {
    bounded: true,
    features: [...latest.values()].map(({ feature }) => feature).sort((a, b) =>
      a.provenance.project.localeCompare(b.provenance.project) || a.featureId.localeCompare(b.featureId)),
    diagnostics: diagnostics.sort((a, b) =>
      a.provenance.project.localeCompare(b.provenance.project) ||
      a.provenance.topicKey.localeCompare(b.provenance.topicKey) ||
      a.provenance.observationId - b.provenance.observationId || (a.line ?? 0) - (b.line ?? 0) ||
      a.code.localeCompare(b.code)),
  };
}

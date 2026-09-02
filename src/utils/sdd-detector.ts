import type { Observation } from "../adapters/types.js";

export const SDD_PHASES = [
  "init",
  "explore",
  "proposal",
  "spec",
  "design",
  "tasks",
  "apply",
  "verify",
  "archive",
] as const;

export type SDDPhaseName = (typeof SDD_PHASES)[number];
export type SDDChangeState = "open" | "in-progress" | "completed" | "archived";

export interface SDDArtifact {
  observationId: number;
  kind: SDDPhaseName;
  topicKey: string;
  title: string;
  updatedAt: string;
}

export interface SDDPhase {
  phase: SDDPhaseName;
  status: "pending" | "in-progress" | "done";
  topicKey: string;
  observationId: number;
}

export interface SDDChange {
  name: string;
  state: SDDChangeState;
  latestAt: string;
  phases: SDDPhase[];
  artifacts: SDDArtifact[];
  blockers: Observation[];
}

const PHASE_ALIASES: Readonly<Record<string, SDDPhaseName>> = {
  "apply-progress": "apply",
  "verify-report": "verify",
  "archive-report": "archive",
};

const phaseOrder = (phase: SDDPhaseName): number => SDD_PHASES.indexOf(phase);

export function normalizePhase(artifact: string): SDDPhaseName | undefined {
  const alias = PHASE_ALIASES[artifact];
  if (alias) return alias;
  return (SDD_PHASES as readonly string[]).includes(artifact)
    ? (artifact as SDDPhaseName)
    : undefined;
}

export function parseSDDTopicKey(topicKey: string): {
  changeName: string;
  phase: SDDPhaseName;
  artifact: string;
} | null {
  const match = /^sdd\/([^/]+)\/([^/]+)$/.exec(topicKey);
  const changeName = match?.[1];
  const artifact = match?.[2];
  if (!changeName || !artifact) return null;
  const phase = normalizePhase(artifact);
  return phase ? { changeName, phase, artifact } : null;
}

const BLOCKER_CONTENT = [
  /status\s*[:：]\s*blocked\b/i,
  /\bblocker\s*[:：]/i,
  /\bblocked\s+(?:by|on|waiting)\b/i,
  /\b(?:depends?\s+on|waiting\s+(?:for|on))\b/i,
];

export function collectBlockers(observations: Observation[]): Observation[] {
  return observations
    .filter(
      (observation) =>
        observation.type.toLowerCase() === "blocker" ||
        /\bblocked\b/i.test(observation.title) ||
        BLOCKER_CONTENT.some((pattern) => pattern.test(observation.content)),
    )
    .sort(compareNewestObservation);
}

export function deriveChangeState(phases: readonly SDDPhaseName[]): SDDChangeState {
  if (phases.includes("archive")) return "archived";
  if (phases.includes("verify")) return "completed";
  return phases.some((phase) => phaseOrder(phase) > phaseOrder("proposal"))
    ? "in-progress"
    : "open";
}

function compareNewestObservation(a: Observation, b: Observation): number {
  return b.updated_at.localeCompare(a.updated_at) || b.id - a.id;
}

export function groupByChange(observations: Observation[]): SDDChange[] {
  const grouped = new Map<string, Array<{ observation: Observation; phase: SDDPhaseName }>>();

  for (const observation of observations) {
    const parsed = parseSDDTopicKey(observation.topic_key);
    if (!parsed) continue;
    const entries = grouped.get(parsed.changeName) ?? [];
    entries.push({ observation, phase: parsed.phase });
    grouped.set(parsed.changeName, entries);
  }

  return [...grouped.entries()]
    .map(([name, entries]): SDDChange => {
      const latestByPhase = new Map<SDDPhaseName, Observation>();
      for (const { observation, phase } of entries) {
        const current = latestByPhase.get(phase);
        if (!current || compareNewestObservation(observation, current) < 0) {
          latestByPhase.set(phase, observation);
        }
      }

      const phaseNames = [...latestByPhase.keys()].sort(
        (a, b) => phaseOrder(a) - phaseOrder(b),
      );
      const state = deriveChangeState(phaseNames);
      const activePhase = state === "open" || state === "in-progress"
        ? phaseNames.at(-1)
        : undefined;
      const phases = phaseNames.map((phase): SDDPhase => {
        const observation = latestByPhase.get(phase)!;
        return {
          phase,
          status: phase === activePhase ? "in-progress" : "done",
          topicKey: observation.topic_key,
          observationId: observation.id,
        };
      });
      const artifacts = entries
        .map(({ observation, phase }): SDDArtifact => ({
          observationId: observation.id,
          kind: phase,
          topicKey: observation.topic_key,
          title: observation.title,
          updatedAt: observation.updated_at,
        }))
        .sort(
          (a, b) =>
            phaseOrder(a.kind) - phaseOrder(b.kind) ||
            a.updatedAt.localeCompare(b.updatedAt) ||
            a.observationId - b.observationId,
        );

      return {
        name,
        state,
        latestAt: entries.map(({ observation }) => observation.updated_at).sort().at(-1)!,
        phases,
        artifacts,
        blockers: collectBlockers(entries.map(({ observation }) => observation)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

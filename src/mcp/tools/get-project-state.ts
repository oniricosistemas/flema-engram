import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EngramAdapter } from "../../adapters/types.js";
import { collectBlockers, groupByChange } from "../../utils/sdd-detector.js";
import { deriveODDState } from "../../utils/odd-detector.js";

export const GetProjectStateInput = z.object({
  project: z.string().min(1),
  includeLegacySdd: z.boolean().optional().default(false),
});

export async function getProjectStateHandler(
  adapter: EngramAdapter,
  args: z.infer<typeof GetProjectStateInput>,
) {
  const { project } = args;

  // Get project info
  const projects = await adapter.listProjects();
  const projectInfo = projects.find((p) => p.name === project);

  if (!projectInfo) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${project}`);
  }

  // Get observations for this project
  const observations = (await adapter.listObservations({ project }))
    .filter((observation) => observation.project === project);

  // Group by type
  const byType: Record<string, number> = {};
  for (const obs of observations) {
    byType[obs.type] = (byType[obs.type] ?? 0) + 1;
  }

  // Group by topic_key prefix
  const byTopicKey: Record<string, number> = {};
  for (const obs of observations) {
    const prefix = obs.topic_key.split("/")[0] ?? obs.topic_key;
    byTopicKey[prefix] = (byTopicKey[prefix] ?? 0) + 1;
  }

  // ODD is canonical; legacy derivation is an explicit per-request addition.
  const odd = deriveODDState(observations);
  const legacy = args.includeLegacySdd ? { changes: groupByChange(observations) } : {};

  const state = {
    project: projectInfo,
    counts: {
      total: observations.length,
      byType,
      byTopicKey,
    },
    odd,
    ...legacy,
    blockers: collectBlockers(observations).map((obs) => ({
      id: obs.id,
      title: obs.title,
      type: obs.type,
      topicKey: obs.topic_key,
    })),
    recentActivity: observations
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
      .slice(0, 10)
      .map((obs) => ({
        id: obs.id,
        title: obs.title,
        type: obs.type,
        updatedAt: obs.updated_at,
      })),
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(state),
      },
    ],
  };
}

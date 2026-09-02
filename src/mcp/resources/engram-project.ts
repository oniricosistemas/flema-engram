import type { EngramAdapter } from "../../adapters/types.js";
import { groupByChange } from "../../utils/sdd-detector.js";
import { decodeVariable, resourceNotFound } from "../errors.js";

export async function projectResourceHandler(
  adapter: EngramAdapter,
  uri: URL,
  variables: { project: string },
) {
  const projectName = decodeVariable(variables.project, "project name");

  // Get project info
  const projects = await adapter.listProjects();
  const projectInfo = projects.find((p) => p.name === projectName);

  if (!projectInfo) {
    resourceNotFound(uri, "Project");
  }

  // Get observations for this project
  const observations = await adapter.listObservations({ project: projectName });

  // Group by type
  const byType: Record<string, number> = {};
  for (const obs of observations) {
    byType[obs.type] = (byType[obs.type] ?? 0) + 1;
  }

  // Detect SDD changes
  const changes = groupByChange(observations);

  const state = {
    project: projectInfo,
    counts: {
      total: observations.length,
      byType,
    },
    changes,
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
    contents: [
      {
        uri: uri.toString(),
        mimeType: "application/json",
        text: JSON.stringify(state),
      },
    ],
  };
}

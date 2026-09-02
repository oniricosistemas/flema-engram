import type { EngramAdapter } from "../../adapters/types.js";
import { groupByChange } from "../../utils/sdd-detector.js";
import { decodeVariable, resourceNotFound } from "../errors.js";

export async function changeStateResourceHandler(
  adapter: EngramAdapter,
  uri: URL,
  variables: { change_name: string },
) {
  const change_name = decodeVariable(variables.change_name, "change name");

  // Get all observations
  const observations = await adapter.listObservations();

  // Group by SDD changes
  const changes = groupByChange(observations);

  // Find the specific change
  const change = changes.find((c) => c.name === change_name);

  if (!change) {
    resourceNotFound(uri, "Change");
  }

  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: "application/json",
        text: JSON.stringify({
          name: change.name, state: change.state, latestAt: change.latestAt,
          phases: change.phases, blockers: change.blockers,
        }),
      },
    ],
  };
}

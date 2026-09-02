import type { EngramAdapter } from "../../adapters/types.js";
import { groupByChange } from "../../utils/sdd-detector.js";

export async function changesResourceHandler(adapter: EngramAdapter) {
  // Get all observations
  const observations = await adapter.listObservations();

  // Group by SDD changes
  const changes = groupByChange(observations);

  return {
    contents: [
      {
        uri: "engram://changes",
        mimeType: "application/json",
        text: JSON.stringify(changes),
      },
    ],
  };
}

import type { EngramAdapter } from "../../adapters/types.js";
import { resourceNotFound } from "../errors.js";

export async function observationResourceHandler(
  adapter: EngramAdapter,
  uri: URL,
  variables: { id: number },
) {
  const id = variables.id;

  const observation = await adapter.getObservation(id);

  if (!observation) {
    resourceNotFound(uri, "Observation");
  }

  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: "application/json",
        text: JSON.stringify(observation),
      },
    ],
  };
}

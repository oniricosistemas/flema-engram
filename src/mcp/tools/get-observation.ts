import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EngramAdapter } from "../../adapters/types.js";

export const GetObservationInput = z.object({
  id: z.number().int().positive(),
});

export async function getObservationHandler(
  adapter: EngramAdapter,
  args: z.infer<typeof GetObservationInput>,
) {
  const { id } = args;

  const observation = await adapter.getObservation(id);

  if (!observation) {
    throw new McpError(ErrorCode.InvalidParams, `Observation not found: ${id}`);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(observation),
      },
    ],
  };
}

import { z } from "zod";
import type { EngramAdapter } from "../../adapters/types.js";

export const ListObservationsInput = z.object({
  project: z.string().optional(),
  type: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export async function listObservationsHandler(
  adapter: EngramAdapter,
  args: z.infer<typeof ListObservationsInput>,
) {
  const { project, type, limit } = args;

  const observations = await adapter.listObservations({
    project,
    type,
    limit,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(observations),
      },
    ],
  };
}

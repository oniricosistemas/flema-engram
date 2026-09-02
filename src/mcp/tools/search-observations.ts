import { z } from "zod";
import type { EngramAdapter } from "../../adapters/types.js";

export const SearchObservationsInput = z.object({
  q: z.string().min(1).max(500),
});

export async function searchObservationsHandler(
  adapter: EngramAdapter,
  args: z.infer<typeof SearchObservationsInput>,
) {
  const observations = await adapter.searchObservations(args.q);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(observations),
      },
    ],
  };
}

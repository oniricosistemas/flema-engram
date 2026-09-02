import { z } from "zod";
import type { EngramAdapter } from "../../adapters/types.js";

export const ListSessionsInput = z.object({
  project: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export async function listSessionsHandler(
  adapter: EngramAdapter,
  args: z.infer<typeof ListSessionsInput>,
) {
  const { project, limit } = args;

  const sessions = await adapter.listSessions({
    project,
    limit,
  });
  const recentFirst = [...sessions].sort(
    (left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id),
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(recentFirst),
      },
    ],
  };
}

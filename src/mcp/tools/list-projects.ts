import { z } from "zod";
import type { EngramAdapter } from "../../adapters/types.js";

export const ListProjectsInput = z.object({});

export async function listProjectsHandler(
  adapter: EngramAdapter,
  _args: z.infer<typeof ListProjectsInput>,
) {
  const projects = await adapter.listProjects();
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(projects),
      },
    ],
  };
}

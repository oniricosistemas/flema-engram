import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EngramAdapter } from "../../adapters/types.js";

export const GetSessionInput = z.object({
  id: z.string().min(1),
});

export async function getSessionHandler(
  adapter: EngramAdapter,
  args: z.infer<typeof GetSessionInput>,
) {
  const { id } = args;

  const session = await adapter.getSession(id);

  if (!session) {
    throw new McpError(ErrorCode.InvalidParams, `Session not found: ${id}`);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(session),
      },
    ],
  };
}

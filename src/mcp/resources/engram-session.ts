import type { EngramAdapter } from "../../adapters/types.js";
import { decodeVariable, resourceNotFound } from "../errors.js";

export async function sessionResourceHandler(
  adapter: EngramAdapter,
  uri: URL,
  variables: { session_id: string },
) {
  const sessionId = decodeVariable(variables.session_id, "session id");

  const session = await adapter.getSession(sessionId);

  if (!session) {
    resourceNotFound(uri, "Session");
  }

  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: "application/json",
        text: JSON.stringify(session),
      },
    ],
  };
}

import type { EngramAdapter } from "../../adapters/types.js";

export async function projectsResourceHandler(adapter: EngramAdapter) {
  const projects = await adapter.listProjects();
  return {
    contents: [
      {
        uri: "engram://projects",
        mimeType: "application/json",
        text: JSON.stringify(projects),
      },
    ],
  };
}

import type { EngramAdapter } from "../../adapters/types.js";

export async function healthResourceHandler(adapter: EngramAdapter) {
  const health = await adapter.health();
  return {
    contents: [
      {
        uri: "engram://health",
        mimeType: "application/json",
        text: JSON.stringify(health),
      },
    ],
  };
}

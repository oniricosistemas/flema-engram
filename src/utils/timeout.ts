export const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** Schedule any positive finite delay without triggering the platform timer overflow clamp. */
export function scheduleLongTimeout(callback: () => void, delayMs: number): () => void {
  let remainingMs = delayMs;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const scheduleNextChunk = () => {
    const chunkMs = Math.min(remainingMs, MAX_TIMER_DELAY_MS);
    timeoutId = setTimeout(() => {
      if (cancelled) return;
      const nextRemainingMs = remainingMs - chunkMs;
      if (nextRemainingMs <= 0) {
        callback();
        return;
      }
      remainingMs = nextRemainingMs;
      scheduleNextChunk();
    }, chunkMs);
  };

  scheduleNextChunk();
  return () => {
    cancelled = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_TIMER_DELAY_MS,
  scheduleLongTimeout,
} from "../../../src/utils/timeout.js";

describe("scheduleLongTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("splits a finite delay above the platform timer limit without firing early", () => {
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    const handles: Array<ReturnType<typeof setTimeout>> = [];
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay?: number) => {
      const handle = { id: scheduled.length + 1 } as unknown as ReturnType<typeof setTimeout>;
      scheduled.push({ callback, delay: delay ?? 0 });
      handles.push(handle);
      return handle;
    }) as typeof setTimeout);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);
    const onTimeout = vi.fn();

    const cancel = scheduleLongTimeout(onTimeout, MAX_TIMER_DELAY_MS + 25);

    expect(scheduled.map(({ delay }) => delay)).toEqual([MAX_TIMER_DELAY_MS]);
    scheduled[0]?.callback();
    expect(onTimeout).not.toHaveBeenCalled();
    expect(scheduled.map(({ delay }) => delay)).toEqual([MAX_TIMER_DELAY_MS, 25]);
    scheduled[1]?.callback();
    expect(onTimeout).toHaveBeenCalledOnce();

    cancel();
    expect(clearTimeoutSpy).toHaveBeenLastCalledWith(handles[1]);
  });
});

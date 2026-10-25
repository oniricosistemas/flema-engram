import { createSignal, onCleanup, onMount, type Accessor } from "solid-js";
import type { EngramAdapter } from "../../adapters/types.js";
import {
  createEngramReadController,
  type SidebarRefreshOutcome,
  type SidebarViewModel,
  type SidebarWorkflowMode,
  type UseEngramOptions,
} from "../../viewer/core.js";

export * from "../../viewer/core.js";

export interface UseEngramReturn {
  state: Accessor<SidebarViewModel>;
  refresh: () => Promise<SidebarRefreshOutcome>;
  setWorkflowMode: (mode: SidebarWorkflowMode) => void;
}

const DEFAULT_POLL_INTERVAL = 30_000;

export function useEngram(
  adapter: EngramAdapter,
  options: UseEngramOptions = {},
): UseEngramReturn {
  let applyState: ((state: SidebarViewModel) => void) | undefined;
  const controller = createEngramReadController(adapter, {
    projectName: options.projectName,
    resolution: options.resolution,
    initialError: options.initialError,
    enabled: options.enabled,
    resolveProject: options.resolveProject,
    now: options.now,
    stageTimeoutMs: options.stageTimeoutMs,
    onState: (next) => applyState?.(next),
  });
  const [state, setState] = createSignal<SidebarViewModel>(controller.getState());
  applyState = (next) => setState(next);
  let disposed = false;
  let initialRefreshStarted = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const refresh = (): Promise<SidebarRefreshOutcome> => {
    initialRefreshStarted = true;
    return controller.refresh();
  };

  const startInitialRefresh = (): void => {
    if (disposed || initialRefreshStarted) return;
    initialRefreshStarted = true;
    if (options.enabled === false) {
      setState((current) => ({ ...current, loading: false }));
      return;
    }
    void controller.refresh();
  };

  onMount(() => {
    if (options.autoRefresh !== false) startInitialRefresh();
    if (options.enabled !== false && pollTimer === undefined) {
      pollTimer = setInterval(() => void controller.refresh(), options.pollInterval ?? DEFAULT_POLL_INTERVAL);
    }
  });

  // Direct hook consumers retain a guarded fallback. The OpenCode slot disables it
  // because sidebar_content owns startup through its current action mount.
  if (options.autoRefresh !== false) queueMicrotask(startInitialRefresh);
  onCleanup(() => {
    if (disposed) return;
    disposed = true;
    controller.dispose();
    if (pollTimer !== undefined) clearInterval(pollTimer);
  });

  return {
    state,
    refresh,
    setWorkflowMode: (mode) => controller.setWorkflowMode(mode),
  };
}

import type { SidebarViewModel } from "../viewer/core.js";

export interface PiSidebarTheme {
  fg: (token: string, text: string) => string;
  bold?: (text: string) => string;
}

export interface PiSidebarRenderHost {
  requestRender: () => void;
}

export interface PiSidebarMouseEvent {
  y: number;
  height: number;
  [key: string]: unknown;
}

export interface PiSidebarMouseResult {
  render?: boolean;
  [key: string]: unknown;
}

export interface PiSidebarPanel {
  render: (width: number) => string[];
  invalidate: () => void;
  digest: () => string;
  handleMouse?: (event: PiSidebarMouseEvent) => PiSidebarMouseResult | undefined;
  setState: (state: SidebarViewModel) => void;
  setCollapsed: (collapsed: boolean) => void;
  isCollapsed: () => boolean;
}

export interface PiSidebarTui extends PiSidebarRenderHost {
  mode?: string;
  terminal?: Record<symbol, unknown>;
}

export interface GentleShellRailAttachment {
  isMounted: () => boolean;
  isActive: () => boolean;
  setVisible: (visible: boolean) => void;
  invalidate: () => void;
  dispose: () => void;
}

export const GENTLE_SHELL_SIDEBAR_STATE = Symbol.for("gentle-pi.experimental-sidebar.state");
const SHARED_RAIL_STACK = Symbol.for("mcp-sidebar.gentle-shell-rail-stack");

type RailComponent = Pick<PiSidebarPanel, "render" | "invalidate" | "digest" | "handleMouse">;
type RailHost = {
  active?: boolean;
  ownsHost?: () => boolean;
  parts: Map<string, RailComponent>;
};
type RailParticipant = { component: RailComponent; visible: boolean };
type RenderedSegment = { component: RailComponent; startY: number; height: number };
type SharedRailStack = {
  host: RailHost;
  original: RailComponent;
  wrapper: RailComponent;
  participants: Map<symbol, RailParticipant>;
  revision: number;
  segments: RenderedSegment[];
};

const ANSI_PATTERN = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const COMBINING_MARK_PATTERN = /\p{Mark}/u;

export function visibleTextWidth(value: string): number {
  let width = 0;
  for (const character of value.replace(ANSI_PATTERN, "")) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint === 0 || codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) continue;
    if (COMBINING_MARK_PATTERN.test(character) || codePoint === 0xfe0f || codePoint === 0x200d) continue;
    width += isWideCodePoint(codePoint) ? 2 : 1;
  }
  return width;
}

function isWideCodePoint(codePoint: number): boolean {
  return codePoint >= 0x1100 && (
    codePoint <= 0x115f ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function truncateText(value: string, width: number): string {
  if (width <= 0) return "";
  if (visibleTextWidth(value) <= width) return value;
  if (width === 1) return "…";

  let result = "";
  let used = 0;
  for (const character of value) {
    const characterWidth = visibleTextWidth(character);
    if (used + characterWidth > width - 1) break;
    result += character;
    used += characterWidth;
  }
  return `${result}…`;
}

function aggregateOddProgress(state: SidebarViewModel): {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
} {
  return (state.odd?.features ?? []).reduce(
    (total, feature) => ({
      total: total.total + feature.progress.total,
      done: total.done + feature.progress.done,
      inProgress: total.inProgress + feature.progress.in_progress,
      blocked: total.blocked + feature.progress.blocked,
    }),
    { total: 0, done: 0, inProgress: 0, blocked: 0 },
  );
}

function healthToken(state: SidebarViewModel): string {
  if (state.health === "ok") return "success";
  if (state.health === "loading" || state.health === "stale") return "warning";
  return "error";
}

function panelDigest(state: SidebarViewModel, collapsed: boolean): string {
  const progress = aggregateOddProgress(state);
  return JSON.stringify({
    collapsed,
    projectName: state.projectName,
    health: state.health,
    loading: state.loading,
    progress,
    blockers: state.blockers.map((item) => [item.id, item.title, item.updated_at]),
    recent: state.recentActivity.map((item) => [item.id, item.title, item.updated_at]),
    error: state.error,
    terminal: state.terminal,
  });
}

function isRailComponent(value: unknown): value is RailComponent {
  return typeof value === "object" && value !== null
    && typeof (value as RailComponent).render === "function"
    && typeof (value as RailComponent).invalidate === "function";
}

function readRailHost(terminal: Record<symbol, unknown>): RailHost | undefined {
  const candidate = terminal[GENTLE_SHELL_SIDEBAR_STATE];
  if (typeof candidate !== "object" || candidate === null) return undefined;
  const parts = (candidate as { parts?: unknown }).parts;
  return parts instanceof Map ? candidate as RailHost : undefined;
}

function hostOwnsRail(host: RailHost): boolean {
  if (typeof host.ownsHost !== "function") return host.active !== false;
  try {
    return host.ownsHost() === true;
  } catch {
    return false;
  }
}

function isSharedRailStack(value: unknown, host: RailHost): value is SharedRailStack {
  if (typeof value !== "object" || value === null) return false;
  const stack = value as Partial<SharedRailStack>;
  return stack.host === host
    && isRailComponent(stack.original)
    && isRailComponent(stack.wrapper)
    && stack.participants instanceof Map
    && Array.isArray(stack.segments)
    && typeof stack.revision === "number";
}

function createSharedRailStack(host: RailHost, original: RailComponent): SharedRailStack {
  let stack: SharedRailStack;
  const wrapper: RailComponent = {
    render(width) {
      const lines: string[] = [];
      const segments: RenderedSegment[] = [];
      const append = (component: RailComponent) => {
        const rendered = [...component.render(width)];
        if (rendered.length === 0) return;
        segments.push({ component, startY: lines.length, height: rendered.length });
        lines.push(...rendered);
      };
      append(original);
      for (const participant of stack.participants.values()) {
        if (participant.visible) append(participant.component);
      }
      stack.segments = segments;
      return lines;
    },
    invalidate() {
      stack.revision++;
      stack.segments = [];
      original.invalidate();
      for (const participant of stack.participants.values()) participant.component.invalidate();
    },
    digest() {
      let originalDigest = "";
      try {
        originalDigest = original.digest?.() ?? "";
      } catch {
        // Explicit invalidation remains the fallback when a digest cannot be read.
      }
      const participants = [...stack.participants.values()]
        .filter((participant) => participant.visible)
        .map((participant) => {
          try {
            return participant.component.digest?.() ?? "";
          } catch {
            return "";
          }
        });
      return JSON.stringify([originalDigest, stack.revision, participants]);
    },
    handleMouse(event) {
      if (event.y < 0 || event.y >= event.height) return undefined;
      const segment = stack.segments.find(
        (candidate) => event.y >= candidate.startY
          && event.y < candidate.startY + candidate.height,
      );
      if (!segment) return undefined;
      const result = segment.component.handleMouse?.({
        ...event,
        y: event.y - segment.startY,
        height: segment.height,
      });
      if (result?.render) stack.revision++;
      return result;
    },
  };
  stack = {
    host,
    original,
    wrapper,
    participants: new Map(),
    revision: 0,
    segments: [],
  };
  return stack;
}

export function attachGentleShellRailPanel(
  tui: PiSidebarTui,
  component: RailComponent,
): GentleShellRailAttachment | undefined {
  if (tui.mode !== "fullscreen" || !tui.terminal) return undefined;
  const terminal = tui.terminal;
  const host = readRailHost(terminal);
  if (!host) return undefined;

  const existing = terminal[SHARED_RAIL_STACK];
  let stack: SharedRailStack;
  if (isSharedRailStack(existing, host) && host.parts.get("footer") === existing.wrapper) {
    stack = existing;
  } else {
    const original = host.parts.get("footer");
    if (!isRailComponent(original)) return undefined;
    stack = createSharedRailStack(host, original);
    terminal[SHARED_RAIL_STACK] = stack;
    host.parts.set("footer", stack.wrapper);
  }

  const participantId = Symbol("flema-engram-rail-participant");
  const participant: RailParticipant = { component, visible: true };
  stack.participants.set(participantId, participant);
  stack.revision++;
  tui.requestRender();
  let disposed = false;

  const isMounted = () => !disposed && host.parts.get("footer") === stack.wrapper;
  const invalidate = () => {
    if (disposed) return;
    stack.revision++;
    stack.segments = [];
    tui.requestRender();
  };

  return {
    isMounted,
    isActive: () => isMounted() && hostOwnsRail(host),
    setVisible(visible) {
      if (disposed || participant.visible === visible) return;
      participant.visible = visible;
      invalidate();
    },
    invalidate,
    dispose() {
      if (disposed) return;
      disposed = true;
      stack.participants.delete(participantId);
      stack.revision++;
      stack.segments = [];
      if (stack.participants.size === 0) {
        if (host.parts.get("footer") === stack.wrapper) host.parts.set("footer", stack.original);
        if (terminal[SHARED_RAIL_STACK] === stack) delete terminal[SHARED_RAIL_STACK];
      }
      tui.requestRender();
    },
  };
}

export function createPiSidebarPanel(
  tui: PiSidebarRenderHost,
  theme: PiSidebarTheme,
  initialState: SidebarViewModel,
): PiSidebarPanel {
  let state = initialState;
  let collapsed = false;

  const paint = (token: string, text: string, bold = false): string => {
    const emphasized = bold && theme.bold ? theme.bold(text) : text;
    return theme.fg(token, emphasized);
  };

  const render = (width: number): string[] => {
    const boundedWidth = Math.max(0, Math.floor(width));
    if (boundedWidth === 0) return [];
    if (boundedWidth === 1) return [paint("dim", "…")];

    const border = (text: string) => paint("dim", text);
    const title = truncateText(`${collapsed ? "▶" : "▼"} 🧠 Engram`, boundedWidth - 6);
    const top = title
      ? border("╭─ ") + paint("accent", title, true)
        + border(` ${"─".repeat(boundedWidth - visibleTextWidth(title) - 5)}╮`)
      : border(`╭${"─".repeat(boundedWidth - 2)}╮`);
    const bottom = border(`╰${"─".repeat(boundedWidth - 2)}╯`);
    const padding = boundedWidth >= 4 ? " " : "";
    const contentWidth = boundedWidth - 2 - padding.length * 2;
    const row = (token: string, text: string, bold = false): string => {
      const bounded = truncateText(text, contentWidth);
      const padded = bounded + " ".repeat(contentWidth - visibleTextWidth(bounded));
      return border(`│${padding}`) + paint(token, padded, bold) + border(`${padding}│`);
    };
    const project = state.projectName ?? "unresolved project";
    const health = state.health.toUpperCase();
    const lines = [top, row(healthToken(state), `${project} · ${health}`)];
    if (collapsed) return [...lines, bottom];

    const progress = aggregateOddProgress(state);
    lines.push(row(
      "text",
      progress.total > 0
        ? `ODD ${progress.done}/${progress.total} done · ${progress.inProgress} active · ${progress.blocked} blocked`
        : "ODD no tracked feature",
    ));

    if (state.error) lines.push(row("error", state.error));

    lines.push(row("warning", `Blockers · ${state.blockers.length}`, true));
    if (state.blockers.length === 0) {
      lines.push(row("muted", "No blockers"));
    } else {
      for (const item of state.blockers.slice(0, 3)) {
        lines.push(row("muted", `• ${item.title}`));
      }
    }

    lines.push(row("accent", "Recent", true));
    if (state.recentActivity.length === 0) {
      lines.push(row("muted", "No recent activity"));
    } else {
      for (const item of state.recentActivity.slice(0, 3)) {
        lines.push(row("muted", `• ${item.title}`));
      }
    }
    return [...lines, bottom];
  };

  return {
    render,
    invalidate: () => tui.requestRender(),
    digest: () => panelDigest(state, collapsed),
    setState: (nextState) => {
      state = nextState;
      tui.requestRender();
    },
    setCollapsed: (nextCollapsed) => {
      if (collapsed === nextCollapsed) return;
      collapsed = nextCollapsed;
      tui.requestRender();
    },
    isCollapsed: () => collapsed,
  };
}

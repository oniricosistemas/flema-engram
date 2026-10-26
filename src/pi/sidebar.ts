import type { SidebarViewModel } from "../viewer/core.js";

export interface PiSidebarTheme {
  fg: (token: string, text: string) => string;
  bold?: (text: string) => string;
}

export interface PiSidebarRenderHost {
  requestRender: () => void;
}

export interface PiSidebarPanel {
  render: (width: number) => string[];
  invalidate: () => void;
  digest: () => string;
  setState: (state: SidebarViewModel) => void;
  setCollapsed: (collapsed: boolean) => void;
  isCollapsed: () => boolean;
}

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

export function createPiSidebarPanel(
  tui: PiSidebarRenderHost,
  theme: PiSidebarTheme,
  initialState: SidebarViewModel,
): PiSidebarPanel {
  let state = initialState;
  let collapsed = false;

  const paint = (token: string, text: string, width: number, bold = false): string => {
    const bounded = truncateText(text, Math.max(0, width));
    const emphasized = bold && theme.bold ? theme.bold(bounded) : bounded;
    return theme.fg(token, emphasized);
  };

  const render = (width: number): string[] => {
    const boundedWidth = Math.max(1, width);
    const project = state.projectName ?? "unresolved project";
    const health = state.health.toUpperCase();
    if (collapsed) {
      return [paint("accent", `▶ 🧠 Engram · ${project} · ${health}`, boundedWidth, true)];
    }

    const progress = aggregateOddProgress(state);
    const lines = [
      paint("accent", "▼ 🧠 Engram", boundedWidth, true),
      paint(healthToken(state), `${project} · ${health}`, boundedWidth),
      paint(
        "info",
        progress.total > 0
          ? `ODD ${progress.done}/${progress.total} done · ${progress.inProgress} active · ${progress.blocked} blocked`
          : "ODD no tracked feature",
        boundedWidth,
      ),
    ];

    if (state.error) lines.push(paint("error", state.error, boundedWidth));

    lines.push(paint("warning", `Blockers · ${state.blockers.length}`, boundedWidth, true));
    if (state.blockers.length === 0) {
      lines.push(paint("muted", "No blockers", boundedWidth));
    } else {
      for (const item of state.blockers.slice(0, 3)) {
        lines.push(paint("muted", `• ${item.title}`, boundedWidth));
      }
    }

    lines.push(paint("secondary", "Recent", boundedWidth, true));
    if (state.recentActivity.length === 0) {
      lines.push(paint("muted", "No recent activity", boundedWidth));
    } else {
      for (const item of state.recentActivity.slice(0, 3)) {
        lines.push(paint("muted", `• ${item.title}`, boundedWidth));
      }
    }
    return lines;
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

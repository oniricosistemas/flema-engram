/** @jsxImportSource @opentui/solid */

import { For, type Accessor } from "solid-js";
import type { TuiSlotContext } from "@opencode-ai/plugin/tui";
import type { Observation } from "../../adapters/types.js";
import { readReactive, type ReactiveValue } from "./reactive-value.js";

export interface BlockersProps {
  blockers: ReactiveValue<Observation[]>;
  theme?: TuiSlotContext["theme"];
}

export function blockerLines(value: ReactiveValue<Observation[]>): string[] {
  const blockers = readReactive(value);
  return [
    "  🚧 Blockers",
    ...(blockers.length
      ? blockers.map((blocker) => `    • ${blocker.title}`)
      : ["    ✅ No explicit blockers."]),
  ];
}

export interface BlockersView {
  lines: Accessor<string[]>;
  hasBlockers: Accessor<boolean>;
}

export function createBlockersView(value: ReactiveValue<Observation[]>): BlockersView {
  return {
    lines: () => blockerLines(value),
    hasBlockers: () => readReactive(value).length > 0,
  };
}

export function Blockers(props: BlockersProps) {
  const view = createBlockersView(props.blockers);
  return (
    <box flexDirection="column">
      <For each={view.lines()}>{(line, index) => (
        <text fg={index() === 0
          ? props.theme?.current.warning
          : view.hasBlockers() ? props.theme?.current.error : props.theme?.current.success}
        >
          {line}
        </text>
      )}</For>
    </box>
  );
}

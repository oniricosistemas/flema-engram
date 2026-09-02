/** @jsxImportSource @opentui/solid */

import { For, type Accessor } from "solid-js";
import type { TuiSlotContext } from "@opencode-ai/plugin/tui";
import type { SDDChange } from "../../utils/sdd-detector.js";
import { readReactive, type ReactiveValue } from "./reactive-value.js";

export interface PhaseProgressProps {
  changes: ReactiveValue<SDDChange[]>;
  theme?: TuiSlotContext["theme"];
}

export function phaseProgressLines(value: ReactiveValue<SDDChange[]>): string[] {
  const changes = readReactive(value);
  return [
    "  📊 SDD Progress",
    ...(changes.length
      ? changes.map(
          (change) => `    • ${change.name}: ${change.state} (${change.phases.map((phase) => phase.phase).join(" → ")})`,
        )
       : ["    ℹ️ No active SDD changes."]),
  ];
}

export function createPhaseProgressView(value: ReactiveValue<SDDChange[]>): Accessor<string[]> {
  return () => phaseProgressLines(value);
}

export function PhaseProgress(props: PhaseProgressProps) {
  const lines = createPhaseProgressView(props.changes);
  return (
    <box flexDirection="column">
      <For each={lines()}>{(line, index) => (
        <text fg={index() === 0 ? props.theme?.current.info : props.theme?.current.textMuted}>
          {line}
        </text>
      )}</For>
    </box>
  );
}

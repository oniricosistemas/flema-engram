/** @jsxImportSource @opentui/solid */

import { For, type Accessor } from "solid-js";
import type { TuiSlotContext } from "@opencode-ai/plugin/tui";
import type { Observation } from "../../adapters/types.js";
import { readReactive, type ReactiveValue } from "./reactive-value.js";

export interface ActivityFeedProps {
  observations: ReactiveValue<Observation[]>;
  theme?: TuiSlotContext["theme"];
}

export function activityLines(value: ReactiveValue<Observation[]>): string[] {
  const observations = readReactive(value);
  return [
    "  📝 Recent Activity",
    ...(observations.length
      ? observations.map((observation) => `    • ${observation.title}`)
      : ["    💤 No recent activity."]),
  ];
}

export function createActivityFeedView(value: ReactiveValue<Observation[]>): Accessor<string[]> {
  return () => activityLines(value);
}

export function ActivityFeed(props: ActivityFeedProps) {
  const lines = createActivityFeedView(props.observations);
  return (
    <box flexDirection="column">
      <For each={lines()}>{(line, index) => (
        <text fg={index() === 0 ? props.theme?.current.secondary : props.theme?.current.textMuted}>
          {line}
        </text>
      )}</For>
    </box>
  );
}

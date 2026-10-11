/** @jsxImportSource @opentui/solid */

import { For, type Accessor } from "solid-js";
import type { TuiSlotContext } from "@opencode-ai/plugin/tui";
import type { ODDState } from "../../schemas/odd-state.js";
import { readReactive, type ReactiveValue } from "./reactive-value.js";

export interface ODDProgressProps {
  odd: ReactiveValue<ODDState | undefined>;
  theme?: TuiSlotContext["theme"];
}

export function oddProgressLines(value: ODDProgressProps["odd"]): string[] {
  const odd = readReactive(value);
  const features = odd?.features ?? [];
  const diagnostics = odd?.diagnostics ?? [];
  const invalidMirrors = new Set(diagnostics.map(({ provenance }) =>
    `${provenance.project}/${provenance.observationId}`)).size;
  return [
    "  📊 ODD Progress",
    "    ℹ️ Bounded recent observations; not a complete project inventory.",
    ...(features.length ? features.map(({ title, featureId, progress }) =>
      `    • ${title} [${featureId}]: ${progress.done}/${progress.total} done; ${progress.cancelled} cancelled; ${progress.in_progress} in progress; ${progress.blocked} blocked; ${progress.pending} pending`,
    ) : ["    ℹ️ No valid ODD features in this bounded window. Mirror feature documents to odd/<feature>/tasks."]),
    ...(diagnostics.length ? [
      `    ⚠️ Invalid ODD mirrors: ${invalidMirrors} observation(s), ${diagnostics.length} diagnostic(s). No SDD fallback.`,
    ] : []),
  ];
}

export function createODDProgressView(value: ODDProgressProps["odd"]): Accessor<string[]> {
  return () => oddProgressLines(value);
}

export function ODDProgress(props: ODDProgressProps) {
  const lines = createODDProgressView(props.odd);
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

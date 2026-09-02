/** @jsxImportSource @opentui/solid */

import type { Project } from "../../adapters/types.js";
import type { ProjectResolution } from "../../utils/project-resolver.js";
import type { TuiSlotContext } from "@opencode-ai/plugin/tui";
import { For, type Accessor } from "solid-js";
import { readReactive, type ReactiveValue } from "./reactive-value.js";

export interface ProjectListProps {
  projectName?: ReactiveValue<string | undefined>;
  project?: ReactiveValue<Project | undefined>;
  resolution?: ReactiveValue<ProjectResolution | undefined>;
  theme?: TuiSlotContext["theme"];
}

export function projectLines(props: ProjectListProps): string[] {
  const projectName = props.projectName === undefined ? undefined : readReactive(props.projectName);
  const project = props.project === undefined ? undefined : readReactive(props.project);
  const resolution = props.resolution === undefined ? undefined : readReactive(props.resolution);
  if (!projectName) {
    return [
      "📁 Project: unresolved",
      resolutionHint(resolution),
    ];
  }

  return [
    `📁 Project: ${projectName}`,
    project
      ? `  🗂️ Indexed observations: ${project.observationCount}`
      : "  🗂️ No indexed observations yet.",
  ];
}

export function createProjectListView(props: ProjectListProps): Accessor<string[]> {
  return () => projectLines(props);
}

function resolutionHint(resolution?: ProjectResolution): string {
  if (!resolution || resolution.validation === "no-candidate") {
    return "💡 Set project in workspace tui.json, ENGRAM_PROJECT, or open OpenCode from a project directory.";
  }
  if (resolution.validation === "offline") {
    return resolution.candidate
      ? `⚠️ Unvalidated ${resolution.source} candidate: ${resolution.candidate} (Engram offline).`
      : "⚠️ Engram is offline; the workspace basename was not trusted without validation.";
  }
  if (resolution.validation === "ambiguous") {
    return `⚠️ Candidate ${resolution.candidate} is ambiguous; set the exact Engram project in workspace tui.json.`;
  }
  return `⚠️ Candidate ${resolution.candidate} was not found in Engram; set the exact project in workspace tui.json.`;
}

export function ProjectList(props: ProjectListProps) {
  const lines = createProjectListView(props);
  return (
    <box flexDirection="column">
      <For each={lines()}>{(line, index) => (
        <text fg={index() === 0 ? props.theme?.current.primary : props.theme?.current.textMuted}>
          {line}
        </text>
      )}</For>
    </box>
  );
}

# SDD Change Detector Specification

## Purpose

Parse Engram `topic_key` values that follow the `sdd/{change-name}/{phase}` convention and group observations into changes, phases, and artifacts for display in the sidebar and MCP resources.

## Types

```ts
interface SddPhase {
  phase: string;              // e.g. "explore", "proposal", "spec"
  observations: EngramObservation[];
  latestAt: string;
}

interface SddChange {
  name: string;
  phases: SddPhase[];
  state: "open" | "in_progress" | "completed" | "archived" | "unknown";
  latestAt: string;
  blocker?: EngramObservation;
}

interface ParsedTopicKey {
  namespace: string;          // "sdd" or "sdd-init"
  changeName?: string;
  phase?: string;
  project?: string;           // for sdd-init/{project}
}
```

## Requirements

### Requirement: Topic Key Parsing

The detector SHALL parse known SDD topic key patterns into structured components.

#### Scenario: Standard change phase key

- GIVEN a topic key `sdd/mcp-flema-engram/spec`
- WHEN it is parsed
- THEN the result is `{ namespace: "sdd", changeName: "mcp-flema-engram", phase: "spec" }`

#### Scenario: Project init key

- GIVEN a topic key `sdd-init/mcp-flema-engram`
- WHEN it is parsed
- THEN the result is `{ namespace: "sdd-init", project: "mcp-flema-engram" }`

#### Scenario: Non-SDD key

- GIVEN a topic key `architecture/auth-model`
- WHEN it is parsed
- THEN the result is `null` (not an SDD topic)

### Requirement: Phase Normalization

The detector SHALL map topic key phase segments to a stable set of phase names.

#### Scenario: Apply progress phase

- GIVEN a topic key `sdd/mcp-flema-engram/apply-progress`
- WHEN the phase is normalized
- THEN it maps to `"apply"`

#### Scenario: Verify report phase

- GIVEN a topic key `sdd/mcp-flema-engram/verify-report`
- WHEN the phase is normalized
- THEN it maps to `"verify"`

#### Scenario: Archive report phase

- GIVEN a topic key `sdd/mcp-flema-engram/archive-report`
- WHEN the phase is normalized
- THEN it maps to `"archive"`

### Requirement: Change Grouping

The detector SHALL group observations by change name and order phases by latest activity.

#### Scenario: Group multiple phases

- GIVEN observations with keys `sdd/x/proposal`, `sdd/x/spec`, and `sdd/x/design`
- WHEN changes are detected
- THEN a single change `x` is returned containing three phases

#### Scenario: Ignore unrelated observations

- GIVEN observations with keys `sdd/x/proposal` and `architecture/auth-model`
- WHEN changes are detected
- THEN only change `x` is produced

### Requirement: Change State Derivation

The detector SHALL derive a change state from the presence and recency of phase observations.

#### Scenario: Completed change

- GIVEN a change has an `archive` phase observation more recent than any other phase
- WHEN state is derived
- THEN the state is `"archived"`

#### Scenario: In-progress change

- GIVEN a change has `spec` and `design` phases, with `design` being the most recent
- WHEN state is derived
- THEN the state is `"in_progress"`

#### Scenario: Unknown state

- GIVEN a change has only an `other` phase
- WHEN state is derived
- THEN the state is `"unknown"`

### Requirement: Blocker Identification

The detector SHALL surface observations of type `bugfix` or `decision` within a change as blockers.

#### Scenario: Bugfix blocker

- GIVEN a change has an observation with `type: "bugfix"` and `topic_key: "sdd/x/apply-progress"`
- WHEN blockers are collected
- THEN the observation is included in the change's `blocker` field

#### Scenario: Multiple blockers ordered by priority

- GIVEN a change has two bugfix observations with different `updated_at` values
- WHEN blockers are collected
- THEN the most recently updated observation is surfaced first

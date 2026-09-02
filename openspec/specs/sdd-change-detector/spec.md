# SDD Change Detector Specification

## Purpose

Normalize local Engram observations into canonical SDD changes, phases, artifacts, states, and blockers.

## Requirements

### Requirement: Topic and Report Normalization

The detector MUST recognize `sdd/{change}/{artifact}` keys, group them by change, and normalize `apply-progress` to `apply`, `verify-report` to `verify`, and `archive-report` to `archive`. Unknown or unrelated keys MUST NOT create SDD changes.

#### Scenario: Normalize report aliases

- GIVEN keys ending in `apply-progress`, `verify-report`, and `archive-report`
- WHEN the change is detected
- THEN its canonical phases are `apply`, `verify`, and `archive`

### Requirement: Canonical State and Artifacts

The detector MUST expose recognized observations as artifacts with their canonical kind, topic key, title, and update time. It MUST derive a deterministic state from canonical phase progression, with archive taking precedence over earlier phases.

#### Scenario: Archived change

- GIVEN a change has proposal, verify-report, and archive-report artifacts
- WHEN its state is derived
- THEN the state is `archived` and all three artifacts remain addressable

#### Scenario: In-progress change

- GIVEN a change has spec and design artifacts but no completed archive
- WHEN its state is derived
- THEN the state reflects active canonical progress rather than `unknown`

### Requirement: Explicit Blockers

The detector MUST surface a blocker only when an observation has an explicit blocker marker, such as type `blocker`, `status: blocked`, a blocked title, or a recognized blocker/reason marker. Type `decision` or `bugfix` alone MUST NOT imply a blocker.

#### Scenario: Ordinary bugfix is not blocked

- GIVEN a bugfix observation contains no explicit blocked marker
- WHEN blockers are collected
- THEN it is not included

#### Scenario: Explicit status is blocked

- GIVEN an observation contains `status: blocked`
- WHEN blockers are collected
- THEN it is included with its available reason

## Deferred

- Heuristic or fuzzy topic-key recovery and inferred blockers without explicit markers are deferred.
- Historical reconstruction of missing SDD or RED chronology is deferred and MUST NOT be fabricated.

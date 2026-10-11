# ODD observation state contract (version 1)

## Canonical authority

An Engram observation with topic key exactly `odd/<feature-id>/tasks` carries
**the full current Markdown feature document** in `content`. The feature ID is
one nonempty topic segment without whitespace. Other ODD topics are invalid;
SDD and unrelated topics are ignored. Neither JSON state nor an
`odd/<feature-id>/state` observation is an alternate authority.

The detector reads the title from exactly one unfenced top-level heading
`# ODD Feature: <title>` and tasks from exactly one unfenced `## Tasks` section.
Task scanning ends at the next level-one or level-two heading; level-three
subheadings remain inside the section. Other sections, observation titles and
metadata do not determine task progress.

```markdown
# ODD Feature: Release automation

## Objective
Make releases reproducible.

## Tasks
- [ ] `ODD-001` **pending** — Define the contract
- [ ] `ODD-002` **in_progress** — Implement the consumer
- [ ] `ODD-003` **blocked** — Resolve an external dependency
- [x] `ODD-004` **done** — Verify the behavior
- [x] `ODD-005` **cancelled** — Remove obsolete scope

## Verification
- [ ] Run focused tests (not an ODD task)
```

## Validation

- Task lines use exactly the checklist/backtick/bold/em-dash structure above.
  IDs start with an ASCII letter or digit and contain only letters, digits,
  periods, underscores or hyphens. IDs must be unique within the document.
- Titles must be nonempty. Unknown statuses, malformed checklist lines within
  Tasks, duplicate IDs, missing/duplicate headings or sections, and empty task
  sections invalidate the document.
- `[ ]` agrees only with `pending`, `in_progress` or `blocked`; `[x]` agrees only
  with `done` or `cancelled`. Status is explicit, never inferred from prose.
- Backtick and tilde fenced blocks are ignored, including example headings and
  task lines. Closing fences must use the same marker and at least the opening
  length. An unclosed fence invalidates the document. CRLF is supported.
- Ordinary prose and non-checklist detail bullets in Tasks are ignored.
  Checklists outside Tasks are ignored. This is a deliberately narrow Markdown
  contract, not a general-purpose Markdown parser.
- Invalid timestamps cannot participate in newest-document selection.

For example, `- [ ] \`ODD-001\` **done** — Verify` is invalid rather than partially
complete. A JSON object such as `{"tasks": []}` is not a feature document.

## Public API and derived result

`parseODDTopicKey(topicKey)` returns `{ featureId }` or `null`.
`deriveODDState(observations)` returns `{ bounded: true, features, diagnostics }`.
Both functions, the `odd*Schema` Zod schemas and corresponding `ODD*` types are
exported from the package entry point.

Each feature includes `version: 1`, `featureId`, `title`, ordered `tasks`,
`progress` counts (`total` and each of the five statuses), and `provenance`.
Version 1 describes the consumer contract; producers need no extra version
metadata or JSON mirror. Cancelled tasks stay distinct from done tasks; no
percentage or inferred feature lifecycle is supplied.

Provenance preserves `observationId`, `topicKey`, `project` and the original
`updatedAt` timestamp string. ISO timestamps and Engram SQLite timestamps are
compared as instants. For each exact project + feature ID pair, the newest
**valid** document wins; a larger observation ID breaks equal-time ties.
Features are sorted by project then feature ID. Tasks retain document order.
Diagnostics are deterministically sorted by project, topic, observation ID,
source line and code; source lines are one-based when applicable.

Invalid observations contribute diagnostics with code, English message and
source provenance, never partial features. A newer invalid observation does
not erase an older valid document, but its diagnostics remain visible so a
consumer can disclose the invalid latest mirror. There is no SDD fallback.

## Bounded-observation limitation

The detector performs no fetches and only sees the supplied observation window.
`bounded: true` explicitly disclaims exhaustive inventory or historical state.
Missing features are unknown, not complete, cancelled or absent from the
project. An empty window returns empty features and diagnostics, not invented
progress. Consumers should show this limitation and diagnostics, and retrieve
project-specific observations where possible; the detector still isolates
projects when given a mixed-project window.

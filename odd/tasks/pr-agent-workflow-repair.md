# ODD Feature: Repair PR-Agent workflow

- Feature ID: `pr-agent-workflow-repair`
- Status: `completed`
- Branch: `fix/pr-agent-workflow`
- Branch point: `4dac96e`
- Approved issue: [#23](https://github.com/oniricosistemas/flema-engram/issues/23)
- Pull request: [#24](https://github.com/oniricosistemas/flema-engram/pull/24)
- Delivery strategy: `single-pr`
- Forecast: 340–430 authored changed lines, excluding generated files
- Current review boundary: `4dac96e`

## Objective

Restore the repository's advisory PR-Agent workflow so it parses, preserves trusted snapshot and publishing safeguards, and executes providers as a strict transient-only fallback chain.

## Problem

`.github/workflows/pr-agent.yml` is invalid on `main` and fails before creating any jobs. Literal carriage-return bytes break YAML near line 99, while additional corruption affects the provider wrapper, classifier, fallback gates, and publishing tail.

## Why

PR-Agent is an independent advisory reviewer in the repository's layered review strategy. A workflow that cannot parse silently removes that review path from every pull request while required `validate` remains unrelated and green.

## Scope

- Repair the complete workflow rather than only the first YAML error.
- Preserve label-only activation and transient-only provider fallback.
- Preserve immutable diff authorization, bounded resources, credential isolation, URL-origin validation, pagination limits, and advisory publishing.
- Add deterministic offline regression tests for YAML, embedded Python/shell, wrapper capture, fallback gates, and publishing safeguards.

## Non-goals

- Changes to ODD application behavior or its active PR chain.
- Live provider calls or secret validation.
- Changes to required branch protection or `validate` policy.
- Making PR-Agent a required merge check.

## Constraints

- Technical artifacts remain in English, except existing provider review-language configuration.
- No provider credentials or network publication in tests.
- Do not blindly revert the sequential-fallback commit; retain its intended safeguards and fix its corruption.
- The workflow advances only after an allowlisted `TRANSIENT` outcome. `VALID` stops successfully; permanent, contract, missing-credential, signal, and unknown failures stop unsuccessfully.
- Activation remains explicit through the existing `pr-agent-review` label path.

## Tasks

- [x] `PRAGENT-001` **completed** — Restore and regression-test the advisory workflow
  - Route: delegated to `gentle-ai-worker`; multi-file write trigger.
  - Surfaces: `.github/workflows/pr-agent.yml`, `tests/unit/workflows/pr-agent.test.ts`, optional narrow offline fixture under `tests/fixtures/`, and this feature document.
  - Acceptance: CR-free valid YAML; every embedded Python heredoc parses; extracted shell passes syntax validation; stderr capture works; provider gates are transient-only and ordered; classifier outcomes are deterministic; publishing preserves authorized head/base/diff and rejects foreign origin/port pagination URLs.
  - Test-first check: `npm test -- tests/unit/workflows/pr-agent.test.ts` observed RED, then GREEN at 40/40 tests.
  - Commits: `f178b62` (workflow repair), `5444192` (bounded stderr correction).
  - Review: native RDD approved and acknowledged for target `sha256:8e4058fd27c114a08ee3b48d64513f3e97bdbf115e3f1c1530de9b3c10a6c816`, lineage `review-8287de755ec9795f`; independent verification passed after correction.

## Acceptance criteria

- The workflow parses before jobs are scheduled.
- Offline regression tests cover the confirmed corruption and intended fallback contract.
- Existing application tests and package checks remain green.
- Required GitHub `validate` passes on the repair PR.
- The repair is delivered independently from the ODD feature chain.

## Verification plan

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run verify:package
```

## Progress

- Issue #23 was created with `type:bug` and `status:approved`.
- Historical comparison confirmed commit `6b5a58e` introduced the corruption and removed transient-only provider gates that existed in `67266a9`.
- The delegated repair restored the workflow and added 35 deterministic offline regression tests.
- The authored implementation/test change is 311 lines excluding the generated lockfile. The complete work-unit commit is 403 changed lines including the ODD recovery document.
- The user selected one single PR because the 3-line budget overage is smaller than the review and rollback cost of separating a workflow from the tests that prove it executable.

## Verification evidence

- Initial test-first RED: 32 failures detected literal control bytes, malformed YAML, invalid embedded Python, broken fallback gates, and publishing safeguards.
- Writer GREEN: 35 focused workflow tests passed; `npm run typecheck` passed; `git diff --check` passed.
- Parent spot check: `npm test -- tests/unit/workflows/pr-agent.test.ts` passed 35/35.
- Independent verification passed 35/35 focused tests and typecheck, but identified one remaining resource-boundary defect: stderr is written directly to an uncapped file while stdout is capped at 50,000 bytes.
- Independent verification identified this task record's incorrect activation-label spelling; the parent corrected it from `pr-agent:review` to the actual `pr-agent-review`.
- Correction RED: the new stderr-overflow case returned status 0 instead of bounded-overflow status 65.
- Correction GREEN: the wrapper now drains stdout and stderr concurrently with separate 50,000-byte limits; 40/40 focused tests passed, including exact-limit, overflow, closed-stream, timeout, and classifier cases.
- Parent correction spot check: `npm test -- tests/unit/workflows/pr-agent.test.ts` passed 40/40.
- Native RDD review approved the normalized 451-line candidate across four lenses and its exact acknowledgement burned the authority.
- Final verification passed: dependency install, typecheck, 273 tests across 20 files, build, package verification across 179 files, and `git diff --check`.
- `npm ci` reported 15 existing dependency vulnerabilities (1 low, 4 moderate, 4 high, 6 critical); remediation was outside this repair.
- Live provider credentials, Docker/provider execution, and network publication remain intentionally unverified; PR-Agent stays dormant until the existing `pr-agent-review` label explicitly activates it.
- The authorized branch push and PR creation produced PR #24 against `main`; required `validate` checks were pending immediately after creation, while CodeRabbit reported a non-blocking manual-review skip.

## Next step

Wait for required `validate` checks and human review on PR #24. Merge remains separately unauthorized.

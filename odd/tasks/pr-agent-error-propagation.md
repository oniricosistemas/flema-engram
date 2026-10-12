# ODD Feature: Classify swallowed PR-Agent failures

- Feature ID: `pr-agent-error-propagation`
- Status: `completed`
- Branch: `fix/pr-agent-error-propagation`
- Branch point: `41682bd9c3416245743e50545b084235260f9565`
- Approved issue: [#26](https://github.com/oniricosistemas/flema-engram/issues/26)
- Pull request: [#27](https://github.com/oniricosistemas/flema-engram/pull/27)
- Canary: [PR #25](https://github.com/oniricosistemas/flema-engram/pull/25), run [38178082929](https://github.com/oniricosistemas/flema-engram/actions/runs/38178082929)
- Delivery strategy: `single-pr`
- Forecast: 165–270 authored changed lines

## Objective

Classify bounded PR-Agent diagnostics from both captured streams, including swallowed status-zero failures, without exposing provider output or weakening transient-only fallback.

## Problem

The first live canary scheduled and snapshot-authorized correctly, but G1 exited zero with diagnostic-bearing output. The wrapper bypassed nonzero classification, rejected the output as a contract failure, and reported only `CONTRACT / invalid-output`. That fail-closed result was safe but could not distinguish transient provider failure from authentication, configuration, model, or malformed-output failure.

## Scope

- Preserve the existing documented `config.propagate_tool_errors=true` setting and assert it in regression coverage.
- Analyze bounded stdout and stderr for every child status before accepting a review artifact.
- Normalize diagnostics to fixed outcome/reason enums without printing captured text.
- Permit fallback only when all nonempty diagnostic evidence is explicitly allowlisted transient or neutral.
- Preserve immutable diff authorization, credential isolation, stream caps, route order, publishing guards, and cleanup.
- Extend deterministic offline tests for status-zero and nonzero diagnostics across both streams.

## Non-goals

- Printing or publishing raw provider diagnostics.
- Broad substring retry matching.
- Changing provider order, image digest, trust boundaries, or required-check policy.
- Merging or publishing the canary PR.
- Dependency-vulnerability remediation.

## Tasks

- [x] `PRAGENT-ERR-001` **completed** — Classify swallowed bounded provider failures
  - Route: delegated to `gentle-ai-worker`; workflow and test files are both non-trivial.
  - Acceptance: valid reviews remain accepted; status-zero/nonzero auth and unknown failures stop; exact transient evidence may advance; mixed or decorated unknown evidence stops; both streams participate; raw diagnostics and secret sentinels never reach logs or publication.
  - Test-first check: observed three RED stages, then GREEN at 103/103 focused tests.
  - Commits: `3742076` (diagnostic-first classifier), `5880e22` (stdout envelope correction).
  - Review: independent verification passed after correction; native RDD approved and acknowledged target `sha256:afb03d07eb154021a0dabd5f2ba06006a4cd84213a7462d18c9bd528dfff60f1`, lineage `review-9980a4beb5d96913`.

## Verification plan

```bash
npm run typecheck
npm test -- tests/unit/workflows/pr-agent.test.ts
npm test
npm run build
npm run verify:package
```

## Evidence

- Initial RED: 17 focused failures demonstrated status-zero bypass, single-stream classification, and logger/traceback normalization gaps.
- Artifact-boundary RED: 6 focused failures showed valid Markdown findings containing diagnostic vocabulary were incorrectly rejected.
- Writer GREEN: 99/99 focused tests passed; typecheck and `git diff --check` passed.
- Parent initial spot check: `npm test -- tests/unit/workflows/pr-agent.test.ts` passed 99/99.
- Independent verification identified a stdout fallback gap that could accept raw generic `Exception` envelopes; acceptance remained blocked.
- Correction RED: 3 focused failures reproduced generic and qualified exception envelopes being written as review artifacts.
- Correction GREEN: stdout fallback now applies the same whole-artifact envelope boundary; parent spot check passed 103/103 tests and `git diff --check`.
- The cumulative authored workflow/test change remains within the selected single-PR budget.
- Live parsing, scheduling, immutable snapshotting, runner setup, and fail-closed publication behavior succeeded.
- G1 ended `CONTRACT / invalid-output`; G2, Ollama, and OpenRouter were correctly skipped because the outcome was not `TRANSIENT`.
- Required `validate` passed on canary head `375f0a9ab4745c7b79700b959feecaef9181f902`.
- Upstream documentation states `config.propagate_tool_errors=true` makes propagated tool failures exit nonzero, but the workflow already supplied it and the pinned live path still returned zero.
- Native RDD approved the 329-line committed candidate across four lenses and its exact acknowledgement burned the authority.
- Native review recorded two non-blocking follow-ups: `R3-stdout-markdown-regression` and `R4-stdout-review-rejection`. Raw stdout exception rejection is directly covered; richer diagnostic-bearing stdout Markdown remains conservative follow-up work and does not reopen this approved candidate.
- Final verification passed: typecheck, 103 focused workflow tests, 336 tests across 20 files, build, package verification across 179 files, and `git diff --check`.
- Live-provider success and advisory publication remain unverified until this fix reaches `main` and canary PR #25 is re-labeled.

## Next step

Wait for required `validate` checks and human review on PR #27. Merge remains separately unauthorized; after an authorized merge, re-label canary PR #25.
# Release 0.4.3
This file tracks the release requested by the maintainer.
Preserve the repository's PR-first main workflow and manual npm/GitHub release process.

## Specs
1. **S1** — "ok crea la release"

## Tasks
- [x] **T1** — S1 — Bump package metadata, exact-version installation docs, site version strings, and package verifier expectation to 0.4.3; route: parent inline; commit: `251e182`.
- [x] **T2** — S1 — Run release checks and verify the exact packed candidate; route: parent inline; commit: not applicable.
- [ ] **T3** — S1 — Open and merge the release-preparation PR under repository policy; route: parent inline; commit: pending.
- [ ] **T4** — S1 — Publish npm 0.4.3 and create the matching GitHub tag/release; route: parent inline; commit: not applicable.

## Log
- **L1** — "ok crea la release"
- **L2** — npm reports `opencode-flema-engram-sidebar@0.4.2` as `latest`; GitHub's latest release is `v0.4.2`. The current `main` includes PR #83. The next patch is 0.4.3. Repository guidance requires main changes through PRs and manual npm/tag releases.
- **L3** — Package metadata, lockfile root version, README and site install/version strings, and the package verifier expectation now target 0.4.3. A release-facing scan found no remaining 0.4.2 references in those files; root manifest/lock versions match.
- **L4** — `git diff --check` passed; package.json, package-lock root, and package-lock root package all report 0.4.3. T1 is complete; the release check sequence is next.
- **L5** — The authorized release check command passed `npm ci` and `npm run typecheck`, then `npm test` failed with one 5-second timeout in `tests/unit/workflows/pr-agent.test.ts` (`publisher enforces post with mocked HTTP and files`; 512/513 passed). Because the command is chained with `&&`, build and package verification did not run.
- **L6** — The user authorized one isolated retry of the exact timed-out PR-Agent test; it passed with one worker (1/1). The subsequent authorized reduced-concurrency full-suite run still failed: `tests/integration/stdio-smoke.test.ts` timed out at 15 seconds; 512/513 passed. Build and package verification did not run because the chain stopped at tests.
- **L7** — The user authorized a bounded adjustment of both stdio smoke-test timeouts to 30 seconds and one remaining release-validation run.
- **L8** — The final authorized validation command exited 0: `npm test -- --maxWorkers=1` passed 513/513, `npm run build` passed, and `npm run verify:package` passed for 207 files. The preceding `npm ci` and typecheck also passed. The 0.4.3 manifest, lockfile, README, site strings, and package-verifier expectation are consistent. T2 is complete; T3 is next.
- **L9** — T1 was committed as `251e182` (`chore(release): prepare 0.4.3`) on `chore/release-0.4.3`. The release-preparation PR is not yet open; no npm publication or tag has occurred.

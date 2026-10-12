# ODD Feature: Remediate Vitest tooling vulnerabilities

- Feature ID: `vitest-tooling-vulnerabilities`
- Status: `completed`
- Branch: `fix/vitest-tooling-vulnerabilities`
- Branch point: `4b6c97fb0d92cf120b6eaffd7f1f94ea927adc96`
- Approved issue: [#30](https://github.com/oniricosistemas/flema-engram/issues/30)
- Delivery strategy: `single-pr`
- Forecast: 2 direct manifest changes plus substantial generated lockfile churn; test/config changes only if migration failures require them

## Objective

Migrate the aligned Vitest and V8 coverage toolchain to a supported patched major-5 release, remove every observed development-only audit finding, and preserve test, coverage, build, and package behavior.

## Security baseline

Fresh full `npm audit --json` reports nine vulnerable package entries: 1 low, 2 moderate, 1 high, and 5 critical. Production-only audit reports four entries owned by issue #29, so issue #30 is responsible for these five development-only entries:

- `@vitest/coverage-v8` — moderate.
- `@vitest/mocker` — moderate.
- `source-map-js` — high.
- `tinypool` — critical.
- `vitest` — critical.

## Selected version set

- `vitest`: exact `5.0.4`.
- `@vitest/coverage-v8`: exact `5.0.4`.

Version `5.0.4` is the newest stable release in the already-approved major 5, aligns the exact coverage peer, resolves normally, and removes all observed development-only findings in a disposable candidate audit. Version `5.0.3` failed npm candidate resolution with an internal `edgesOut` error. No patched 3.x release exists beyond the vulnerable installed `3.2.7`.

## Compatibility boundary

- Vitest 5 requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`; CI uses Node 22 and the verification environment is Node 22.23.1.
- The published package runtime contract remains Node `>=22`; the narrower floor applies to development tooling, not shipped runtime code.
- Ordinary resolution advances dev-only Vite `7.3.6 → 8.3.4`, removes `vite-node` and `tinypool`, and changes about 140 generated lockfile entries.
- Production dependency versions must remain unchanged.

## Scope

- Upgrade the aligned Vitest and coverage direct dev dependencies to exact `5.0.4`.
- Resolve the supported development dependency graph without overrides, force, or audit-fix automation.
- Adapt Vitest configuration or tests only for observed major-version incompatibilities.
- Verify focused mocking, fake-timer, TSX/Solid, subprocess, coverage, full test, build, and package behavior.
- Confirm full audit equals the known four-entry production boundary and production audit is unchanged.

## Non-goals

- Remediating the four upstream-blocked runtime findings in issue #29.
- Changing runtime Node support, production dependencies, application behavior, or coverage policy.
- Adding coverage thresholds or making coverage a required CI gate.
- Broad dependency refreshes beyond ordinary Vitest 5 resolution.

## Tasks

- [x] `VITESTSEC-001` **completed** — Migrate and verify the aligned Vitest 5 toolchain
  - Route: delegated to `gentle-ai-worker`; manifest/lockfile migration plus independent functional and security verification.
  - Security RED: full audit contained exactly five additional development-only vulnerable package entries beyond the production boundary.
  - Security GREEN: full and production audit sets are now identical; all five issue-#30 entries are absent and production versions remain unchanged.
  - Compatibility: inherited `ENGRAM_URL` caused one false baseline failure; with `ENGRAM_URL` and `ENGRAM_BASE_URL` unset, focused, coverage, and full suites pass without test/config changes.
  - Commit: `097feaa`.
  - Review: native RDD approved and acknowledged target `sha256:7ee925df941e107904d3a244cba20d94c62b523be7698634032554a0c8a9cc98`, lineage `review-7db21e87e9e2d664`.

## Verification plan

```bash
npm audit --json
npm audit --omit=dev --json
npm ls vitest @vitest/coverage-v8 @vitest/mocker vite vite-node tinypool source-map-js --all
npm test -- tests/unit/adapters tests/unit/sidebar tests/integration/stdio-smoke.test.ts
npm run test:coverage -- --run
npm run typecheck
npm test
npm run build
npm run verify:package
```

## Evidence

- Direct development dependencies are pinned to exact `vitest@5.0.4` and `@vitest/coverage-v8@5.0.4`; peers resolve cleanly.
- Ordinary resolution changes 142 lock entries within the Vitest 5 development graph: Vite `7.3.6 → 8.3.4`, source-map-js `1.2.1 → 1.2.2`, removal of vite-node/tinypool, and replacement worker/coverage packages.
- All 253 pre-existing production package versions remain unchanged; no production entries were added. Shared `detect-libc@2.1.2` changed metadata from optional to devOptional because Lightning CSS adds a development edge.
- All five issue-#30 findings are absent. After integrating merged PR #32 in commit `0522c3d`, full and production audits both contain exactly the four upstream-blocked issue-#29 entries: `@babel/core`, `@opentui/solid`, `seroval`, and `solid-js`; `brace-expansion` is absent.
- Clean-environment focused verification passed 144 tests across 10 files.
- One-shot V8 coverage passed all 336 tests and completed reporters: 82.41% statements, 74.38% branches, 80.98% functions, and 83.16% lines.
- Full verification passed 336 tests across 20 files, typecheck, build, package verification across 179 files, valid installed/lockfile trees, and `git diff --check`.
- Native RDD approved the 1,840-line generated/tooling candidate and its exact acknowledgement burned authority.

- Combined verification after merging `main` preserved all 253 production package path/version pairs, installed production brace `2.1.7`, and passed 144 focused tests, 336 coverage tests, 336 full tests, typecheck, build, package verification across 179 files, and both diff checks.

## Next step

Publish the branch and open one pull request for issue #30 under the user's existing authorization.
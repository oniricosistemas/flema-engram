# ODD Feature: Reduce Solid/OpenTUI runtime vulnerabilities

- Feature ID: `solid-runtime-vulnerabilities`
- Status: `completed_partial`
- Branch: `fix/solid-runtime-vulnerabilities`
- Branch point: `4b6c97fb0d92cf120b6eaffd7f1f94ea927adc96`
- Approved issue: [#29](https://github.com/oniricosistemas/flema-engram/issues/29)
- Pull request: [#32](https://github.com/oniricosistemas/flema-engram/pull/32)
- Delivery strategy: `partial-fix-pr`
- Forecast: 10–60 authored changed lines, primarily targeted lockfile resolution and blocker evidence

## Objective

Remove the independently fixable production `brace-expansion` vulnerability while preserving the project runtime floor and documenting why the remaining Solid/OpenTUI findings cannot yet be remediated with supported stable releases.

## Security baseline

Fresh `npm audit --omit=dev --json` reports five issue-#29 entries:

- `@babel/core` — low.
- `brace-expansion` — high; production `2.1.4`, patched at `2.1.7`.
- `@opentui/solid` — critical propagated findings.
- `seroval` — critical; patched from `1.6.3` across current advisories.
- `solid-js` — critical propagated Seroval findings; patched from stable `1.9.16`.

## Upstream blocker

- `@opentui/solid@0.5.16` and `0.5.17` move Babel to a patched release but require exactly `solid-js@1.9.12`, which remains vulnerable.
- Their matching `@opentui/core` requires Node `>=26.4.0` and Bun `>=1.3.0`, conflicting with this package's Node `>=22` contract.
- Latest stable OpenTUI `0.6.1` retains the exact vulnerable Solid peer and the higher runtime floor.
- Pairing OpenTUI `0.5.16` with Solid `1.9.16` fails ordinary npm peer resolution.

## Scope

- Resolve the production `brace-expansion` 2.x chain to `2.1.7` using ordinary lockfile resolution.
- Preserve direct dependency ranges, Node `>=22`, sidebar behavior, and package output.
- Confirm the high-severity brace advisory disappears without introducing replacement production findings.
- Record the remaining four runtime entries as blocked by the supported OpenTUI release graph.

## Non-goals

- Overrides, `--force`, `--legacy-peer-deps`, patched forks, or speculative peer bypasses.
- Raising the Node runtime floor.
- Sidebar feature changes.
- Closing issue #29 while the four critical/propagated entries remain.
- Vitest/tooling remediation tracked by issue #30.

## Tasks

- [x] `SOLIDSEC-001` **completed** — Patch the independently resolvable brace-expansion chain
  - Route: delegated to `gentle-ai-worker`; targeted lockfile mutation plus independent security and compatibility verification.
  - Security RED: production audit contained `brace-expansion@2.1.4` as a high-severity entry.
  - Security GREEN: production brace resolves to `2.1.7`; the brace entry is absent and the remaining entries are exactly the documented OpenTUI/Solid blocker set.
  - Commit: `2229bf5`.
  - Review: independent verification passed. Native RDD lineage `review-f32eefb9e8488255` could not admit a verdict because its reviewer context omitted generated lockfile hunks; two refusal outcomes and one transport failure consumed no lens slot. No native approval is claimed.

## Verification plan

```bash
npm audit --omit=dev --json
npm ls brace-expansion @babel/core @opentui/solid seroval solid-js --all
npm test -- tests/unit/sidebar tests/unit/schemas tests/unit/package
npm run typecheck
npm test
npm run build
npm run verify:package
npm audit --omit=dev --json
```

## Evidence

- Ordinary targeted resolution changed only two lockfile entries: production `brace-expansion` `2.1.4 → 2.1.7` and the dev-only nested copy `5.0.9 → 5.0.12`; no manifest or source files changed.
- Fresh production audit exits nonzero with exactly four residual entries: `@babel/core` low plus critical `@opentui/solid`, `seroval`, and `solid-js`; `brace-expansion` is absent.
- Clean install completed and installed/lockfile dependency trees matched.
- Focused sidebar/schema/package verification passed 122 tests across 7 files.
- Full verification passed 336 tests across 20 files, typecheck, build, package verification across 179 files, and `git diff --check`.
- The self-referential untracked `flema-engram` symlink naturally reflected generated `dist/` writes during build; the symlink itself and tracked state were unchanged.
- Native RDD did not produce a verdict because generated lockfile content hunks were omitted from reviewer context; independent verification is the applicable fallback evidence.

## Next step

Wait for required `validate` checks and human review on PR #32. Keep #29 open and blocked until OpenTUI publishes a stable release that accepts patched Solid and preserves the supported runtime floor.
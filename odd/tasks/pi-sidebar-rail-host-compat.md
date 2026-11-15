# ODD Feature: Restore Flema Pi sidebar compatibility
- Feature ID: `pi-sidebar-rail-host-compat`
- Status: `in_progress`
- Branch: `fix/pi-sidebar-rail-host-compat`

## Specs

1. **S1 — Flema sidebar rendering.** "en main rompe y no deja ver ningun sidebar ni los nativos de gentle-shell y en stable se ve mal:"
2. **S2 — Known-good comparison.** "ya probe, mcp-sidebar (esta donde estas vos) y funcionana"
3. **S3 — PR delivery.** "ahi se conecto el mcp de engram por si quieres probar, comite y crea el pr"
4. **S4 — Native rail ownership fallback.** "si aplica y actualiza el Pr"

## Tasks

- [blocked] **T1** — S1-S2 — Fix Flema rail/card compatibility so Stable rows use host-owned framing and Main does not hide or break native Gentle Shell sidebars; route: parent inline, test-first plus independent Risk verifier; implementation commit: `8232467`.
- [-] **T2** — S1-S2 — Separate Main integration slice; dropped because both symptoms share the rail adapter and shipped as one bounded review unit; commit: not applicable.
- [x] **T3** — S3 — Link the related issue, push the authorized branch, and open a focused PR without claiming unperformed Main/Stable manual validation; route: parent with branch-pr skill; PR: https://github.com/oniricosistemas/flema-engram/pull/85.
- [~] **T4** — S4 — Distinguish an active foreign/native rail from an unavailable rail so the fallback overlay does not overlap a native owner; add regression tests and update PR #85; route: parent inline, test-first plus independent Risk verifier; commit: pending.

## Log

- **L1** — "revisa lo que hicimos porque se sigue rompiendo el sidebar, en la version main ni se ve ningun sidebar, y en la stable se ve asi:\n[Image#1]\npuedes analizar los proyectos pr-flow o mcp-sidebar como lo solucionamos"
- **L2** — "los proyectos estan por fuera de este repo, estan en la carpeta lmsastre@CT112:~/projects/"
- **L3** — "ya probe, mcp-sidebar (esta donde estas vos) y funcionana \n[Image#2]\nen main ni en stable se ve bien flema-engram. En main rompe y no deja ver ningun sidebar ni los nativos de gentle-shell y en stable se ve mal:\n[Image#3]"
- **L4** — Implementation authorized by the user selecting “Implementar el arreglo” for a scoped Flema correction with regression tests.
- **L5** — Risk: item 3 (shared Gentle Shell/Pi sidebar contract) and item 5 (runtime compatibility); preserve existing host behavior and verify using focused fixtures plus an independent review.
- **L6** — Consolidated the Main and Stable fixes into one work unit after the Stable RED/GREEN showed both failures route through the same host-selected panel participant; this keeps the shared-adapter change reviewable as one candidate.
- **L7** — Focused Pi tests pass 29/29; full suite passes 28 files / 515 tests; typecheck and build pass. `npm run verify:package` did not finish before its 30-second command timeout; per no-retry policy, it was not rerun.
- **L8** — Independent Risk verifier passes S1-S2 at fixture level, including 8 isolated probes for foreign-stack non-mutation, fallback visibility, and panel row framing. Real Main/Stable host acceptance remains unavailable; Risk 3/5 is only partially verified. The verifier made no workspace edits.
- **L9** — Native ASSESS on committed candidate `main..HEAD` returned high risk, applied escalation item 3, and `reviewDue=false` (`under_budget`); the independent verifier satisfied the escalation plan, so no native review lineage was started.
- **L10** — T1 remains blocked pending actual Main/Stable host acceptance. The code fix is committed as `8232467`; no push or release had been performed at that point.
- **L11** — The user then authorized testing the newly connected Engram MCP, committing, and creating a PR. `mcp__engram` responded to read-only project/doctor calls; those calls do not validate the sidebar UI. A single isolated `npm run verify:package` subsequently passed (207 files). Repository policy requires an issue reference; related issue #80 is closed and will be referenced non-closing (`Refs #80`) rather than creating a new issue without authorization.
- **L12** — Fresh target-bound GitHub reads confirm `main` is the default branch, issue #80 is the exact related approved bug, the fix branch has no existing PR, and no open sidebar PR duplicates this candidate. The `fix` branch matches the repo's documented naming convention.
- **L13** — PR #85 is open against `main`, references issue #80 non-closing, and accurately marks actual Main/Stable visual acceptance as not performed. Both observed `validate` runs are pending; no merge was requested or performed. T3 is complete; T1 remains blocked on actual host acceptance.
- **L14** — PR #85's AI reviewer requested one medium-severity change: a foreign active rail causes `attachGentleShellRailPanel` to return `undefined`, while the overlay fallback still renders and can overlap the rail. The user authorized applying this recommendation and updating PR #85.
- **L15** — RED reproduced the overlap: the overlay remained visible at width 120 with an active foreign rail. The fix suppresses both `overlayOptions.visible` and the mounted handle when the native rail owns the host, while preserving overlay fallback when no host exists; focused Pi tests pass 30/30 and the full suite passes 516/516. A combined test/typecheck/build command then timed out at 30 seconds after the suite output, before typecheck completed; build and diff-check were not reached and were not retried. Independent static Risk verification marks S4 met at fixture level. PR #85 remains unmodified by this follow-up.
- **L16** — The user authorized one isolated attempt each of `npm run typecheck`, `npm run build`, and `npm run verify:package`, each capped at 30 seconds, stopping on any failure or timeout; only if all pass may the correction be committed and pushed to PR #85.
- **L17** — The isolated `npm run typecheck` attempt also timed out at 30 seconds. Per the user's explicit stop-on-timeout boundary, build and package verification were not attempted; the follow-up remains uncommitted and PR #85 is unchanged.
- **L18** — The user authorized one new isolated attempt of typecheck with a 60-second cap, followed by one build and one package-verification attempt capped at 30 seconds each; stop at the first failure or timeout, and only commit/update PR #85 if all three pass.
- **L19** — The authorized isolated typecheck passed in 7 seconds, build passed, and `npm run verify:package` passed for 207 files. The S4 implementation and regression tests are ready for a reviewable work-unit commit; actual Main/Stable host acceptance remains pending.

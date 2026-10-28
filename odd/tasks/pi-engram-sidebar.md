# ODD Feature: Pi / Gentle Shell Engram sidebar

- Feature ID: `pi-engram-sidebar`
- Status: `in_progress`
- Branch: `feat/pi-engram-sidebar`
- Delivery strategy: review-sliced work-unit commits; if remote delivery is authorized, publish them as a chained PR sequence

## Specs

1. **S1 — Sidebar.** "pero tambien quiero el sidebar como en opencode, colapsable y que tome los colores del theme que esté activo"
2. **S2 — Widget visibility.** "tambien deberiamos ofrear la opcion de sacar el widget del status debajo del input para que no moleste, osea poder mostrar y no mostrarlo"
3. **S3 — Widget defaults.** "Siempre oculto inicialmente" and "Solo durante la sesión (recomendado)"
4. **S4 — Release version.** "Preparar 0.4.0 (recomendado)"
5. **S5 — Blocker resolution.** "resolvamos los bloqueos"

## Tasks

- [x] **T1** — S1 — Add the bounded, theme-aware, collapsible Pi Engram panel component and pure layout behavior; route: parent inline, test-first; commit: `bf23c4d`.
- [x] **T2** — S1 — Attach independent panel participants to the feature-detected Gentle Shell rail without replacing the host footer or breaking another participant; route: parent inline, test-first; commit: `762d628`.
- [x] **T3** — S1 — Mount the panel through the Pi custom-UI lifecycle with a passive overlay fallback, show/hide and collapse commands, stale-session protection, and idempotent cleanup; route: parent inline, test-first; commit: `c4da979`.
- [x] **T4** — S2-S3 — Add independent session-scoped widget visibility controls, hidden by default, while preserving refresh and lifecycle behavior; route: parent inline, test-first; commit: `35a3446`.
- [x] **T5** — S1-S4 — Prepare version 0.4.0, update Pi installation/usage documentation, and verify the focused behavior, full suite, build, package contract, Pi runtime registration, and Gentle Shell rail integration; route: parent plus independent Risk 3/5 verifier; commit: `e2608a8`.
- [x] **T6** — S5 — Prevent completed historical summaries from appearing as active Pi/Engram blockers while preserving explicit blocker observations and active blocker wording; route: parent inline, test-first, Risk item 3 verifier; commit: `0f11f71`.
- [x] **T7** — S1-S5 — Resolve the protected-untracked declaration stop and complete the native RDD route for the bounded final 0.4.0 release slice; route: parent native review lifecycle; commit: not applicable.
- [ ] **T8** — S5 — Install the exact local 0.4.0 candidate into Gentle Shell's isolated package home and verify a fresh runtime no longer reports the historical false blocker; route: parent environment update after explicit authorization; commit: not applicable.

## Log

- **L1** — "pero tambien quiero el sidebar como en opencode, colapsable y que tome los colores del theme que esté activo"
- **L2** — "tambien deberiamos ofrear la opcion de sacar el widget del status debajo del input para que no moleste, osea poder mostrar y no mostrarlo"
- **L3** — Widget initial state selected as "Siempre oculto inicialmente".
- **L4** — Widget persistence selected as "Solo durante la sesión (recomendado)".
- **L5** — Exploration found no public fixed-sidebar Pi slot. Gentle Shell exposes the terminal-owned experimental rail contract `Symbol.for("gentle-pi.experimental-sidebar.state")`; plain Pi supports a passive right-side overlay fallback. The implementation must feature-detect the rail rather than require Gentle Shell internals.
- **L6** — Risk: item 3 (Pi/Gentle Shell presentation commands and package contracts) and item 5 (host/runtime compatibility and npm distribution).
- **L7** — Review workload is split into cohesive work units: pure themed panel, host rail/overlay integration, widget controls, then documentation and verification. This avoids one oversized UI/runtime slice while keeping each behavior with its tests.
- **L8** — T1 RED failed because `src/pi/sidebar.js` did not exist. GREEN passes 3 focused tests covering bounded layout, collapse/expand, and active-theme repaint, plus TypeScript typecheck.
- **L9** — The initial combined host/lifecycle T2 forecast reached 521 changed lines, so it was split at the natural boundary: rail participant adapter first, Pi lifecycle integration second. Rail RED failed because no attachment API existed; GREEN passes direct mount, visibility, restoration, and shared-wrapper coexistence tests.
- **L10** — The feature crossed 400 authored lines after two independently reviewable commits (294 and 280 changed lines). Remaining work stays in separate work-unit commits; any later remote delivery uses a chained PR sequence rather than one oversized PR.
- **L11** — T3 RED observed no custom UI mount. GREEN passes overlay configuration, active view-model handoff, show/hide and collapse commands, stale factory rejection, mount-error redaction, and repeated shutdown cleanup; 14 focused Pi tests and TypeScript typecheck pass.
- **L12** — T4 RED showed the below-input widget still rendered at startup and no `engram-widget` command existed. GREEN keeps the widget hidden by default, toggles it independently, and resets visibility on session replacement; 15 focused Pi tests and TypeScript typecheck pass.
- **L13** — "Preparar 0.4.0 (recomendado)"
- **L14** — Parent verification passes 492/492 tests, TypeScript typecheck, build, 207-file package verification, and `git diff --check`. The `engram-refresh` differential preserves registration, notification, status, stderr, and exit behavior; only the requested hidden-default widget differs. The actual Gentle Shell runtime registers the four 0.4.0 commands from `dist/pi.js`. The packed artifact installs and imports through `opencode-flema-engram-sidebar/pi`; SHA-256 is `eb4582af4b8d2bc7ae51362cb3257582641e5f9e4f97a052a83dc7fdc9322c7a`.
- **L15** — Native assessment was unassessable before candidate creation because protected ambient untracked paths require an explicit declaration; no lineage or native verdict exists. The required independent Risk 3/5 verifier is the outside view for this candidate.
- **L16** — Independent Risk 3/5 verification passed S1-S4 with no blockers. It inspected the complete eight-file candidate, passed 28 focused and 492 full tests, typecheck, build, 207-file package verification, actual Pi command registration, theme rendering, Gentle Shell rail coexistence and responsive fallback, baseline differential behavior, packed `./pi` import, and diff hygiene. Registry installation and human fullscreen visual acceptance remain outside preparation scope.
- **L17** — T5 is recorded in `e2608a8`. Version 0.4.0 is prepared locally; tag creation, npm publication, push, pull-request creation, and merge remain separate delivery decisions. Risk: item 3 (public Pi commands and package contracts) and item 5 (Pi/Gentle Shell host and npm distribution compatibility).
- **L18** — "resolvamos los bloqueos"
- **L19** — Selected "Ambos (recomendado)": correct the false `1 blocked` status caused by a completed historical summary, then resolve the native RDD protected-untracked declaration stop without modifying those protected paths.
- **L20** — T6 RED reproduced observation 2108 semantics: a completed `session_summary` containing `upstream-blocked on` was returned as active. GREEN excludes summary heuristics while preserving explicit blocker records and non-summary title/content markers. Focused 8/8 and full 493/493 tests, typecheck, build, 207-file package verification, diff hygiene, and independent S5 verification pass with no blockers.
- **L21** — T6 is recorded in `0f11f71`. The bounded native review candidate is the committed final release slice after `35a3446`, excluding every ambient untracked path.
- **L22** — Native review lineage `review-54529587abc6a305` froze the exact committed 10-path slice after `35a3446` with every ambient untracked path excluded. Risk, readability, and reliability lenses approved target `sha256:0970788d5208f334606cf2a55f9882963b5fd9c23b73514010337caca747ead7`; exact acknowledgement completed and burned authority at revision `sha256:5ff97c7be51b6b9c1968fa6c319d2d77200490a18b3327ae5bceeea7a86cc039`.
- **L23** — The active Gentle Shell package home is outside the repository at `/home/lmsastre/.gentle-shell/agent`. Updating it to the corrected local 0.4.0 candidate requires explicit external-write authorization before runtime verification.
- **L24** — External installation was authorized. Gentle Shell now configures local source `../../projects/flema-engram`, resolved by `pi list` to `/home/lmsastre/projects/flema-engram`; the old npm 0.3.0 source is removed and the original settings are backed up at `/home/lmsastre/.gentle-shell/agent/settings.json.pre-flema-local-0.4.0`. Runtime proof remains pending: the first probe incorrectly required an absolute stored source, the installed Pi CLI rejected unsupported `--no-mcp`, and the bounded second correction still produced no `/engram-refresh` response. No further automated retry is allowed; run `/reload` and then `/engram-refresh` interactively and inspect the status.

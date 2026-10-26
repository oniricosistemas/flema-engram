# ODD Feature: Pi / Gentle Shell Engram sidebar

- Feature ID: `pi-engram-sidebar`
- Status: `in_progress`
- Branch: `feat/pi-engram-sidebar`
- Delivery strategy: review-sliced work-unit commits; if remote delivery is authorized, publish them as a chained PR sequence

## Specs

1. **S1 — Sidebar.** "pero tambien quiero el sidebar como en opencode, colapsable y que tome los colores del theme que esté activo"
2. **S2 — Widget visibility.** "tambien deberiamos ofrear la opcion de sacar el widget del status debajo del input para que no moleste, osea poder mostrar y no mostrarlo"
3. **S3 — Widget defaults.** "Siempre oculto inicialmente" and "Solo durante la sesión (recomendado)"

## Tasks

- [x] **T1** — S1 — Add the bounded, theme-aware, collapsible Pi Engram panel component and pure layout behavior; route: parent inline, test-first; commit: `bf23c4d`.
- [x] **T2** — S1 — Attach independent panel participants to the feature-detected Gentle Shell rail without replacing the host footer or breaking another participant; route: parent inline, test-first; commit: `762d628`.
- [x] **T3** — S1 — Mount the panel through the Pi custom-UI lifecycle with a passive overlay fallback, show/hide and collapse commands, stale-session protection, and idempotent cleanup; route: parent inline, test-first; commit: `c4da979`.
- [x] **T4** — S2-S3 — Add independent session-scoped widget visibility controls, hidden by default, while preserving refresh and lifecycle behavior; route: parent inline, test-first; commit: pending.
- [ ] **T5** — S1-S3 — Update Pi installation/usage documentation and verify the focused behavior, full suite, build, package contract, Pi runtime registration, and Gentle Shell rail integration; route: parent plus independent Risk 3/5 verifier; commit: pending.

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

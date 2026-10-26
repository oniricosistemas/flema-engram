# ODD Feature: Pi / Gentle Shell Engram sidebar

- Feature ID: `pi-engram-sidebar`
- Status: `in_progress`
- Branch: `feat/pi-engram-sidebar`

## Specs

1. **S1 — Sidebar.** "pero tambien quiero el sidebar como en opencode, colapsable y que tome los colores del theme que esté activo"
2. **S2 — Widget visibility.** "tambien deberiamos ofrear la opcion de sacar el widget del status debajo del input para que no moleste, osea poder mostrar y no mostrarlo"
3. **S3 — Widget defaults.** "Siempre oculto inicialmente" and "Solo durante la sesión (recomendado)"

## Tasks

- [x] **T1** — S1 — Add the bounded, theme-aware, collapsible Pi Engram panel component and pure layout behavior; route: parent inline, test-first; commit: pending.
- [ ] **T2** — S1 — Mount the panel into the feature-detected Gentle Shell rail with a passive Pi overlay fallback and session-safe cleanup; route: parent inline, test-first; commit: pending.
- [ ] **T3** — S2-S3 — Add independent session-scoped widget visibility controls, hidden by default, while preserving refresh and lifecycle behavior; route: parent inline, test-first; commit: pending.
- [ ] **T4** — S1-S3 — Update Pi installation/usage documentation and verify the focused behavior, full suite, build, package contract, Pi runtime registration, and Gentle Shell rail integration; route: parent plus independent Risk 3/5 verifier; commit: pending.

## Log

- **L1** — "pero tambien quiero el sidebar como en opencode, colapsable y que tome los colores del theme que esté activo"
- **L2** — "tambien deberiamos ofrear la opcion de sacar el widget del status debajo del input para que no moleste, osea poder mostrar y no mostrarlo"
- **L3** — Widget initial state selected as "Siempre oculto inicialmente".
- **L4** — Widget persistence selected as "Solo durante la sesión (recomendado)".
- **L5** — Exploration found no public fixed-sidebar Pi slot. Gentle Shell exposes the terminal-owned experimental rail contract `Symbol.for("gentle-pi.experimental-sidebar.state")`; plain Pi supports a passive right-side overlay fallback. The implementation must feature-detect the rail rather than require Gentle Shell internals.
- **L6** — Risk: item 3 (Pi/Gentle Shell presentation commands and package contracts) and item 5 (host/runtime compatibility and npm distribution).
- **L7** — Review workload is split into cohesive work units: pure themed panel, host rail/overlay integration, widget controls, then documentation and verification. This avoids one oversized UI/runtime slice while keeping each behavior with its tests.
- **L8** — T1 RED failed because `src/pi/sidebar.js` did not exist. GREEN passes 3 focused tests covering bounded layout, collapse/expand, and active-theme repaint, plus TypeScript typecheck.

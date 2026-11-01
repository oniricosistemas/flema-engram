# ODD Feature: Pi global-scope compatibility and cloud-first fallback

- Feature ID: `pi-global-scope-fix`
- Status: `in_progress`
- Branch: `feat/pi-engram-sidebar`
- Delivery strategy: single work-unit commit + PR

## Specs

1. **S1 — Global scope acceptance.** "el codigo de node se queda asi sin hacer nada" — live Engram returns `scope: "global"` in all-project observations; schemas must accept it without breaking project/personal validation.
2. **S2 — Cloud-first Pi adapter.** "la idea es que valide el cloud primero y luego el local" — Pi resolves from cloud first, falls back to local on empty/error.
3. **S3 — Gentle Shell runtime acceptance.** "ahora si!, el sidebar se ve asi ... y el /engram-refresh devuelve Engram refreshed" — live host confirms project resolution, OK health, and successful refresh.

## Tasks

- [x] **T1** — S1 — Accept `scope: "global"` in observation/project schemas and Observation/ListObservationsOpts types; route: parent inline, test-first; commit: pending.
- [x] **T2** — S2 — Add `createPiConfiguredAdapter` with cloud-first CompositeEngramAdapter and empty-result fallback; preserve OpenCode `createConfiguredAdapter` behavior; route: parent inline, test-first; commit: pending.
- [x] **T3** — S1-S3 — Verify focused tests, full suite, typecheck, build, live adapter probe, and Gentle Shell runtime acceptance; route: parent inline; commit: pending.
- [ ] **T4** — S1-S3 — Commit, create PR, merge, create release, and publish npm package; route: parent remote delivery; commit: pending.

## Log

- **L1** — "en el sidebar me sale esto: projects: All adapters failed (projects=una…" — initial sidebar error in Gentle Shell.
- **L2** — User confirmed the project is enrolled in cloud and Gentle Shell/Pi should use cloud first, then local.
- **L3** — Live curl evidence: local `/observations/recent?limit=100&all_projects=true` returns `scope: "global"` on observation ID 2160 (project `mcp-sidebar`); cloud `:18080` returns 404 on data routes.
- **L4** — Node probe on compiled adapter confirmed `EngramUnavailable: All adapters failed` with cause `Engram returned an invalid response` on `/observations/recent?limit=100&all_projects=true`.
- **L5** — Schema validation isolated the root cause: `scope: "global"` rejected by `z.enum(["project", "personal"])`. RED test added; GREEN after enum expansion.
- **L6** — Cloud-first Pi adapter added via `createPiConfiguredAdapter`; `fallbackOnEmpty` option added to `CompositeEngramAdapter`. OpenCode keeps existing `createConfiguredAdapter` behavior.
- **L7** — Live Gentle Shell acceptance: sidebar shows `flema-engram · OK`, recent activity, `/engram-refresh` returns `Engram refreshed`.
- **L8** — Full suite 504/504, focused 126/126, typecheck, build, and live adapter probe all pass. User authorized commit, PR, merge, release, and npm publication.

# ODD Feature: Safe Plugin Doctor and Updater

- Status: in progress; external pattern research complete.
- Delivery strategy: chained PRs. Slice 1 covers the read-only `doctor` and reusable inspection core; slice 2 covers update planning/apply, package wiring, docs, and final verification.

## Specs

1. **S1** — "pregunta..., hay forma de resolver esto automaticamente? con cada nueva release? actualiza el readme si es necesario"
2. **S2** — "CLI `doctor/update` seguro (recomendado)"
3. **S3** — "flujo completo, pero antes puedes investigar como lo hacen otros plugings quizas podemos copiar sus metodos"

## Tasks

- [x] **T1** — S3 — Research OpenCode and third-party plugin update patterns; route: parent research; commit: N/A (read-only).
- [x] **T2** — S1-S3 — Define the public `doctor` CLI contract and add RED tests for diagnosis and argument refusal; route: parent inline; commit: `5edd9d3`.
- [x] **T3** — S2-S3 — Implement cross-platform OpenCode path/config/cache discovery and the read-only `doctor` report; route: parent inline; commit: `5edd9d3`.
- [x] **T4** — S1-S3 — Implement fail-closed update planning, dry-run, confirmation, config snapshot/backup, exact manifest-verified stale-wrapper cleanup, and post-apply verification; route: parent inline; commit: `0bf4b7d`; Risk: item 5 (environment/configuration mutation).
- [x] **T5** — S1-S3 — Wire the package binary, update README/help, and extend package verification; route: parent inline; commit: wiring slice (hash recorded after commit).
- [ ] **T6** — S1-S3 — Run focused and full verification, cross-platform structural checks, native assessment/review when due, and prepare reviewable delivery slices; route: parent inline plus required independent verification for Risk item 5; commit: pending.

## Log

- **L1** — "pregunta..., hay forma de resolver esto automaticamente? con cada nueva release? actualiza el readme si es necesario"
- **L2** — User selected: "CLI `doctor/update` seguro (recomendado)".
- **L3** — "flujo completo, pero antes puedes investigar como lo hacen otros plugings quizas podemos copiar sus metodos"
- **L4** — Research evidence: OpenCode v1 has a confirmed stale-spec cache short-circuit; OpenCode v2 adds native `plugin check/update`. OpenCode Quota uses preview/confirm/apply with race revalidation, atomic config writes, symlink/containment/manifest checks, and no secret mutation. `opencode-cursor` uses a check/prompt/force helper. Background auto-update plugins add locks/throttling but rewrite config silently and are not the safety model selected here.
- **L5** — User selected: "PRs encadenados (recomendado)". Slice 1 is the read-only diagnosis/planning boundary; slice 2 adds environment mutation and carries Risk item 5.
- **L6** — Slice 1 boundary: `5edd9d3` (`feat(maintenance): add read-only plugin doctor`), 445 authored lines including its feature tracker, implementation, and public-interface tests.
- **L7** — Slice 2 high-risk boundary: `0bf4b7d` (`feat(maintenance): apply verified plugin updates`), 483 authored lines with the environment-mutating behavior and its six public-interface rules.

# ODD Feature: Fresh sidebar state after Engram saves

- Feature ID: `sidebar-save-refresh`
- Status: `in_progress`
- Delivery: one bug-fix work unit, PR, merge, release, and npm publication

## Specs

1. **S1 — Fresh Gentle Shell refresh.** "he notado que en la nueva versión de gentle-shell cuando hace un save no se actualiza el sidebar de engram"
2. **S2 — Cloud-aware project view.** "no deberiamos mostrar lo que se ve en engram cloud (en caso que este enrolado el proyecto al cloud)"
3. **S3 — Local fallback after save.** "si se hizo un save y falla el cloud no deberia mostrar el save que se hizo en local?"
4. **S4 — OpenCode parity.** "ojo que este bug hay que ver si pasa lo mismo en el sidebar de opencode, la captura que te pase es de gentle-shell"
5. **S5 — Reviewed delivery.** "corrige lo que sea necesario para correr el RDD y luego comitea, y abre el PR si da verde mergea crea el release el y el paquete"

## Tasks

- [x] **T1** — S1-S4 — Diagnose Gentle Shell and OpenCode refresh paths and reproduce stale composite-cache behavior; route: parent inline; commit: pending.
- [x] **T2** — S1-S3 — Invalidate cached reads safely on refresh and preserve fresh local fallback when Cloud is unavailable; route: parent inline, test-first; commit: pending.
- [x] **T3** — S4 — Refresh the official OpenCode TUI after successful Engram save events and document behavior; route: parent inline, test-first; commit: pending.
- [ ] **T4** — S1-S5 — Run native RDD review on the exact final candidate and apply any bounded correction; route: native review; commit: not applicable. Initial implementation lineage `review-38f8b7071abce53a` approved and acknowledged; reopened after adding 0.4.2 release metadata and documentation.
- [ ] **T5** — S5 — Commit the reviewed work unit, open the approved-issue PR, verify required CI, merge, create the release, and publish the npm package; route: parent remote delivery; commit: pending. Patch release `0.4.2` is prepared and locally verified.

## Log

- **L1** — "puedes revisar el código que tenemos, he notado que en la nueva versión de gentle-shell cuando hace un save no se actualiza el sidebar de engram, mira en el proyecto marketplace, el agente guarda en memoria\n/tmp/herdr-clipboard-images-1000/client-4-clipboard-1793820188839225226-0.png\npero en engram cloud muestra \n/tmp/herdr-clipboard-images-1000/client-4-clipboard-1793820271452454991-0.png\n\nno deberiamos mostrar lo que se ve en engram cloud (en caso que este enrolado el proyecto al cloud)"
- **L2** — "ok, una duda nomas en el 3, si se hizo un save y falla el cloud no deberia mostrar el save que se hizo en local? porque si no entiendo mal el save graba en local y luego hace el sync al cloud no?"
- **L3** — "ok haz el fix, ojo que este bug hay que ver si pasa lo mismo en el sidebar de opencode, la captura que te pase es de gentle-shell"
- **L4** — "corrige lo que sea necesario para correr el RDD y luego comitea, y abre el PR si da verde mergea crea el release el y el paquete"
- **L5** — RED evidence: controller returned cached pre-save observations within the 30-second TTL; an older in-flight request could repopulate cache after invalidation; OpenCode emitted no save-triggered refresh.
- **L6** — GREEN evidence: focused 90/90, full suite 508/508, typecheck, build, package verification (207 files), and diff check passed.
- **L7** — Native RDD lineage `review-38f8b7071abce53a` froze the exact ten-path implementation candidate. Resilience, readability, and reliability lenses approved it; exact acknowledgement burned the authority at revision `sha256:86a2a2ae175c4283bbd1f9804ec7ff2daa76d3dc0626b197d90f832bf8037568`.
- **L8** — Remote delivery uses approved issue #5 (`fix: Alt+R reports refreshed but sidebar data remains stale`) as a nonclosing `Refs #5` link. Patch release `0.4.2` updates package metadata, README install examples, and the GitHub Pages landing before the final candidate is re-verified and re-reviewed.
- **L9** — Final 0.4.2 verification initially stopped after the combined command passed 508/508 tests, TypeScript typecheck, and build, then hit the 30-second command timeout while package verification was active. The user authorized one isolated rerun of the pending checks.
- **L10** — The authorized isolated rerun passed package verification (207 files), `npm pack --dry-run` for `opencode-flema-engram-sidebar@0.4.2` (107,174 packed bytes; 489,595 unpacked bytes; shasum `269a6a8e376fd350e16807b3b2e7671e3177cc46`), root package/lock version alignment, and `git diff --check`. Its broad stale-version grep exited 1 only because `package-lock.json` legitimately contains dependency `json-schema@0.4.0`; direct scans prove README, site, and package-version test contain no stale 0.4.0/0.4.1 release references. The final candidate is locally green and ready for a fresh exact RDD review.

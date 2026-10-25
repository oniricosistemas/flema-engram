# Pi Engram Viewer

Add a read-only Flema Engram viewer for Pi/Gentle Shell after the verified 0.2.0 release. Keep OpenCode behavior intact and share only host-neutral state logic.

## Specs

1. **S1 — Scope.** The selected first implementation is: "Viewer read-only (recomendado)". It must not add memory-writing authority.
2. **S2 — Presentation.** The selected default is: "Status + widget compacto (recomendado)".
3. **S3 — Refresh.** The selected policy is: "Después de save_memory + eventos (recomendado)". Refresh after a successful Engram memory save, on relevant session lifecycle changes, and through a manual command; do not add periodic polling.
4. **S4 — Distribution.** The selected packaging is: "Mismo paquete, entrypoint ./pi (recomendado)".
5. **S5 — Compatibility.** Preserve the published OpenCode v1 `tui(...)` and OpenCode v2 `setup(context)` contracts and keep non-TUI Pi modes free of terminal-only rendering.
6. **S6 — Lifecycle.** Start session-owned resources from Pi session lifecycle events, prevent stale async refreshes from updating a replaced session, and clean up idempotently on shutdown or reload.
7. **S7 — Release version.** Prepare the selected version: "0.3.0 (recomendado)".

## Tasks

- [x] **T1** — S1,S5 — Extract and export a host-neutral Engram read-model/controller while preserving OpenCode behavior; route: parent inline, test-first; commit: `43fe27b`.
- [x] **T2** — S2,S3,S6 — Implement the Pi extension with named status/widget output, lifecycle refresh, successful-memory-save refresh, and a manual refresh command; route: parent inline, test-first; commit: `d181a8b`.
- [x] **T3** — S4,S5 — Add the `./pi` export and Pi package manifest, documentation, package verification, and isolated Pi load smoke; route: parent inline; commit: `c118097`.
- [x] **T4** — S1-S6 — Run full functional checks, differential OpenCode checks, independent Risk 3/5 verification, and applicable native review; route: independent verifier plus parent; commit: `fde3aaa`.
- [ ] **T5** — S4,S7 — Bump package and documentation to 0.3.0, rebuild the exact artifact, and verify package/runtime contracts; route: parent inline; commit: pending.
- [ ] **T6** — S1-S7 — Create the approved linked issue, push the feature branch, and open a PR with exactly one `type:*` label; route: parent inline; commit: pending.

## Log

- **L1** — "Arquitectura primero"
- **L2** — Selected decisions: "Viewer read-only (recomendado)"; "Status + widget compacto (recomendado)"; "Mismo paquete, entrypoint ./pi (recomendado)".
- **L3** — Initial refresh wording: "polling pero cuando se corre el save_memory de engram". Clarified and selected as: "Después de save_memory + eventos (recomendado)", meaning event-driven refresh after a successful Engram memory save, session lifecycle refresh, and manual refresh without periodic polling.
- **L4** — Delivery strategy: `43fe27b` is the core extraction boundary. Git reports a large raw slice because `src/sidebar/hooks/use-engram.ts` moved into `src/viewer/core.ts`; copy-aware review reports 194 additions and 704 deletions. Pi integration, packaging/docs, and final verification remain separate commits.
- **L5** — Delivery boundary: `d181a8b` adds only the Pi viewer and its behavior tests (360 additions). Packaging/documentation and final verification remain separate commits.
- **L6** — Delivery boundary: `c118097` adds package exports, the Pi manifest, documentation, and artifact verification (158 additions). Final verification remains separate.
- **L7** — Independent Risk 3/5 verification found that Pi creates a fresh command context, so object identity made `/engram-refresh` report an inactive viewer. A RED regression reproduced zero refresh calls; the guard now relies on active session ownership instead. The focused correction, 115 related tests, 480/480 full tests, typecheck, build, 203-file package verification, and independent S3 recheck pass.
- **L8** — The final OpenCode differential against `origin/main` produced identical stdout, stderr, and exit code for the shared hook state and root/TUI contracts. Native assessment was unavailable because protected ambient untracked paths require an explicit declaration; no native review lineage was started. Independent Risk 3/5 verification remains the final outside view.
- **L9** — Risk: item 3 (new public `./core` and `./pi` contracts plus the `/engram-refresh` command) and item 5 (npm/Pi package distribution and host compatibility).
- **L10** — "autorizo"
- **L11** — Selected release version: "0.3.0 (recomendado)". Authorization applies to issue creation, branch push, and PR creation; merge, tag, and npm publication remain separate decisions.

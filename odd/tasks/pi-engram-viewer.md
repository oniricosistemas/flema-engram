# Pi Engram Viewer

Add a read-only Flema Engram viewer for Pi/Gentle Shell after the verified 0.2.0 release. Keep OpenCode behavior intact and share only host-neutral state logic.

## Specs

1. **S1 — Scope.** The selected first implementation is: "Viewer read-only (recomendado)". It must not add memory-writing authority.
2. **S2 — Presentation.** The selected default is: "Status + widget compacto (recomendado)".
3. **S3 — Refresh.** The selected policy is: "Después de save_memory + eventos (recomendado)". Refresh after a successful Engram memory save, on relevant session lifecycle changes, and through a manual command; do not add periodic polling.
4. **S4 — Distribution.** The selected packaging is: "Mismo paquete, entrypoint ./pi (recomendado)".
5. **S5 — Compatibility.** Preserve the published OpenCode v1 `tui(...)` and OpenCode v2 `setup(context)` contracts and keep non-TUI Pi modes free of terminal-only rendering.
6. **S6 — Lifecycle.** Start session-owned resources from Pi session lifecycle events, prevent stale async refreshes from updating a replaced session, and clean up idempotently on shutdown or reload.

## Tasks

- [ ] **T1** — S1,S5 — Extract and export a host-neutral Engram read-model/controller while preserving OpenCode behavior; route: parent inline, test-first; commit: pending.
- [ ] **T2** — S2,S3,S6 — Implement the Pi extension with named status/widget output, lifecycle refresh, successful-memory-save refresh, and a manual refresh command; route: parent inline, test-first; commit: pending.
- [ ] **T3** — S4,S5 — Add the `./pi` export and Pi package manifest, documentation, package verification, and isolated Pi load smoke; route: parent inline; commit: pending.
- [ ] **T4** — S1-S6 — Run full functional checks, differential OpenCode checks, independent Risk 3/5 verification, and applicable native review; route: independent verifier plus parent; commit: pending.

## Log

- **L1** — "Arquitectura primero"
- **L2** — Selected decisions: "Viewer read-only (recomendado)"; "Status + widget compacto (recomendado)"; "Mismo paquete, entrypoint ./pi (recomendado)".
- **L3** — Initial refresh wording: "polling pero cuando se corre el save_memory de engram". Clarified and selected as: "Después de save_memory + eventos (recomendado)", meaning event-driven refresh after a successful Engram memory save, session lifecycle refresh, and manual refresh without periodic polling.

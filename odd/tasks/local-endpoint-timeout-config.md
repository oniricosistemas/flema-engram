# Local Endpoint and Timeout Configuration

Implement approved issue #45 by making the local Engram endpoint and one bounded timeout budget explicit workspace options without changing existing defaults or configuration precedence.

## Specs

1. **S1** — User selection: “Configurar endpoint y timeout (recomendado)”.
2. **S2** — “`baseUrl` is an explicitly documented and tested `tui.json` option.”
3. **S3** — “`timeoutMs` is accepted only when finite and greater than zero; omitted or invalid values use the existing 5000 ms default.”
4. **S4** — “The configured timeout reaches both `LocalEngramAdapter` and sidebar refresh/project-resolution stage guards.”
5. **S5** — “Explicit plugin configuration wins over environment and attach-host inference.”
6. **S6** — “Invalid endpoint configuration fails inside the sidebar boundary with an actionable diagnostic and does not crash the OpenCode host.”
7. **S7** — “Existing `enabled`, `project`, and `pollInterval` behavior remains unchanged.”
8. **S8** — “Tests cover option precedence, defaults, invalid URL/timeout values, request timeout propagation, and existing attach-host behavior.”
9. **S9** — “README configuration, attach guidance, and troubleshooting describe the two options accurately.”
10. **S10** — “Typecheck, full tests, build, and package verification pass.”
11. **S11** — User direction: “perfecto entonces tu agregarias la etiqueta cuando corresponda?”. Apply `pr-agent-review` to the delivery PR when the final diff changes the public configuration/error contract as expected.
12. **S12** — Preserve `.opencode/`, `flema-engram`, and the dirty sibling worktree `/home/lmsastre/projects/flema-engram-darter`.

## Tasks

- **T1** — S2-S8, S12 — Add public-contract RED tests for endpoint precedence, timeout validation/propagation, and invalid endpoint containment. Route: parent inline. Commits: `adc2398`, `7e7c461`. Status: done; focused RED reported 3 failures and 51 passes, then correction RED pinned explicit empty endpoints.
- **T2** — S2-S8, S12 — Implement one validated local endpoint and timeout budget across option parsing, adapter construction, project resolution, and refresh stages. Route: parent inline. Commits: `adc2398`, `7e7c461`. Status: done; focused GREEN passed 120/120 before the final plugin-boundary regression was added.
- **T3** — S2, S9, S12 — Document the supported options and troubleshooting contract. Route: parent inline with the same behavior work unit. Commit: `adc2398`. Status: done; README documents options, precedence, attach use, and troubleshooting.
- **T4** — S1-S12 — Run focused/full verification, differential checks for existing options, independent high-risk verification, native review when due, then prepare an issue-linked PR and activate PR-Agent. Route: parent plus independent verifier. Commits: `adc2398`, `7e7c461`; delivery pending. Status: in progress.

## Log

- **L1** — “ok sigamos con 1,3,2”.
- **L2** — User selected “Configurar endpoint y timeout (recomendado)”.
- **L3** — “perfecto entonces tu agregarias la etiqueta cuando corresponda?, haz el merge del PR#44 y continua con el issue#45”.
- **L4** — Approved issue: https://github.com/oniricosistemas/flema-engram/issues/45
- **L5** — Baseline: `baseUrl` already exists in internal option types and reaches `LocalEngramAdapter`, but is undocumented. `timeoutMs` is not a plugin option; the adapter and sidebar stage guards independently default to 5000 ms.
- **L6** — RED evidence: focused factory/plugin suite reported 3 failures and 51 passes. Failures proved `timeoutMs` was absent from resolved config, absent from sidebar stage props, and invalid `baseUrl` escaped the plugin boundary.
- **L7** — GREEN evidence: focused factory/local/plugin/refresh suite passed 119/119. `timeoutMs` is filtered to positive finite values, reaches local adapter construction and sidebar stage guards, invalid endpoint construction is contained at plugin registration, and invalid endpoint diagnostics no longer echo configured credentials.
- **L8** — Documentation evidence: README now exposes `baseUrl` and `timeoutMs`, endpoint precedence, attach override guidance, the common timeout budget, invalid URL behavior, and removes URL/timeout configuration from deferred roadmap scope.
- **L9** — Parent verification before independent review: differential factory probe matched `origin/main` for explicit nonempty endpoint, environment, and attach precedence; typecheck passed; full suite passed 422/422; build passed; package verification passed for 179 files; `git diff --check` passed.
- **L10** — Independent verifier initially failed S5/S6/S8 because explicit `baseUrl: ""` was silently replaced by attach or loopback fallback. Parent reproduced RED in the public factory test, committed `7e7c461`, and added plugin-boundary coverage for empty and unsupported-protocol endpoints.
- **L11** — Correction verification: focused suite passed 120/120, full suite passed 423/423, typecheck/build passed, package verification passed for 179 files, and the independent verifier returned PASS for S5/S6/S8 with no new blockers. S11 remains the parent-owned PR delivery check.
- **L12** — Native review `review-76afdf00f90e3a83` approved the 167-line committed candidate across risk, resilience, readability, and reliability; exact acknowledgement burned the authority. Delivery remains ordinary repository policy.

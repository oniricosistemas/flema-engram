# Local Endpoint and Timeout Configuration

Implement approved issue #45 by making the local Engram endpoint and one bounded timeout budget explicit workspace options without changing existing defaults or configuration precedence.
Delivery strategy: `feature-branch-chain` with two focused child slices and PR #46 superseded as the original oversized delivery.

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
- **T4** — S1-S12 — Run focused/full verification, differential checks for existing options, independent high-risk verification, native review when due, then prepare an issue-linked PR and activate PR-Agent. Route: parent plus independent verifier. Commits: `adc2398`, `7e7c461`, `7df6ccc`; chained delivery pending. Status: blocked on remote-chain authorization.
- **T5** — S3-S4, S8 — Address PR review findings with observable factory-to-request timeout propagation and safe scheduling for finite delays above the platform timer limit. Route: parent inline. Commit: `f5b48c4`. Status: done; correction RED observed and focused GREEN passed 123/123.
- **T6** — S3-S4, S8 — Address second review round by pinning abort/cleanup through fake timers and validating the shared timeout scheduler at its own boundary. Route: parent inline. Commit: `e442845` (amended locally after verification; final hash pending). Status: done; focused/full and independent GREEN.

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
- **L13** — Delivery: pushed `feat/local-endpoint-timeout-config` and opened PR #46 against `main`, closing approved issue #45. Applied exactly one type label, `type:feature`, plus the authorized advisory label `pr-agent-review`.
- **L14** — PR #46 required `validate` checks passed. PR-Agent failed closed without publication at `route=G1 outcome=CONTRACT reason=invalid-diagnostics`; later routes were terminally skipped. Revix identified missing committed factory-to-request timeout propagation proof and the Node timer overflow edge for finite values above 2147483647 ms. Correction will preserve S3's finite-positive contract by scheduling long delays in safe chunks.
- **L15** — PR correction evidence: RED failed because the long-timeout utility did not exist while the new factory propagation test already passed. Implemented reusable chunked scheduling in local HTTP and sidebar stage guards; focused factory/local/hook/plugin/utility suite passed 123/123.
- **L16** — Correction verification: full suite passed 426/426, typecheck/build passed, package verification passed for 183 files, and diff hygiene passed. Independent verification returned PASS for S3/S4/S8, including candidate-vs-baseline overflow probes, local/sidebar integration, cleanup after settlement, and preserved protected paths.
- **L17** — Second PR review round: Revix correctly identified that the committed factory propagation test left a real 1250 ms timer pending and did not assert abort, and requested defensive validation at the exported scheduler boundary. Add RED coverage for exact abort/cleanup and invalid scheduler input before correcting.
- **L18** — Second correction evidence: invalid scheduler inputs produced four RED failures; the new fake-timer factory test also exposed and corrected late rejection-handler ordering. The scheduler now rejects non-finite/non-positive delays before scheduling, and focused utility/factory/local/hook tests passed 79/79 with exact abort and zero pending timers.
- **L19** — Independent verification found and parent reproduced a zero-remaining-budget regression: strict scheduler validation replaced the sidebar's 0 ms timeout diagnostic and could leave a fallback rejection unobserved. Promise handlers are now attached before scheduling; the guard preserves cancellable zero-delay semantics while the exported scheduler stays strict. Focused 54/54, full 432/432, typecheck/build, 183-file package verification, diff hygiene, and independent S3/S4/S8 recheck passed.
- **L20** — Review-budget gate: the amended cohesive candidate plus tracking evidence reached about 421 authored changed lines, above the 400-line advisory threshold. Delivery strategy requires the user's explicit chained-versus-single-PR choice before another commit or push.
- **L21** — User selected “Cadena con rama feature/tracker (recomendada)” (`chain_strategy=feature-branch-chain`). One honest split yields core adapter/configuration at about 197 changed lines and sidebar/docs/tracking at about 226; both remain below 400. Remote execution requires separate authorization because it creates branches/PRs and supersedes PR #46.

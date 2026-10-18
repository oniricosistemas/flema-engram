# Controlled PR-Agent Failover Canary

Implement approved issue #39 as a bounded, maintainer-controlled canary without weakening the advisory workflow's fail-closed boundaries.

## Specs

1. **S1** — User authorization: “Sí, aprobar e implementar #39”.
2. **S2** — Selected direction: “Diseñar un canary controlado aparte”.
3. **S3** — The controlled canary must exercise the same route-decision and sequential-gate implementation, deterministically produce an advanceable early-route outcome, and prove that the next configured route is attempted.
4. **S4** — Activation must be trusted and bounded: untrusted pull-request input cannot enable canary mode, credentials remain isolated, and logs contain only sanitized route/outcome/reason identifiers.
5. **S5** — Normal and canary execution must preserve immutable candidate authorization and terminal contract, artifact-integrity, candidate-authority, signal, resource-boundary, and publication guards.
6. **S6** — Synthetic canary output must never reach PR advisory publication; cleanup must not require changing or deleting production secrets.
7. **S7** — Tests must cover activation denial, credential isolation, deterministic early advancement, next-route execution, first-valid stopping, final exhaustion, and terminal-boundary precedence.

## Tasks

- **T1** — S3-S7 — Add RED workflow contract tests for controlled-canary authorization, routing, and publication isolation. Route: parent inline. Commit: `03fd437`. Status: done; RED observed at 120 passed / 5 failed.
- **T2** — S3-S6 — Implement the bounded controlled-canary path and operational documentation. Route: parent inline. Commit: `03fd437`. Status: done; focused GREEN at 132/132.
- **T3** — S1-S7 — Run focused/full verification, independent and native review, then publish an issue-linked PR. Route: parent plus independent verifier. Commit: `85c16e5`. Status: awaiting exact-head CI on PR #40.

## Log

- **L1** — “ok continua”
- **L2** — User selected “Sí, aprobar e implementar #39”.
- **L3** — User previously selected “Diseñar un canary controlado aparte”.
- **L4** — Approved issue: https://github.com/oniricosistemas/flema-engram/issues/39
- **L5** — RED evidence: focused workflow suite reported 120 passed and 5 failed for dispatch authorization, live PR binding, deterministic G1 advancement, G2 execution proof, and publication isolation.
- **L6** — GREEN evidence: focused workflow suite passed 129/129, including executable trusted and denied controlled-G1 cases.
- **L7** — Full verification for the initial work unit: `npm ci`, typecheck, 415/415 tests, build, 179-file package verification, and diff hygiene passed. `npm ci` reported four existing audit findings (one low, three critical); no dependency or lockfile changed.
- **L8** — Independent verification found dispatch cleanup was skipped after an earlier step failure because the validation step inherited implicit `success()`. Correction RED reproduced one scheduling failure; `always()` now keeps cleanup reachable, focused GREEN is 132/132, and corrected work unit commit is `03fd437`.
- **L9** — Independent re-verification passed S1-S7. Native four-lens review approved the 358-line PR slice and its acknowledgement burned lineage `review-29c0ae187b21f1dc`.
- **L10** — Published issue-linked PR https://github.com/oniricosistemas/flema-engram/pull/40 with exactly one `type:*` label (`type:feature`); exact-head CI remains.

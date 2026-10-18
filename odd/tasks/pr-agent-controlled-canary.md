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

- **T1** — S3-S7 — Add RED workflow contract tests for controlled-canary authorization, routing, and publication isolation. Route: parent inline. Commit: pending. Status: done; RED observed at 120 passed / 5 failed.
- **T2** — S3-S6 — Implement the bounded controlled-canary path and operational documentation. Route: parent inline. Commit: pending. Status: done; focused GREEN at 129/129.
- **T3** — S1-S7 — Run focused/full verification, independent and native review, then publish an issue-linked PR. Route: parent plus independent verifier. Commit: pending. Status: in progress.

## Log

- **L1** — “ok continua”
- **L2** — User selected “Sí, aprobar e implementar #39”.
- **L3** — User previously selected “Diseñar un canary controlado aparte”.
- **L4** — Approved issue: https://github.com/oniricosistemas/flema-engram/issues/39
- **L5** — RED evidence: focused workflow suite reported 120 passed and 5 failed for dispatch authorization, live PR binding, deterministic G1 advancement, G2 execution proof, and publication isolation.
- **L6** — GREEN evidence: focused workflow suite passed 129/129, including executable trusted and denied controlled-G1 cases.

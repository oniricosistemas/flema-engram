# ODD-first workflow delivery tracker

This document bootstraps the feature/tracker branch for the ODD-first workflow visibility chain.

- Approved issue: [#17](https://github.com/oniricosistemas/flema-engram/issues/17)
- Integration base: `main`
- Delivery strategy: feature/tracker branch chain
- Tracker branch: `feat/odd-first-tracker`
- Status: child pull requests #19–#22 integrated; tracker synchronized with current `main`, locally verified, and awaiting final review and CI

## Chain

```text
main
└── feat/odd-first-tracker
    └── feat/odd-first-01-contract
        └── feat/odd-first-02-sidebar
            └── feat/odd-first-03-legacy
                └── feat/odd-first-04-mcp
```

## Review boundaries

| Position | Branch | Scope | Preserved implementation boundary |
|---|---|---|---|
| 1 | `feat/odd-first-01-contract` | ODD mirror contract, parser, diagnostics, and ordering | `b2305d5` |
| 2 | `feat/odd-first-02-sidebar` | Default ODD sidebar progress | `6330817` |
| 3 | `feat/odd-first-03-legacy` | Session-scoped legacy SDD mode | `59908b9` |
| 4 | `feat/odd-first-04-mcp` | ODD-first MCP state and closure documentation | `02ec2f6` |

Each child pull request originally targeted its immediate parent branch: #19 → tracker, #20 → #19, #21 → #20, and #22 → #21. All four children are now integrated into tracker PR #18 with their implementation ancestry preserved. The tracker remains draft until final review and exact-head CI complete.

## Verification

The final tracker candidate, synchronized with current `main`, passed:

- Exact-lockfile installation on Node.js 22.
- TypeScript typecheck.
- 151 focused ODD/sidebar/MCP tests and 389 full tests across 21 test files, with inherited Engram URL overrides removed for the test process.
- Package build.
- Package verification across 179 files.
- Independent verification of the ODD, legacy SDD, session-isolation, MCP, and public-export contracts.

The process-local environment isolation compensates for a pre-existing factory test that inherits `ENGRAM_URL`; the ODD implementation did not modify that source or test.

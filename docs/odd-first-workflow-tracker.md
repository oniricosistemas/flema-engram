# ODD-first workflow delivery tracker

This document bootstraps the feature/tracker branch for the ODD-first workflow visibility chain.

- Approved issue: [#17](https://github.com/oniricosistemas/flema-engram/issues/17)
- Integration base: `main`
- Delivery strategy: feature/tracker branch chain
- Tracker branch: `feat/odd-first-tracker`
- Status: implementation complete; child pull requests pending

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

Each child pull request targets its immediate parent branch. The tracker remains draft and must not merge into `main` until the complete chain is reviewed and integrated.

## Verification

The completed implementation passed:

- TypeScript typecheck.
- 285 tests across 20 test files with inherited Engram URL overrides removed for the test process.
- Package build.
- Package verification across 179 files.

The process-local environment isolation compensates for a pre-existing factory test that inherits `ENGRAM_URL`; the ODD implementation did not modify that source or test.

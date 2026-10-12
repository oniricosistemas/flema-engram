# ODD Feature: Remediate MCP runtime vulnerability chain

- Feature ID: `mcp-runtime-vulnerabilities`
- Status: `completed`
- Branch: `fix/mcp-runtime-vulnerabilities`
- Branch point: `41682bd9c3416245743e50545b084235260f9565`
- Approved issue: [#28](https://github.com/oniricosistemas/flema-engram/issues/28)
- Delivery strategy: `single-pr`
- Forecast: 20–80 authored changed lines, primarily lockfile resolution

## Objective

Upgrade the production MCP dependency chain to compatible patched releases while preserving the existing stdio protocol behavior and package output.

## Security baseline

Fresh `npm audit --omit=dev --json` reports these issue-#28 entries:

- `@modelcontextprotocol/sdk` 1.30.0 — direct high severity; patched from 1.31.0.
- `fast-uri` 3.1.6 — transitive high; patched at 3.1.8.
- `hono` 4.13.5 — transitive moderate; patched at 4.13.7.
- `ip-address` 10.7.0 — transitive moderate; patched at 10.7.1.
- `proxy-addr` 2.0.7 — transitive critical; patched at 2.0.8.

The application uses `StdioServerTransport`; HTTP/OAuth features are not enabled by observed entrypoints, but all five packages are installed through a production dependency.

## Scope

- Raise the direct SDK minimum from `^1.12.1` to a patched compatible 1.x range starting at 1.31.0.
- Refresh only the MCP/network transitive lockfile chain to patched versions allowed by existing ranges.
- Avoid overrides unless ordinary resolution cannot remove the targeted findings.
- Preserve MCP exports, Zod compatibility, Node >=22 support, stdio handshake, schemas, and package contents.

## Non-goals

- Solid/OpenTUI/Seroval remediation tracked by issue #29.
- Vitest/tooling remediation tracked by issue #30.
- HTTP transport, OAuth behavior, MCP feature changes, or broad dependency refreshes.
- `npm audit fix --force` or automatic major upgrades.

## Tasks

- [x] `MCPSEC-001` **completed** — Upgrade and verify the MCP runtime dependency chain
  - Route: delegated to `gentle-ai-worker`; manifest and lockfile update with security and compatibility checks.
  - Security RED: current production audit contained all five targeted vulnerable package entries.
  - Acceptance: targeted entries are absent from production audit; remaining findings belong only to issue #29; SDK/MCP stdio integration checks, typecheck, full tests, build, and package verification pass.
  - Commit: `c210029`.
  - Review: independent patched-runtime verification passed; native RDD approved and acknowledged target `sha256:a6ee572abdd63882808adab0fa0961465a4eaa9071f4e4ccc21d3d7b0fc3cddb`, lineage `review-f39d5937b623c047`.

## Verification plan

```bash
npm audit --omit=dev --json
npm test -- tests/integration/mcp-server.test.ts tests/integration/stdio-smoke.test.ts
npm run typecheck
npm test
npm run build
npm run verify:package
```

## Evidence

- Security RED: production audit reported 10 package entries, including all five issue-#28 targets.
- Targeted resolution locked SDK 1.32.1, fast-uri 3.1.8, Hono 4.13.13, ip-address 10.7.4, and proxy-addr 2.0.8 without overrides or unrelated package-entry changes.
- Security GREEN: all five issue-#28 entries are absent; the five residual production entries belong to approved Solid/OpenTUI issue #29.
- Clean-install verification confirmed installed versions exactly match the candidate lockfile.
- Focused compatibility passed 15/15 MCP server and stdio tests; typecheck and `git diff --check` passed.
- `@modelcontextprotocol/sdk` 1.31.0 is the minimum forward patched SDK release; 1.32.1 is latest stable.
- SDK 1.31.0 and 1.32.1 retain Node >=18, Zod `^3.25 || ^4.0`, and relevant wildcard exports.
- Existing transitive ranges admit fast-uri 3.1.8, Hono 4.13.7, ip-address 10.7.1, and proxy-addr 2.0.8.
- Native RDD approved and its exact acknowledgement burned the authority.
- Final verification passed: exact installed-version checks, expected production audit boundary, 15 focused MCP/stdio tests, 273 tests across 20 files, typecheck, build, package verification across 179 files, and `git diff --check`.
- Production audit remains nonzero with five issue-#29 entries: `@babel/core`, `brace-expansion`, `seroval`, `solid-js`, and `@opentui/solid`.

## Next step

Push `fix/mcp-runtime-vulnerabilities` and open one pull request linked to issue #28. Merge remains separately unauthorized.
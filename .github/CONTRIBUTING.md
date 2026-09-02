# Contributing

Flema Engram is an [OpenCode plugin/sidebar](../README.md) first. The MCP adapter is an optional integration, not the product's primary direction.

## Contribution path

1. Branch from the current `main` using a purpose prefix.
2. Make one focused change and use Conventional Commits.
3. Run the required local checks.
4. Open a pull request that links its issue. Every change to `main` must go through a PR.

| Change | Branch example | Commit example |
| --- | --- | --- |
| Feature | `feat/sidebar-filter` | `feat(sidebar): add project filter` |
| Fix | `fix/stale-state` | `fix(sidebar): preserve stale context` |
| Documentation | `docs/contributing` | `docs: clarify contribution workflow` |
| CI or maintenance | `ci/node-matrix`, `chore/dependencies` | `ci: update Node matrix` |

Other clear Conventional Commit prefixes, such as `refactor/`, `test/`, and `perf/`, are welcome when they accurately describe the work.

## Current `main` protection

All changes to `main` must arrive through pull requests. The effective rules are:

- The required CI status check is `validate`.
- One approving human review is required, and stale approvals are dismissed.
- All conversations must be resolved before merging.
- Git history must remain linear.
- Force pushes and branch deletion are disabled.
- Admin enforcement is intentionally disabled while this is a single-maintainer repository; revisit it when a second maintainer exists.
- CodeRabbit reviews pull requests, but it does not replace required CI or human approval.

Linear issue and pull request tracking is linked through the GitHub integration. The current tracking chain is Linear `ONI-237`, GitHub issue [oniricosistemas/onirico-devops#26](https://github.com/oniricosistemas/onirico-devops/issues/26), and pull request [oniricosistemas/flema-engram#2](https://github.com/oniricosistemas/flema-engram/pull/2).

## Required checks

Run these commands in order before requesting review:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run verify:package
```

The [CI workflow](./workflows/ci.yml) runs on pushes and pull requests. It validates changes but does **not** publish packages.

## Pull request checklist

- [ ] Keep the OpenCode sidebar primary and the MCP adapter optional.
- [ ] Link the relevant issue and use a focused, reviewable scope.
- [ ] Complete all required local checks.
- [ ] Do not include credentials, tokens, or other secrets.
- [ ] Do not force-push shared branches.
- [ ] Do not modify archived SDD artifacts.
- [ ] Do not publish a release or npm package from a contribution.

Releases and npm publication remain manual operations and require explicit action from a maintainer.

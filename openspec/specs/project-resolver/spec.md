# Project Resolver Specification

## Purpose

Select one local Engram project deterministically from an override or working directory.

## Contract

```ts
interface ProjectResolver {
  resolve(cwd: string): Promise<string | undefined>;
}
```

## Requirements

### Requirement: Deterministic Precedence

The resolver MUST apply one documented precedence order: a non-empty explicit configuration override, then a non-empty `ENGRAM_PROJECT` override, then the normalized basename of `cwd`. The same inputs MUST produce the same output.

#### Scenario: Explicit override wins

- GIVEN explicit project `alpha`, environment project `beta`, and cwd `/work/gamma`
- WHEN the project is resolved
- THEN the result is `alpha`

#### Scenario: Resolve from cwd

- GIVEN no override and cwd `/work/MCP Flema Engram`
- WHEN the project is resolved
- THEN the result is `mcp-flema-engram`

### Requirement: Unresolved Result

The resolver MUST return `undefined` when no non-empty override or usable cwd basename exists. It MUST return only `string | undefined`, without provenance or confidence metadata.

#### Scenario: No usable candidate

- GIVEN overrides are blank and cwd has no usable basename
- WHEN the project is resolved
- THEN the result is `undefined`

## Deferred

- Parent-directory walking, fuzzy or case-insensitive Engram matching, fallback candidate lists, and manual selection are deferred.
- Resolver caching, provenance, confidence scores, and cache invalidation guarantees are deferred.

# Project Resolver Specification

## Purpose

Map the OpenCode current working directory to an Engram project name so the sidebar can query the right project state.

## Types

```ts
interface ProjectResolver {
  resolve(cwd: string): Promise<string | undefined>;
}

interface ProjectResolverConfig {
  engramAdapter: EngramAdapter;
  fallbackNames?: string[];     // candidate project names to try
  maxCandidates?: number;       // default: 5
}

interface ResolvedProject {
  name: string;
  source: "cwd" | "config" | "engram-match" | "manual";
  confidence: "high" | "medium" | "low";
}
```

## Requirements

### Requirement: CWD-to-Project Mapping

The resolver SHALL derive candidate project names from the current working directory path.

#### Scenario: Directory matches project name

- GIVEN `cwd` is `/home/user/projects/mcp-flema-engram`
- WHEN `resolve(cwd)` is called
- THEN it returns `mcp-flema-engram` with `source: "cwd"` and `confidence: "high"`

#### Scenario: Nested workspace

- GIVEN `cwd` is `/home/user/projects/mcp-flema-engram/src/plugin`
- WHEN `resolve(cwd)` is called
- THEN it walks up to `/home/user/projects/mcp-flema-engram` and returns `mcp-flema-engram`

#### Scenario: No recognizable project

- GIVEN `cwd` is `/tmp`
- WHEN `resolve(cwd)` is called
- THEN it returns `undefined`

### Requirement: Engram Matching

The resolver SHALL validate candidate names against projects known to Engram and fall back to the closest match.

#### Scenario: Exact Engram match

- GIVEN the directory-derived name exists in Engram
- WHEN `resolve(cwd)` is called
- THEN it returns that name with `source: "engram-match"` and `confidence: "high"`

#### Scenario: Case-insensitive match

- GIVEN the directory is `MCP-Flema-Engram` and Engram has `mcp-flema-engram`
- WHEN `resolve(cwd)` is called
- THEN it returns `mcp-flema-engram` with `confidence: "medium"`

#### Scenario: No Engram match

- GIVEN the directory-derived name does not exist in Engram and no fallback matches
- WHEN `resolve(cwd)` is called
- THEN it returns `undefined`

### Requirement: Configuration Override

The resolver SHALL allow an explicit project name in config or environment to override directory heuristics.

#### Scenario: Config override

- GIVEN `fallbackNames: ["explicit-project"]` and the directory is `unrelated`
- WHEN `resolve(cwd)` is called
- THEN it returns `explicit-project` with `source: "config"`

#### Scenario: Environment variable

- GIVEN `ENGRAM_PROJECT=foo` is set in the environment
- WHEN `resolve(cwd)` is called
- THEN it returns `foo` with `source: "config"` and `confidence: "high"`

### Requirement: Caching

The resolver MAY cache the last resolved project for the same `cwd` to avoid repeated Engram calls within a session.

#### Scenario: Same cwd repeated

- GIVEN `resolve(cwd)` was already called for `/home/user/projects/x`
- WHEN it is called again
- THEN it returns the cached result without querying Engram

#### Scenario: Cache invalidation on cwd change

- GIVEN the cache contains a result for `/home/user/projects/x`
- WHEN `resolve("/home/user/projects/y")` is called
- THEN it recomputes the result for the new cwd

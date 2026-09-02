# Engram HTTP Client Specification

## Purpose

Provide a typed, resilient HTTP client for the local Engram service (`127.0.0.1:7437`) used by both the OpenCode sidebar plugin and the MCP server.

## Types

```ts
interface EngramHttpClientConfig {
  baseUrl: string;           // default: "http://127.0.0.1:7437"
  timeoutMs: number;         // default: 5000
  retries: number;           // default: 2
  retryDelayMs: number;      // default: 250
}

interface EngramObservation {
  id: number;
  type: string;
  title: string;
  topic_key: string;
  content: string;
  project: string;
  scope: "project" | "personal";
  updated_at: string;
  created_at: string;
}

interface EngramSession {
  id: string;
  project: string;
  directory?: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}

interface EngramHealth {
  status: string;
  version?: string;
}

class EngramApiError extends Error {
  status?: number;
  code: "timeout" | "connection" | "parse" | "http" | "unknown";
}
```

## Requirements

### Requirement: Configuration Defaults

The client SHALL accept a config object and apply safe defaults for any missing field.

#### Scenario: Default config when Engram is local

- GIVEN no config is provided
- WHEN the client is instantiated
- THEN `baseUrl` is `http://127.0.0.1:7437`, `timeoutMs` is `5000`, `retries` is `2`, and `retryDelayMs` is `250`

#### Scenario: Override defaults

- GIVEN a config with `baseUrl: "http://custom:7437"` and `timeoutMs: 1000`
- WHEN the client is instantiated
- THEN the supplied values override defaults and remaining fields use defaults

### Requirement: Endpoint Coverage

The client SHALL expose typed methods for every empirically verified Engram endpoint.

#### Scenario: Health check

- GIVEN Engram is running
- WHEN `health()` is called
- THEN it returns an `EngramHealth` object

#### Scenario: Recent observations by project

- GIVEN a project name and limit
- WHEN `getRecentObservations({ project, limit })` is called
- THEN it calls `GET /observations/recent?project={project}&limit={limit}` and returns `EngramObservation[]`

#### Scenario: Single observation

- GIVEN an observation id
- WHEN `getObservation(id)` is called
- THEN it calls `GET /observations/{id}` and returns `EngramObservation`

#### Scenario: Full-text search

- GIVEN a query string
- WHEN `searchObservations(q)` is called
- THEN it calls `GET /observations?q={q}` (and falls back to `GET /search?q={q}` if the first returns 404) and returns `EngramObservation[]`

#### Scenario: Recent sessions by project

- GIVEN a project name
- WHEN `getRecentSessions({ project })` is called
- THEN it calls `GET /sessions/recent?project={project}` and returns `EngramSession[]`

### Requirement: Timeout and Retry

The client SHALL retry idempotent GET requests on transient failures up to the configured retry count, with a delay between attempts, and fail with a timeout error when the total time exceeds `timeoutMs`.

#### Scenario: Retry on transient failure

- GIVEN `retries: 2` and the first two requests return `ECONNREFUSED`
- WHEN `health()` is called
- THEN the client makes three attempts total and returns the successful response

#### Scenario: Timeout on persistent unavailability

- GIVEN `retries: 1` and `timeoutMs: 50`
- WHEN `health()` is called against a blackhole address
- THEN it throws `EngramApiError` with `code: "timeout"`

### Requirement: Error Handling

The client SHALL classify errors into `timeout`, `connection`, `parse`, `http`, or `unknown` and never throw raw transport exceptions.

#### Scenario: Non-2xx response

- GIVEN Engram returns HTTP 500
- WHEN `getObservation(1)` is called
- THEN it throws `EngramApiError` with `code: "http"` and `status: 500`

#### Scenario: Invalid JSON body

- GIVEN Engram returns a 200 response with malformed JSON
- WHEN `health()` is called
- THEN it throws `EngramApiError` with `code: "parse"`

#### Scenario: Connection refused

- GIVEN no service is listening on the configured port
- WHEN `health()` is called
- THEN it throws `EngramApiError` with `code: "connection"`

### Requirement: Query Encoding

The client SHALL URL-encode query parameters and reject empty search queries before sending.

#### Scenario: Encode special characters

- GIVEN a search query `"foo bar"`
- WHEN `searchObservations("foo bar")` is called
- THEN the request URL contains `?q=foo%20bar`

#### Scenario: Reject empty query

- GIVEN an empty search query
- WHEN `searchObservations("")` is called
- THEN it throws a validation error without making a network request

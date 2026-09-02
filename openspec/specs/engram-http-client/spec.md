# Engram HTTP Client Specification

## Purpose

Provide bounded, validated, read-only access to local Engram at `127.0.0.1:7437`.

## Requirements

### Requirement: Local Configuration and Bounds

The client MUST default to `http://127.0.0.1:7437` and a 5000 ms timeout, MUST accept valid overrides, and MUST reject invalid URLs or non-positive timeouts before sending a request.

#### Scenario: Override local defaults

- GIVEN a valid custom base URL and 1000 ms timeout
- WHEN the client is created
- THEN those values replace the local defaults

#### Scenario: Request exceeds its bound

- GIVEN local Engram does not respond before `timeoutMs`
- WHEN a read method is called
- THEN the request is aborted and a safe timeout error is returned

### Requirement: Supported Read Endpoints

The client MUST support health, recent observations, observation lookup, observation search, recent sessions, and session lookup. Project discovery MUST be derived from observations and sessions available through supported endpoints and MUST NOT depend on `GET /projects`.

#### Scenario: Derive projects

- GIVEN observations and sessions contain projects `alpha` and `beta`
- WHEN projects are requested
- THEN both distinct projects are derived with available counts and activity timestamps

### Requirement: Validation and Errors

Every successful response MUST be schema-validated. Non-2xx, malformed JSON, timeout, and connection failures MUST be converted to safe categorized errors without leaking raw transport exceptions.

#### Scenario: Invalid response body

- GIVEN local Engram returns malformed or schema-invalid JSON
- WHEN the response is processed
- THEN the client returns a categorized validation or parse error

### Requirement: Query Safety

The client MUST URL-encode query parameters and MUST reject an empty search query without a network request.

#### Scenario: Encode search text

- GIVEN the query `foo bar`
- WHEN observations are searched
- THEN the outbound query contains the encoded value `foo%20bar`

## Deferred

- Retries, backoff, circuit breaking, and advanced caching are deferred.
- Cloud endpoints, authentication, writes, and cloud availability guarantees are deferred.

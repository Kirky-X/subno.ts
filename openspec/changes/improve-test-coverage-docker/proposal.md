# Change: Improve Test Coverage to 95% with Docker

## Why
Current test coverage is at 54.62% due to three critical gaps:
- SSE stream tests require real Redis Pub/Sub connections
- Cleanup service tests need full DB/Redis environment
- Template API tests are incomplete

Without addressing these gaps, the project cannot achieve the 95% coverage target, impacting:
- Code quality confidence
- Release reliability
- Security audit compliance

## What Changes

### Phase 1: Docker Test Infrastructure
- Add `testcontainers` configuration for integration tests
- Create `docker-compose.test.yml` for CI/CD pipeline
- Add `__tests__/containers/` directory with test container utilities

### Phase 2: SSE Stream Tests (16.66% → 80%)
- Create SSE integration tests with real Redis Pub/Sub
- Add stream event validation tests
- Add lastEventId miss message recovery tests

### Phase 3: Cleanup Service Tests (0.99% → 95%)
- Add DB-based cleanup integration tests
- Add Redis key cleanup tests
- Add orphaned channel detection tests

### Phase 4: Template API Tests (16.66% → 95%)
- Add template CRUD integration tests
- Add template rendering tests
- Add template validation tests

## Impact

### Affected Specs
- `testing` (new capability)

### Affected Code
- `__tests__/integration/`
- `__tests__/containers/` (new)
- `docker-compose.test.yml` (new)
- `vitest.config.ts`

### Breaking Changes
None. All changes are additive for testing infrastructure.

## Test Coverage Targets

| Component | Current | Target | Gap |
|-----------|---------|--------|-----|
| app/api/subscribe | 16.66% | 95% | +78.34% |
| cleanup.service.ts | 0.99% | 95% | +94.01% |
| app/api/templates | 16.66% | 95% | +78.34% |
| **Overall** | **54.62%** | **95%** | **+40.38%** |

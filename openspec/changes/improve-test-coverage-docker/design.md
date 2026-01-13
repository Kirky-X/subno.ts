## Context
This change adds Docker-based test infrastructure to achieve 95% test coverage. The current coverage is 54.62%, with major gaps in SSE streams, cleanup services, and template APIs that require real database and Redis connections.

### Constraints
- Tests must run in CI/CD environment without persistent Docker hosts
- Test containers must start within reasonable time (<30s)
- Container cleanup must be guaranteed to prevent resource leaks
- No breaking changes to existing test structure

### Stakeholders
- Developers needing reliable integration tests
- QA team requiring coverage reports
- DevOps team maintaining CI/CD pipelines

## Goals / Non-Goals

### Goals
- Achieve 95% code coverage
- Reliable integration tests with real services
- Automated coverage enforcement in CI/CD
- No manual Docker management required

### Non-Goals
- E2E browser testing (use Playwright separately)
- Performance benchmark testing
- Load/stress testing

## Decisions

### Decision: Use @testcontainers/node for test containers
**Choice**: @testcontainers/node over custom Docker spawn
**Reason**: 
- Provides reliable container lifecycle management
- Built-in retry and health checks
- Automatic cleanup via finally blocks
- Widely adopted in JavaScript ecosystem

### Decision: Create separate docker-compose.test.yml
**Choice**: Separate compose file over modifying existing
**Reason**:
- Clear separation of production vs test configurations
- Test compose can include additional services (mailhog, etc.)
- Easier to modify without affecting deployment

### Decision: Global vitest setup for containers
**Choice**: Create __tests__/setup-containers.ts
**Reason**:
- Single point for container initialization
- Runs before any test files
- Shared across all test suites
- Easier to debug container issues

### Alternatives Considered
1. **Docker-in-Docker (DinD)**: Requires privileged containers, more complex setup
2. **External Docker host**: Adds infrastructure complexity, cost
3. **Mock services**: Doesn't provide true integration testing

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Container startup time increases test duration | Medium | Use image caching, optimize container size |
| Flaky tests due to container timing | High | Add health checks, retry logic |
| CI resource usage increase | Low | Run in parallel, limit concurrency |
| Image compatibility across platforms | Medium | Use multi-architecture images |

## Migration Plan

### Step 1: Install Dependencies
```bash
npm install -D @testcontainers/node
```

### Step 2: Create Test Container Utilities
- Create `__tests__/containers/test-containers.ts`
- Create `__tests__/setup-containers.ts`

### Step 3: Update Vitest Configuration
- Add setup file to `vitest.config.ts`
- Configure environment variables

### Step 4: Create GitHub Actions Workflow
- Add `test-coverage.yml` workflow
- Configure Docker service containers
- Add coverage badge

### Rollback
1. Remove `@testcontainers/node` dependency
2. Delete `__tests__/containers/` directory
3. Update `vitest.config.ts` to remove setup file
4. Remove workflow file from `.github/workflows/`

## Open Questions
1. Should we use `redis` vs `@redis/client` for test container connections?
2. Should we run tests in parallel across multiple containers?
3. Should we cache Docker images in CI for faster builds?

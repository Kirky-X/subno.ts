## 1. Docker Test Infrastructure Setup
- [ ] 1.1 Install @testcontainers/node as dev dependency
- [ ] 1.2 Create docker-compose.test.yml for test environments
- [ ] 1.3 Create __tests__/containers/test-containers.ts utility
- [ ] 1.4 Update vitest.config.ts to support testcontainers
- [ ] 1.5 Create __tests__/setup-containers.ts global setup

## 2. SSE Stream Integration Tests
- [ ] 2.1 Create __tests__/integration/sse-stream.test.ts
- [ ] 2.2 Add Redis Pub/Sub connection tests
- [ ] 2.3 Add SSE event stream parsing tests
- [ ] 2.4 Add lastEventId message recovery tests
- [ ] 2.5 Add channel subscription timeout tests
- [ ] 2.6 Add SSE heartbeat/keepalive tests

## 3. Cleanup Service Integration Tests
- [ ] 3.1 Create __tests__/integration/cleanup.service.test.ts
- [ ] 3.2 Add expired keys cleanup tests
- [ ] 3.3 Add orphaned Redis keys detection tests
- [ ] 3.4 Add old audit logs cleanup tests
- [ ] 3.5 Add temp channel expiration tests
- [ ] 3.6 Add message queue cleanup tests

## 4. Template API Integration Tests
- [ ] 4.1 Create __tests__/integration/templates.test.ts
- [ ] 4.2 Add template CRUD operation tests
- [ ] 4.3 Add template rendering tests
- [ ] 4.4 Add template validation tests
- [ ] 4.5 Add template security tests (XSS prevention)

## 5. CI/CD Pipeline Integration
- [ ] 5.1 Create .github/workflows/test-coverage.yml
- [ ] 5.2 Add Docker service containers to GitHub Actions
- [ ] 5.3 Add coverage badge to README.md
- [ ] 5.4 Add coverage gate to PR checks (fail if <95%)

## 6. Documentation
- [ ] 6.1 Update TESTING.md with Docker instructions
- [ ] 6.2 Document test container lifecycle
- [ ] 6.3 Add troubleshooting section for flaky tests

# Fix Critical Security and Performance Issues

## Status
**Proposed** | [ ] Approved | [ ] In Progress | [ ] Completed

## Summary
This change addresses critical security vulnerabilities and performance issues identified in comprehensive code review. Focus areas include memory leak prevention in SSE subscriptions, delayed message queue management, attachment deletion race conditions, and N+1 query optimization.

## Motivation

### Critical Issues Requiring Immediate Attention

1. **Memory Leak in SSE Subscriptions** (Critical)
   - SSE connections may not be properly cleaned up when clients disconnect
   - Accumulates event listeners and timers over time
   - Can lead to server memory exhaustion under high load

2. **Unbounded Growth in Delayed Message Queue** (Critical)
   - Delayed messages accumulate in Redis sorted set without automatic cleanup
   - Redis memory usage grows indefinitely
   - No monitoring or alerting for queue size

3. **Race Condition in Attachment Deletion** (High)
   - Concurrent deletion requests can cause orphaned files
   - Database record may be deleted while file upload is in progress
   - No transactional guarantee between file system and database

4. **N+1 Query Performance Issue** (High)
   - Channel queries trigger separate queries for each channel's metadata
   - Performance degrades linearly with channel count
   - Impacts API response time significantly

### Impact

- **Security**: Memory exhaustion can lead to denial of service
- **Performance**: Degraded response times and increased resource usage
- **Reliability**: Orphaned files and inconsistent state
- **Scalability**: System cannot handle high concurrent loads

## Proposed Changes

### 1. SSE Subscription Lifecycle Management

**Problem**: SSE connections accumulate resources without proper cleanup.

**Solution**:
- Implement connection tracking with heartbeat monitoring
- Add automatic cleanup of stale connections
- Implement graceful shutdown handling
- Add connection limits per IP and globally

**Files to Modify**:
- `src/app/api/subscribe/route.ts`
- `src/lib/services/message-extended.service.ts`
- `src/lib/utils/sse-manager.ts` (new)

### 2. Delayed Message Queue Management

**Problem**: Delayed messages accumulate without cleanup.

**Solution**:
- Implement automatic cleanup of expired messages
- Add queue size monitoring and alerting
- Implement queue size limits with backpressure
- Add metrics for queue health

**Files to Modify**:
- `src/lib/services/delayed-message.service.ts`
- `src/app/api/cron/cleanup-delayed-messages/route.ts` (new)
- `src/lib/utils/metrics.ts` (new)

### 3. Attachment Deletion Transaction Safety

**Problem**: Race conditions between file system and database operations.

**Solution**:
- Implement transactional file deletion pattern
- Add file existence validation before deletion
- Implement retry logic for failed deletions
- Add orphaned file cleanup job

**Files to Modify**:
- `src/lib/services/attachment.service.ts`
- `src/app/api/attachments/[id]/route.ts`

### 4. Database Query Optimization

**Problem**: N+1 queries degrade performance.

**Solution**:
- Implement batch query loading with joins
- Add query result caching
- Optimize database indexes
- Add query performance monitoring

**Files to Modify**:
- `src/lib/services/channel.service.ts`
- `src/lib/repositories/redis.repository.ts`
- `src/db/schema.ts`

## Implementation Plan

### Phase 1: SSE Subscription Management (Priority: Critical)
1. Create SSE connection manager with lifecycle tracking
2. Implement heartbeat mechanism and stale connection detection
3. Add connection limits and rate limiting for SSE
4. Implement graceful shutdown handling
5. Add monitoring and metrics

### Phase 2: Delayed Message Queue Management (Priority: Critical)
1. Implement automatic cleanup of expired messages
2. Add queue size monitoring and alerting
3. Implement queue size limits with backpressure
4. Create cron job for periodic cleanup
5. Add metrics and health checks

### Phase 3: Attachment Deletion Safety (Priority: High)
1. Implement transactional file deletion pattern
2. Add file existence validation
3. Implement retry logic
4. Create orphaned file cleanup job
5. Add audit logging for deletions

### Phase 4: Query Optimization (Priority: High)
1. Analyze N+1 query patterns
2. Implement batch loading with joins
3. Add query result caching
4. Optimize database indexes
5. Add query performance monitoring

## Testing Strategy

### Unit Tests
- SSE connection lifecycle management
- Delayed message queue cleanup logic
- Attachment deletion transaction safety
- Query optimization correctness

### Integration Tests
- SSE connection under load
- Delayed message queue with cleanup
- Concurrent attachment deletions
- Performance benchmarks for optimized queries

### Load Tests
- SSE connection scaling
- Delayed message queue under high load
- Concurrent attachment operations
- Query performance under load

### Security Tests
- SSE connection limits enforcement
- Delayed message queue DoS protection
- Attachment deletion authorization
- Query injection prevention

## Migration Path

No breaking changes. All changes are backward compatible.

### Rollout Strategy
1. Deploy to staging environment
2. Monitor metrics and performance
3. Gradual rollout to production with feature flags
4. Monitor for issues and rollback if needed

## Rollback Plan

If issues arise:
1. Disable new features via feature flags
2. Revert to previous cleanup logic
3. Restore original query patterns
4. Clear any accumulated state

## Success Criteria

- ✅ SSE memory usage remains stable under load
- ✅ Delayed message queue size stays within limits
- ✅ No orphaned files after concurrent deletions
- ✅ Query performance improved by >50%
- ✅ All existing tests pass
- ✅ New tests added and passing
- ✅ Code coverage maintained >80%
- ✅ No performance regression
- ✅ Memory usage stable over time

## Related Issues

- Addresses Critical issues #1, #2, #3 from code review
- Addresses High issues #4, #5 from code review
- Related to OpenSpec change: `improve-test-coverage-docker`

## Dependencies

- None (uses existing dependencies)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSE cleanup breaks existing connections | High | Feature flag, gradual rollout |
| Queue cleanup removes valid messages | Medium | Thorough testing, monitoring |
| Attachment deletion causes data loss | High | Transaction safety, audit logging |
| Query optimization breaks existing logic | Medium | Comprehensive testing, rollback plan |
| Performance regression | Medium | Load testing, performance monitoring |

## Timeline

- Phase 1: 4 hours
- Phase 2: 3 hours
- Phase 3: 3 hours
- Phase 4: 4 hours
- Testing: 4 hours
- Deployment: 2 hours
- **Total**: ~20 hours

## Reviewers

- @KirkyX (Tech Lead)
- [ ] TBD (Security Lead)
- [ ] TBD (Performance Lead)

## Checklist

- [ ] Implementation completed
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Load tests completed
- [ ] Security tests passed
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Monitored for issues
- [ ] Deployed to production
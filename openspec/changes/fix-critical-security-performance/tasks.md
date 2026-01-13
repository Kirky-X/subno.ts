# Tasks

## Phase 1: SSE Subscription Lifecycle Management

### 1.1 Create SSE Connection Manager
- [ ] Create `src/lib/utils/sse-manager.ts`
- [ ] Implement connection tracking with unique IDs
- [ ] Add connection metadata (IP, channel, timestamp)
- [ ] Implement connection registry with Map
- [ ] Add unit tests for connection tracking

### 1.2 Implement Heartbeat Mechanism
- [ ] Add heartbeat interval to SSE connections
- [ ] Implement heartbeat message sending
- [ ] Detect stale connections (no heartbeat in 30s)
- [ ] Implement automatic cleanup of stale connections
- [ ] Add unit tests for heartbeat logic

### 1.3 Add Connection Limits
- [ ] Implement per-IP connection limit (max 5)
- [ ] Implement global connection limit (max 1000)
- [ ] Add connection limit enforcement
- [ ] Return 429 when limits exceeded
- [ ] Add unit tests for connection limits

### 1.4 Implement Graceful Shutdown
- [ ] Add shutdown signal handling (SIGTERM, SIGINT)
- [ ] Implement graceful connection closure
- [ ] Send close event to all clients
- [ ] Wait for connections to close (5s timeout)
- [ ] Add integration test for graceful shutdown

### 1.5 Add Monitoring and Metrics
- [ ] Track active connection count
- [ ] Track connection rate (new/second)
- [ ] Track stale connection count
- [ ] Expose metrics via health endpoint
- [ ] Add tests for metrics collection

## Phase 2: Delayed Message Queue Management

### 2.1 Implement Automatic Cleanup
- [ ] Update `delayed-message.service.ts` cleanup method
- [ ] Add batch cleanup (1000 messages at a time)
- [ ] Implement cleanup scheduling (every 5 minutes)
- [ ] Add cleanup metrics tracking
- [ ] Add unit tests for cleanup logic

### 2.2 Add Queue Size Monitoring
- [ ] Implement queue size tracking
- [ ] Add queue size metrics (current, max, average)
- [ ] Implement size alerting (>10000 messages)
- [ ] Add queue health status to health endpoint
- [ ] Add tests for monitoring logic

### 2.3 Implement Queue Size Limits
- [ ] Add max queue size configuration (10000)
- [ ] Implement queue size checking before adding
- [ ] Return error when queue is full
- [ ] Implement backpressure (reject new messages)
- [ ] Add unit tests for size limits

### 2.4 Create Cleanup Cron Job
- [ ] Create `src/app/api/cron/cleanup-delayed-messages/route.ts`
- [ ] Add CRON_SECRET authentication
- [ ] Implement periodic cleanup trigger
- [ ] Add cleanup result reporting
- [ ] Add integration test for cron job

### 2.5 Add Queue Health Metrics
- [ ] Track cleanup success/failure rate
- [ ] Track messages cleaned per run
- [ ] Track queue growth rate
- [ ] Expose metrics in health endpoint
- [ ] Add tests for metrics

## Phase 3: Attachment Deletion Safety

### 3.1 Implement Transactional Deletion
- [ ] Update `attachment.service.ts` delete method
- [ ] Add file existence check before deletion
- [ ] Implement database deletion first
- [ ] Delete file only after database success
- [ ] Add rollback if file deletion fails

### 3.2 Add File Validation
- [ ] Validate file path before deletion
- [ ] Check file is within allowed directory
- [ ] Verify file ownership
- [ ] Add logging for validation failures
- [ ] Add unit tests for validation

### 3.3 Implement Retry Logic
- [ ] Add retry mechanism for file deletion (3 attempts)
- [ ] Add exponential backoff (1s, 2s, 4s)
- [ ] Log retry attempts
- [ ] Mark deletion as failed after retries
- [ ] Add tests for retry logic

### 3.4 Create Orphaned File Cleanup
- [ ] Scan upload directory for orphaned files
- [ ] Compare with database records
- [ ] Delete files without database records
- [ ] Run cleanup periodically (daily)
- [ ] Add tests for cleanup logic

### 3.5 Add Audit Logging
- [ ] Log all deletion attempts
- [ ] Include user, timestamp, result
- [ ] Log orphaned file detections
- [ ] Add audit trail for compliance
- [ ] Add tests for audit logging

## Phase 4: Database Query Optimization

### 4.1 Analyze Query Patterns
- [ ] Identify N+1 query locations
- [ ] Analyze query execution plans
- [ ] Measure current query performance
- [ ] Document query bottlenecks
- [ ] Create performance baseline

### 4.2 Implement Batch Loading
- [ ] Update `channel.service.ts` to use joins
- [ ] Implement batch channel loading
- [ ] Use Drizzle's `with` clause for relations
- [ ] Reduce query count by >80%
- [ ] Add unit tests for batch loading

### 4.3 Add Query Result Caching
- [ ] Identify cacheable queries
- [ ] Implement Redis caching for channel metadata
- [ ] Add cache invalidation logic
- [ ] Set appropriate TTL (5 minutes)
- [ ] Add tests for caching logic

### 4.4 Optimize Database Indexes
- [ ] Analyze query patterns
- [ ] Add composite indexes where needed
- [ ] Review existing index usage
- [ ] Remove unused indexes
- [ ] Add tests for index usage

### 4.5 Add Query Performance Monitoring
- [ ] Track query execution time
- [ ] Track slow queries (>100ms)
- [ ] Add query count metrics
- [ ] Expose metrics in health endpoint
- [ ] Add alerting for degraded performance

## Testing

### Unit Tests
- [ ] SSE manager unit tests (10 tests)
- [ ] Delayed message cleanup tests (8 tests)
- [ ] Attachment deletion tests (12 tests)
- [ ] Query optimization tests (6 tests)

### Integration Tests
- [ ] SSE lifecycle integration tests (5 tests)
- [ ] Queue cleanup integration tests (4 tests)
- [ ] Concurrent deletion tests (3 tests)
- [ ] Performance benchmark tests (4 tests)

### Load Tests
- [ ] SSE connection scaling test
- [ ] Queue load test (10000 messages)
- [ ] Concurrent attachment operations (100 concurrent)
- [ ] Query performance under load (1000 channels)

### Security Tests
- [ ] SSE connection limit enforcement
- [ ] Queue DoS protection
- [ ] Attachment deletion authorization
- [ ] Query injection prevention

## Validation

### Code Quality
- [ ] ESLint passes
- [ ] TypeScript compilation succeeds
- [ ] No console errors/warnings
- [ ] Code follows project conventions

### Performance
- [ ] SSE memory usage stable (<100MB)
- [ ] Queue size stays within limits
- [ ] Query performance improved >50%
- [ ] No performance regression

### Testing
- [ ] All tests pass (target: 100%)
- [ ] Test coverage >80%
- [ ] Load tests pass
- [ ] Security tests pass

### Documentation
- [ ] API documentation updated
- [ ] Architecture docs updated
- [ ] Runbook for monitoring
- [ ] Troubleshooting guide

## Deployment

### Staging
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Monitor metrics for 24 hours
- [ ] Verify no issues

### Production
- [ ] Create deployment plan
- [ ] Schedule maintenance window
- [ ] Deploy with feature flags
- [ ] Monitor for issues
- [ ] Rollback plan ready

### Post-Deployment
- [ ] Monitor metrics for 48 hours
- [ ] Check error rates
- [ ] Verify performance improvements
- [ ] Gather user feedback
- [ ] Document lessons learned
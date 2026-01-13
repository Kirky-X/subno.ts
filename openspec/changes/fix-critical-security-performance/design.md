# Design Document: Fix Critical Security and Performance Issues

## Overview

This document describes the architectural design for addressing critical security and performance issues in the subno.ts project. The solution focuses on four main areas: SSE subscription lifecycle management, delayed message queue management, attachment deletion safety, and database query optimization.

## Architecture Decisions

### 1. SSE Subscription Lifecycle Management

#### Current State
- SSE connections established in `subscribe/route.ts`
- No connection tracking or cleanup mechanism
- Connections accumulate resources indefinitely
- No limits on concurrent connections

#### Proposed Design

```
┌─────────────────────────────────────────────────────────────┐
│                     SSE Manager                              │
├─────────────────────────────────────────────────────────────┤
│  Connection Registry (Map<connectionId, Connection>)        │
│  - Tracks all active connections                             │
│  - Stores metadata (IP, channel, timestamp, lastHeartbeat)  │
├─────────────────────────────────────────────────────────────┤
│  Heartbeat Monitor                                           │
│  - Sends heartbeat every 15 seconds                          │
│  - Detects stale connections (>30s no heartbeat)             │
│  - Automatically cleans up stale connections                 │
├─────────────────────────────────────────────────────────────┤
│  Connection Limiter                                           │
│  - Per-IP limit: 5 connections                               │
│  - Global limit: 1000 connections                            │
│  - Returns 429 when limits exceeded                          │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components

**SSEManager Class** (`src/lib/utils/sse-manager.ts`)
```typescript
class SSEManager {
  private connections: Map<string, SSEConnection>;
  private heartbeatInterval: number;
  
  // Connection lifecycle
  registerConnection(id: string, connection: SSEConnection): void;
  unregisterConnection(id: string): void;
  
  // Heartbeat management
  startHeartbeat(): void;
  stopHeartbeat(): void;
  checkStaleConnections(): void;
  
  // Limits
  checkConnectionLimit(ip: string): boolean;
  
  // Metrics
  getMetrics(): SSEMetrics;
}
```

**Connection Lifecycle**
1. Client connects → Manager registers connection
2. Heartbeat sent every 15s → Update lastHeartbeat timestamp
3. Stale detection every 30s → Remove connections with no heartbeat
4. Client disconnects → Manager unregisters connection
5. Server shutdown → Gracefully close all connections

#### Trade-offs
- **Memory vs Reliability**: Tracking connections uses memory but prevents leaks
- **Complexity vs Safety**: Heartbeat adds complexity but ensures cleanup
- **Limits vs Flexibility**: Connection limits prevent DoS but may restrict legitimate use

### 2. Delayed Message Queue Management

#### Current State
- Messages stored in Redis sorted set with score = delivery timestamp
- No automatic cleanup of expired messages
- Queue grows indefinitely
- No monitoring or alerting

#### Proposed Design

```
┌─────────────────────────────────────────────────────────────┐
│              Delayed Message Queue Manager                   │
├─────────────────────────────────────────────────────────────┤
│  Queue Monitor                                               │
│  - Tracks queue size (current, max, average)                │
│  - Monitors growth rate                                      │
│  - Alerts when size > 10000                                │
├─────────────────────────────────────────────────────────────┤
│  Automatic Cleanup                                           │
│  - Runs every 5 minutes                                      │
│  - Removes expired messages (score < now)                   │
│  - Processes in batches of 1000                             │
│  - Tracks cleanup metrics                                   │
├─────────────────────────────────────────────────────────────┤
│  Size Enforcement                                            │
│  - Max queue size: 10000 messages                           │
│  - Rejects new messages when full                            │
│  - Implements backpressure                                   │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components

**Enhanced DelayedMessageService**
```typescript
class DelayedMessageService {
  // Queue management
  async addDelayedMessage(message: DelayedMessage): Promise<void>;
  async cleanupExpiredMessages(): Promise<number>;
  
  // Monitoring
  getQueueSize(): Promise<number>;
  getQueueMetrics(): Promise<QueueMetrics>;
  
  // Size enforcement
  isQueueFull(): Promise<boolean>;
}
```

**Cleanup Strategy**
1. **Passive Cleanup**: Remove expired messages when delivering
2. **Active Cleanup**: Cron job runs every 5 minutes
3. **Batch Processing**: Process 1000 messages at a time
4. **Size Limit**: Reject new messages when queue > 10000

#### Trade-offs
- **Latency vs Throughput**: Batch cleanup improves throughput but adds latency
- **Memory vs Reliability**: Size limit prevents memory exhaustion but may drop messages
- **Frequency vs Load**: More frequent cleanup uses more CPU but keeps queue smaller

### 3. Attachment Deletion Safety

#### Current State
- File deletion and database deletion are separate operations
- No transactional guarantee
- Race conditions possible with concurrent deletions
- Orphaned files can accumulate

#### Proposed Design

```
┌─────────────────────────────────────────────────────────────┐
│              Transactional Attachment Deletion              │
├─────────────────────────────────────────────────────────────┤
│  Validation Phase                                            │
│  - Check file existence                                      │
│  - Validate file path (within allowed directory)            │
│  - Verify file ownership                                     │
├─────────────────────────────────────────────────────────────┤
│  Deletion Phase (Transaction)                                │
│  1. Delete database record                                   │
│  2. If success, delete file                                 │
│  3. If file deletion fails, mark for retry                  │
├─────────────────────────────────────────────────────────────┤
│  Retry Mechanism                                             │
│  - 3 retry attempts with exponential backoff                 │
│  - Track failed deletions                                    │
│  - Manual cleanup for persistent failures                   │
├─────────────────────────────────────────────────────────────┤
│  Orphaned File Cleanup                                       │
│  - Scan upload directory daily                               │
│  - Compare with database records                             │
│  - Delete files without database records                    │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components

**Safe Deletion Pattern**
```typescript
async deleteAttachment(id: string): Promise<boolean> {
  // Phase 1: Validation
  const attachment = await this.getAttachment(id);
  if (!attachment) return false;
  
  if (!this.validateFilePath(attachment.path)) {
    throw new Error('Invalid file path');
  }
  
  // Phase 2: Transactional deletion
  try {
    // Step 1: Delete from database
    await db.delete(attachments).where(eq(attachments.id, id));
    
    // Step 2: Delete file with retry
    await this.deleteFileWithRetry(attachment.path);
    
    return true;
  } catch (error) {
    // Rollback: Re-insert database record
    await db.insert(attachments).values(attachment);
    throw error;
  }
}
```

**Retry Strategy**
- Attempt 1: Immediate
- Attempt 2: Wait 1 second
- Attempt 3: Wait 2 seconds
- Attempt 4: Wait 4 seconds
- After 4 attempts: Mark as failed for manual cleanup

#### Trade-offs
- **Consistency vs Availability**: Transaction pattern ensures consistency but may reduce availability
- **Complexity vs Safety**: Retry logic adds complexity but prevents orphaned files
- **Storage vs Cleanup**: Orphaned file cleanup uses storage but ensures data consistency

### 4. Database Query Optimization

#### Current State
- N+1 query problem in channel listing
- Each channel triggers separate metadata query
- Performance degrades linearly with channel count
- No query result caching

#### Proposed Design

```
┌─────────────────────────────────────────────────────────────┐
│                 Optimized Query Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Batch Loading                                               │
│  - Use Drizzle's `with` clause for relations                │
│  - Load channels and metadata in single query               │
│  - Reduce query count by >80%                               │
├─────────────────────────────────────────────────────────────┤
│  Result Caching                                              │
│  - Cache channel metadata in Redis                          │
│  - TTL: 5 minutes                                           │
│  - Invalidate on updates                                    │
├─────────────────────────────────────────────────────────────┤
│  Index Optimization                                          │
│  - Add composite indexes for common query patterns          │
│  - Analyze query execution plans                            │
│  - Remove unused indexes                                    │
├─────────────────────────────────────────────────────────────┤
│  Performance Monitoring                                      │
│  - Track query execution time                               │
│  - Alert on slow queries (>100ms)                           │
│  - Expose metrics in health endpoint                        │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components

**Optimized Channel Query**
```typescript
// Before: N+1 queries
const channels = await db.select().from(channels);
for (const channel of channels) {
  channel.metadata = await db.select().from(channelMetadata)
    .where(eq(channelMetadata.channelId, channel.id));
}

// After: Single query with join
const channels = await db.query.channels.findMany({
  with: {
    metadata: true,
  },
});
```

**Caching Strategy**
```typescript
async getChannel(id: string): Promise<Channel> {
  // Try cache first
  const cached = await redis.get(`channel:${id}`);
  if (cached) return JSON.parse(cached);
  
  // Query database
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, id),
    with: { metadata: true },
  });
  
  // Cache result
  await redis.setex(`channel:${id}`, 300, JSON.stringify(channel));
  
  return channel;
}
```

#### Trade-offs
- **Memory vs Performance**: Caching uses memory but improves performance
- **Complexity vs Speed**: Joins add query complexity but reduce round trips
- **Freshness vs Latency**: Cache improves latency but may serve stale data

## Data Flow

### SSE Connection Flow
```
Client Request
    ↓
Rate Limit Check (IP + Global)
    ↓
Create SSE Connection
    ↓
Register in SSEManager
    ↓
Start Heartbeat (15s interval)
    ↓
Send Messages to Client
    ↓
Client Disconnect OR Stale Detection
    ↓
Unregister from SSEManager
    ↓
Cleanup Resources
```

### Delayed Message Flow
```
Add Delayed Message
    ↓
Check Queue Size (< 10000)
    ↓
Add to Redis Sorted Set
    ↓
Queue Monitor Checks Size
    ↓
If Size > Threshold → Alert
    ↓
Cron Job Runs (every 5 min)
    ↓
Remove Expired Messages (batch of 1000)
    ↓
Update Metrics
```

### Attachment Deletion Flow
```
Delete Request
    ↓
Validate File Path
    ↓
Check File Exists
    ↓
Start Transaction
    ↓
Delete Database Record
    ↓
Delete File (with retry)
    ↓
Commit Transaction
    ↓
Log Audit Trail
```

### Optimized Query Flow
```
Request Channel List
    ↓
Check Cache (Redis)
    ↓
If Cache Hit → Return Cached Data
    ↓
If Cache Miss → Query Database
    ↓
Use Joins (single query)
    ↓
Cache Result (5 min TTL)
    ↓
Return Data
```

## Security Considerations

### SSE Security
- **Connection Limits**: Prevent DoS via connection exhaustion
- **IP Tracking**: Identify and block abusive IPs
- **Authentication**: Verify client identity before establishing connection
- **Rate Limiting**: Limit connection rate per IP

### Queue Security
- **Size Limits**: Prevent memory exhaustion
- **Input Validation**: Validate message size before queuing
- **Access Control**: Restrict queue operations to authorized users
- **Audit Logging**: Track all queue operations

### Attachment Security
- **Path Validation**: Prevent directory traversal attacks
- **Ownership Verification**: Ensure user owns the file
- **Audit Logging**: Track all deletion operations
- **Retry Limits**: Prevent infinite retry loops

### Query Security
- **Input Sanitization**: Prevent SQL injection
- **Access Control**: Enforce row-level security
- **Query Limits**: Prevent resource exhaustion
- **Monitoring**: Detect suspicious query patterns

## Performance Considerations

### SSE Performance
- **Memory Usage**: Track connection memory usage
- **Heartbeat Overhead**: Minimize heartbeat message size
- **Connection Pooling**: Reuse connections where possible
- **Metrics Overhead**: Keep metrics collection lightweight

### Queue Performance
- **Batch Size**: Optimize batch size for cleanup (1000 messages)
- **Cleanup Frequency**: Balance between frequency and load (5 minutes)
- **Memory Usage**: Monitor Redis memory usage
- **Throughput**: Measure messages processed per second

### Deletion Performance
- **Retry Overhead**: Limit retry attempts to avoid blocking
- **Batch Cleanup**: Process orphaned files in batches
- **I/O Optimization**: Use async file operations
- **Database Indexes**: Ensure fast lookups

### Query Performance
- **Cache Hit Rate**: Monitor cache effectiveness
- **Query Time**: Track query execution time
- **Join Optimization**: Use appropriate join strategies
- **Index Usage**: Ensure indexes are used

## Monitoring and Observability

### Metrics to Track

**SSE Metrics**
- Active connections (current, max, average)
- Connection rate (new/second)
- Stale connection count
- Connection duration (p50, p95, p99)

**Queue Metrics**
- Queue size (current, max, average)
- Messages cleaned per run
- Cleanup success rate
- Queue growth rate

**Deletion Metrics**
- Deletion success rate
- Retry attempts
- Orphaned files detected
- Deletion duration (p50, p95, p99)

**Query Metrics**
- Query execution time (p50, p95, p99)
- Cache hit rate
- Slow query count (>100ms)
- Query count per endpoint

### Health Checks

**SSE Health**
- Connection count within limits
- No stale connections
- Heartbeat mechanism working

**Queue Health**
- Queue size within limits
- Cleanup job running
- No backlog of expired messages

**Deletion Health**
- No orphaned files accumulating
- Deletion success rate >99%
- No failed deletions pending

**Query Health**
- Query time <100ms for 95% of queries
- Cache hit rate >80%
- No slow queries

### Alerting

**Critical Alerts**
- SSE connection count >900 (90% of limit)
- Queue size >9000 (90% of limit)
- Deletion failure rate >1%
- Query time >500ms for 5% of queries

**Warning Alerts**
- SSE stale connection count >10
- Queue growth rate >100/minute
- Orphaned files detected >10
- Cache hit rate <50%

## Rollback Strategy

### SSE Rollback
1. Disable SSE manager via feature flag
2. Revert to original SSE implementation
3. Clear connection registry
4. Monitor for memory leaks

### Queue Rollback
1. Disable automatic cleanup
2. Revert to manual cleanup
3. Remove size limits
4. Monitor queue growth

### Deletion Rollback
1. Disable transactional deletion
2. Revert to original deletion logic
3. Disable retry mechanism
4. Run orphaned file cleanup

### Query Rollback
1. Disable caching
2. Revert to N+1 queries
3. Remove new indexes
4. Monitor query performance

## Future Improvements

### SSE
- Implement connection pooling
- Add compression for large payloads
- Implement message batching
- Add WebSocket support as alternative

### Queue
- Implement priority-based cleanup
- Add message deduplication
- Implement queue persistence to disk
- Add distributed queue support

### Deletion
- Implement distributed file system
- Add versioning for files
- Implement soft delete
- Add file archival

### Query
- Implement query result streaming
- Add GraphQL support
- Implement real-time subscriptions
- Add distributed query processing
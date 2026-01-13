# Queue Management

## ADDED Requirements

### Requirement: Delayed Message Queue Automatic Cleanup
The system MUST automatically clean up expired delayed messages from the Redis sorted set to prevent unbounded memory growth.

#### Scenario: Expired messages are removed in batches
**Given** the delayed message queue contains expired messages (delivery timestamp < now)
**When** the cleanup job runs
**Then** the system MUST remove expired messages in batches of 1000
**And** the system MUST track the number of messages cleaned
**And** the system MUST update cleanup metrics

#### Scenario: Cleanup job runs periodically
**Given** the system is running
**When** 5 minutes have elapsed since the last cleanup
**Then** the system MUST trigger the cleanup job
**And** the system MUST process expired messages
**And** the system MUST update metrics

#### Scenario: Cleanup handles empty queue
**Given** the delayed message queue is empty
**When** the cleanup job runs
**Then** the system MUST complete successfully
**And** the system MUST return 0 messages cleaned
**And** the system MUST update metrics

### Requirement: Delayed Message Queue Size Monitoring
The system MUST monitor the delayed message queue size and alert when it exceeds thresholds to prevent memory exhaustion.

#### Scenario: Queue size is tracked continuously
**Given** the system is running
**When** queue metrics are requested
**Then** the system MUST return the current queue size
**And** the system MUST return the maximum queue size observed
**And** the system MUST return the average queue size

#### Scenario: Alert is triggered when queue size exceeds threshold
**Given** the delayed message queue size exceeds 10000 messages
**When** the queue is checked
**Then** the system MUST trigger an alert
**And** the system MUST log the queue size
**And** the system MUST notify administrators

#### Scenario: Queue health status is exposed
**Given** the health endpoint is requested
**When** the queue status is checked
**Then** the system MUST return the queue size
**And** the system MUST return the queue health status (healthy/warning/critical)
**And** the system MUST return cleanup metrics

### Requirement: Delayed Message Queue Size Limits
The system MUST enforce a maximum queue size of 10000 messages and reject new messages when the queue is full to implement backpressure.

#### Scenario: New message is rejected when queue is full
**Given** the delayed message queue contains 10000 messages
**When** a new delayed message is added
**Then** the system MUST reject the message
**And** the system MUST return a queue full error
**And** the system MUST return HTTP 503

#### Scenario: New message is accepted when queue has space
**Given** the delayed message queue contains 5000 messages
**When** a new delayed message is added
**Then** the system MUST accept the message
**And** the system MUST add the message to the queue
**And** the system MUST return success

#### Scenario: Queue size check happens before adding message
**Given** a delayed message is being added
**When** the queue size is checked
**Then** the system MUST verify the current queue size
**And** the system MUST only add if size < 10000
**And** the system MUST reject if size >= 10000

### Requirement: Delayed Message Queue Cleanup Cron Job
The system MUST provide a cron job endpoint that triggers automatic cleanup of expired delayed messages with proper authentication.

#### Scenario: Cleanup cron job is triggered with valid secret
**Given** the cleanup cron endpoint is called
**And** the request includes a valid CRON_SECRET
**When** the cleanup job executes
**Then** the system MUST authenticate the request
**And** the system MUST run the cleanup job
**And** the system MUST return cleanup results

#### Scenario: Cleanup cron job is rejected without secret
**Given** the cleanup cron endpoint is called
**And** the request does not include a valid CRON_SECRET
**When** the authentication check runs
**Then** the system MUST reject the request
**And** the system MUST return HTTP 401
**And** the system MUST log the failed attempt

#### Scenario: Cleanup cron job returns detailed results
**Given** the cleanup cron job completes
**When** the results are returned
**Then** the system MUST return the number of messages cleaned
**And** the system MUST return the execution time
**And** the system MUST return the queue size after cleanup

### Requirement: Delayed Message Queue Health Metrics
The system MUST track and expose health metrics for the delayed message queue including cleanup success rate, messages cleaned per run, and queue growth rate.

#### Scenario: Cleanup success rate is tracked
**Given** the cleanup job runs
**When** the job completes
**Then** the system MUST track whether cleanup succeeded
**And** the system MUST update the success rate metric
**And** the system MUST log any failures

#### Scenario: Messages cleaned per run is tracked
**Given** the cleanup job runs
**When** the job completes
**Then** the system MUST track the number of messages cleaned
**And** the system MUST update the messages cleaned metric
**And** the system MUST log the count

#### Scenario: Queue growth rate is tracked
**Given** the system is running
**When** queue metrics are calculated
**Then** the system MUST calculate the growth rate (messages/minute)
**And** the system MUST track the growth rate over time
**And** the system MUST alert if growth rate is abnormal

## MODIFIED Requirements

### Requirement: Delayed Message Service
The delayed message service MUST now include automatic cleanup, size monitoring, and size limits.

#### Scenario: Delayed message includes size check
**Given** a delayed message is being added
**When** the size check runs
**Then** the system MUST verify the queue size
**And** the system MUST only add if under limit
**And** the system MUST reject if over limit

#### Scenario: Delayed message service exposes metrics
**Given** the delayed message service is queried
**When** metrics are requested
**Then** the system MUST return queue size
**And** the system MUST return cleanup metrics
**And** the system MUST return health status

## Related Capabilities
- `sse-lifecycle`: Queue cleanup may trigger SSE notifications to subscribers
- `attachment-safety`: Attachment deletions may trigger queue cleanup
- `query-optimization`: Optimized queries improve queue performance monitoring
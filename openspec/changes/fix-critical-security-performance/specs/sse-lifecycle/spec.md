# SSE Lifecycle Management

## ADDED Requirements

### Requirement: SSE Connection Lifecycle Tracking
The system MUST track all active SSE connections with unique identifiers, metadata (IP address, channel ID, connection timestamp, last heartbeat timestamp), and automatically clean up stale connections to prevent memory leaks.

#### Scenario: Connection is registered with unique ID and metadata
**Given** a client connects to the SSE endpoint
**When** the connection is established
**Then** the system MUST assign a unique connection ID
**And** the system MUST store connection metadata (IP, channel, timestamp)
**And** the system MUST register the connection in the connection registry

#### Scenario: Stale connections are automatically detected and cleaned up
**Given** an SSE connection has not sent a heartbeat for 30 seconds
**When** the heartbeat monitor runs
**Then** the system MUST detect the connection as stale
**And** the system MUST remove the connection from the registry
**And** the system MUST clean up all associated resources

#### Scenario: Connection is properly unregistered on client disconnect
**Given** a client disconnects from the SSE endpoint
**When** the disconnect event is received
**Then** the system MUST unregister the connection
**And** the system MUST clean up all associated resources
**And** the system MUST log the disconnection

### Requirement: SSE Heartbeat Mechanism
The system MUST implement a heartbeat mechanism that sends periodic messages to clients and detects stale connections that haven't responded within the timeout period.

#### Scenario: Heartbeat is sent every 15 seconds
**Given** an active SSE connection
**When** 15 seconds have elapsed since the last heartbeat
**Then** the system MUST send a heartbeat message to the client
**And** the system MUST update the last heartbeat timestamp

#### Scenario: Stale connection is detected after 30 seconds
**Given** an SSE connection hasn't responded to heartbeat for 30 seconds
**When** the heartbeat monitor checks the connection
**Then** the system MUST mark the connection as stale
**And** the system MUST initiate cleanup of the stale connection

### Requirement: SSE Connection Limits
The system MUST enforce connection limits to prevent denial of service attacks, including per-IP limits (max 5 connections) and global limits (max 1000 connections).

#### Scenario: Per-IP connection limit is enforced
**Given** an IP address already has 5 active SSE connections
**When** a new connection request comes from the same IP
**Then** the system MUST reject the connection with HTTP 429
**And** the system MUST return a rate limit exceeded error message

#### Scenario: Global connection limit is enforced
**Given** the system already has 1000 active SSE connections
**When** a new connection request comes from any IP
**Then** the system MUST reject the connection with HTTP 429
**And** the system MUST return a server busy error message

#### Scenario: Connection is allowed when under limits
**Given** an IP address has 3 active connections (below limit of 5)
**And** the system has 500 active connections (below limit of 1000)
**When** a new connection request comes from the IP
**Then** the system MUST accept the connection
**And** the system MUST register the connection

### Requirement: SSE Graceful Shutdown
The system MUST implement graceful shutdown handling that notifies all connected clients and waits for connections to close before terminating.

#### Scenario: Server initiates graceful shutdown on SIGTERM
**Given** the system receives a SIGTERM signal
**When** the shutdown process starts
**Then** the system MUST send a close event to all connected clients
**And** the system MUST wait up to 5 seconds for connections to close
**And** the system MUST force-close any remaining connections after timeout

#### Scenario: Server initiates graceful shutdown on SIGINT
**Given** the system receives a SIGINT signal
**When** the shutdown process starts
**Then** the system MUST send a close event to all connected clients
**And** the system MUST wait up to 5 seconds for connections to close
**And** the system MUST force-close any remaining connections after timeout

### Requirement: SSE Monitoring and Metrics
The system MUST track and expose metrics for SSE connections including active connection count, connection rate (new/second), stale connection count, and connection duration distribution.

#### Scenario: Active connection count is tracked
**Given** the system is running
**When** the metrics are requested
**Then** the system MUST return the current active connection count
**And** the system MUST return the maximum connection count observed

#### Scenario: Connection rate is tracked
**Given** the system is running
**When** the metrics are requested
**Then** the system MUST return the new connections per second rate
**And** the system MUST return the disconnections per second rate

#### Scenario: Connection duration distribution is tracked
**Given** the system is running
**When** the metrics are requested
**Then** the system MUST return connection duration percentiles (p50, p95, p99)
**And** the system MUST return the average connection duration

## MODIFIED Requirements

### Requirement: SSE Subscription Endpoint
The SSE subscription endpoint MUST now include connection lifecycle management, heartbeat mechanism, and connection limits.

#### Scenario: SSE connection includes heartbeat
**Given** a client connects to the SSE endpoint
**When** the connection is established
**Then** the system MUST start sending heartbeats every 15 seconds
**And** the system MUST track the connection in the registry

#### Scenario: SSE connection enforces limits
**Given** a client attempts to connect to the SSE endpoint
**When** the connection request exceeds limits
**Then** the system MUST return HTTP 429
**And** the system MUST include rate limit headers

## Related Capabilities
- `queue-management`: Queue cleanup may trigger SSE notifications
- `attachment-safety`: Attachment deletions may trigger SSE notifications
- `query-optimization`: Optimized queries improve SSE message delivery performance
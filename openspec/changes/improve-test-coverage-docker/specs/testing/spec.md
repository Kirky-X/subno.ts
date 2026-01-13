## ADDED Requirements

### Requirement: Docker Test Infrastructure
The system SHALL provide Docker-based test infrastructure for integration testing.

#### Scenario: PostgreSQL test container starts successfully
- **WHEN** integration tests require a database
- **THEN** a PostgreSQL container SHALL be started via testcontainers
- **AND** the container SHALL be ready within 30 seconds
- **AND** migrations SHALL be applied automatically

#### Scenario: Redis test container starts successfully
- **WHEN** integration tests require Redis
- **THEN** a Redis container SHALL be started via testcontainers
- **AND** the container SHALL be ready within 10 seconds
- **AND** the Redis URL SHALL be passed via environment variables

#### Scenario: Test containers are cleaned up after tests
- **WHEN** all integration tests complete
- **THEN** all test containers SHALL be stopped and removed
- **AND** no container artifacts SHALL remain

### Requirement: SSE Stream Integration Tests
The system SHALL provide comprehensive tests for SSE stream functionality.

#### Scenario: SSE connection establishes with valid channel
- **WHEN** client connects to `/api/subscribe?channel=valid-channel`
- **THEN** a Redis Pub/Sub connection SHALL be established
- **AND** a connection confirmation event SHALL be sent
- **AND** the response headers SHALL include correct SSE headers

#### Scenario: SSE receives published messages
- **WHEN** a message is published to a subscribed channel
- **THEN** the message SHALL appear in the SSE stream
- **AND** the event SHALL be formatted as `event: message`
- **AND** the message ID SHALL be unique and incrementing

#### Scenario: SSE handles lastEventId for missed messages
- **WHEN** client reconnects with `lastEventId=msg_123`
- **THEN** all messages after msg_123 SHALL be sent
- **AND** the catch-up count SHALL be reported via info event

#### Scenario: SSE heartbeat maintains connection
- **WHEN** no messages are published for 30 seconds
- **THEN** a keepalive comment SHALL be sent
- **AND** the connection SHALL remain open

### Requirement: Cleanup Service Integration Tests
The system SHALL provide comprehensive tests for cleanup service functionality.

#### Scenario: Expired public keys are cleaned
- **WHEN** cleanup service runs for expired keys
- **THEN** expired keys SHALL be removed from PostgreSQL
- **AND** cached keys SHALL be removed from Redis
- **AND** the deleted count SHALL be returned

#### Scenario: Orphaned Redis keys are detected and cleaned
- **WHEN** cleanup service runs for orphaned keys
- **THEN** Redis keys without corresponding database channels SHALL be identified
- **AND** orphaned keys SHALL be deleted
- **AND** the cleanup count SHALL be reported

#### Scenario: Old audit logs are archived
- **WHEN** cleanup service runs for audit logs older than retention period
- **THEN** old logs SHALL be archived or deleted
- **AND** the archive operation SHALL be logged

#### Scenario: Temporary channels with expired TTL are cleaned
- **WHEN** cleanup service runs for temp channels
- **THEN** channels with expired TTL SHALL be identified
- **AND** associated Redis keys SHALL be deleted
- **AND** database records SHALL be marked as inactive

### Requirement: Template API Integration Tests
The system SHALL provide comprehensive tests for template API functionality.

#### Scenario: Template is created successfully
- **WHEN** POST request is sent to `/api/templates` with valid template
- **THEN** a new template SHALL be created
- **AND** the template SHALL be stored in the database
- **AND** the response SHALL include the created template ID

#### Scenario: Template is retrieved successfully
- **WHEN** GET request is sent to `/api/templates/{name}`
- **THEN** the template SHALL be retrieved
- **AND** template variables SHALL be replaced with provided values
- **AND** the rendered content SHALL be returned

#### Scenario: Template validation rejects invalid syntax
- **WHEN** POST request is sent with malformed template
- **THEN** a validation error SHALL be returned
- **AND** the error SHALL include the syntax error location

#### Scenario: Template prevents XSS attacks
- **WHEN** template contains potential XSS payload
- **THEN** the payload SHALL be escaped
- **AND** no executable script SHALL be rendered

### Requirement: CI/CD Coverage Gate
The system SHALL enforce coverage requirements in the CI/CD pipeline.

#### Scenario: PR fails when coverage is below 95%
- **WHEN** a pull request is created
- **THEN** the coverage check SHALL run
- **AND** if coverage is below 95%, the check SHALL fail
- **AND** a detailed coverage report SHALL be provided

#### Scenario: Coverage badge reflects current branch coverage
- **WHEN** tests complete on the main branch
- **THEN** the coverage badge SHALL be updated
- **AND** the badge SHALL reflect the actual coverage percentage

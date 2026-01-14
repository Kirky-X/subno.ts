## ADDED Requirements

### Requirement: API Key Permission Validation
The system SHALL validate that API keys have appropriate permissions before allowing key revocation operations.

#### Scenario: Revocation with valid permission
- **WHEN** a revocation request is made with an API key having `key_revoke` or `admin` permission
- **THEN** the system SHALL process the request normally
- **AND** the request SHALL be logged in audit logs

#### Scenario: Revocation without permission
- **WHEN** a revocation request is made with an API key lacking required permissions
- **THEN** the system SHALL return HTTP 403 Forbidden
- **AND** the response SHALL contain error code `FORBIDDEN`
- **AND** the failed attempt SHALL be logged in audit logs

#### Scenario: Revocation with inactive API key
- **WHEN** a revocation request is made with an inactive API key
- **THEN** the system SHALL return HTTP 401 Unauthorized
- **AND** the response SHALL contain error code `AUTH_FAILED`

### Requirement: Secure Credential Comparison
The system SHALL use timing-safe string comparison for comparing sensitive credentials to prevent timing attacks.

#### Scenario: Admin key comparison
- **WHEN** admin key verification is performed
- **THEN** the system SHALL use constant-time comparison algorithm
- **AND** response time SHALL NOT vary based on how many characters match

#### Scenario: Invalid admin key
- **WHEN** an invalid admin key is provided
- **THEN** the system SHALL return HTTP 401 Unauthorized
- **AND** no distinction SHALL be made between key not found and key mismatch

### Requirement: Input Validation for Revocation Reason
The system SHALL validate revocation reason fields to prevent injection attacks and abuse.

#### Scenario: Valid reason length
- **WHEN** a revocation request has reason between 10 and 1000 characters
- **THEN** the system SHALL accept the request

#### Scenario: Reason too short
- **WHEN** a revocation request has reason less than 10 characters
- **THEN** the system SHALL return HTTP 400 Bad Request
- **AND** the response SHALL contain error code `INVALID_REASON`

#### Scenario: Reason too long
- **WHEN** a revocation request has reason more than 1000 characters
- **THEN** the system SHALL return HTTP 400 Bad Request
- **AND** the response SHALL contain error code `INVALID_REASON`

#### Scenario: Invalid characters in reason
- **WHEN** a revocation request contains control characters in reason
- **THEN** the system SHALL return HTTP 400 Bad Request
- **AND** the response SHALL contain error code `INVALID_INPUT`

### Requirement: Batch Database Operations
The system SHALL perform database cleanup operations using batch operations to improve performance and reduce connection usage.

#### Scenario: Batch update expired confirmations
- **WHEN** cleaning up expired revocation confirmations
- **THEN** the system SHALL use batch update with `IN` clause
- **AND** the operation SHALL complete in a single database round trip
- **AND** processing time SHALL be O(1) instead of O(n)

#### Scenario: Batch delete revoked keys
- **WHEN** permanently deleting revoked keys older than threshold
- **THEN** the system SHALL use batch delete with `IN` clause
- **AND** the operation SHALL complete in a single database round trip

#### Scenario: Large batch processing
- **WHEN** batch size exceeds 500 records
- **THEN** the system SHALL process records in chunks of 500
- **AND** each chunk SHALL be processed in a separate transaction

### Requirement: Error Message Sanitization
The system SHALL NOT expose sensitive information in error messages.

#### Scenario: Database error handling
- **WHEN** a database operation fails
- **THEN** the system SHALL log the full error details internally
- **AND** the response SHALL contain only generic error messages
- **AND** database schema information SHALL NOT be exposed

#### Scenario: Cleanup operation errors
- **WHEN** a cleanup operation fails for a specific record
- **THEN** the error message SHALL NOT contain database query details
- **AND** the error message SHALL use format: `Failed to process record {id}: Operation failed`

### Requirement: API Key Permission Check
The system SHALL provide a method to check API key permissions programmatically.

#### Scenario: Check single permission
- **WHEN** `validateApiKeyPermission(apiKeyId, 'key_revoke')` is called
- **THEN** the system SHALL return `true` if the key has `key_revoke` or `admin` permission
- **AND** the system SHALL return `false` if the key lacks required permissions
- **AND** the system SHALL return `false` if the key is inactive or deleted

#### Scenario: Permission cache
- **WHEN** a permission check is performed
- **THEN** the result MAY be cached for up to 5 minutes
- **AND** cache invalidation SHALL occur when key permissions are modified

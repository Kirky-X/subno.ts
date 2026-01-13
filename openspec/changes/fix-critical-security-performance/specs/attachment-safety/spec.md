# Attachment Safety

## ADDED Requirements

### Requirement: Transactional Attachment Deletion
The system MUST implement transactional attachment deletion that ensures consistency between the file system and database, with rollback capability if file deletion fails.

#### Scenario: Attachment deletion validates file before deletion
**Given** an attachment deletion request is received
**When** the validation phase runs
**Then** the system MUST check if the file exists
**And** the system MUST validate the file path (within allowed directory)
**And** the system MUST verify file ownership
**And** the system MUST reject if validation fails

#### Scenario: Attachment deletion deletes database record first
**Given** file validation succeeds
**When** the deletion transaction starts
**Then** the system MUST delete the database record
**And** the system MUST verify the deletion succeeded
**And** the system MUST proceed to file deletion

#### Scenario: Attachment deletion rolls back if file deletion fails
**Given** the database record is deleted
**When** file deletion fails
**Then** the system MUST re-insert the database record
**And** the system MUST return an error
**And** the system MUST log the failure

#### Scenario: Attachment deletion succeeds when both operations succeed
**Given** the database record is deleted
**When** file deletion succeeds
**Then** the system MUST commit the transaction
**And** the system MUST return success
**And** the system MUST log the successful deletion

### Requirement: Attachment File Path Validation
The system MUST validate file paths before deletion to prevent directory traversal attacks and ensure files are within the allowed upload directory.

#### Scenario: File path is validated for directory traversal
**Given** an attachment deletion request is received
**When** the file path is validated
**Then** the system MUST check for path traversal sequences (.., /, \)
**And** the system MUST reject if path traversal is detected
**And** the system MUST return a security error

#### Scenario: File path is validated for allowed directory
**Given** an attachment deletion request is received
**When** the file path is validated
**Then** the system MUST verify the file is within the upload directory
**And** the system MUST reject if file is outside allowed directory
**And** the system MUST return a security error

#### Scenario: File path validation passes for valid path
**Given** an attachment with a valid file path
**When** the file path is validated
**Then** the system MUST approve the path
**And** the system MUST proceed with deletion
**And** the system MUST log the validation success

### Requirement: Attachment Deletion Retry Mechanism
The system MUST implement a retry mechanism for file deletion with exponential backoff (1s, 2s, 4s) and a maximum of 3 attempts to handle transient failures.

#### Scenario: File deletion is retried on failure
**Given** file deletion fails on first attempt
**When** the retry mechanism runs
**Then** the system MUST wait 1 second before retry
**And** the system MUST retry the deletion
**And** the system MUST log the retry attempt

#### Scenario: File deletion retry uses exponential backoff
**Given** file deletion fails on second attempt
**When** the retry mechanism runs
**Then** the system MUST wait 2 seconds before retry
**And** the system MUST retry the deletion
**And** the system MUST log the retry attempt

#### Scenario: File deletion fails after maximum retries
**Given** file deletion fails on all 3 attempts
**When** the retry mechanism completes
**Then** the system MUST mark the deletion as failed
**And** the system MUST return an error
**And** the system MUST schedule manual cleanup

#### Scenario: File deletion succeeds on retry
**Given** file deletion fails on first attempt
**When** the retry mechanism runs
**Then** the system MUST retry the deletion
**And** the system MUST succeed on retry
**And** the system MUST return success

### Requirement: Orphaned File Cleanup
The system MUST periodically scan the upload directory for orphaned files (files without database records) and delete them to maintain storage consistency.

#### Scenario: Orphaned files are detected during scan
**Given** the orphaned file cleanup job runs
**When** the upload directory is scanned
**Then** the system MUST list all files in the upload directory
**And** the system MUST query the database for file records
**And** the system MUST identify files without database records

#### Scenario: Orphaned files are deleted
**Given** orphaned files are detected
**When** the cleanup runs
**Then** the system MUST delete the orphaned files
**And** the system MUST log the deletions
**And** the system MUST update cleanup metrics

#### Scenario: Cleanup job runs daily
**Given** the system is running
**When** 24 hours have elapsed since the last cleanup
**Then** the system MUST trigger the orphaned file cleanup
**And** the system MUST scan the upload directory
**And** the system MUST delete orphaned files

### Requirement: Attachment Deletion Audit Logging
The system MUST log all attachment deletion attempts including user, timestamp, result, and error details for compliance and troubleshooting.

#### Scenario: Successful deletion is logged
**Given** an attachment is deleted successfully
**When** the deletion completes
**Then** the system MUST log the deletion attempt
**And** the system MUST include the user ID
**And** the system MUST include the timestamp
**And** the system MUST include the success status

#### Scenario: Failed deletion is logged
**Given** an attachment deletion fails
**When** the deletion fails
**Then** the system MUST log the failure
**And** the system MUST include the error message
**And** the system MUST include the retry attempts
**And** the system MUST include the final status

#### Scenario: Orphaned file detection is logged
**Given** orphaned files are detected
**When** the cleanup runs
**Then** the system MUST log the detection
**And** the system MUST include the file paths
**And** the system MUST include the count of files
**And** the system MUST include the cleanup result

## MODIFIED Requirements

### Requirement: Attachment Deletion Endpoint
The attachment deletion endpoint MUST now include transactional deletion, file path validation, retry mechanism, and audit logging.

#### Scenario: Attachment deletion includes validation
**Given** a delete request is received
**When** the deletion starts
**Then** the system MUST validate the file path
**And** the system MUST check file existence
**And** the system MUST proceed only if validation passes

#### Scenario: Attachment deletion includes retry
**Given** a delete request is received
**When** file deletion fails
**Then** the system MUST retry with exponential backoff
**And** the system MUST attempt up to 3 times
**And** the system MUST return error if all retries fail

#### Scenario: Attachment deletion includes audit logging
**Given** a delete request is received
**When** the deletion completes
**Then** the system MUST log the attempt
**And** the system MUST include all relevant details
**And** the system MUST store the audit record

## Related Capabilities
- `sse-lifecycle`: Attachment deletions may trigger SSE notifications
- `queue-management`: Orphaned file cleanup may be queued
- `query-optimization`: Optimized queries improve deletion performance
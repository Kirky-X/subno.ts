# Tasks: Fix Critical Security Vulnerabilities

## 1. Security Infrastructure
- [ ] 1.1 Create `src/lib/utils/secure-compare.ts` with timing-safe comparison
- [ ] 1.2 Add unit tests for `secureCompare` function
- [ ] 1.3 Create `src/lib/constants/config.ts` for magic numbers

## 2. API Key Permission Validation
- [ ] 2.1 Add `validateApiKeyPermission` method to `ApiKeyRepository`
- [ ] 2.2 Implement permission check in `keyRevocationService.requestRevocation()`
- [ ] 2.3 Add permission validation error to API route
- [ ] 2.4 Write integration tests for permission validation

## 3. Admin Key Security
- [ ] 3.1 Replace `!==` comparison with `secureCompare()` in `app/api/keys/[id]/route.ts`
- [ ] 3.2 Add `secureCompare` import to route file
- [ ] 3.3 Test admin key comparison behavior

## 4. Input Validation Enhancement
- [ ] 4.1 Add `MAX_REASON_LENGTH` constant (1000 chars)
- [ ] 4.2 Add reason length validation in `key-revocation.service.ts`
- [ ] 4.3 Add special character filtering for reason field
- [ ] 4.4 Write validation tests

## 5. Error Message Sanitization
- [ ] 5.1 Replace detailed error messages in `cleanup.service.ts`
- [ ] 5.2 Add generic error messages for all public methods
- [ ] 5.3 Ensure no stack trace leakage in API responses

## 6. Batch Database Operations
- [ ] 6.1 Refactor `cleanupExpiredRevocations()` to use batch update with `inArray`
- [ ] 6.2 Refactor `cleanupRevokedKeys()` to use batch delete
- [ ] 6.3 Add batch size limit constant (500 records per batch)
- [ ] 6.4 Test batch operations with large datasets

## 7. Code Quality Improvements
- [ ] 7.1 Fix type assertions in `api-key.repository.ts` (remove `as unknown as`)
- [ ] 7.2 Fix type assertions in `audit.service.ts`
- [ ] 7.3 Update `cleanup.service.ts` imports to use `../../db` consistently
- [ ] 7.4 Run linter and fix any remaining issues

## 8. Documentation & Validation
- [ ] 8.1 Update API documentation for permission requirements
- [ ] 8.2 Run full test suite
- [ ] 8.3 Verify no regression in existing functionality
- [ ] 8.4 Create security testing checklist

## Dependencies
- Task 1.1 must complete before 3.1
- Task 2.1 must complete before 2.2
- Task 6.1 and 6.2 can be done in parallel

## Parallel Work
- Tasks 1.x can run in parallel with 4.x
- Tasks 2.x and 3.x can run in parallel
- Tasks 7.x can be done during review waiting periods

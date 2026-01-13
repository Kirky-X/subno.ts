# Security Enhancements - SQL Injection, Rate Limiting, and Input Validation

## Status
**Proposed** | [ ] Approved | [ ] In Progress | [ ] Completed

## Summary
Implement critical security enhancements to address remaining High and Medium priority security issues identified in code review:
1. SQL injection protection with enhanced input validation
2. Multi-layer rate limiting (IP + User-Agent + Device Fingerprint)
3. Request size validation for all API endpoints
4. Improved error handling and logging

## Motivation
The code review identified several security vulnerabilities that need to be addressed:
- **SQL Injection Risk**: Dynamic query construction without proper sanitization
- **Rate Limiting Bypass**: IP-based rate limiting can be bypassed using proxy pools
- **Missing Request Size Limits**: No validation of request body sizes
- **Error Information Leakage**: Detailed error messages exposed to clients

## Proposed Changes

### 1. SQL Injection Protection

**Files to modify**:
- `src/lib/services/message-extended.service.ts`
- `src/lib/utils/validation.util.ts`

**Changes**:
```typescript
// Add input sanitization utility
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

// Update message validation
const PublishMessageSchema = z.object({
  channel: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/),
  message: z.string().min(1).max(4718592),
  filter: z.object({
    message: z.string().max(1000).optional(),
  }).optional(),
  // ... other fields
});
```

### 2. Multi-Layer Rate Limiting

**Files to modify**:
- `src/lib/services/rate-limiter.service.ts`
- `src/middleware.ts`

**Changes**:
```typescript
// Implement multi-layer rate limiting
export class RateLimiterService {
  async checkPublishLimit(request: Request): Promise<boolean> {
    const ip = this.getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const uaHash = this.hashUserAgent(userAgent);
    
    // Layer 1: IP-based limit (strict)
    const ipAllowed = await this.checkLimit(
      `publish:ip:${ip}`,
      env.RATE_LIMIT_PUBLISH,
      60
    );
    
    if (!ipAllowed) {
      return false;
    }
    
    // Layer 2: User-Agent based limit (more lenient)
    const uaAllowed = await this.checkLimit(
      `publish:ua:${uaHash}`,
      env.RATE_LIMIT_PUBLISH * 2,
      60
    );
    
    return uaAllowed;
  }
  
  private hashUserAgent(userAgent: string): string {
    return crypto.createHash('sha256')
      .update(userAgent)
      .digest('hex')
      .substring(0, 16);
  }
}
```

### 3. Request Size Validation

**Files to modify**:
- `src/middleware.ts`
- `src/app/api/subscribe/route.ts`
- `src/app/api/publish/route.ts`
- `src/app/api/register/route.ts`

**Changes**:
```typescript
// Add request size middleware
export function validateRequestSize(request: Request, maxSize: number): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSize) {
      return false;
    }
  }
  return true;
}

// Apply to all API routes
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB

if (!validateRequestSize(request, MAX_REQUEST_SIZE)) {
  return new NextResponse(
    JSON.stringify({ success: false, error: 'Request body too large' }),
    { status: 413 }
  );
}
```

### 4. Improved Error Handling and Logging

**Files to modify**:
- `src/lib/services/*.ts`
- `src/app/api/**/*.ts`

**Changes**:
```typescript
// Create structured error handler
export class ErrorHandler {
  static handleError(error: unknown, context: string): ErrorResponse {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (error instanceof ZodError) {
      return {
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        errors: error.errors,
      };
    }
    
    if (error instanceof Error) {
      // Log full error in development, minimal in production
      if (isProduction) {
        console.error(`[${context}] Error: ${error.message}`);
      } else {
        console.error(`[${context}] Error:`, error);
      }
      
      return {
        success: false,
        error: isProduction ? 'Internal server error' : error.message,
        code: 'INTERNAL_ERROR',
      };
    }
    
    return {
      success: false,
      error: 'Unknown error',
      code: 'UNKNOWN_ERROR',
    };
  }
}
```

## Implementation Plan

### Phase 1: Input Validation (High Priority)
1. Create `src/lib/utils/sanitization.util.ts`
2. Update validation schemas in `validation.util.ts`
3. Add input sanitization to all API routes
4. Write unit tests for sanitization functions

### Phase 2: Multi-Layer Rate Limiting (High Priority)
1. Update `RateLimiterService` with multi-layer checks
2. Add User-Agent hashing utility
3. Update middleware to apply rate limiting
4. Write integration tests for rate limiting

### Phase 3: Request Size Validation (High Priority)
1. Add request size validation middleware
2. Apply to all API routes
3. Add tests for size validation

### Phase 4: Error Handling (Medium Priority)
1. Create `ErrorHandler` utility
2. Update all API routes to use `ErrorHandler`
3. Add structured logging
4. Write tests for error handling

## Testing Strategy

### Unit Tests
- Input sanitization functions
- Rate limiting logic
- Request size validation
- Error handling

### Integration Tests
- API endpoints with various input sizes
- Rate limiting with different scenarios
- Error responses

### Security Tests
- SQL injection attempts
- Rate limit bypass attempts
- Oversized request payloads

## Migration Path

No breaking changes. All changes are backward compatible.

## Rollback Plan

If issues arise:
1. Revert to previous validation logic
2. Disable multi-layer rate limiting
3. Remove request size validation
4. Restore original error handling

## Success Criteria

- ✅ All security tests pass
- ✅ No performance regression
- ✅ All existing tests pass
- ✅ New tests added and passing
- ✅ Code coverage maintained > 80%

## Related Issues

- Addresses High priority issues #7, #8, #9 from code review
- Addresses Medium priority issues #10, #11, #12 from code review

## Dependencies

- None (uses existing dependencies)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rate limiting too aggressive | Medium | Adjust limits based on monitoring |
| Input validation breaks valid use cases | Medium | Add comprehensive tests |
| Error messages too vague | Low | Add error codes for debugging |

## Timeline

- Phase 1: 2 hours
- Phase 2: 2 hours
- Phase 3: 1 hour
- Phase 4: 2 hours
- Testing: 2 hours
- **Total**: ~9 hours

## Reviewers

- @KirkyX (Security Lead)
- [ ] TBD (Backend Lead)
- [ ] TBD (QA Lead)

## Checklist

- [ ] Implementation completed
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Security tests pass
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Monitored for issues
- [ ] Deployed to production
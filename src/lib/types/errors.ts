// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Unified error types for SecureNotify application
 */

/**
 * Application error codes
 */
export enum ErrorCode {
  // Authentication errors (40x)
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INACTIVE_API_KEY = 'INACTIVE_API_KEY',
  REVOKED_API_KEY = 'REVOKED_API_KEY',
  EXPIRED_API_KEY = 'EXPIRED_API_KEY',
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',

  // Resource errors (40x)
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (50x)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',

  // Operation errors
  VALIDATION_ERROR_CODE = 'VALIDATION_ERROR_CODE',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Unknown
  UNKNOWN = 'UNKNOWN',
}

/**
 * HTTP status code mapping for error codes
 */
export const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  // 40x - Client errors
  [ErrorCode.MISSING_API_KEY]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.INACTIVE_API_KEY]: 401,
  [ErrorCode.REVOKED_API_KEY]: 401,
  [ErrorCode.EXPIRED_API_KEY]: 401,
  [ErrorCode.AUTH_FAILED]: 401,
  [ErrorCode.AUTH_REQUIRED]: 401,
  
  // 403 - Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 400 - Bad Request
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.INVALID_PARAMETER]: 400,
  [ErrorCode.MISSING_PARAMETER]: 400,

  // 404/409
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.ALREADY_EXISTS]: 409,

  // 429 - Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,

  // 50x - Server errors
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_GATEWAY]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,

  // Operation errors (default to 500)
  [ErrorCode.VALIDATION_ERROR_CODE]: 500,
  [ErrorCode.ENCRYPTION_ERROR]: 500,
  [ErrorCode.DECRYPTION_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.NETWORK_ERROR]: 500,
  [ErrorCode.TIMEOUT_ERROR]: 500,

  [ErrorCode.UNKNOWN]: 500,
};

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly message: string,
    public readonly status: number = HTTP_STATUS_MAP[code] || 500,
    public readonly details?: Record<string, unknown>,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert to JSON-serializable format for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }

  /**
   * Convert to NextResponse JSON
   */
  toNextResponse(): Response {
    return Response.json(this.toJSON(), { status: this.status });
  }
}

/**
 * Create authentication-related errors
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AUTH_FAILED,
    originalError?: Error
  ) {
    super(code, message, HTTP_STATUS_MAP[code], undefined, originalError);
    this.name = 'AuthenticationError';
  }
}

/**
 * Create authorization-related errors
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.FORBIDDEN,
    originalError?: Error
  ) {
    super(code, message, HTTP_STATUS_MAP[code], undefined, originalError);
    this.name = 'AuthorizationError';
  }
}

/**
 * Create validation-related errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.VALIDATION_ERROR,
    originalError?: Error
  ) {
    super(code, message, HTTP_STATUS_MAP[code], details, originalError);
    this.name = 'ValidationError';
  }
}

/**
 * Create resource-related errors (not found, conflict, etc.)
 */
export class ResourceError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NOT_FOUND,
    originalError?: Error
  ) {
    super(code, message, HTTP_STATUS_MAP[code], undefined, originalError);
    this.name = 'ResourceError';
  }
}

/**
 * Create rate limit errors
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    message: string = 'Too many requests, please try again later',
    retryAfter: number = 60,
    originalError?: Error
  ) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      429,
      { retryAfter },
      originalError
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Create server-related errors
 */
export class ServerError extends AppError {
  constructor(
    message: string = 'An internal error occurred',
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    originalError?: Error
  ) {
    super(code, message, HTTP_STATUS_MAP[code], undefined, originalError);
    this.name = 'ServerError';
  }
}

/**
 * Helper function to wrap errors with AppError
 */
export function wrapError(
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.INTERNAL_ERROR
): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(
      defaultCode,
      error.message || 'An error occurred',
      undefined,
      undefined,
      error
    );
  }
  
  return new AppError(
    defaultCode,
    String(error) || 'An unknown error occurred'
  );
}

/**
 * Check if error is retryable (for retry mechanisms)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.status >= 500 || error.code === ErrorCode.RATE_LIMIT_EXCEEDED;
  }
  return true;  // Non-AppErrors are generally retryable
}

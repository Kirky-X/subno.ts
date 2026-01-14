// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type { ErrorDetails } from "./api.js";

/**
 * Error codes for SecureNotify SDK
 */
export const ErrorCode = {
  // Client errors (4xx)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_FAILED: "AUTH_FAILED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CHANNEL_EXISTS: "CHANNEL_EXISTS",
  KEY_EXPIRED: "KEY_EXPIRED",
  MESSAGE_TOO_LARGE: "MESSAGE_TOO_LARGE",

  // Server errors (5xx)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  BAD_GATEWAY: "BAD_GATEWAY",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",

  // Client-side errors
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  CONNECTION_ERROR: "CONNECTION_ERROR",
  CANCELLATION_ERROR: "CANCELLATION_ERROR",
  SERIALIZATION_ERROR: "SERIALIZATION_ERROR",
  DESERIALIZATION_ERROR: "DESERIALIZATION_ERROR",

  // SSE errors
  SSE_CONNECTION_ERROR: "SSE_CONNECTION_ERROR",
  SSE_HEARTBEAT_TIMEOUT: "SSE_HEARTBEAT_TIMEOUT",
  SSE_UNSUBSCRIBE_ERROR: "SSE_UNSUBSCRIBE_ERROR",

  // Configuration errors
  INVALID_OPTIONS: "INVALID_OPTIONS",
  MISSING_API_KEY: "MISSING_API_KEY",
  INVALID_BASE_URL: "INVALID_BASE_URL",
} as const;

/**
 * Error code type
 */
export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Map of error codes to HTTP status codes
 */
export const ErrorCodeToStatus: Record<ErrorCodeType, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.AUTH_FAILED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CHANNEL_EXISTS]: 409,
  [ErrorCode.KEY_EXPIRED]: 410,
  [ErrorCode.MESSAGE_TOO_LARGE]: 413,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_GATEWAY]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,
  [ErrorCode.NETWORK_ERROR]: 0,
  [ErrorCode.TIMEOUT_ERROR]: 0,
  [ErrorCode.CONNECTION_ERROR]: 0,
  [ErrorCode.CANCELLATION_ERROR]: 0,
  [ErrorCode.SERIALIZATION_ERROR]: 0,
  [ErrorCode.DESERIALIZATION_ERROR]: 0,
  [ErrorCode.SSE_CONNECTION_ERROR]: 0,
  [ErrorCode.SSE_HEARTBEAT_TIMEOUT]: 0,
  [ErrorCode.SSE_UNSUBSCRIBE_ERROR]: 0,
  [ErrorCode.INVALID_OPTIONS]: 0,
  [ErrorCode.MISSING_API_KEY]: 0,
  [ErrorCode.INVALID_BASE_URL]: 0,
};

/**
 * Map of error codes to retryability
 */
export const RetryableErrorCodes: Set<ErrorCodeType> = new Set([
  ErrorCode.RATE_LIMIT_EXCEEDED,
  ErrorCode.INTERNAL_ERROR,
  ErrorCode.BAD_GATEWAY,
  ErrorCode.SERVICE_UNAVAILABLE,
  ErrorCode.GATEWAY_TIMEOUT,
  ErrorCode.NETWORK_ERROR,
  ErrorCode.TIMEOUT_ERROR,
  ErrorCode.CONNECTION_ERROR,
]);

/**
 * Check if an error code is retryable
 */
export function isRetryableError(code: ErrorCodeType): boolean {
  return RetryableErrorCodes.has(code);
}

/**
 * SecureNotify SDK Error class
 */
export class SecureNotifyError extends Error {
  public readonly code: ErrorCodeType;
  public readonly status: number;
  public readonly retryable: boolean;
  public readonly timestamp: string;
  public readonly details?: ErrorDetails;

  constructor(
    code: ErrorCodeType,
    message: string,
    options?: {
      status?: number;
      retryable?: boolean;
      details?: ErrorDetails;
    }
  ) {
    super(message);
    this.name = "SecureNotifyError";
    this.code = code;
    this.status = options?.status ?? ErrorCodeToStatus[code];
    this.retryable = options?.retryable ?? isRetryableError(code);
    this.timestamp = new Date().toISOString();
    this.details = options?.details;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SecureNotifyError);
    }
  }

  /**
   * Create an error from an API error response
   */
  static fromApiResponse(errorDetails: ErrorDetails, httpStatus: number = 0): SecureNotifyError {
    const code = errorDetails.code as ErrorCodeType;
    const retryable = isRetryableError(code);

    return new SecureNotifyError(code, errorDetails.message, {
      status: httpStatus,
      retryable,
      details: errorDetails,
    });
  }

  /**
   * Create a validation error
   */
  static validation(message: string, details?: Record<string, unknown>): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.VALIDATION_ERROR, message, {
      details: {
        message,
        code: ErrorCode.VALIDATION_ERROR,
        timestamp: new Date().toISOString(),
      },
      retryable: false,
    });
  }

  /**
   * Create an authentication error
   */
  static authRequired(message: string = "API key is required"): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.AUTH_REQUIRED, message, {
      status: 401,
      retryable: false,
      details: {
        message,
        code: ErrorCode.AUTH_REQUIRED,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create an authentication failure error
   */
  static authFailed(message: string = "Invalid API key"): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.AUTH_FAILED, message, {
      status: 401,
      retryable: false,
      details: {
        message,
        code: ErrorCode.AUTH_FAILED,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create a rate limit error
   */
  static rateLimitExceeded(message: string = "Rate limit exceeded", retryAfter?: number): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.RATE_LIMIT_EXCEEDED, message, {
      status: 429,
      retryable: true,
      details: {
        message,
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create a network error
   */
  static network(message: string = "Network error occurred"): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.NETWORK_ERROR, message, {
      retryable: true,
      details: {
        message,
        code: ErrorCode.NETWORK_ERROR,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create a timeout error
   */
  static timeout(message: string = "Request timed out"): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.TIMEOUT_ERROR, message, {
      retryable: true,
      details: {
        message,
        code: ErrorCode.TIMEOUT_ERROR,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create a connection error
   */
  static connection(message: string = "Connection failed"): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.CONNECTION_ERROR, message, {
      retryable: true,
      details: {
        message,
        code: ErrorCode.CONNECTION_ERROR,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create an invalid options error
   */
  static invalidOptions(message: string, details?: Record<string, unknown>): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.INVALID_OPTIONS, message, {
      retryable: false,
      details: {
        message,
        code: ErrorCode.INVALID_OPTIONS,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create a missing API key error
   */
  static missingApiKey(): SecureNotifyError {
    return new SecureNotifyError(
      ErrorCode.MISSING_API_KEY,
      "API key is required for this operation. Please provide an apiKey when initializing the client.",
      {
        retryable: false,
        details: {
          message: "API key is required",
          code: ErrorCode.MISSING_API_KEY,
          timestamp: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * Create an SSE connection error
   */
  static sseConnection(message: string = "SSE connection failed"): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.SSE_CONNECTION_ERROR, message, {
      retryable: true,
      details: {
        message,
        code: ErrorCode.SSE_CONNECTION_ERROR,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create an SSE heartbeat timeout error
   */
  static sseHeartbeatTimeout(message: string = "SSE heartbeat timeout"): SecureNotifyError {
    return new SecureNotifyError(ErrorCode.SSE_HEARTBEAT_TIMEOUT, message, {
      retryable: true,
      details: {
        message,
        code: ErrorCode.SSE_HEARTBEAT_TIMEOUT,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Convert to JSON object
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      retryable: this.retryable,
      timestamp: this.timestamp,
      details: this.details,
    };
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `SecureNotifyError[${this.code}]: ${this.message}`;
  }
}

/**
 * Type guard for SecureNotifyError
 */
export function isSecureNotifyError(error: unknown): error is SecureNotifyError {
  return error instanceof SecureNotifyError;
}

/**
 * Assert that a value is not null or undefined
 */
export function assertNotNull<T>(value: T | null | undefined, message: string = "Value cannot be null"): T {
  if (value === null || value === undefined) {
    throw SecureNotifyError.validation(message);
  }
  return value;
}

/**
 * Assert that a condition is true
 */
export function assert(condition: boolean, message: string = "Assertion failed"): void {
  if (!condition) {
    throw SecureNotifyError.validation(message);
  }
}

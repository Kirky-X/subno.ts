// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import crypto from 'crypto';

/**
 * Generate a unique error ID for tracking
 */
export function generateErrorId(): string {
  return crypto.randomUUID().substring(0, 8);
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Structured error information
 */
export interface AppError {
  id: string;
  message: string;
  code: string;
  severity: ErrorSeverity;
  timestamp: Date;
  path?: string;
  method?: string;
  userId?: string;
  originalError?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Create a structured error
 */
export function createError(
  message: string,
  code: string,
  severity: ErrorSeverity = 'medium',
  originalError?: unknown,
  metadata?: Record<string, unknown>
): AppError {
  return {
    id: generateErrorId(),
    message,
    code,
    severity,
    timestamp: new Date(),
    originalError,
    metadata,
  };
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    errorId: string;
    timestamp: string;
  };
}

/**
 * Create a standardized error response
 * Masks internal error details in production
 */
export function createErrorResponse(error: AppError, includeDetails = false): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      message: includeDetails ? error.message : 'An unexpected error occurred',
      code: error.code,
      errorId: error.id,
      timestamp: error.timestamp.toISOString(),
    },
  };

  // In production, always mask the message
  if (process.env.NODE_ENV === 'production' && !includeDetails) {
    response.error.message = 'An unexpected error occurred';
  }

  return response;
}

/**
 * Handle and format errors consistently
 */
export function handleError(
  error: unknown,
  code: string,
  severity: ErrorSeverity = 'medium',
  path?: string,
  method?: string
): AppError {
  const appError = createError(
    error instanceof Error ? error.message : 'Unknown error',
    code,
    severity,
    error,
    { path, method }
  );

  // Log the full error for debugging (in production, use proper logging)
  const logData = {
    errorId: appError.id,
    code: appError.code,
    severity: appError.severity,
    message: appError.message,
    stack: error instanceof Error ? error.stack : undefined,
    path,
    method,
    timestamp: appError.timestamp.toISOString(),
  };

  if (severity === 'critical') {
    console.error('[CRITICAL]', JSON.stringify(logData));
  } else if (severity === 'high') {
    console.error('[HIGH]', JSON.stringify(logData));
  } else {
    console.warn('[ERROR]', JSON.stringify(logData));
  }

  return appError;
}

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  defaultCode = 'INTERNAL_ERROR',
  defaultSeverity: ErrorSeverity = 'medium'
): T {
  const wrapped = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await handler(...args) as ReturnType<T>;
    } catch (error) {
      handleError(error, defaultCode, defaultSeverity);
      throw error;
    }
  };
  return wrapped as T;
}

/**
 * Common error codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

/**
 * Create a validation error
 */
export function validationError(message: string, metadata?: Record<string, unknown>): AppError {
  return createError(message, ERROR_CODES.VALIDATION_ERROR, 'medium', undefined, metadata);
}

/**
 * Create a not found error
 */
export function notFoundError(resource: string, id?: string): AppError {
  return createError(
    `${resource} not found`,
    ERROR_CODES.NOT_FOUND,
    'low',
    undefined,
    { resource, id }
  );
}

/**
 * Create an unauthorized error
 */
export function unauthorizedError(message = 'Authentication required'): AppError {
  return createError(message, ERROR_CODES.UNAUTHORIZED, 'medium');
}

/**
 * Create a forbidden error
 */
export function forbiddenError(message = 'Access denied'): AppError {
  return createError(message, ERROR_CODES.FORBIDDEN, 'medium');
}

/**
 * Create a rate limit error
 */
export function rateLimitError(retryAfter?: number): AppError {
  return createError(
    'Rate limit exceeded',
    ERROR_CODES.RATE_LIMITED,
    'medium',
    undefined,
    { retryAfter }
  );
}

/**
 * Create an internal error
 */
export function internalError(originalError?: unknown): AppError {
  return handleError(
    originalError || new Error('Internal server error'),
    ERROR_CODES.INTERNAL_ERROR,
    'high'
  );
}

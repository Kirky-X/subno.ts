// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Retry Utility using async-retry
 * Provides robust retry logic with exponential backoff
 */

import retry, { type Options as RetryOptions } from 'async-retry';
import { logger } from './logger';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 30000,
  factor: 2,
  randomize: true,
};

/**
 * Retry operation options
 */
export interface RetryOperationOptions<T> extends Partial<RetryOptions> {
  /** Operation name for logging */
  name?: string;
  /** Whether to log retry attempts */
  logRetries?: boolean;
  /** Custom error handler */
  onError?: (error: Error, attempt: number) => void | Promise<void>;
  /** Function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Operation to retry */
  operation: () => Promise<T>;
}

/**
 * Execute an operation with retry logic
 * @param options - Retry configuration and operation
 * @returns Result of the successful operation
 * @throws Error if all retries exhausted or error is not retryable
 */
export async function withRetry<T>(options: RetryOperationOptions<T>): Promise<T> {
  const {
    name = 'Operation',
    logRetries = true,
    onError,
    isRetryable,
    operation,
    ...retryOptions
  } = options;

  const mergedOptions: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...retryOptions,
  };

  return retry(async bail => {
    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (isRetryable && !isRetryable(err)) {
        bail(err);
        throw err;
      }

      // Log retry attempt
      if (logRetries) {
        logger.warn(
          {
            operation: name,
            error: err.message,
            attemptsRemaining: mergedOptions.retries,
          },
          `${name} failed, will retry...`,
        );
      }

      // Call custom error handler
      if (onError) {
        try {
          await onError(err, mergedOptions.retries!);
        } catch (handlerError) {
          logger.error({ error: handlerError }, 'Error handler failed');
        }
      }

      throw err;
    }
  }, mergedOptions);
}

/**
 * Retry database operations with appropriate settings
 */
export async function withDatabaseRetry<T>(operation: () => Promise<T>, name?: string): Promise<T> {
  return withRetry({
    name: name || 'Database operation',
    retries: 5,
    minTimeout: 500,
    maxTimeout: 10000,
    factor: 2,
    operation,
    isRetryable: error => {
      // Don't retry on constraint violations or syntax errors
      const nonRetryableErrors = [
        'unique violation',
        'foreign key violation',
        'check violation',
        'syntax error',
      ];

      return !nonRetryableErrors.some(msg => error.message.toLowerCase().includes(msg));
    },
  });
}

/**
 * Retry Redis operations with appropriate settings
 */
export async function withRedisRetry<T>(operation: () => Promise<T>, name?: string): Promise<T> {
  return withRetry({
    name: name || 'Redis operation',
    retries: 3,
    minTimeout: 200,
    maxTimeout: 5000,
    factor: 2,
    operation,
    isRetryable: error => {
      // Don't retry on command errors
      const nonRetryableErrors = [
        'unknown command',
        'wrong number of arguments',
        'invalid argument',
      ];

      return !nonRetryableErrors.some(msg => error.message.toLowerCase().includes(msg));
    },
  });
}

/**
 * Retry HTTP requests with appropriate settings
 */
export async function withHttpRetry<T>(operation: () => Promise<T>, name?: string): Promise<T> {
  return withRetry({
    name: name || 'HTTP request',
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2,
    operation,
    isRetryable: error => {
      // Don't retry on client errors (4xx) except 429 (rate limit)
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        const code = error.statusCode;
        return code >= 500 || code === 429;
      }

      // Retry on network errors
      return true;
    },
  });
}

/**
 * Retry SSE connection establishment
 */
export async function withSSERetry<T>(operation: () => Promise<T>, name?: string): Promise<T> {
  return withRetry({
    name: name || 'SSE connection',
    retries: 5,
    minTimeout: 1000,
    maxTimeout: 30000,
    factor: 2.5,
    operation,
    isRetryable: error => {
      // Always retry on connection errors
      return true;
    },
  });
}

/**
 * Create a retryable function that can be called multiple times
 * @param operation - Function to make retryable
 * @param options - Retry options
 * @returns Retryable function
 */
export function createRetryableFunction<T extends unknown[], R>(
  operation: (...args: T) => Promise<R>,
  options: Partial<RetryOptions> & { name?: string } = {},
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    return withRetry({
      name: options.name || operation.name || 'Anonymous operation',
      ...options,
      operation: () => operation(...args),
    });
  };
}

/**
 * Check if an error is likely a transient/network error
 */
export function isTransientError(error: Error): boolean {
  const transientIndicators = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'timeout',
    'temporary failure',
    'network is unreachable',
  ];

  return transientIndicators.some(indicator => error.message.toLowerCase().includes(indicator));
}

/**
 * Wrap a promise with timeout and retry
 */
export async function withTimeoutAndRetry<T>(
  promise: Promise<T>,
  timeoutMs: number,
  options: Partial<RetryOptions> & { name?: string } = {},
): Promise<T> {
  return withRetry({
    name: options.name || 'Timed operation',
    ...options,
    operation: () => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);
    },
  });
}

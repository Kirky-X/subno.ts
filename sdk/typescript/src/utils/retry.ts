// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { SecureNotifyError, isRetryableError } from "../types/errors.js";

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryOnStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry */
  initialDelay?: number;
  /** Maximum delay in milliseconds between retries */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Whether to add random jitter to delays */
  jitter?: boolean;
  /** HTTP status codes that should trigger a retry */
  retryOnStatusCodes?: number[];
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  /** Number of attempts made */
  attempts: number;
  /** Total time spent retrying in milliseconds */
  totalTime: number;
  /** Whether the operation succeeded */
  success: boolean;
  /** The result data if successful */
  data?: T;
  /** The error if the operation failed */
  error?: SecureNotifyError;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  config: Required<RetryConfig>
): number {
  const baseDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  const maxDelay = Math.min(baseDelay, config.maxDelay);

  if (config.jitter) {
    // Add random jitter between 0 and baseDelay
    const jitterAmount = Math.random() * config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
    const delay = Math.min(jitterAmount, config.maxDelay);
    return Math.floor(delay);
  }

  return maxDelay;
}

/**
 * Check if an error should be retried
 */
function shouldRetry(error: SecureNotifyError, config: Required<RetryConfig>): boolean {
  // Check if the error is marked as retryable
  if (error.retryable) {
    return true;
  }

  // Check if the status code matches retryable status codes
  if (config.retryOnStatusCodes.includes(error.status)) {
    return true;
  }

  return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<RetryResult<T>> {
  const finalConfig: Required<RetryConfig> = {
    maxRetries: config?.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries,
    initialDelay: config?.initialDelay ?? DEFAULT_RETRY_OPTIONS.initialDelay,
    maxDelay: config?.maxDelay ?? DEFAULT_RETRY_OPTIONS.maxDelay,
    backoffMultiplier: config?.backoffMultiplier ?? DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    jitter: config?.jitter ?? DEFAULT_RETRY_OPTIONS.jitter,
    retryOnStatusCodes: config?.retryOnStatusCodes ?? DEFAULT_RETRY_OPTIONS.retryOnStatusCodes,
  };

  let attempts = 0;
  let totalTime = 0;
  let lastError: SecureNotifyError | undefined;

  while (attempts <= finalConfig.maxRetries) {
    const startTime = Date.now();

    try {
      const data = await fn();
      const elapsed = Date.now() - startTime;

      return {
        attempts: attempts + 1,
        totalTime: totalTime + elapsed,
        success: true,
        data,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      totalTime += elapsed;
      attempts++;

      if (!(error instanceof SecureNotifyError)) {
        // Convert unknown errors to SecureNotifyError
        lastError = new SecureNotifyError(
          "UNKNOWN",
          `Unknown error: ${(error as Error).message}`
        );
      } else {
        lastError = error as SecureNotifyError;
      }

      // Check if we should retry
      if (attempts > finalConfig.maxRetries || !shouldRetry(lastError, finalConfig)) {
        return {
          attempts,
          totalTime,
          success: false,
          error: lastError,
        };
      }

      // Calculate and wait for the delay
      const delay = calculateDelay(attempts, finalConfig);

      // Check if we should respect Retry-After header
      const retryAfter = lastError.status === 429 ? parseRetryAfter(lastError) : undefined;
      const finalDelay = retryAfter ?? delay;

      await sleep(finalDelay);
    }
  }

  // This should not be reached, but return the last error
  return {
    attempts,
    totalTime,
    success: false,
    error: lastError,
  };
}

/**
 * Parse Retry-After header value
 */
function parseRetryAfter(error: SecureNotifyError): number | undefined {
  // Check if Retry-After is in the details
  if (error.details?.message) {
    // Try to extract seconds from message
    const match = error.details.message.match(/retry after\s+(\d+)\s*sec/i);
    if (match) {
      return parseInt(match[1], 10) * 1000;
    }
  }

  return undefined;
}

/**
 * Create a retryable version of a function
 */
export function createRetryableFunction<T extends (...args: Args) => Promise<Return>, Args extends unknown[], Return>(
  fn: T,
  config?: RetryConfig
): T => {
  return (async (...args: Args): Promise<Return> => {
    const result = await withRetry(() => fn(...args), config);
    if (!result.success) {
      throw result.error;
    }
    return result.data!;
  }) as T;
};

/**
 * Decorator for adding retry logic to class methods
 */
export function withRetryDecorated(
  config?: RetryConfig
): MethodDecorator {
  return function <T>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;

    descriptor.value = (async function (this: unknown, ...args: Parameters<T extends (...args: infer A) => Promise<unknown> ? (...args: A) => Promise<unknown> : never>) {
      const result = await withRetry(() => originalMethod.apply(this, args), config);
      if (!result.success) {
        throw result.error;
      }
      return result.data;
    }) as T extends (...args: infer A) => Promise<infer R> ? (...args: A) => Promise<R> : never;

    return descriptor;
  };
}

/**
 * Utility to check if a request should be retried based on status code
 */
export function isRetryableStatusCode(status: number, config?: RetryConfig): boolean {
  const retryCodes = config?.retryOnStatusCodes ?? DEFAULT_RETRY_OPTIONS.retryOnStatusCodes;
  return retryCodes.includes(status);
}

/**
 * Utility to check if an error is retryable
 */
export function isErrorRetryable(error: SecureNotifyError): boolean {
  return isRetryableError(error.code);
}

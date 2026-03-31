// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Pino Logger Configuration
 * Provides structured logging with high performance
 */

import pino from 'pino';

/**
 * Log levels configuration
 */
const LOG_LEVELS = {
  development: 'debug',
  production: 'info',
  test: 'warn',
} as const;

/**
 * Get current environment
 */
const NODE_ENV = (process.env.NODE_ENV || 'development') as keyof typeof LOG_LEVELS;

/**
 * Create logger instance with pino
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || LOG_LEVELS[NODE_ENV] || 'info',
  transport: NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  } : undefined,
  // Add timestamp in ISO format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  // Enable error serialization
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
    err: (err: Error) => ({
      message: err.message,
      stack: err.stack,
      name: err.name,
    }),
  } as any,
});

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  fatal(message: string, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Create a child logger with additional context
 * @param bindings - Additional context to attach to logs
 * @returns Child logger instance
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

/**
 * Log HTTP request details
 * @param method - HTTP method
 * @param url - Request URL
 * @param statusCode - Response status code
 * @param durationMs - Request duration in milliseconds
 */
export function logHttpRequest(
  method: string,
  url: string,
  statusCode: number,
  durationMs: number
): void {
  const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  logger[logLevel]({
    type: 'http_request',
    method,
    url,
    statusCode,
    durationMs,
  }, `${method} ${url} - ${statusCode} (${durationMs}ms)`);
}

/**
 * Log database query execution
 * @param query - SQL query or operation name
 * @param durationMs - Query duration in milliseconds
 * @param error - Optional error if query failed
 */
export function logDatabaseQuery(
  query: string,
  durationMs: number,
  error?: Error
): void {
  if (error) {
    logger.error({
      type: 'database_query',
      query,
      durationMs,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    }, `Database query failed: ${query}`);
  } else {
    logger.debug({
      type: 'database_query',
      query,
      durationMs,
    }, `Database query executed: ${query} (${durationMs}ms)`);
  }
}

/**
 * Log Redis operation
 * @param operation - Redis operation name
 * @param key - Redis key
 * @param durationMs - Operation duration in milliseconds
 * @param error - Optional error if operation failed
 */
export function logRedisOperation(
  operation: string,
  key: string,
  durationMs: number,
  error?: Error
): void {
  if (error) {
    logger.error({
      type: 'redis_operation',
      operation,
      key,
      durationMs,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    }, `Redis operation failed: ${operation} on ${key}`);
  } else {
    logger.debug({
      type: 'redis_operation',
      operation,
      key,
      durationMs,
    }, `Redis operation executed: ${operation} on ${key} (${durationMs}ms)`);
  }
}

/**
 * Log security event
 * @param event - Security event type
 * @param details - Event details
 */
export function logSecurityEvent(event: string, details: Record<string, unknown>): void {
  logger.warn({
    type: 'security_event',
    event,
    ...details,
  }, `Security event: ${event}`);
}

/**
 * Log rate limit exceeded
 * @param identifier - Rate limited identifier (IP, user ID, etc.)
 * @param limit - Rate limit value
 * @param windowSeconds - Time window in seconds
 */
export function logRateLimitExceeded(
  identifier: string,
  limit: number,
  windowSeconds: number
): void {
  logger.warn({
    type: 'rate_limit_exceeded',
    identifier,
    limit,
    windowSeconds,
  }, `Rate limit exceeded for ${identifier}`);
}

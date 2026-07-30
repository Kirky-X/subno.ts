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
  // eslint-disable-next-line security/detect-object-injection -- NODE_ENV 受 keyof typeof LOG_LEVELS 约束，安全
  level: process.env.LOG_LEVEL ?? LOG_LEVELS[NODE_ENV] ?? 'info',
  transport:
    NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pino formatters 类型与实际结构不完全一致
  } as any,
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Rate limit configuration
 * All configurable values are loaded from environment variables with bounds checking
 */

import { parseEnvInt } from '../utils/env.utils';

// Time window for rate limiting in seconds (1-3600 seconds = 1 hour)
const RATE_LIMIT_WINDOW_SECONDS = parseEnvInt('RATE_LIMIT_WINDOW_SECONDS', 60, 1, 3600);

// Maximum requests per window for different endpoint types (1-10000)
const RATE_LIMIT_DEFAULT = parseEnvInt('RATE_LIMIT_DEFAULT', 100, 1, 10000);
const RATE_LIMIT_PUBLISH = parseEnvInt('RATE_LIMIT_PUBLISH', 10, 1, 10000);
const RATE_LIMIT_REGISTER = parseEnvInt('RATE_LIMIT_REGISTER', 5, 1, 1000);
const RATE_LIMIT_SUBSCRIBE = parseEnvInt('RATE_LIMIT_SUBSCRIBE', 5, 1, 10000);
const RATE_LIMIT_REVOKE = parseEnvInt('RATE_LIMIT_REVOKE', 20, 1, 10000);

// Cleanup interval in milliseconds (60000-3600000 = 1 minute to 1 hour)
const RATE_LIMIT_CLEANUP_INTERVAL_MS = parseEnvInt('RATE_LIMIT_CLEANUP_INTERVAL_MS', 300000, 60000, 3600000);

// Maximum requests per window
export const RATE_LIMIT_CONFIG = {
  windowMs: RATE_LIMIT_WINDOW_SECONDS * 1000,
  maxRequests: {
    default: RATE_LIMIT_DEFAULT,
    publish: RATE_LIMIT_PUBLISH,
    register: RATE_LIMIT_REGISTER,
    subscribe: RATE_LIMIT_SUBSCRIBE,
    revoke: RATE_LIMIT_REVOKE,
  },
  cleanupIntervalMs: RATE_LIMIT_CLEANUP_INTERVAL_MS,
} as const;

/**
 * Get the rate limit configuration for a specific endpoint type
 * Falls back to 'default' if the type is not configured
 */
export function getRateLimitConfig(type: string): typeof RATE_LIMIT_CONFIG.maxRequests['default'] {
  return RATE_LIMIT_CONFIG.maxRequests[type as keyof typeof RATE_LIMIT_CONFIG.maxRequests]
    ?? RATE_LIMIT_CONFIG.maxRequests.default;
}

/**
 * Get the time window in milliseconds
 */
export function getRateLimitWindowMs(): number {
  return RATE_LIMIT_CONFIG.windowMs;
}

/**
 * Get the cleanup interval in milliseconds
 */
export function getCleanupIntervalMs(): number {
  return RATE_LIMIT_CONFIG.cleanupIntervalMs;
}

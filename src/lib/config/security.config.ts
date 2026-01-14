// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Security configuration
 * All configurable values are loaded from environment variables
 */

/**
 * Validate and parse PBKDF2 iterations with bounds checking
 */
function parsePbkdf2Iterations(): number {
  const minIterations = 100000;
  const maxIterations = 1000000;
  const value = parseInt(process.env.PBKDF2_ITERATIONS || '100000', 10);
  if (isNaN(value) || value < minIterations) return minIterations;
  if (value > maxIterations) return maxIterations;
  return value;
}

export const SECURITY_CONFIG = {
  pbkdf2Iterations: parsePbkdf2Iterations(),
  hashLength: 64,
  saltLength: 32,
  maxAttempts: 5,
  lockoutDurationMinutes: 60,
} as const;

export type SecurityConfig = typeof SECURITY_CONFIG;

export function getSecurityConfig(): typeof SECURITY_CONFIG {
  return SECURITY_CONFIG;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Environment variable parsing utilities
 */

export function parseEnvInt(
  key: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  const value = parseInt(process.env[key] || String(defaultValue), 10);
  if (isNaN(value) || value < min) return defaultValue;
  if (value > max) return max;
  return value;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return typeof value === 'string' && UUID_V4_REGEX.test(value);
}

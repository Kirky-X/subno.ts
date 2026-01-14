// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import crypto from 'crypto';

/**
 * Constants for security configurations
 */
export const SECURITY_CONFIG = {
  // API Key settings
  API_KEY_MIN_LENGTH: 32,
  API_KEY_MAX_LENGTH: 128,
  
  // Revocation settings
  REVOCATION_REASON_MIN_LENGTH: 10,
  REVOCATION_REASON_MAX_LENGTH: 1000,
  REVOCATION_MAX_ATTEMPTS: 5,
  REVOCATION_LOCKOUT_MINUTES: 60,
  REVOCATION_DEFAULT_EXPIRY_HOURS: 24,
  
  // Batch processing
  BATCH_SIZE: 500,
  
  // Cleanup settings
  DEFAULT_CLEANUP_DAYS: 30,
  DEFAULT_AUDIT_RETENTION_DAYS: 90,
  
  // API Key expiry
  DEFAULT_API_KEY_EXPIRY_DAYS: 365,
} as const;

/**
 * Perform a constant-time string comparison to prevent timing attacks.
 * This function compares two strings in a way that takes the same amount
 * of time regardless of how many characters match.
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Use Buffer for consistent byte-level comparison
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // Constant-time length comparison
  const lengthMatch = crypto.timingSafeEqual(
    Buffer.alloc(1, bufA.length === bufB.length ? 1 : 0),
    Buffer.from([bufA.length === bufB.length ? 1 : 0])
  );

  if (!lengthMatch) {
    return false;
  }

  // Constant-time content comparison
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validate that a string is not empty and within acceptable length bounds.
 * 
 * @param value - String to validate
 * @param minLength - Minimum allowed length
 * @param maxLength - Maximum allowed length
 * @returns true if valid, false otherwise
 */
export function validateLength(
  value: string,
  minLength: number,
  maxLength: number
): boolean {
  return typeof value === 'string' && 
         value.length >= minLength && 
         value.length <= maxLength;
}

/**
 * Check if a string contains invalid control characters.
 * Control characters are characters with ASCII codes 0-31 except tab (9), 
 * line feed (10), and carriage return (13).
 * 
 * @param value - String to check
 * @returns true if invalid characters found, false if clean
 */
export function containsInvalidCharacters(value: string): boolean {
  if (typeof value !== 'string') return true;
  
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    
    // Check for control characters (0-31) excluding tab(9), LF(10), CR(13)
    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
      return true;
    }
    
    // Check for surrogate pairs (invalid in UTF-8)
    if (charCode >= 0xD800 && charCode <= 0xDFFF) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create a sanitized error message that doesn't leak sensitive information.
 * 
 * @param operation - Description of the operation
 * @param id - Optional identifier (will be partially redacted)
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(operation: string, id?: string): string {
  const sanitizedId = id 
    ? `${id.substring(0, 8)}...${id.substring(id.length - 4)}`
    : '';
  
  return sanitizedId 
    ? `Failed to ${operation} record ${sanitizedId}: Operation failed`
    : `Failed to ${operation}: Operation failed`;
}

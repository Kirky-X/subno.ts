// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Header sanitization utilities for security
 */

/**
 * Sensitive header names that should be redacted in logs
 */
export const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'x-auth-token',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-forwarded-for',  // May contain IPs
  'x-real-ip',
] as const;

/**
 * Check if a header name is sensitive
 */
export function isSensitiveHeader(headerName: string): boolean {
  const lowerHeader = headerName.toLowerCase();
  return SENSITIVE_HEADERS.some(sensitive => 
    lowerHeader === sensitive || lowerHeader.includes(sensitive)
  );
}

/**
 * Sanitize a single header value
 * Returns '[REDACTED]' for sensitive headers, original value otherwise
 */
export function sanitizeHeaderValue(headerName: string, value: string): string {
  if (isSensitiveHeader(headerName)) {
    return '[REDACTED]';
  }
  return value;
}

/**
 * Sanitize all headers in a Headers object
 * Returns a new Headers object with sensitive values redacted
 */
export function sanitizeHeaders(headers: Headers): Headers {
  const sanitized = new Headers();
  
  for (const [key, value] of headers.entries()) {
    sanitized.set(key, sanitizeHeaderValue(key, value));
  }
  
  return sanitized;
}

/**
 * Sanitize headers for logging (returns plain object)
 * Returns an object with sensitive header values redacted
 */
export function sanitizeHeadersForLog(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of headers.entries()) {
    sanitized[key] = sanitizeHeaderValue(key, value);
  }
  
  return sanitized;
}

/**
 * Sanitize a single header for logging
 * Returns the header value or '[REDACTED]' if sensitive
 */
export function sanitizeHeaderForLog(headerName: string, value: string): string {
  return sanitizeHeaderValue(headerName, value);
}

/**
 * Check if headers contain any sensitive information
 */
export function headersContainSensitiveInfo(headers: Headers): boolean {
  for (const headerName of SENSITIVE_HEADERS) {
    if (headers.has(headerName)) {
      return true;
    }
  }
  return false;
}

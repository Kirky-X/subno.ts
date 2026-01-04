// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';

// CORS configuration (kept for reference, actual CORS handled by middleware)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
];

/**
 * Get the origin from request headers
 */
export function getOrigin(request: NextRequest): string | null {
  return (
    request.headers.get('origin') ||
    request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
    null
  );
}

/**
 * Validate if the origin is allowed
 */
export function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes('*')) return true;
  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed.endsWith('*')) {
      const base = allowed.slice(0, -1);
      return origin.startsWith(base);
    }
    return origin === allowed;
  });
}

/**
 * Get client's real IP address with validation
 */
export function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    for (const ip of ips) {
      if (isValidIP(ip) && !isPrivateIP(ip)) {
        return ip;
      }
    }
    return ips[0] || '127.0.0.1';
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }

  return '127.0.0.1';
}

/**
 * Basic IP validation
 */
function isValidIP(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Check if IP is a private/internal IP
 */
function isPrivateIP(ip: string): boolean {
  const ipv4Private = /^((10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.))/;
  if (ipv4Private.test(ip)) return true;
  if (ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  return false;
}

/**
 * Create error response
 * Note: CORS headers are now handled by middleware
 */
export function createErrorResponse(
  request: NextRequest,
  status: number,
  message: string,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: code || `HTTP_${status}`,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Rate limit key extractor with proper IP validation
 */
export function getRateLimitKey(request: NextRequest): string {
  const ip = getClientIP(request);
  const apiKey = request.headers.get('x-api-key');

  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  return `ip:${ip}`;
}

/**
 * Security headers for all responses (kept for backward compatibility)
 * Note: These are now applied by middleware automatically
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}

/**
 * Apply security headers to response
 * Note: Now a no-op since middleware handles this
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  return response;
}

/**
 * Add CORS headers to response
 * Note: Now a no-op since middleware handles CORS automatically
 */
export function withCors(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  return response;
}

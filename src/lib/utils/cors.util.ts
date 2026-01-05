// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';

// CORS configuration (kept for backward compatibility)
// Note: Actual CORS is now handled by middleware.ts
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:8080',
  'http://localhost:3001',
];

/**
 * Deprecated: ORIGIN validation is now handled by middleware
 * This function is kept for backward compatibility only
 * @deprecated Use middleware.ts for CORS validation
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
export function isValidIP(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Check if IP is a private/internal IP
 * Supports both IPv4 and IPv6 private address ranges
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 private addresses
  // 10.0.0.0/8
  // 172.16.0.0/12 (172.16-172.31)
  // 192.168.0.0/16
  // 127.0.0.0/8 (loopback)
  // 169.254.0.0/16 (link-local)
  const ipv4Private = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.)/;

  if (ipv4Private.test(ip)) return true;

  // IPv6 private and special addresses
  // fc00::/7 - Unique local addresses (ULA)
  // fd00::/8 - ULA prefix
  // fe80::/10 - Link-local addresses
  // ::1/128 - Loopback address
  // ::/128 - Unspecified address
  const ipv6Private = /^(?:fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe[89ab][0-9a-f]:|::1$|::$)/i;

  if (ipv6Private.test(ip)) return true;

  return false;
}

/**
 * Check if IP is allowed to access cron endpoints
 * Whitelist-based approach for better security
 */
export function isCronIPAllowed(ip: string): boolean {
  // Get allowed IPs from environment variable
  const allowedIPs = process.env.CRON_ALLOWED_IPS?.split(',') || [];

  // If no whitelist configured, deny all (fail-closed)
  if (allowedIPs.length === 0) {
    return false;
  }

  // Check if IP is in whitelist
  return allowedIPs.some(allowed => {
    const trimmed = allowed.trim();
    // Support CIDR notation (basic implementation for /32 and /128)
    if (trimmed.includes('/')) {
      const [baseIp, prefix] = trimmed.split('/');
      // For single IP (prefix 32 for IPv4, 128 for IPv6)
      if (prefix === '32' || prefix === '128') {
        return ip === baseIp;
      }
      // Note: For full CIDR support, consider using a library like 'ip-range-check'
      return false;
    }
    // Exact match
    return ip === trimmed;
  });
}

/**
 * Create error response
 * Note: CORS headers are now handled by middleware
 */
export function createErrorResponse(
  _request: NextRequest,
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
 * Apply security headers to response
 * Note: Now a no-op since middleware handles this
 * Kept for backward compatibility
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  return response;
}

/**
 * Add CORS headers to response
 * Note: Now a no-op since middleware handles CORS automatically
 * Kept for backward compatibility
 */
export function withCors(
  _request: NextRequest,
  response: NextResponse
): NextResponse {
  return response;
}

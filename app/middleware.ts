// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, createRateLimitedResponse } from '@/src/lib/middleware/rate-limit';
import {
  getCorsConfigCached,
  createCorsHeaders,
  createPreflightHeaders,
} from '@/src/lib/config/cors.config';

// Paths that should be rate limited
const RATE_LIMITED_PATHS = ['/api/'];

// Paths that should be excluded from rate limiting
const EXCLUDED_PATHS = [
  '/api/health',
  '/api/ready',
];

/**
 * Handle CORS preflight (OPTIONS) requests
 * Returns appropriate CORS headers for preflight requests
 */
function handlePreflight(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const requestHeaders = request.headers.get('access-control-request-headers');
  const requestMethod = request.headers.get('access-control-request-method');
  
  const config = getCorsConfigCached();
  const headers = createPreflightHeaders(origin, requestHeaders, requestMethod, config);
  
  // If origin is not allowed, return 403 Forbidden
  if (!headers['Access-Control-Allow-Origin']) {
    return new NextResponse(null, {
      status: 403,
      statusText: 'Forbidden - Origin not allowed',
    });
  }
  
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Add CORS headers to a response
 */
function addCorsHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');
  const config = getCorsConfigCached();
  const headers = createCorsHeaders(origin, config);
  
  // Add CORS headers to response
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle CORS preflight requests first
  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  // Skip non-API paths
  if (!RATE_LIMITED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip excluded paths
  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    const response = NextResponse.next();
    return addCorsHeaders(request, response);
  }

  // Apply rate limiting (async)
  const result = await rateLimit(request);

  if (!result.success) {
    // Return rate limited response with CORS headers
    const response = createRateLimitedResponse(result);
    return addCorsHeaders(request, response);
  }

  // Continue with the request
  const response = NextResponse.next();

  // Add rate limit headers to successful responses
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

  // Add CORS headers
  return addCorsHeaders(request, response);
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};

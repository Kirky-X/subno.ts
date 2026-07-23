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

function handlePreflight(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const requestHeaders = request.headers.get('access-control-request-headers');
  const requestMethod = request.headers.get('access-control-request-method');

  const config = getCorsConfigCached();
  const headers = createPreflightHeaders(origin, requestHeaders, requestMethod, config);

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

function addCorsHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');
  const config = getCorsConfigCached();
  const headers = createCorsHeaders(origin, config);

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  if (!RATE_LIMITED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    const response = NextResponse.next();
    return addCorsHeaders(request, response);
  }

  const result = await rateLimit(request);

  if (!result.success) {
    const response = createRateLimitedResponse(result);
    return addCorsHeaders(request, response);
  }

  const response = NextResponse.next();

  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

  return addCorsHeaders(request, response);
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};

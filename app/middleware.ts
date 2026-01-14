// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, createRateLimitedResponse } from '@/src/lib/middleware/rate-limit';

// Paths that should be rate limited
const RATE_LIMITED_PATHS = ['/api/'];

// Paths that should be excluded from rate limiting
const EXCLUDED_PATHS = [
  '/api/health',
  '/api/ready',
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip non-API paths
  if (!RATE_LIMITED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip excluded paths
  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Apply rate limiting
  const result = rateLimit(request);

  if (!result.success) {
    // Return rate limited response
    return createRateLimitedResponse('Too many requests, please try again later', result);
  }

  // Continue with the request
  const response = NextResponse.next();

  // Add rate limit headers to successful responses
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};

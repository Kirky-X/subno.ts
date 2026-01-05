// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:8080',
  'http://localhost:3001',
];

// Only allow all origins in development
const isDevelopment = process.env.NODE_ENV === 'development' ||
  !process.env.NODE_ENV;

const ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Request-ID',
  'X-Client-Version',
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

function isOriginAllowed(origin: string): boolean {
  // In development, be more permissive
  if (isDevelopment) {
    return true;
  }

  // In production, strict origin checking
  if (ALLOWED_ORIGINS.includes('*')) {
    // Never allow wildcard in production
    if (process.env.NODE_ENV === 'production') {
      console.error('SECURITY ERROR: Wildcard origin (*) is not allowed in production!');
      return false;
    }
    return false; // Never allow wildcard explicitly
  }
  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed.endsWith('*')) {
      const base = allowed.slice(0, -1);
      return origin.startsWith(base);
    }
    return origin === allowed;
  });
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Handle CORS
  const origin = request.headers.get('origin');
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // No origin header (same origin request)
    // Do nothing
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    ALLOWED_METHODS.join(', ')
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    ALLOWED_HEADERS.join(', ')
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (request.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin)) {
      return new NextResponse('Origin not allowed', { status: 403 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || '',
        'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
        'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};

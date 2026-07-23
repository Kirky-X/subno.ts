// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
}

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'X-Api-Key',
  'X-Request-Id',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
];

const DEFAULT_EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Request-Id',
];

function parseAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;

  if (!envOrigins) {
    if (process.env.NODE_ENV === 'development') {
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ];
    }
    // In production, no default origins - must be explicitly configured
    console.warn('CORS_ORIGINS not configured for production environment');
    return [];
  }

  return envOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    // Only allow http and https protocols
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

export function getCorsConfig(): CorsConfig {
  const rawOrigins = parseAllowedOrigins();
  const allowedOrigins = rawOrigins.filter(isValidOrigin).map(normalizeOrigin);

  const invalidOrigins = rawOrigins.filter(origin => !isValidOrigin(origin));
  if (invalidOrigins.length > 0) {
    console.warn(`Invalid CORS origins detected and ignored: ${invalidOrigins.join(', ')}`);
  }

  return {
    allowedOrigins,
    allowedMethods: DEFAULT_ALLOWED_METHODS,
    allowedHeaders: DEFAULT_ALLOWED_HEADERS,
    exposedHeaders: DEFAULT_EXPOSED_HEADERS,
    allowCredentials: true,
    maxAge: 86400, // 24 hours - preflight cache duration
  };
}

export function isOriginAllowed(origin: string | null, config: CorsConfig): boolean {
  if (!origin) {
    // No origin header (e.g., same-origin requests, mobile apps, curl)
    // Allow these requests but don't add CORS headers
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return config.allowedOrigins.includes(normalizedOrigin);
}

// Supports wildcard subdomains (e.g., *.example.com)
export function isOriginMatch(origin: string | null, config: CorsConfig): boolean {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (config.allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;

    for (const allowedOrigin of config.allowedOrigins) {
      // Check for wildcard pattern (e.g., https://*.example.com)
      if (allowedOrigin.includes('*.')) {
        try {
          const allowedUrl = new URL(allowedOrigin.replace('*.', ''));
          const allowedDomain = allowedUrl.hostname;

          // *.example.com should match sub.example.com but NOT example.com
          if (originHost.endsWith(`.${allowedDomain}`)) {
            // Also verify protocol matches
            if (originUrl.protocol === allowedUrl.protocol) {
              return true;
            }
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    return false;
  }

  return false;
}

export function createCorsHeaders(
  origin: string | null,
  config: CorsConfig,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!isOriginMatch(origin, config)) {
    return headers;
  }

  headers['Access-Control-Allow-Origin'] = origin!;

  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (config.exposedHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
  }

  return headers;
}

export function createPreflightHeaders(
  origin: string | null,
  requestHeaders: string | null,
  requestMethod: string | null,
  config: CorsConfig,
): Record<string, string> {
  const headers = createCorsHeaders(origin, config);

  if (!headers['Access-Control-Allow-Origin']) {
    return headers;
  }

  headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');

  // Use request headers if provided and valid, otherwise use defaults
  if (requestHeaders) {
    const requestedHeaders = requestHeaders.split(',').map(h => h.trim().toLowerCase());

    const validHeaders = config.allowedHeaders.filter(h =>
      requestedHeaders.includes(h.toLowerCase()),
    );

    if (validHeaders.length > 0) {
      headers['Access-Control-Allow-Headers'] = validHeaders.join(', ');
    } else {
      headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
    }
  } else {
    headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
  }

  headers['Access-Control-Max-Age'] = config.maxAge.toString();

  return headers;
}

let cachedConfig: CorsConfig | null = null;

export function getCorsConfigCached(): CorsConfig {
  if (!cachedConfig) {
    cachedConfig = getCorsConfig();
  }
  return cachedConfig;
}

export function clearCorsConfigCache(): void {
  cachedConfig = null;
}

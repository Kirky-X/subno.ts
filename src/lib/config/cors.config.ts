// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 * Provides secure and configurable CORS policy for the API
 */

/**
 * CORS configuration interface
 */
export interface CorsConfig {
  /** List of allowed origins */
  allowedOrigins: string[];
  /** Allowed HTTP methods */
  allowedMethods: string[];
  /** Allowed request headers */
  allowedHeaders: string[];
  /** Headers exposed to the client */
  exposedHeaders: string[];
  /** Whether credentials (cookies, authorization headers) are allowed */
  allowCredentials: boolean;
  /** Max age for preflight cache in seconds */
  maxAge: number;
}

/**
 * Default allowed methods
 */
const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

/**
 * Default allowed headers
 */
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

/**
 * Default exposed headers (headers the client can read)
 */
const DEFAULT_EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Request-Id',
];

/**
 * Parse allowed origins from environment variable
 * Supports comma-separated list of origins
 */
function parseAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;

  if (!envOrigins) {
    // Default origins based on environment
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

/**
 * Validate origin format
 * Ensures origin is a valid URL
 */
function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    // Only allow http and https protocols
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize origin by removing trailing slash
 */
function normalizeOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

/**
 * Get CORS configuration
 * Loads settings from environment variables with sensible defaults
 */
export function getCorsConfig(): CorsConfig {
  const rawOrigins = parseAllowedOrigins();
  const allowedOrigins = rawOrigins.filter(isValidOrigin).map(normalizeOrigin);

  // Warn about invalid origins
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

/**
 * Check if an origin is allowed
 * Performs exact match against the allowed origins list
 */
export function isOriginAllowed(origin: string | null, config: CorsConfig): boolean {
  if (!origin) {
    // No origin header (e.g., same-origin requests, mobile apps, curl)
    // Allow these requests but don't add CORS headers
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return config.allowedOrigins.includes(normalizedOrigin);
}

/**
 * Check if origin matches using pattern matching
 * Supports wildcard subdomains (e.g., *.example.com)
 */
export function isOriginMatch(origin: string | null, config: CorsConfig): boolean {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  // First try exact match
  if (config.allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // Then try wildcard pattern matching
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;

    for (const allowedOrigin of config.allowedOrigins) {
      // Check for wildcard pattern (e.g., https://*.example.com)
      if (allowedOrigin.includes('*.')) {
        try {
          const allowedUrl = new URL(allowedOrigin.replace('*.', ''));
          const allowedDomain = allowedUrl.hostname;

          // Check if origin is a subdomain of the allowed domain
          // *.example.com should match sub.example.com but NOT example.com
          if (originHost.endsWith(`.${allowedDomain}`)) {
            // Also verify protocol matches
            if (originUrl.protocol === allowedUrl.protocol) {
              return true;
            }
          }
        } catch {
          // Invalid URL pattern, skip
          continue;
        }
      }
    }
  } catch {
    // Invalid origin URL
    return false;
  }

  return false;
}

/**
 * Create CORS headers for a response
 * Only adds headers if the origin is allowed
 */
export function createCorsHeaders(
  origin: string | null,
  config: CorsConfig,
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Check if origin is allowed (supports both exact match and wildcard)
  if (!isOriginMatch(origin, config)) {
    return headers;
  }

  // Set the allowed origin
  headers['Access-Control-Allow-Origin'] = origin!;

  // Set credentials flag
  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // Set exposed headers
  if (config.exposedHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
  }

  return headers;
}

/**
 * Create preflight response headers
 * Used for OPTIONS requests
 */
export function createPreflightHeaders(
  origin: string | null,
  requestHeaders: string | null,
  requestMethod: string | null,
  config: CorsConfig,
): Record<string, string> {
  const headers = createCorsHeaders(origin, config);

  // If origin not allowed, return empty headers
  if (!headers['Access-Control-Allow-Origin']) {
    return headers;
  }

  // Set allowed methods
  headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');

  // Set allowed headers
  // Use request headers if provided and valid, otherwise use defaults
  if (requestHeaders) {
    // Validate and filter request headers
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

  // Set max age for preflight cache
  headers['Access-Control-Max-Age'] = config.maxAge.toString();

  return headers;
}

/**
 * Cached CORS config for performance
 */
let cachedConfig: CorsConfig | null = null;

/**
 * Get cached CORS configuration
 * Caches the config to avoid re-parsing on every request
 */
export function getCorsConfigCached(): CorsConfig {
  if (!cachedConfig) {
    cachedConfig = getCorsConfig();
  }
  return cachedConfig;
}

/**
 * Clear cached CORS configuration
 * Useful for testing or when config changes
 */
export function clearCorsConfigCache(): void {
  cachedConfig = null;
}

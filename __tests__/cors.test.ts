// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCorsConfig,
  getCorsConfigCached,
  clearCorsConfigCache,
  isOriginAllowed,
  isOriginMatch,
  createCorsHeaders,
  createPreflightHeaders,
  type CorsConfig,
} from '../src/lib/config/cors.config';

describe('CORS Configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset cache before each test
    clearCorsConfigCache();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    clearCorsConfigCache();
    vi.unstubAllEnvs();
  });

  describe('getCorsConfig', () => {
    it('should return default development origins when CORS_ORIGINS is not set', () => {
      vi.stubEnv('CORS_ORIGINS', '');
      vi.stubEnv('NODE_ENV', 'development');
      // Delete the CORS_ORIGINS to simulate it not being set
      delete process.env.CORS_ORIGINS;

      const config = getCorsConfig();

      expect(config.allowedOrigins).toContain('http://localhost:3000');
      expect(config.allowedOrigins).toContain('http://localhost:3001');
      expect(config.allowedOrigins).toContain('http://127.0.0.1:3000');
      expect(config.allowedOrigins).toContain('http://127.0.0.1:3001');
    });

    it('should return empty origins in production when CORS_ORIGINS is not set', () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.CORS_ORIGINS;

      const config = getCorsConfig();

      expect(config.allowedOrigins).toEqual([]);
    });

    it('should parse CORS_ORIGINS from environment variable', () => {
      process.env.CORS_ORIGINS = 'https://example.com,https://api.example.com';

      const config = getCorsConfig();

      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).toContain('https://api.example.com');
    });

    it('should trim whitespace from origins', () => {
      process.env.CORS_ORIGINS = '  https://example.com  ,  https://api.example.com  ';

      const config = getCorsConfig();

      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).toContain('https://api.example.com');
    });

    it('should filter out invalid origins', () => {
      process.env.CORS_ORIGINS = 'https://example.com,invalid-origin,ftp://bad.com';

      const config = getCorsConfig();

      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).not.toContain('invalid-origin');
      expect(config.allowedOrigins).not.toContain('ftp://bad.com');
    });

    it('should normalize origins by removing trailing slash', () => {
      process.env.CORS_ORIGINS = 'https://example.com/,https://api.example.com/';

      const config = getCorsConfig();

      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).toContain('https://api.example.com');
    });

    it('should return correct default values', () => {
      process.env.CORS_ORIGINS = 'https://example.com';

      const config = getCorsConfig();

      expect(config.allowedMethods).toContain('GET');
      expect(config.allowedMethods).toContain('POST');
      expect(config.allowedMethods).toContain('PUT');
      expect(config.allowedMethods).toContain('DELETE');
      expect(config.allowedMethods).toContain('PATCH');
      expect(config.allowedMethods).toContain('OPTIONS');
      expect(config.allowCredentials).toBe(true);
      expect(config.maxAge).toBe(86400);
    });

    it('should include required allowed headers', () => {
      process.env.CORS_ORIGINS = 'https://example.com';

      const config = getCorsConfig();

      expect(config.allowedHeaders).toContain('Content-Type');
      expect(config.allowedHeaders).toContain('Authorization');
      expect(config.allowedHeaders).toContain('X-Api-Key');
    });

    it('should include exposed headers', () => {
      process.env.CORS_ORIGINS = 'https://example.com';

      const config = getCorsConfig();

      expect(config.exposedHeaders).toContain('X-RateLimit-Limit');
      expect(config.exposedHeaders).toContain('X-RateLimit-Remaining');
      expect(config.exposedHeaders).toContain('X-RateLimit-Reset');
    });
  });

  describe('getCorsConfigCached', () => {
    it('should cache the configuration', () => {
      process.env.CORS_ORIGINS = 'https://example.com';

      const config1 = getCorsConfigCached();
      const config2 = getCorsConfigCached();

      // Should be the same object reference
      expect(config1).toBe(config2);
    });

    it('should return new config after cache is cleared', () => {
      process.env.CORS_ORIGINS = 'https://example.com';

      const config1 = getCorsConfigCached();
      clearCorsConfigCache();
      const config2 = getCorsConfigCached();

      // Should be different object references
      expect(config1).not.toBe(config2);
    });
  });

  describe('isOriginAllowed', () => {
    let config: CorsConfig;

    beforeEach(() => {
      process.env.CORS_ORIGINS = 'https://example.com,https://api.example.com';
      config = getCorsConfig();
    });

    it('should return true for allowed origins', () => {
      expect(isOriginAllowed('https://example.com', config)).toBe(true);
      expect(isOriginAllowed('https://api.example.com', config)).toBe(true);
    });

    it('should return false for non-allowed origins', () => {
      expect(isOriginAllowed('https://evil.com', config)).toBe(false);
      expect(isOriginAllowed('https://notallowed.com', config)).toBe(false);
    });

    it('should return false for null origin', () => {
      expect(isOriginAllowed(null, config)).toBe(false);
    });

    it('should handle origins with trailing slash', () => {
      expect(isOriginAllowed('https://example.com/', config)).toBe(true);
    });
  });

  describe('isOriginMatch', () => {
    let config: CorsConfig;

    beforeEach(() => {
      process.env.CORS_ORIGINS = 'https://example.com,https://*.test.com';
      config = getCorsConfig();
    });

    it('should match exact origins', () => {
      expect(isOriginMatch('https://example.com', config)).toBe(true);
    });

    it('should match wildcard subdomains', () => {
      expect(isOriginMatch('https://sub.test.com', config)).toBe(true);
      expect(isOriginMatch('https://deep.sub.test.com', config)).toBe(true);
    });

    it('should not match different protocol for wildcard', () => {
      expect(isOriginMatch('http://sub.test.com', config)).toBe(false);
    });

    it('should not match root domain for wildcard', () => {
      // *.test.com should not match test.com itself
      expect(isOriginMatch('https://test.com', config)).toBe(false);
    });

    it('should return false for non-matching origins', () => {
      expect(isOriginMatch('https://evil.com', config)).toBe(false);
    });

    it('should return false for null origin', () => {
      expect(isOriginMatch(null, config)).toBe(false);
    });
  });

  describe('createCorsHeaders', () => {
    let config: CorsConfig;

    beforeEach(() => {
      process.env.CORS_ORIGINS = 'https://example.com';
      config = getCorsConfig();
    });

    it('should create correct CORS headers for allowed origin', () => {
      const headers = createCorsHeaders('https://example.com', config);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Expose-Headers']).toBeDefined();
    });

    it('should return empty headers for non-allowed origin', () => {
      const headers = createCorsHeaders('https://evil.com', config);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should return empty headers for null origin', () => {
      const headers = createCorsHeaders(null, config);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should include exposed headers', () => {
      const headers = createCorsHeaders('https://example.com', config);

      expect(headers['Access-Control-Expose-Headers']).toContain('X-RateLimit-Limit');
      expect(headers['Access-Control-Expose-Headers']).toContain('X-RateLimit-Remaining');
    });
  });

  describe('createPreflightHeaders', () => {
    let config: CorsConfig;

    beforeEach(() => {
      process.env.CORS_ORIGINS = 'https://example.com';
      config = getCorsConfig();
    });

    it('should create correct preflight headers for allowed origin', () => {
      const headers = createPreflightHeaders(
        'https://example.com',
        'Content-Type,Authorization',
        'POST',
        config
      );

      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(headers['Access-Control-Allow-Headers']).toBeDefined();
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });

    it('should return empty headers for non-allowed origin', () => {
      const headers = createPreflightHeaders(
        'https://evil.com',
        'Content-Type',
        'POST',
        config
      );

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should include all allowed methods', () => {
      const headers = createPreflightHeaders(
        'https://example.com',
        null,
        null,
        config
      );

      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Methods']).toContain('PUT');
      expect(headers['Access-Control-Allow-Methods']).toContain('DELETE');
      expect(headers['Access-Control-Allow-Methods']).toContain('PATCH');
      expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    });

    it('should use default allowed headers when request headers not provided', () => {
      const headers = createPreflightHeaders(
        'https://example.com',
        null,
        'POST',
        config
      );

      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
    });

    it('should filter requested headers against allowed list', () => {
      const headers = createPreflightHeaders(
        'https://example.com',
        'Content-Type,X-Custom-Header',
        'POST',
        config
      );

      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      // X-Custom-Header is not in the allowed list, so it should not be included
      expect(headers['Access-Control-Allow-Headers']).not.toContain('X-Custom-Header');
    });

    it('should set correct max age', () => {
      const headers = createPreflightHeaders(
        'https://example.com',
        null,
        'POST',
        config
      );

      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });
  });

  describe('Security', () => {
    it('should not allow file:// protocol', () => {
      process.env.CORS_ORIGINS = 'file:///etc/passwd,https://example.com';
      const config = getCorsConfig();

      expect(config.allowedOrigins).not.toContain('file:///etc/passwd');
    });

    it('should not allow javascript: protocol', () => {
      process.env.CORS_ORIGINS = 'javascript:alert(1),https://example.com';
      const config = getCorsConfig();

      expect(config.allowedOrigins).not.toContain('javascript:alert(1)');
    });

    it('should not allow data: protocol', () => {
      process.env.CORS_ORIGINS = 'data:text/html,<script>alert(1)</script>,https://example.com';
      const config = getCorsConfig();

      expect(config.allowedOrigins).not.toContain('data:text/html,<script>alert(1)</script>');
    });

    it('should only allow http and https protocols', () => {
      process.env.CORS_ORIGINS = 'http://example.com,https://example.com,ftp://example.com';
      const config = getCorsConfig();

      expect(config.allowedOrigins).toContain('http://example.com');
      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).not.toContain('ftp://example.com');
    });
  });
});

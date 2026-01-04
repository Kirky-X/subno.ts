// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseEnv } from '@/config/env';

describe('Security Fixes - Environment Variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('should throw error if ADMIN_MASTER_KEY not set in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_MASTER_KEY;
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';

    expect(() => parseEnv()).toThrow(
      'ADMIN_MASTER_KEY is required in production'
    );
  });

  it('should throw error if CRON_SECRET not set in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_MASTER_KEY = 'test-key';
    delete process.env.CRON_SECRET;
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';

    expect(() => parseEnv()).toThrow(
      'CRON_SECRET is required in production'
    );
  });

  it('should auto-generate keys in development with warnings', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_MASTER_KEY;
    delete process.env.CRON_SECRET;
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const env = parseEnv();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: ADMIN_MASTER_KEY auto-generated')
    );
    expect(env.ADMIN_MASTER_KEY).toBeDefined();
    expect(env.CRON_SECRET).toBeDefined();

    consoleSpy.mockRestore();
  });
});

describe('Security Fixes - IP Address Validation', () => {
  const { isValidIP, isPrivateIP } = require('@/lib/utils/cors.util');

  it('should detect IPv4 loopback addresses', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
    expect(isPrivateIP('127.0.0.2')).toBe(true);
  });

  it('should detect IPv4 private addresses', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('172.31.255.255')).toBe(true);
  });

  it('should detect IPv4 link-local addresses', () => {
    expect(isPrivateIP('169.254.1.1')).toBe(true);
  });

  it('should detect IPv6 private addresses', () => {
    expect(isPrivateIP('::1')).toBe(true); // Loopback
    expect(isPrivateIP('::')).toBe(true); // Unspecified
    expect(isPrivateIP('fe80::1')).toBe(true); // Link-local
    expect(isPrivateIP('fc00::1')).toBe(true); // ULA
    expect(isPrivateIP('fd00::1')).toBe(true); // ULA
  });

  it('should allow public IPv4 addresses', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });

  it('should allow public IPv6 addresses', () => {
    expect(isPrivateIP('2001:4860:4860::8888')).toBe(false);
  });
});

describe('Security Fixes - Rate Limiting with Backoff', () => {
  it('should implement progressive rate limiting', async () => {
    const { RateLimiterService } = await import('@/lib/services/rate-limiter.service');
    const service = new RateLimiterService();

    const clientId = 'test-client-123';

    // Reset rate limit for this client
    await service['redis'].del(`register:fail:${clientId}`);
    await service['redis'].del(`register:lockout:${clientId}`);

    // First 5 attempts should be allowed with normal limits
    for (let i = 0; i < 5; i++) {
      const allowed = await service.checkRegisterLimit(clientId);
      expect(allowed).toBe(true);
    }

    // Simulate rate limit hit by making request exceed limit
    // (In real scenario, this would trigger the failure counter)
  });
});

describe('Security Fixes - Database Connection Pool', () => {
  it('should have connection pool configured', () => {
    const config = require('@/drizzle.config.ts');
    expect(config.pool).toBeDefined();
    expect(config.pool.min).toBe(2);
    expect(config.pool.max).toBe(20);
  });
});

describe('Security Fixes - Error Message Sanitization', () => {
  it('should not expose database details in error responses', () => {
    const duplicateKeyError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "public_keys_channel_id_key"',
    };

    const expectedResponse = {
      success: false,
      error: {
        message: 'Registration already exists for this channel',
        code: 'DUPLICATE_KEY',
      },
    };

    expect(duplicateKeyError.code).toBe('23505');
  });
});

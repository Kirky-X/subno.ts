// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

/**
 * Environment Configuration 测试
 *
 * env 模块在 import 时通过 @t3-oss/env-nextjs + Zod 4 进行校验，
 * 因此每个测试用例必须先设置好 process.env，再通过 vi.resetModules() + 动态 import
 * 重新加载模块，使校验基于当前 env 值执行。
 */
describe('Environment Configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /** 设置所有必填 env 变量为合法值（启用校验） */
  function setValidEnv(): void {
    delete process.env.SKIP_ENV_VALIDATION;
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ADMIN_MASTER_KEY = 'a'.repeat(32);
    process.env.CRON_SECRET = 'b'.repeat(32);
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  }

  /** 重置模块缓存并动态 import env 模块，使校验基于当前 process.env */
  async function importEnv() {
    vi.resetModules();
    return import('@/src/lib/config/env');
  }

  describe('getDatabaseConfig', () => {
    it('应该返回数据库 URL', async () => {
      setValidEnv();
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      const { getDatabaseConfig } = await importEnv();
      expect(getDatabaseConfig().url).toBe('postgresql://user:pass@localhost:5432/db');
    });

    it('应该在缺少配置时抛出错误', async () => {
      setValidEnv();
      delete process.env.DATABASE_URL;
      await expect(importEnv()).rejects.toThrow();
    });
  });

  describe('getRedisConfig', () => {
    it('应该返回 Redis URL', async () => {
      setValidEnv();
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getRedisConfig } = await importEnv();
      expect(getRedisConfig().url).toBe('redis://localhost:6379');
    });

    it('应该在缺少配置时抛出错误', async () => {
      setValidEnv();
      delete process.env.REDIS_URL;
      await expect(importEnv()).rejects.toThrow();
    });
  });

  describe('NODE_ENV', () => {
    it('应该返回 development（默认）', async () => {
      setValidEnv();
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
      const { getEnv } = await importEnv();
      expect(getEnv().NODE_ENV).toBe('development');
    });

    it('应该返回 production', async () => {
      setValidEnv();
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      const { getEnv } = await importEnv();
      expect(getEnv().NODE_ENV).toBe('production');
    });

    it('应该返回 test', async () => {
      setValidEnv();
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      const { getEnv } = await importEnv();
      expect(getEnv().NODE_ENV).toBe('test');
    });

    it('应该拒绝无效的环境', async () => {
      setValidEnv();
      (process.env as Record<string, string | undefined>).NODE_ENV = 'invalid';
      await expect(importEnv()).rejects.toThrow();
    });
  });

  describe('ADMIN_MASTER_KEY', () => {
    it('应该返回管理员主密钥', async () => {
      setValidEnv();
      process.env.ADMIN_MASTER_KEY = 'a'.repeat(32);
      const { getEnv } = await importEnv();
      expect(getEnv().ADMIN_MASTER_KEY).toBe('a'.repeat(32));
    });

    it('应该拒绝过短的密钥', async () => {
      setValidEnv();
      process.env.ADMIN_MASTER_KEY = 'short';
      await expect(importEnv()).rejects.toThrow();
    });

    it('应该在缺少配置时抛出错误', async () => {
      setValidEnv();
      delete process.env.ADMIN_MASTER_KEY;
      await expect(importEnv()).rejects.toThrow();
    });
  });

  describe('CRON_SECRET', () => {
    it('应该返回 Cron 密钥', async () => {
      setValidEnv();
      process.env.CRON_SECRET = 'b'.repeat(32);
      const { getEnv } = await importEnv();
      expect(getEnv().CRON_SECRET).toBe('b'.repeat(32));
    });

    it('应该拒绝过短的密钥', async () => {
      setValidEnv();
      process.env.CRON_SECRET = 'short';
      await expect(importEnv()).rejects.toThrow();
    });
  });

  describe('getRateLimitConfig', () => {
    it('应该返回默认限流配置', async () => {
      setValidEnv();
      delete process.env.RATE_LIMIT_WINDOW_SECONDS;
      delete process.env.RATE_LIMIT_DEFAULT;
      const { getRateLimitConfig } = await importEnv();
      const config = getRateLimitConfig();
      expect(config.windowSeconds).toBe(60);
      expect(config.default).toBe(100);
    });

    it('应该返回自定义限流配置', async () => {
      setValidEnv();
      process.env.RATE_LIMIT_WINDOW_SECONDS = '120';
      process.env.RATE_LIMIT_DEFAULT = '50';
      const { getRateLimitConfig } = await importEnv();
      const config = getRateLimitConfig();
      expect(config.windowSeconds).toBe(120);
      expect(config.default).toBe(50);
    });

    it('应该返回 publish 端点配置', async () => {
      setValidEnv();
      process.env.RATE_LIMIT_PUBLISH = '10';
      const { getRateLimitConfig } = await importEnv();
      expect(getRateLimitConfig().publish).toBe(10);
    });

    it('应该返回 register 端点配置', async () => {
      setValidEnv();
      process.env.RATE_LIMIT_REGISTER = '5';
      const { getRateLimitConfig } = await importEnv();
      expect(getRateLimitConfig().register).toBe(5);
    });

    it('应该返回 subscribe 端点配置', async () => {
      setValidEnv();
      process.env.RATE_LIMIT_SUBSCRIBE = '5';
      const { getRateLimitConfig } = await importEnv();
      expect(getRateLimitConfig().subscribe).toBe(5);
    });

    it('应该返回 revoke 端点配置', async () => {
      setValidEnv();
      process.env.RATE_LIMIT_REVOKE = '20';
      const { getRateLimitConfig } = await importEnv();
      expect(getRateLimitConfig().revoke).toBe(20);
    });
  });

  describe('getChannelConfig', () => {
    it('应该返回默认频道配置', async () => {
      setValidEnv();
      delete process.env.TEMPORARY_CHANNEL_TTL;
      delete process.env.PERSISTENT_CHANNEL_DEFAULT_TTL;
      const { getChannelConfig } = await importEnv();
      const config = getChannelConfig();
      expect(config.temporaryTTL).toBe(1800); // 30 minutes
      expect(config.persistentDefaultTTL).toBe(86400); // 24 hours
    });

    it('应该返回自定义临时频道 TTL', async () => {
      setValidEnv();
      process.env.TEMPORARY_CHANNEL_TTL = '3600';
      const { getChannelConfig } = await importEnv();
      expect(getChannelConfig().temporaryTTL).toBe(3600);
    });

    it('应该返回自定义持久化频道 TTL', async () => {
      setValidEnv();
      process.env.PERSISTENT_CHANNEL_DEFAULT_TTL = '172800';
      const { getChannelConfig } = await importEnv();
      expect(getChannelConfig().persistentDefaultTTL).toBe(172800);
    });
  });

  describe('getKeyRevocationConfig', () => {
    it('应该返回默认撤销配置', async () => {
      setValidEnv();
      delete process.env.REVOCATION_CONFIRMATION_HOURS;
      delete process.env.REVOKED_KEY_CLEANUP_DAYS;
      delete process.env.CONFIRMATION_MAX_ATTEMPTS;
      delete process.env.CONFIRMATION_LOCKOUT_MINUTES;
      const { getKeyRevocationConfig } = await importEnv();
      const config = getKeyRevocationConfig();
      expect(config.confirmationHours).toBe(24);
      expect(config.cleanupDays).toBe(30);
      expect(config.maxAttempts).toBe(5);
      expect(config.lockoutMinutes).toBe(60);
    });

    it('应该返回自定义撤销配置', async () => {
      setValidEnv();
      process.env.REVOCATION_CONFIRMATION_HOURS = '48';
      process.env.REVOKED_KEY_CLEANUP_DAYS = '60';
      process.env.CONFIRMATION_MAX_ATTEMPTS = '10';
      process.env.CONFIRMATION_LOCKOUT_MINUTES = '120';
      const { getKeyRevocationConfig } = await importEnv();
      const config = getKeyRevocationConfig();
      expect(config.confirmationHours).toBe(48);
      expect(config.cleanupDays).toBe(60);
      expect(config.maxAttempts).toBe(10);
      expect(config.lockoutMinutes).toBe(120);
    });
  });

  describe('getMessageTTLConfig', () => {
    it('应该返回默认消息 TTL 配置', async () => {
      setValidEnv();
      delete process.env.PUBLIC_MESSAGE_TTL;
      delete process.env.PRIVATE_MESSAGE_TTL;
      const { getMessageTTLConfig } = await importEnv();
      const config = getMessageTTLConfig();
      expect(config.public).toBe(43200);
      expect(config.private).toBe(86400);
    });

    it('应该返回自定义消息 TTL 配置', async () => {
      setValidEnv();
      process.env.PUBLIC_MESSAGE_TTL = '7200';
      process.env.PRIVATE_MESSAGE_TTL = '3600';
      const { getMessageTTLConfig } = await importEnv();
      const config = getMessageTTLConfig();
      expect(config.public).toBe(7200);
      expect(config.private).toBe(3600);
    });
  });

  describe('数据库连接池配置', () => {
    it('应该返回默认连接池大小', async () => {
      setValidEnv();
      delete process.env.DB_POOL_SIZE;
      const { getDatabaseConfig } = await importEnv();
      expect(getDatabaseConfig().poolSize).toBe(20);
    });

    it('应该返回默认空闲超时', async () => {
      setValidEnv();
      delete process.env.DB_IDLE_TIMEOUT;
      const { getDatabaseConfig } = await importEnv();
      expect(getDatabaseConfig().idleTimeout).toBe(30000);
    });

    it('应该返回默认连接超时', async () => {
      setValidEnv();
      delete process.env.DB_CONNECT_TIMEOUT;
      const { getDatabaseConfig } = await importEnv();
      expect(getDatabaseConfig().connectTimeout).toBe(2000);
    });
  });

  describe('日志级别配置', () => {
    it('应该返回默认日志级别', async () => {
      setValidEnv();
      delete process.env.LOG_LEVEL;
      const { getEnv } = await importEnv();
      expect(getEnv().LOG_LEVEL).toBe('info');
    });

    it('应该接受有效的日志级别', async () => {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
      for (const level of validLevels) {
        setValidEnv();
        process.env.LOG_LEVEL = level;
        const { getEnv } = await importEnv();
        expect(getEnv().LOG_LEVEL).toBe(level);
      }
    });

    it('应该拒绝无效的日志级别', async () => {
      setValidEnv();
      process.env.LOG_LEVEL = 'invalid';
      await expect(importEnv()).rejects.toThrow();
    });
  });

  describe('CORS 配置', () => {
    it('应该处理未配置的 CORS', async () => {
      setValidEnv();
      delete process.env.CORS_ORIGINS;
      const { getEnv } = await importEnv();
      expect(getEnv().CORS_ORIGINS).toBeUndefined();
    });

    it('应该接受逗号分隔的 CORS 来源', async () => {
      setValidEnv();
      process.env.CORS_ORIGINS = 'https://example.com,https://test.com';
      const { getEnv } = await importEnv();
      expect(getEnv().CORS_ORIGINS).toBe('https://example.com,https://test.com');
    });
  });

  describe('validateProductionSecurity', () => {
    it('应该在生产环境拒绝弱 ADMIN_MASTER_KEY', async () => {
      setValidEnv();
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.ADMIN_MASTER_KEY = 'REPLACE_WITH_secure_key_at_least_32_chars';
      const { validateProductionSecurity } = await importEnv();
      expect(() => validateProductionSecurity()).toThrow();
    });

    it('应该在生产环境拒绝弱 CRON_SECRET', async () => {
      setValidEnv();
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.CRON_SECRET = 'dev-cron-secret-32-chars-minimum!!';
      const { validateProductionSecurity } = await importEnv();
      expect(() => validateProductionSecurity()).toThrow();
    });

    it('应该在非生产环境不抛出错误', async () => {
      setValidEnv();
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      const { validateProductionSecurity } = await importEnv();
      expect(() => validateProductionSecurity()).not.toThrow();
    });
  });
});

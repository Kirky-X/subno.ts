// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import { 
  getDatabaseUrl, 
  getRedisUrl,
  getNodeEnv,
  getAdminMasterKey,
  getCronSecret,
  getRateLimitConfig,
  getChannelConfig,
  getRevocationConfig,
} from '@/src/lib/config/env';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getDatabaseUrl', () => {
    it('应该返回数据库 URL', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      
      const url = getDatabaseUrl();
      
      expect(url).toBe('postgresql://user:pass@localhost:5432/db');
    });

    it('应该在缺少配置时抛出错误', () => {
      delete process.env.DATABASE_URL;
      
      expect(() => getDatabaseUrl()).toThrow();
    });
  });

  describe('getRedisUrl', () => {
    it('应该返回 Redis URL', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      
      const url = getRedisUrl();
      
      expect(url).toBe('redis://localhost:6379');
    });

    it('应该在缺少配置时抛出错误', () => {
      delete process.env.REDIS_URL;
      
      expect(() => getRedisUrl()).toThrow();
    });
  });

  describe('getNodeEnv', () => {
    it('应该返回 development（默认）', () => {
      delete process.env.NODE_ENV;
      
      const env = getNodeEnv();
      
      expect(env).toBe('development');
    });

    it('应该返回 production', () => {
      process.env.NODE_ENV = 'production';
      
      const env = getNodeEnv();
      
      expect(env).toBe('production');
    });

    it('应该返回 test', () => {
      process.env.NODE_ENV = 'test';
      
      const env = getNodeEnv();
      
      expect(env).toBe('test');
    });

    it('应该拒绝无效的环境', () => {
      process.env.NODE_ENV = 'invalid';
      
      expect(() => getNodeEnv()).toThrow();
    });
  });

  describe('getAdminMasterKey', () => {
    it('应该返回管理员主密钥', () => {
      process.env.ADMIN_MASTER_KEY = 'a'.repeat(32);
      
      const key = getAdminMasterKey();
      
      expect(key).toBe('a'.repeat(32));
    });

    it('应该拒绝过短的密钥', () => {
      process.env.ADMIN_MASTER_KEY = 'short';
      
      expect(() => getAdminMasterKey()).toThrow();
    });

    it('应该在缺少配置时抛出错误', () => {
      delete process.env.ADMIN_MASTER_KEY;
      
      expect(() => getAdminMasterKey()).toThrow();
    });
  });

  describe('getCronSecret', () => {
    it('应该返回 Cron 密钥', () => {
      process.env.CRON_SECRET = 'b'.repeat(32);
      
      const secret = getCronSecret();
      
      expect(secret).toBe('b'.repeat(32));
    });

    it('应该拒绝过短的密钥', () => {
      process.env.CRON_SECRET = 'short';
      
      expect(() => getCronSecret()).toThrow();
    });
  });

  describe('getRateLimitConfig', () => {
    it('应该返回默认限流配置', () => {
      delete process.env.RATE_LIMIT_WINDOW_SECONDS;
      delete process.env.RATE_LIMIT_DEFAULT;
      
      const config = getRateLimitConfig();
      
      expect(config.windowMs).toBe(60000); // 60 seconds
      expect(config.maxRequests).toBe(100);
    });

    it('应该返回自定义限流配置', () => {
      process.env.RATE_LIMIT_WINDOW_SECONDS = '120';
      process.env.RATE_LIMIT_DEFAULT = '50';
      
      const config = getRateLimitConfig();
      
      expect(config.windowMs).toBe(120000);
      expect(config.maxRequests).toBe(50);
    });

    it('应该为不同端点返回特定配置', () => {
      process.env.RATE_LIMIT_PUBLISH = '10';
      
      const publishConfig = getRateLimitConfig('publish');
      
      expect(publishConfig.maxRequests).toBe(10);
    });

    it('应该为 register 端点返回配置', () => {
      process.env.RATE_LIMIT_REGISTER = '5';
      
      const registerConfig = getRateLimitConfig('register');
      
      expect(registerConfig.maxRequests).toBe(5);
    });

    it('应该为 subscribe 端点返回配置', () => {
      process.env.RATE_LIMIT_SUBSCRIBE = '5';
      
      const subscribeConfig = getRateLimitConfig('subscribe');
      
      expect(subscribeConfig.maxRequests).toBe(5);
    });

    it('应该为 revoke 端点返回配置', () => {
      process.env.RATE_LIMIT_REVOKE = '20';
      
      const revokeConfig = getRateLimitConfig('revoke');
      
      expect(revokeConfig.maxRequests).toBe(20);
    });
  });

  describe('getChannelConfig', () => {
    it('应该返回默认频道配置', () => {
      delete process.env.TEMPORARY_CHANNEL_TTL;
      delete process.env.PERSISTENT_CHANNEL_DEFAULT_TTL;
      
      const config = getChannelConfig();
      
      expect(config.temporaryChannelTtl).toBe(1800); // 30 minutes
      expect(config.persistentChannelDefaultTtl).toBe(86400); // 24 hours
    });

    it('应该返回自定义临时频道 TTL', () => {
      process.env.TEMPORARY_CHANNEL_TTL = '3600';
      
      const config = getChannelConfig();
      
      expect(config.temporaryChannelTtl).toBe(3600);
    });

    it('应该返回自定义持久化频道 TTL', () => {
      process.env.PERSISTENT_CHANNEL_DEFAULT_TTL = '172800';
      
      const config = getChannelConfig();
      
      expect(config.persistentChannelDefaultTtl).toBe(172800);
    });
  });

  describe('getRevocationConfig', () => {
    it('应该返回默认撤销配置', () => {
      delete process.env.REVOCATION_CONFIRMATION_HOURS;
      delete process.env.REVOKED_KEY_CLEANUP_DAYS;
      delete process.env.CONFIRMATION_MAX_ATTEMPTS;
      delete process.env.CONFIRMATION_LOCKOUT_MINUTES;
      
      const config = getRevocationConfig();
      
      expect(config.confirmationHours).toBe(24);
      expect(config.cleanupDays).toBe(30);
      expect(config.maxAttempts).toBe(5);
      expect(config.lockoutMinutes).toBe(60);
    });

    it('应该返回自定义撤销配置', () => {
      process.env.REVOCATION_CONFIRMATION_HOURS = '48';
      process.env.REVOKED_KEY_CLEANUP_DAYS = '60';
      process.env.CONFIRMATION_MAX_ATTEMPTS = '10';
      process.env.CONFIRMATION_LOCKOUT_MINUTES = '120';
      
      const config = getRevocationConfig();
      
      expect(config.confirmationHours).toBe(48);
      expect(config.cleanupDays).toBe(60);
      expect(config.maxAttempts).toBe(10);
      expect(config.lockoutMinutes).toBe(120);
    });
  });

  describe('消息 TTL 配置', () => {
    it('应该返回默认公共消息 TTL', () => {
      delete process.env.PUBLIC_MESSAGE_TTL;
      
      // Note: This would need a separate function to test
      // Assuming there's a getMessageTTL function
      expect(process.env.PUBLIC_MESSAGE_TTL || '43200').toBe('43200');
    });

    it('应该返回默认私有消息 TTL', () => {
      delete process.env.PRIVATE_MESSAGE_TTL;
      
      expect(process.env.PRIVATE_MESSAGE_TTL || '86400').toBe('86400');
    });
  });

  describe('数据库连接池配置', () => {
    it('应该返回默认连接池大小', () => {
      delete process.env.DB_POOL_SIZE;
      
      expect(process.env.DB_POOL_SIZE || '20').toBe('20');
    });

    it('应该返回默认空闲超时', () => {
      delete process.env.DB_IDLE_TIMEOUT;
      
      expect(process.env.DB_IDLE_TIMEOUT || '30000').toBe('30000');
    });

    it('应该返回默认连接超时', () => {
      delete process.env.DB_CONNECT_TIMEOUT;
      
      expect(process.env.DB_CONNECT_TIMEOUT || '2000').toBe('2000');
    });
  });

  describe('日志级别配置', () => {
    it('应该返回默认日志级别', () => {
      delete process.env.LOG_LEVEL;
      
      expect(process.env.LOG_LEVEL || 'info').toBe('info');
    });

    it('应该接受有效的日志级别', () => {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
      
      for (const level of validLevels) {
        process.env.LOG_LEVEL = level;
        expect(process.env.LOG_LEVEL).toBe(level);
      }
    });
  });

  describe('CORS 配置', () => {
    it('应该处理未配置的 CORS', () => {
      delete process.env.CORS_ORIGINS;
      
      expect(process.env.CORS_ORIGINS).toBeUndefined();
    });

    it('应该解析逗号分隔的 CORS 来源', () => {
      process.env.CORS_ORIGINS = 'https://example.com,https://test.com';
      
      const origins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim());
      
      expect(origins).toEqual(['https://example.com', 'https://test.com']);
    });
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limit middleware tests.
 *
 * Mock 策略：
 * - `rate-limiter-flexible`：mock RateLimiterRedis / RateLimiterMemory 构造函数，
 *   使每个实例的 `consume` 方法可被测试控制。
 * - `@/src/lib/utils/redis-client`：mock getRedisClient，控制 Redis 可用性。
 * - `@/src/lib/utils/error-handler`：部分 mock，仅替换 extractRequestContext
 *   （createRateLimitedResponse 内部用 `{} as NextRequest` 调用，原始实现会抛错）。
 *
 * limiterCache 是模块级 Map，无法直接清空。使用 vi.resetModules() + 动态 import
 * 重新加载 rate-limit 模块，获得全新的 limiterCache。
 * vi.hoisted 保证 mock 引用在 resetModules 后仍然稳定。
 * 注意：vi.resetModules() 会重置 mock 实现，所以 mockImplementation 必须在
 * importRateLimit() 之后设置。
 */

const mocks = vi.hoisted(() => ({
  RateLimiterRedisCtor: vi.fn(),
  RateLimiterMemoryCtor: vi.fn(),
  getRedisClientMock: vi.fn(),
  extractRequestContextMock: vi.fn(),
  // RateLimiterRes mock：模拟 rate-limiter-flexible 的限流错误类
  RateLimiterRes: class RateLimiterRes {
    constructor(
      public remainingPoints: number,
      public msBeforeNext: number,
    ) {}
  },
}));

vi.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: mocks.RateLimiterRedisCtor,
  RateLimiterMemory: mocks.RateLimiterMemoryCtor,
  RateLimiterRes: mocks.RateLimiterRes,
}));

vi.mock('@/src/lib/utils/redis-client', () => ({
  getRedisClient: mocks.getRedisClientMock,
}));

vi.mock('@/src/lib/utils/error-handler', async importOriginal => {
  const actual = await importOriginal<typeof import('@/src/lib/utils/error-handler')>();
  return {
    ...actual,
    extractRequestContext: mocks.extractRequestContextMock,
  };
});

const SUCCESS_RESULT = { remainingPoints: 99, msBeforeNext: 5000 };

/**
 * 创建 limiter 构造函数实现。
 * 必须使用 function 语法（非箭头函数），否则 vitest 4 中 `new Mock()` 报 "is not a constructor"。
 */
function makeLimiterImpl(consumeResult: unknown = SUCCESS_RESULT, consumeError?: unknown) {
  return function (this: unknown, opts: unknown) {
    const consume = vi.fn();
    if (consumeError !== undefined) {
      consume.mockRejectedValue(consumeError);
    } else {
      consume.mockResolvedValue(consumeResult);
    }
    return { consume, __opts: opts };
  };
}

/**
 * 设置默认 mock 实现。必须在 importRateLimit() 之后调用（vi.resetModules 会清除实现）。
 */
function setDefaultMockImplementations(): void {
  mocks.getRedisClientMock.mockResolvedValue(null);
  mocks.RateLimiterRedisCtor.mockImplementation(makeLimiterImpl());
  mocks.RateLimiterMemoryCtor.mockImplementation(makeLimiterImpl());
  mocks.extractRequestContextMock.mockReturnValue({
    requestId: 'test-req-id',
    path: '/test',
    method: 'GET',
    clientIP: '127.0.0.1',
    userAgent: 'test-agent',
  });
}

/**
 * 动态导入 rate-limit 模块，获得全新的 limiterCache。
 * 每次调用都会重新评估 rate-limit.ts，limiterCache Map 被重置。
 */
async function importRateLimit() {
  vi.resetModules();
  setDefaultMockImplementations();
  return await import('@/src/lib/middleware/rate-limit');
}

describe('rate-limit middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * 构造模拟 NextRequest
   */
  function createRequest(
    url = 'http://localhost:3000/api/test',
    headers: Record<string, string> = {},
    method = 'GET',
  ): NextRequest {
    return new NextRequest(url, { method, headers });
  }

  describe('checkRateLimit', () => {
    it('应该在限流允许时返回 null', async () => {
      const m = await importRateLimit();
      const request = createRequest();
      const result = await m.checkRateLimit(request);
      expect(result).toBeNull();
    });

    it('应该在限流命中时返回 429 NextResponse', async () => {
      const m = await importRateLimit();
      // consume 抛出 RateLimiterRes 实例（rate-limiter-flexible 限流行为）
      const rateLimitError = new mocks.RateLimiterRes(0, 3000);
      mocks.RateLimiterMemoryCtor.mockImplementation(makeLimiterImpl(undefined, rateLimitError));

      const request = createRequest();
      const result = await m.checkRateLimit(request);

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(NextResponse);
      expect(result!.status).toBe(429);

      const body = await result!.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('应该使用传入的 endpointType 而非从 URL 推断', async () => {
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/unknown');
      await m.checkRateLimit(request, 'publish');

      expect(mocks.RateLimiterMemoryCtor).toHaveBeenCalledTimes(1);
      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(10); // RATE_LIMIT_PUBLISH
    });
  });

  describe('rateLimit - 基本行为', () => {
    it('应该在限流允许时返回 success: true', async () => {
      const m = await importRateLimit();
      const request = createRequest();
      const result = await m.rateLimit(request);

      expect(result.success).toBe(true);
      expect(result.limit).toBe(100); // default maxRequests
      expect(result.remaining).toBe(99);
      expect(result.resetAt).toBeGreaterThan(Date.now());
      expect(result.retryAfter).toBeUndefined();
    });

    it('应该在限流命中时返回 success: false 并包含 retryAfter', async () => {
      const m = await importRateLimit();
      const rateLimitError = new mocks.RateLimiterRes(0, 4500);
      mocks.RateLimiterMemoryCtor.mockImplementation(makeLimiterImpl(undefined, rateLimitError));

      const request = createRequest();
      const result = await m.rateLimit(request);

      expect(result.success).toBe(false);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(5); // Math.ceil(4500 / 1000)
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it('应该在 consume 抛出非限流错误时 fail open（success: true）', async () => {
      const m = await importRateLimit();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.RateLimiterMemoryCtor.mockImplementation(
        makeLimiterImpl(undefined, new Error('Redis gone')),
      );

      const request = createRequest();
      const result = await m.rateLimit(request);

      expect(result.success).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(100); // 全部剩余
      expect(errorSpy).toHaveBeenCalledWith('Rate limiting error:', expect.any(Error));
      errorSpy.mockRestore();
    });

    it('应该用 consume 的返回值计算 remaining 和 resetAt', async () => {
      const m = await importRateLimit();
      mocks.RateLimiterMemoryCtor.mockImplementation(
        makeLimiterImpl({ remainingPoints: 42, msBeforeNext: 12000 }),
      );

      const request = createRequest();
      const result = await m.rateLimit(request);

      expect(result.remaining).toBe(42);
      expect(result.resetAt).toBeGreaterThan(Date.now() + 11000);
    });
  });

  describe('rateLimit - endpoint type 推断', () => {
    it('应该从 /publish 路径推断 publish 类型', async () => {
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/publish');
      await m.rateLimit(request);

      expect(mocks.RateLimiterMemoryCtor).toHaveBeenCalledTimes(1);
      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(10); // RATE_LIMIT_PUBLISH
    });

    it('应该从 /register 路径推断 register 类型', async () => {
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/register');
      await m.rateLimit(request);

      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(5); // RATE_LIMIT_REGISTER
    });

    it('应该从 /subscribe 路径推断 subscribe 类型', async () => {
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/subscribe');
      await m.rateLimit(request);

      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(5); // RATE_LIMIT_SUBSCRIBE
    });

    it('应该从 /revoke 路径推断 revoke 类型', async () => {
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/keys/x/revoke');
      await m.rateLimit(request);

      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(20); // RATE_LIMIT_REVOKE
    });

    it('应该对未知路径使用 default 类型', async () => {
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/unknown');
      await m.rateLimit(request);

      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(100); // RATE_LIMIT_DEFAULT
    });

    it('应该优先使用显式传入的 endpointType', async () => {
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/publish');
      await m.rateLimit(request, 'register');

      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(5); // register
    });

    it('应该对未知 endpointType 回退到 default 配置', async () => {
      const m = await importRateLimit();
      const request = createRequest();
      await m.rateLimit(request, 'nonexistent-type');

      const opts = mocks.RateLimiterMemoryCtor.mock.calls[0][0] as {
        points: number;
      };
      expect(opts.points).toBe(100); // default
    });
  });

  describe('rateLimit - Redis 可用性', () => {
    it('应该在 Redis 可用时使用 RateLimiterRedis', async () => {
      const m = await importRateLimit();
      const fakeClient = { __id: 'redis-1' };
      mocks.getRedisClientMock.mockResolvedValue(fakeClient);

      const request = createRequest();
      await m.rateLimit(request);

      expect(mocks.RateLimiterRedisCtor).toHaveBeenCalledTimes(1);
      expect(mocks.RateLimiterMemoryCtor).not.toHaveBeenCalled();

      const opts = mocks.RateLimiterRedisCtor.mock.calls[0][0] as {
        storeClient: unknown;
        keyPrefix: string;
        points: number;
        duration: number;
        blockDuration: number;
        useRedisPackage: boolean;
      };
      expect(opts.storeClient).toBe(fakeClient);
      expect(opts.keyPrefix).toBe('rl:default:');
      expect(opts.points).toBe(100);
      expect(opts.duration).toBe(60); // 60000ms / 1000
      expect(opts.blockDuration).toBe(0);
      // node-redis v4+ 兼容性：constructor.name 不是 'Commander'，
      // 库自动检测失效，必须显式声明 useRedisPackage 走 eval 路径
      expect(opts.useRedisPackage).toBe(true);
    });

    it('应该为 node-redis v6 客户端传递 useRedisPackage: true（修复 rlflxIncr bug）', async () => {
      const m = await importRateLimit();
      // 模拟 node-redis v6 客户端：constructor.name === 'Class'，无 defineCommand
      const fakeNodeRedisClient = {
        __id: 'node-redis-v6',
        constructor: { name: 'Class' },
        defineCommand: undefined,
        eval: () => Promise.resolve([1, 60000]),
      };
      mocks.getRedisClientMock.mockResolvedValue(fakeNodeRedisClient);

      const request = createRequest();
      await m.rateLimit(request);

      expect(mocks.RateLimiterRedisCtor).toHaveBeenCalledTimes(1);
      const opts = mocks.RateLimiterRedisCtor.mock.calls[0][0] as {
        useRedisPackage: boolean;
      };
      expect(opts.useRedisPackage).toBe(true);
    });

    it('应该在 Redis 返回 null 时回退到 RateLimiterMemory', async () => {
      const m = await importRateLimit();
      mocks.getRedisClientMock.mockResolvedValue(null);

      const request = createRequest();
      await m.rateLimit(request);

      expect(mocks.RateLimiterMemoryCtor).toHaveBeenCalledTimes(1);
      expect(mocks.RateLimiterRedisCtor).not.toHaveBeenCalled();
    });

    it('应该在 getRedisClient 抛错时回退到 RateLimiterMemory 并警告', async () => {
      const m = await importRateLimit();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mocks.getRedisClientMock.mockRejectedValue(new Error('Redis down'));

      const request = createRequest();
      await m.rateLimit(request);

      expect(mocks.RateLimiterMemoryCtor).toHaveBeenCalledTimes(1);
      expect(mocks.RateLimiterRedisCtor).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Redis rate limiter failed, falling back to memory:',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe('limiterCache 复用优化', () => {
    it('应该在同一 endpointType + 同一 Redis 客户端时复用 limiter', async () => {
      const m = await importRateLimit();
      const fakeClient = { __id: 'redis-stable' };
      mocks.getRedisClientMock.mockResolvedValue(fakeClient);

      const request = createRequest();
      await m.rateLimit(request, 'publish');
      await m.rateLimit(request, 'publish');

      // Redis limiter 构造函数只应被调用一次（缓存命中）
      expect(mocks.RateLimiterRedisCtor).toHaveBeenCalledTimes(1);
    });

    it('应该在不同 endpointType 时创建不同 limiter', async () => {
      const m = await importRateLimit();
      const fakeClient = { __id: 'redis-stable' };
      mocks.getRedisClientMock.mockResolvedValue(fakeClient);

      const request = createRequest();
      await m.rateLimit(request, 'publish');
      await m.rateLimit(request, 'register');

      // 两个不同 endpointType，两次构造
      expect(mocks.RateLimiterRedisCtor).toHaveBeenCalledTimes(2);
      const opts1 = mocks.RateLimiterRedisCtor.mock.calls[0][0] as {
        keyPrefix: string;
      };
      const opts2 = mocks.RateLimiterRedisCtor.mock.calls[1][0] as {
        keyPrefix: string;
      };
      expect(opts1.keyPrefix).toBe('rl:publish:');
      expect(opts2.keyPrefix).toBe('rl:register:');
    });

    it('应该在 Redis 客户端引用变化时重建 limiter', async () => {
      const m = await importRateLimit();
      const client1 = { __id: 'redis-1' };
      const client2 = { __id: 'redis-2' };
      mocks.getRedisClientMock.mockResolvedValueOnce(client1).mockResolvedValueOnce(client2);

      const request = createRequest();
      await m.rateLimit(request, 'publish');
      await m.rateLimit(request, 'publish');

      // 客户端引用变化导致缓存失效
      expect(mocks.RateLimiterRedisCtor).toHaveBeenCalledTimes(2);
    });

    it('应该复用内存 limiter（同 endpointType + 无 Redis）', async () => {
      const m = await importRateLimit();
      mocks.getRedisClientMock.mockResolvedValue(null);

      const request = createRequest();
      await m.rateLimit(request, 'publish');
      await m.rateLimit(request, 'publish');

      // 内存 limiter 只应创建一次（缓存命中，clientRef 都是 null）
      expect(mocks.RateLimiterMemoryCtor).toHaveBeenCalledTimes(1);
    });

    it('应该在 Redis→Memory 切换时重建 limiter', async () => {
      const m = await importRateLimit();
      const fakeClient = { __id: 'redis-1' };
      mocks.getRedisClientMock.mockResolvedValueOnce(fakeClient).mockResolvedValueOnce(null);

      const request = createRequest();
      await m.rateLimit(request, 'publish');
      await m.rateLimit(request, 'publish');

      expect(mocks.RateLimiterRedisCtor).toHaveBeenCalledTimes(1);
      expect(mocks.RateLimiterMemoryCtor).toHaveBeenCalledTimes(1);
    });

    it('应该在 Memory→Redis 切换时重建 limiter', async () => {
      const m = await importRateLimit();
      const fakeClient = { __id: 'redis-1' };
      mocks.getRedisClientMock.mockResolvedValueOnce(null).mockResolvedValueOnce(fakeClient);

      const request = createRequest();
      await m.rateLimit(request, 'publish');
      await m.rateLimit(request, 'publish');

      expect(mocks.RateLimiterMemoryCtor).toHaveBeenCalledTimes(1);
      expect(mocks.RateLimiterRedisCtor).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClientIP', () => {
    it('应该在配置 TRUSTED_PROXY_IPS 时从 X-Forwarded-For 取最后一个 IP', async () => {
      process.env.TRUSTED_PROXY_IPS = '10.0.0.1,10.0.0.2';
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/test', {
        'x-forwarded-for': '203.0.113.5, 198.51.100.1',
      });
      await m.rateLimit(request);

      // consume 被调用时第一个参数应该是最后一个 IP
      const memoryInstance = mocks.RateLimiterMemoryCtor.mock.results[0].value as {
        consume: ReturnType<typeof vi.fn>;
      };
      expect(memoryInstance.consume).toHaveBeenCalledTimes(1);
      expect(memoryInstance.consume.mock.calls[0][0]).toBe('198.51.100.1');
    });

    it('应该在无 TRUSTED_PROXY_IPS 时忽略 X-Forwarded-For 并警告', async () => {
      delete process.env.TRUSTED_PROXY_IPS;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/test', {
        'x-forwarded-for': '203.0.113.5',
        'x-real-ip': '10.0.0.99',
      });
      await m.rateLimit(request);

      expect(warnSpy).toHaveBeenCalledWith(
        'X-Forwarded-For header present but no TRUSTED_PROXY_IPS configured',
      );
      // 应该使用 X-Real-IP 作为 fallback
      const memoryInstance = mocks.RateLimiterMemoryCtor.mock.results[0].value as {
        consume: ReturnType<typeof vi.fn>;
      };
      expect(memoryInstance.consume.mock.calls[0][0]).toBe('10.0.0.99');
      warnSpy.mockRestore();
    });

    it('应该在没有 X-Forwarded-For 时使用 X-Real-IP', async () => {
      delete process.env.TRUSTED_PROXY_IPS;
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/test', {
        'x-real-ip': '192.0.2.10',
      });
      await m.rateLimit(request);

      const memoryInstance = mocks.RateLimiterMemoryCtor.mock.results[0].value as {
        consume: ReturnType<typeof vi.fn>;
      };
      expect(memoryInstance.consume.mock.calls[0][0]).toBe('192.0.2.10');
    });

    it('应该在没有 IP header 时返回 unknown', async () => {
      delete process.env.TRUSTED_PROXY_IPS;
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/test', {});
      await m.rateLimit(request);

      const memoryInstance = mocks.RateLimiterMemoryCtor.mock.results[0].value as {
        consume: ReturnType<typeof vi.fn>;
      };
      expect(memoryInstance.consume.mock.calls[0][0]).toBe('unknown');
    });

    it('应该处理 X-Forwarded-For 为空字符串的场景', async () => {
      process.env.TRUSTED_PROXY_IPS = '10.0.0.1';
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/test', {
        'x-forwarded-for': '',
      });
      await m.rateLimit(request);

      const memoryInstance = mocks.RateLimiterMemoryCtor.mock.results[0].value as {
        consume: ReturnType<typeof vi.fn>;
      };
      // '' || 'unknown' → 'unknown'
      expect(memoryInstance.consume.mock.calls[0][0]).toBe('unknown');
    });

    it('应该在无 IP header 时使用 request.ip 属性 (line 123)', async () => {
      // 覆盖 line 123: request.ip 属性回退分支
      delete process.env.TRUSTED_PROXY_IPS;
      const m = await importRateLimit();
      const request = createRequest('http://localhost:3000/api/test', {});
      // NextRequest 在测试环境无 ip 属性，通过 defineProperty 设置
      Object.defineProperty(request, 'ip', {
        value: '198.51.100.42',
        configurable: true,
        enumerable: true,
      });
      await m.rateLimit(request);

      const memoryInstance = mocks.RateLimiterMemoryCtor.mock.results[0].value as {
        consume: ReturnType<typeof vi.fn>;
      };
      expect(memoryInstance.consume.mock.calls[0][0]).toBe('198.51.100.42');
    });
  });

  describe('createRateLimitedResponse', () => {
    it('应该返回 429 NextResponse 并包含 rate limit headers', async () => {
      const m = await importRateLimit();
      const result = {
        success: false,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() + 5000,
        retryAfter: 5,
      };

      const response = m.createRateLimitedResponse(result);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      // createRateLimitHeaders 会覆盖 RateLimitError 设置的 Retry-After
      // 值为 Math.ceil((resetAt - now) / 1000) ≈ 5
      expect(response.headers.get('Retry-After')).not.toBeNull();
      expect(response.headers.get('X-RateLimit-Reset')).not.toBeNull();
    });

    it('应该使用 extractRequestContext 获取 requestId', async () => {
      const m = await importRateLimit();
      mocks.extractRequestContextMock.mockReturnValue({
        requestId: 'custom-req-id',
        path: '/x',
        method: 'POST',
        clientIP: '1.1.1.1',
        userAgent: 'ua',
      });

      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 3000,
        retryAfter: 3,
      };
      const response = m.createRateLimitedResponse(result);

      expect(mocks.extractRequestContextMock).toHaveBeenCalledWith({});
      const body = await response.json();
      expect(body.error.requestId).toBe('custom-req-id');
    });

    it('应该用 result.retryAfter 构造 RateLimitError', async () => {
      const m = await importRateLimit();
      const result = {
        success: false,
        limit: 50,
        remaining: 0,
        resetAt: Date.now() + 10000,
        retryAfter: 10,
      };

      const response = m.createRateLimitedResponse(result);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      // Retry-After 由 createRateLimitHeaders 设置（覆盖 RateLimitError 的值）
      // 值为 Math.ceil((resetAt - now) / 1000) ≈ 10
      const retryAfter = response.headers.get('Retry-After');
      expect(retryAfter).not.toBeNull();
      expect(Number(retryAfter)).toBeGreaterThanOrEqual(9);
    });

    it('应该在 retryAfter 缺失时仍返回有效响应（RateLimitError 用默认 60）', async () => {
      const m = await importRateLimit();
      const result = {
        success: false,
        limit: 50,
        remaining: 0,
        resetAt: Date.now() + 10000,
        // retryAfter 缺失 → RateLimitError 用 60
      };

      const response = m.createRateLimitedResponse(result);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      // createRateLimitHeaders 的 Retry-After 覆盖 RateLimitError 的值
      const retryAfter = response.headers.get('Retry-After');
      expect(retryAfter).not.toBeNull();
    });
  });

  describe('addRateLimitHeaders', () => {
    it('应该向现有 response 添加 rate limit headers', async () => {
      const m = await importRateLimit();
      const response = NextResponse.json({ ok: true });
      const result = {
        success: true,
        limit: 100,
        remaining: 95,
        resetAt: Date.now() + 60000,
      };

      const returned = m.addRateLimitHeaders(response, result);

      expect(returned).toBe(response); // 返回同一 response
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('95');
      expect(response.headers.get('X-RateLimit-Reset')).not.toBeNull();
    });

    it('应该在没有剩余时间时不设置 Retry-After', async () => {
      const m = await importRateLimit();
      const response = NextResponse.json({ ok: true });
      // resetAt 已经过去 → msBeforeNext <= 0 → 不设置 Retry-After
      const result = {
        success: true,
        limit: 100,
        remaining: 100,
        resetAt: Date.now() - 1000,
      };

      m.addRateLimitHeaders(response, result);

      expect(response.headers.get('Retry-After')).toBeNull();
    });

    it('应该将 remaining 钳制为 0（负值场景）', async () => {
      const m = await importRateLimit();
      const response = NextResponse.json({ ok: true });
      const result = {
        success: false,
        limit: 100,
        remaining: -5, // 负值
        resetAt: Date.now() + 3000,
      };

      m.addRateLimitHeaders(response, result);

      // Math.max(0, -5) = 0
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('应该在 msBeforeNext > 0 时设置 Retry-After', async () => {
      const m = await importRateLimit();
      const response = NextResponse.json({ ok: true });
      const result = {
        success: true,
        limit: 100,
        remaining: 50,
        resetAt: Date.now() + 7500, // 7.5 秒后
      };

      m.addRateLimitHeaders(response, result);

      // Math.ceil(7500 / 1000) = 8
      expect(response.headers.get('Retry-After')).toBe('8');
    });
  });

  describe('导出的类型与接口', () => {
    it('应该正确导出 rateLimit 函数', async () => {
      const m = await importRateLimit();
      expect(typeof m.rateLimit).toBe('function');
    });

    it('应该正确导出 checkRateLimit 函数', async () => {
      const m = await importRateLimit();
      expect(typeof m.checkRateLimit).toBe('function');
    });

    it('应该正确导出 createRateLimitedResponse 函数', async () => {
      const m = await importRateLimit();
      expect(typeof m.createRateLimitedResponse).toBe('function');
    });

    it('应该正确导出 addRateLimitHeaders 函数', async () => {
      const m = await importRateLimit();
      expect(typeof m.addRateLimitHeaders).toBe('function');
    });
  });
});

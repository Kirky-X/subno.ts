// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache, apiKeyCache } from '@/src/lib/utils/cache';

describe('Cache', () => {
  describe('构造函数', () => {
    it('应该使用数字 max 创建缓存', () => {
      const cache = new Cache<string, number>({ max: 100 });
      expect(cache.size()).toBe(0);
    });

    it('应该使用 Map 作为 max 创建缓存（回退到默认 1000）', () => {
      const cache = new Cache<string, number>({ max: new Map() });
      // 当 max 不是数字时，使用默认 1000
      expect(cache.size()).toBe(0);
      expect(cache.stats().maxSize).toBe(1000);
    });

    it('应该支持 TTL 配置', () => {
      const cache = new Cache<string, number>({ max: 100, ttl: 1000 });
      cache.set('key', 42);
      expect(cache.get('key')).toBe(42);
    });

    it('应该支持 dispose 回调', () => {
      const dispose = vi.fn();
      const cache = new Cache<string, number>({ max: 2, dispose });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // 触发 'a' 的 evict
      expect(dispose).toHaveBeenCalledWith(1, 'a', 'evict');
    });
  });

  describe('get / set', () => {
    it('应该存取值', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 42);
      expect(cache.get('key')).toBe(42);
    });

    it('应该对不存在的 key 返回 undefined', () => {
      const cache = new Cache<string, number>({ max: 100 });
      expect(cache.get('missing')).toBeUndefined();
    });

    it('应该覆盖已存在的值', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 1);
      cache.set('key', 2);
      expect(cache.get('key')).toBe(2);
    });

    it('应该记录命中和未命中', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 1);
      cache.get('key'); // hit
      cache.get('missing'); // miss
      const stats = cache.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('TTL 过期', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该在 TTL 过期后返回 undefined（get）', () => {
      const cache = new Cache<string, number>({ max: 100, ttl: 1000 });
      cache.set('key', 42);
      expect(cache.get('key')).toBe(42);

      vi.advanceTimersByTime(1001);
      expect(cache.get('key')).toBeUndefined();
    });

    it('应该在 TTL 过期后从缓存中删除（get）', () => {
      const cache = new Cache<string, number>({ max: 100, ttl: 1000 });
      cache.set('key', 42);
      vi.advanceTimersByTime(1001);
      cache.get('key'); // 触发删除
      expect(cache.size()).toBe(0);
    });

    it('应该在 TTL 过期后 has 返回 false', () => {
      const cache = new Cache<string, number>({ max: 100, ttl: 1000 });
      cache.set('key', 42);
      expect(cache.has('key')).toBe(true);

      vi.advanceTimersByTime(1001);
      expect(cache.has('key')).toBe(false);
    });

    it('应该在 TTL 过期后从缓存中删除（has）', () => {
      const cache = new Cache<string, number>({ max: 100, ttl: 1000 });
      cache.set('key', 42);
      vi.advanceTimersByTime(1001);
      cache.has('key'); // 触发删除
      expect(cache.size()).toBe(0);
    });

    it('应该在 TTL 未过期时正常返回', () => {
      const cache = new Cache<string, number>({ max: 100, ttl: 1000 });
      cache.set('key', 42);
      vi.advanceTimersByTime(500);
      expect(cache.get('key')).toBe(42);
    });

    it('应该支持 set 时指定自定义 TTL', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 42, 1000);
      expect(cache.get('key')).toBe(42);

      vi.advanceTimersByTime(1001);
      expect(cache.get('key')).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('应该删除存在的 key 并返回 true', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 42);
      expect(cache.delete('key')).toBe(true);
      expect(cache.get('key')).toBeUndefined();
    });

    it('应该对不存在的 key 返回 false', () => {
      const cache = new Cache<string, number>({ max: 100 });
      expect(cache.delete('missing')).toBe(false);
    });
  });

  describe('has', () => {
    it('应该对存在的 key 返回 true', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 42);
      expect(cache.has('key')).toBe(true);
    });

    it('应该对不存在的 key 返回 false', () => {
      const cache = new Cache<string, number>({ max: 100 });
      expect(cache.has('missing')).toBe(false);
    });

    it('不应该增加 hits 或 misses', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 42);
      cache.has('key');
      cache.has('missing');
      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('clear', () => {
    it('应该清空所有缓存', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it('应该重置统计计数', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('a', 1);
      cache.get('a');
      cache.get('missing');
      cache.clear();
      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('size', () => {
    it('应该返回当前缓存大小', () => {
      const cache = new Cache<string, number>({ max: 100 });
      expect(cache.size()).toBe(0);
      cache.set('a', 1);
      expect(cache.size()).toBe(1);
      cache.set('b', 2);
      expect(cache.size()).toBe(2);
    });
  });

  describe('stats', () => {
    it('应该返回完整统计信息', () => {
      const cache = new Cache<string, number>({ max: 100, ttl: 1000 });
      cache.set('a', 1);
      cache.get('a'); // hit
      cache.get('missing'); // miss
      const stats = cache.stats();
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(100);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('应该在没有访问时 hitRate 为 0', () => {
      const cache = new Cache<string, number>({ max: 100 });
      const stats = cache.stats();
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('应该在全部命中时 hitRate 为 100', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a');
      cache.get('b');
      expect(cache.stats().hitRate).toBe(100);
    });

    it('应该在全部未命中时 hitRate 为 0', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.get('a');
      cache.get('b');
      expect(cache.stats().hitRate).toBe(0);
    });
  });

  describe('getOrCompute', () => {
    it('应该在缓存命中时返回缓存值（不调用 computeFn）', async () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 42);
      const computeFn = vi.fn().mockResolvedValue(99);
      const result = await cache.getOrCompute('key', computeFn);
      expect(result).toBe(42);
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时调用 computeFn 并缓存结果', async () => {
      const cache = new Cache<string, number>({ max: 100 });
      const computeFn = vi.fn().mockResolvedValue(99);
      const result = await cache.getOrCompute('key', computeFn);
      expect(result).toBe(99);
      expect(computeFn).toHaveBeenCalledTimes(1);
      // 第二次应该命中缓存
      const result2 = await cache.getOrCompute('key', computeFn);
      expect(result2).toBe(99);
      expect(computeFn).toHaveBeenCalledTimes(1);
    });

    it('应该支持自定义 TTL', async () => {
      vi.useFakeTimers();
      const cache = new Cache<string, number>({ max: 100 });
      const computeFn = vi.fn().mockResolvedValue(99);
      await cache.getOrCompute('key', computeFn, 1000);
      vi.advanceTimersByTime(1001);
      const result = await cache.getOrCompute('key', computeFn);
      expect(result).toBe(99);
      expect(computeFn).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('getOrComputeSync', () => {
    it('应该在缓存命中时返回缓存值（不调用 computeFn）', () => {
      const cache = new Cache<string, number>({ max: 100 });
      cache.set('key', 42);
      const computeFn = vi.fn().mockReturnValue(99);
      const result = cache.getOrComputeSync('key', computeFn);
      expect(result).toBe(42);
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时调用 computeFn 并缓存结果', () => {
      const cache = new Cache<string, number>({ max: 100 });
      const computeFn = vi.fn().mockReturnValue(99);
      const result = cache.getOrComputeSync('key', computeFn);
      expect(result).toBe(99);
      expect(computeFn).toHaveBeenCalledTimes(1);
      // 第二次应该命中缓存
      const result2 = cache.getOrComputeSync('key', computeFn);
      expect(result2).toBe(99);
      expect(computeFn).toHaveBeenCalledTimes(1);
    });

    it('应该支持自定义 TTL', () => {
      vi.useFakeTimers();
      const cache = new Cache<string, number>({ max: 100 });
      const computeFn = vi.fn().mockReturnValue(99);
      cache.getOrComputeSync('key', computeFn, 1000);
      vi.advanceTimersByTime(1001);
      cache.getOrComputeSync('key', computeFn);
      expect(computeFn).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('数字 key 支持', () => {
    it('应该支持数字类型的 key', () => {
      const cache = new Cache<number, string>({ max: 100 });
      cache.set(1, 'one');
      cache.set(2, 'two');
      expect(cache.get(1)).toBe('one');
      expect(cache.get(2)).toBe('two');
    });
  });

  describe('LRU 淘汰策略', () => {
    it('应该淘汰最近最少使用的项', () => {
      const cache = new Cache<string, number>({ max: 2 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // 访问 a，使 b 成为最久未使用
      cache.set('c', 3); // 应该淘汰 b
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });
  });
});

describe('apiKeyCache（预配置缓存）', () => {
  it('应该是 Cache 实例', () => {
    expect(apiKeyCache).toBeInstanceOf(Cache);
  });

  it('应该可以存取 API key 验证结果', () => {
    apiKeyCache.set('test-key', {
      keyId: 'key-1',
      userId: 'user1',
      permissions: ['read'],
      isValid: true,
    });
    const result = apiKeyCache.get('test-key');
    expect(result).toEqual({
      keyId: 'key-1',
      userId: 'user1',
      permissions: ['read'],
      isValid: true,
    });
  });
});

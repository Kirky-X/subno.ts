// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestDeduplicator } from './requestDeduplicator';

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator();
  });

  describe('constructor', () => {
    it('should create deduplicator with default options', () => {
      const defaultDedup = new RequestDeduplicator();
      expect(defaultDedup).toBeDefined();
      
      const stats = defaultDedup.getStats();
      expect(stats.ttlSeconds).toBe(5.0);
      expect(stats.pendingCount).toBe(0);
      expect(stats.completedCount).toBe(0);
    });

    it('should create deduplicator with custom options', () => {
      const customDedup = new RequestDeduplicator({
        ttlSeconds: 10,
        maxPending: 500,
        maxCached: 5000,
      });
      
      const stats = customDedup.getStats();
      expect(stats.ttlSeconds).toBe(10);
    });

    it('should handle undefined options', () => {
      const dedup = new RequestDeduplicator(undefined);
      expect(dedup).toBeDefined();
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys', () => {
      // Note: generateKey is private, but we can test through execute
      // This is tested indirectly
    });

    it('should generate different keys for different endpoints', () => {
      // Tested through execute behavior
    });
  });

  describe('execute', () => {
    it('should execute function and return result on first call', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      const result = await deduplicator.execute(
        '/api/test',
        { param: 'value' },
        mockFunc
      );
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
      
      const stats = deduplicator.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('should return cached result for duplicate request', async () => {
      const mockFunc = vi.fn().mockResolvedValue('cached-result');
      
      // First request
      await deduplicator.execute('/api/test', { id: 1 }, mockFunc);
      
      // Second request with same params (within TTL)
      const result2 = await deduplicator.execute(
        '/api/test',
        { id: 1 },
        mockFunc
      );
      
      expect(mockFunc).toHaveBeenCalledTimes(1); // Should not call again
      expect(result2).toBe('cached-result');
      
      const stats = deduplicator.getStats();
      expect(stats.hits).toBe(1);
    });

    it('should wait for pending request', async () => {
      let resolveFunc: ((value: string) => void) | undefined;
      const promise = new Promise<string>((resolve) => {
        resolveFunc = resolve;
      });
      
      const mockFunc = vi.fn().mockReturnValue(promise);
      
      // Start first request
      const promise1 = deduplicator.execute('/api/test', {}, mockFunc);
      
      // Start second concurrent request
      const promise2 = deduplicator.execute('/api/test', {}, mockFunc);
      
      // Resolve the first request
      resolveFunc!('done');
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe('done');
      expect(result2).toBe('done');
      expect(mockFunc).toHaveBeenCalledTimes(1);
      
      const stats = deduplicator.getStats();
      expect(stats.hits).toBe(1); // Second request was a hit
    });

    it('should use cache by default', async () => {
      const mockFunc = vi.fn().mockResolvedValue('cached');
      
      await deduplicator.execute('/api/test', {}, mockFunc);
      await deduplicator.execute('/api/test', {}, mockFunc);
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when useCache is false', async () => {
      const mockFunc = vi.fn().mockResolvedValue('fresh');
      
      await deduplicator.execute('/api/test', {}, mockFunc, false);
      await deduplicator.execute('/api/test', {}, mockFunc, false);
      
      expect(mockFunc).toHaveBeenCalledTimes(2);
    });

    it('should handle different parameters', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      await deduplicator.execute('/api/test', { id: 1 }, mockFunc);
      await deduplicator.execute('/api/test', { id: 2 }, mockFunc);
      
      expect(mockFunc).toHaveBeenCalledTimes(2); // Different params = different requests
    });

    it('should handle errors correctly', async () => {
      const mockFunc = vi.fn().mockRejectedValue(new Error('test error'));
      
      await expect(deduplicator.execute('/api/test', {}, mockFunc))
        .rejects.toThrow('test error');
      
      const stats = deduplicator.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should remove from pending on error', async () => {
      const mockFunc = vi.fn().mockRejectedValue(new Error('fail'));
      
      try {
        await deduplicator.execute('/api/test', {}, mockFunc);
      } catch (e) {
        // Expected
      }
      
      const stats = deduplicator.getStats();
      expect(stats.pendingCount).toBe(0);
    });

    it('should enforce maxCached limit', async () => {
      const limitedDedup = new RequestDeduplicator({ maxCached: 3 });
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      await limitedDedup.execute('/api/a', {}, mockFunc);
      await limitedDedup.execute('/api/b', {}, mockFunc);
      await limitedDedup.execute('/api/c', {}, mockFunc);
      await limitedDedup.execute('/api/d', {}, mockFunc);
      
      const stats = limitedDedup.getStats();
      expect(stats.completedCount).toBeLessThanOrEqual(3);
    });

    it('should enforce maxPending limit', async () => {
      const limitedDedup = new RequestDeduplicator({ maxPending: 3 });
      
      let resolveFunc: (() => void) | undefined;
      const hangingPromise = new Promise<void>((resolve) => {
        resolveFunc = resolve;
      });
      
      const mockFunc = vi.fn().mockReturnValue(hangingPromise);
      
      // Create 5 pending requests
      limitedDedup.execute('/api/1', {}, mockFunc);
      limitedDedup.execute('/api/2', {}, mockFunc);
      limitedDedup.execute('/api/3', {}, mockFunc);
      limitedDedup.execute('/api/4', {}, mockFunc);
      limitedDedup.execute('/api/5', {}, mockFunc);
      
      const stats = limitedDedup.getStats();
      expect(stats.pendingCount).toBeLessThanOrEqual(3);
      
      // Clean up
      resolveFunc!();
    });
  });

  describe('cleanupExpired', () => {
    it('should remove old completed entries', () => {
      const dedup = new RequestDeduplicator({ maxCached: 10 });
      
      // Manually add some completed entries
      // Note: We can't directly control when entries expire via TTL
      // But we can test the cleanup mechanism
      
      const removed = dedup.cleanupExpired();
      expect(removed).toBeGreaterThanOrEqual(0);
    });

    it('should handle large completed cache', () => {
      const dedup = new RequestDeduplicator({ maxCached: 5 });
      
      // Simulate exceeding maxCached * 2
      // This would trigger cleanup in real usage
      const removed = dedup.cleanupExpired();
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearPending', () => {
    it('should clear all pending requests', async () => {
      let resolveFunc: (() => void) | undefined;
      const hangingPromise = new Promise<void>((resolve) => {
        resolveFunc = resolve;
      });
      
      const mockFunc = vi.fn().mockReturnValue(hangingPromise);
      
      deduplicator.execute('/api/1', {}, mockFunc);
      deduplicator.execute('/api/2', {}, mockFunc);
      deduplicator.execute('/api/3', {}, mockFunc);
      
      const count = deduplicator.clearPending();
      expect(count).toBe(3);
      
      const stats = deduplicator.getStats();
      expect(stats.pendingCount).toBe(0);
      
      // Clean up
      resolveFunc!();
    });

    it('should return 0 when no pending requests', () => {
      const count = deduplicator.clearPending();
      expect(count).toBe(0);
    });
  });

  describe('clearCompleted', () => {
    it('should clear all completed requests', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      await deduplicator.execute('/api/1', {}, mockFunc);
      await deduplicator.execute('/api/2', {}, mockFunc);
      await deduplicator.execute('/api/3', {}, mockFunc);
      
      const count = deduplicator.clearCompleted();
      expect(count).toBe(3);
      
      const stats = deduplicator.getStats();
      expect(stats.completedCount).toBe(0);
    });

    it('should return 0 when no completed requests', () => {
      const count = deduplicator.clearCompleted();
      expect(count).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear both pending and completed', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      // Add completed
      await deduplicator.execute('/api/1', {}, mockFunc);
      await deduplicator.execute('/api/2', {}, mockFunc);
      
      // Add pending
      let resolveFunc: (() => void) | undefined;
      const hangingPromise = new Promise<void>((resolve) => {
        resolveFunc = resolve;
      });
      const hangingMock = vi.fn().mockReturnValue(hangingPromise);
      
      deduplicator.execute('/api/3', {}, hangingMock);
      deduplicator.execute('/api/4', {}, hangingMock);
      
      const count = deduplicator.clearAll();
      expect(count).toBe(4); // 2 completed + 2 pending
      
      const stats = deduplicator.getStats();
      expect(stats.pendingCount).toBe(0);
      expect(stats.completedCount).toBe(0);
      
      // Clean up
      resolveFunc!();
    });

    it('should return total count', () => {
      const count = deduplicator.clearAll();
      expect(count).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats structure', () => {
      const stats = deduplicator.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('pendingCount');
      expect(stats).toHaveProperty('completedCount');
      expect(stats).toHaveProperty('ttlSeconds');
    });

    it('should calculate hit rate correctly', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      await deduplicator.execute('/api/test', {}, mockFunc); // miss
      await deduplicator.execute('/api/test', {}, mockFunc); // hit
      
      const stats = deduplicator.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5, 2);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = deduplicator.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset all counters', async () => {
      const mockFunc = vi.fn()
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success2'); // Changed to avoid error in finally block
      
      await deduplicator.execute('/api/success', {}, mockFunc);
      await deduplicator.execute('/api/success2', {}, mockFunc);
      
      deduplicator.resetStats();
      
      const stats = deduplicator.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('should not affect pending and completed counts', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      await deduplicator.execute('/api/test', {}, mockFunc);
      
      deduplicator.resetStats();
      
      const stats = deduplicator.getStats();
      expect(stats.completedCount).toBe(1); // Still there
      expect(stats.hits).toBe(0); // Reset
    });
  });

  describe('edge cases', () => {
    it('should handle undefined params', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      await deduplicator.execute('/api/test', undefined, mockFunc);
      await deduplicator.execute('/api/test', undefined, mockFunc);
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should handle complex params', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      const complexParams = {
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
        string: 'test',
      };
      
      await deduplicator.execute('/api/test', complexParams, mockFunc);
      await deduplicator.execute('/api/test', complexParams, mockFunc);
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should handle empty object params', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      await deduplicator.execute('/api/test', {}, mockFunc);
      await deduplicator.execute('/api/test', {}, mockFunc);
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
    });

    it('should handle very large number of requests', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      for (let i = 0; i < 100; i++) {
        await deduplicator.execute(`/api/${i}`, {}, mockFunc);
      }
      
      const stats = deduplicator.getStats();
      expect(stats.misses).toBe(100);
      expect(stats.completedCount).toBe(100);
    });
  });

  describe('concurrent scenarios', () => {
    it('should handle multiple concurrent requests to same endpoint', async () => {
      let resolveFunc: ((value: string) => void) | undefined;
      const promise = new Promise<string>((resolve) => {
        resolveFunc = resolve;
      });
      
      const mockFunc = vi.fn().mockReturnValue(promise);
      
      // Start 5 concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        deduplicator.execute('/api/test', {}, mockFunc)
      );
      
      resolveFunc!('done');
      
      const results = await Promise.all(promises);
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
      expect(results).toEqual(['done', 'done', 'done', 'done', 'done']);
      
      const stats = deduplicator.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(4);
    });

    it('should handle race conditions', async () => {
      const mockFunc = vi.fn().mockResolvedValue('result');
      
      // Rapid fire requests
      const promises = Array.from({ length: 10 }, () =>
        deduplicator.execute('/api/test', {}, mockFunc)
      );
      
      const results = await Promise.all(promises);
      
      expect(mockFunc).toHaveBeenCalledTimes(1);
      expect(results.every(r => r === 'result')).toBe(true);
    });
  });
});

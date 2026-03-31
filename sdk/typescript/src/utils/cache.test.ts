// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ResponseCache } from './cache';

describe('ResponseCache', () => {
  let cache: ResponseCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new ResponseCache<string>(60, 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create cache with default TTL and max entries', () => {
      const defaultCache = new ResponseCache();
      expect(defaultCache.size()).toBe(0);
      const metrics = defaultCache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
    });

    it('should create cache with custom TTL', () => {
      const customCache = new ResponseCache<string>(120);
      expect(customCache.size()).toBe(0);
    });

    it('should create cache with custom max entries', () => {
      const customCache = new ResponseCache<string>(60, 500);
      expect(customCache.size()).toBe(0);
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
      const metrics = cache.getMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);
    });

    it('should return cached value for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(0);
    });

    it('should return null for expired key', () => {
      cache.set('key1', 'value1', 10); // 10 seconds TTL
      
      // Fast-forward time by 11 seconds
      vi.advanceTimersByTime(11000);
      
      expect(cache.get('key1')).toBeNull();
      const metrics = cache.getMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.entries).toBe(0);
    });

    it('should decrement entries when expiring', () => {
      cache.set('key1', 'value1', 5);
      expect(cache.size()).toBe(1);
      
      vi.advanceTimersByTime(6000);
      
      cache.get('key1'); // Trigger expiration check
      expect(cache.size()).toBe(0);
    });
  });

  describe('set', () => {
    it('should set a value with default TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      expect(cache.size()).toBe(1);
      
      const metrics = cache.getMetrics();
      expect(metrics.entries).toBe(1);
    });

    it('should set a value with custom TTL', () => {
      cache.set('key1', 'value1', 30);
      expect(cache.get('key1')).toBe('value1');
      
      vi.advanceTimersByTime(29000);
      expect(cache.get('key1')).toBe('value1');
      
      vi.advanceTimersByTime(2000);
      expect(cache.get('key1')).toBeNull();
    });

    it('should update existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
      expect(cache.size()).toBe(1);
    });

    it('should enforce max entries limit', () => {
      const smallCache = new ResponseCache<string>(60, 3);
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      expect(smallCache.size()).toBe(3);
      
      // Adding 4th entry should remove oldest
      smallCache.set('key4', 'value4');
      expect(smallCache.size()).toBe(3);
      expect(smallCache.get('key1')).toBeNull(); // Oldest removed
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });

    it('should not remove entries when updating existing key', () => {
      const smallCache = new ResponseCache<string>(60, 3);
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      
      // Update existing key should not trigger removal
      smallCache.set('key1', 'updated');
      expect(smallCache.size()).toBe(3);
      expect(smallCache.get('key1')).toBe('updated');
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.size()).toBe(0);
    });

    it('should return false for non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should decrement entries count', () => {
      cache.set('key1', 'value1');
      expect(cache.getMetrics().entries).toBe(1);
      
      cache.delete('key1');
      expect(cache.getMetrics().entries).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });

    it('should reset entries count to 0', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      expect(cache.getMetrics().entries).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('should remove expired entries', () => {
      cache.set('key1', 'value1', 5);
      cache.set('key2', 'value2', 10);
      cache.set('key3', 'value3', 15);
      
      vi.advanceTimersByTime(12000);
      
      const removed = cache.cleanupExpired();
      expect(removed).toBe(2);
      expect(cache.size()).toBe(1);
      expect(cache.get('key3')).toBe('value3');
    });

    it('should increment cleanupCount', () => {
      cache.set('key1', 'value1', 5);
      
      vi.advanceTimersByTime(6000);
      cache.cleanupExpired();
      
      const metrics = cache.getMetrics();
      expect(metrics.cleanupCount).toBe(1);
    });

    it('should return 0 when no expired entries', () => {
      cache.set('key1', 'value1', 60);
      
      vi.advanceTimersByTime(30000);
      
      const removed = cache.cleanupExpired();
      expect(removed).toBe(0);
      expect(cache.size()).toBe(1);
    });
  });

  describe('size', () => {
    it('should return correct number of entries', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object', () => {
      const metrics = cache.getMetrics();
      expect(metrics).toEqual({
        hits: 0,
        misses: 0,
        entries: 0,
        cleanupCount: 0,
      });
    });

    it('should return a copy of metrics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      
      const metrics1 = cache.getMetrics();
      metrics1.hits = 999;
      
      const metrics2 = cache.getMetrics();
      expect(metrics2.hits).toBe(1);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics except entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1');
      cache.get('nonexistent');
      cache.cleanupExpired();
      
      cache.resetMetrics();
      
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.entries).toBe(2); // Entries preserved
      expect(metrics.cleanupCount).toBe(0);
    });
  });

  describe('getHitRate', () => {
    it('should return 0 when no requests', () => {
      expect(cache.getHitRate()).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      
      const hitRate = cache.getHitRate();
      expect(hitRate).toBeCloseTo(66.67, 1);
    });

    it('should return 100 for all hits', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1');
      cache.get('key2');
      
      expect(cache.getHitRate()).toBe(100);
    });

    it('should return 0 for all misses', () => {
      cache.get('key1');
      cache.get('key2');
      cache.get('key3');
      
      expect(cache.getHitRate()).toBe(0);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed operations correctly', () => {
      // Set multiple keys
      cache.set('a', 'A', 10);
      cache.set('b', 'B', 20);
      cache.set('c', 'C', 30);
      
      // Read some
      expect(cache.get('a')).toBe('A');
      expect(cache.get('b')).toBe('B');
      
      // Time passes
      vi.advanceTimersByTime(15000);
      
      // 'a' should be expired
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBe('B');
      expect(cache.get('c')).toBe('C');
      
      // Update 'b'
      cache.set('b', 'B_updated', 25);
      expect(cache.get('b')).toBe('B_updated');
      
      // Delete 'c'
      cache.delete('c');
      expect(cache.get('c')).toBeNull();
      
      // Final state
      expect(cache.size()).toBe(1);
      expect(cache.get('b')).toBe('B_updated');
    });
  });
});

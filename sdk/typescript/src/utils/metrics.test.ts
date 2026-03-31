// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetricsCollector, MetricsContext } from './metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('constructor', () => {
    it('should create collector with default max samples', () => {
      const defaultCollector = new MetricsCollector();
      expect(defaultCollector).toBeDefined();
    });

    it('should create collector with custom max samples', () => {
      const customCollector = new MetricsCollector(500);
      expect(customCollector).toBeDefined();
    });
  });

  describe('record', () => {
    it('should record a successful request', () => {
      collector.record('/api/test', 100, true);
      
      const stats = collector.getStats('/api/test');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.successCount).toBe(1);
      expect(stats!.failureCount).toBe(0);
    });

    it('should record a failed request', () => {
      collector.record('/api/test', 200, false);
      
      const stats = collector.getStats('/api/test');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.successCount).toBe(0);
      expect(stats!.failureCount).toBe(1);
    });

    it('should record multiple requests for same endpoint', () => {
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 150, true);
      collector.record('/api/test', 200, false);
      
      const stats = collector.getStats('/api/test');
      expect(stats!.count).toBe(3);
      expect(stats!.successCount).toBe(2);
      expect(stats!.failureCount).toBe(1);
    });

    it('should trim to max samples', () => {
      const limitedCollector = new MetricsCollector(5);
      
      // Record 10 samples
      for (let i = 0; i < 10; i++) {
        limitedCollector.record('/api/test', 100 + i * 10, true);
      }
      
      const stats = limitedCollector.getStats('/api/test');
      expect(stats!.count).toBe(5); // Should only keep last 5
    });
  });

  describe('getStats', () => {
    it('should return null for non-existent endpoint', () => {
      const stats = collector.getStats('/nonexistent');
      expect(stats).toBeNull();
    });

    it('should return null for empty samples', () => {
      collector.record('/api/test', 100, true);
      collector.reset();
      
      const stats = collector.getStats('/api/test');
      expect(stats).toBeNull();
    });

    it('should calculate min duration correctly', () => {
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 50, true);
      collector.record('/api/test', 200, true);
      
      const stats = collector.getStats('/api/test');
      expect(stats!.minDurationMs).toBe(50);
    });

    it('should calculate max duration correctly', () => {
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 50, true);
      collector.record('/api/test', 200, true);
      
      const stats = collector.getStats('/api/test');
      expect(stats!.maxDurationMs).toBe(200);
    });

    it('should calculate average duration correctly', () => {
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 200, true);
      collector.record('/api/test', 300, true);
      
      const stats = collector.getStats('/api/test');
      expect(stats!.avgDurationMs).toBe(200);
    });

    it('should calculate percentiles correctly', () => {
      // Record 20 samples
      for (let i = 1; i <= 20; i++) {
        collector.record('/api/test', i * 10, true);
      }
      
      const stats = collector.getStats('/api/test');
      expect(stats!.p50DurationMs).toBeGreaterThanOrEqual(100);
      expect(stats!.p95DurationMs).toBeGreaterThanOrEqual(190);
      expect(stats!.p99DurationMs).toBeGreaterThanOrEqual(190);
    });

    it('should handle single sample', () => {
      collector.record('/api/test', 150, true);
      
      const stats = collector.getStats('/api/test');
      expect(stats!.count).toBe(1);
      expect(stats!.minDurationMs).toBe(150);
      expect(stats!.maxDurationMs).toBe(150);
      expect(stats!.avgDurationMs).toBe(150);
      expect(stats!.p50DurationMs).toBe(150);
    });

    it('should get success rate from getSuccessRate method', () => {
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 100, false);
      
      const stats = collector.getStats('/api/test');
      expect(stats!.getSuccessRate()).toBeCloseTo(0.667, 2);
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all endpoints', () => {
      collector.record('/api/users', 100, true);
      collector.record('/api/posts', 200, true);
      collector.record('/api/comments', 150, false);
      
      const allStats = collector.getAllStats();
      expect(allStats.size).toBe(3);
      expect(allStats.has('/api/users')).toBe(true);
      expect(allStats.has('/api/posts')).toBe(true);
      expect(allStats.has('/api/comments')).toBe(true);
    });

    it('should skip endpoints with no samples', () => {
      collector.record('/api/test', 100, true);
      collector.reset();
      
      const allStats = collector.getAllStats();
      expect(allStats.size).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should return summary with no data', () => {
      const summary = collector.getSummary();
      expect(summary.totalRequests).toBe(0);
      expect(summary.totalSuccess).toBe(0);
      expect(summary.totalFailures).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.endpointCount).toBe(0);
    });

    it('should calculate total requests correctly', () => {
      collector.record('/api/users', 100, true);
      collector.record('/api/users', 150, true);
      collector.record('/api/posts', 200, false);
      
      const summary = collector.getSummary();
      expect(summary.totalRequests).toBe(3);
      expect(summary.totalSuccess).toBe(2);
      expect(summary.totalFailures).toBe(1);
    });

    it('should calculate success rate correctly', () => {
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 100, false);
      collector.record('/api/test', 100, false);
      
      const summary = collector.getSummary();
      expect(summary.successRate).toBe(0.5);
    });

    it('should count unique endpoints', () => {
      collector.record('/api/a', 100, true);
      collector.record('/api/b', 100, true);
      collector.record('/api/c', 100, true);
      collector.record('/api/a', 100, true); // Duplicate
      
      const summary = collector.getSummary();
      expect(summary.endpointCount).toBe(3);
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      collector.record('/api/test', 100, true);
      collector.record('/api/test', 150, false);
      collector.record('/api/other', 200, true);
      
      collector.reset();
      
      const summary = collector.getSummary();
      expect(summary.totalRequests).toBe(0);
      expect(summary.endpointCount).toBe(0);
      
      const stats = collector.getStats('/api/test');
      expect(stats).toBeNull();
    });
  });

  describe('empty samples edge case', () => {
    it('should handle empty samples in calculateStats', () => {
      // This tests the private method indirectly through getStats
      collector.record('/api/test', 100, true);
      collector.reset();
      
      const stats = collector.getStats('/api/test');
      expect(stats).toBeNull();
    });
  });
});

describe('MetricsContext', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    collector = new MetricsCollector();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create context with collector and endpoint', () => {
      const context = new MetricsContext(collector, '/api/test');
      expect(context).toBeDefined();
    });
  });

  describe('markSuccess', () => {
    it('should mark operation as successful', () => {
      const context = new MetricsContext(collector, '/api/test');
      context.markSuccess();
      context.record();
      
      const stats = collector.getStats('/api/test');
      expect(stats!.successCount).toBe(1);
      expect(stats!.failureCount).toBe(0);
    });

    it('should default to failure if not marked', () => {
      const context = new MetricsContext(collector, '/api/test');
      // Don't call markSuccess()
      context.record();
      
      const stats = collector.getStats('/api/test');
      expect(stats!.successCount).toBe(0);
      expect(stats!.failureCount).toBe(1);
    });
  });

  describe('record', () => {
    it('should record duration from start time', () => {
      const context = new MetricsContext(collector, '/api/test');
      context.markSuccess();
      
      // Simulate some time passing
      vi.advanceTimersByTime(250);
      
      context.record();
      
      const stats = collector.getStats('/api/test');
      expect(stats!.count).toBe(1);
      expect(stats!.minDurationMs).toBeGreaterThanOrEqual(250);
      expect(stats!.maxDurationMs).toBeGreaterThanOrEqual(250);
    });

    it('should record to correct endpoint', () => {
      const context1 = new MetricsContext(collector, '/api/users');
      const context2 = new MetricsContext(collector, '/api/posts');
      
      context1.markSuccess();
      context1.record();
      
      context2.markSuccess();
      context2.record();
      
      expect(collector.getStats('/api/users')).not.toBeNull();
      expect(collector.getStats('/api/posts')).not.toBeNull();
      expect(collector.getStats('/api/comments')).toBeNull();
    });

    it('should accumulate multiple records', () => {
      const context = new MetricsContext(collector, '/api/test');
      
      context.markSuccess();
      context.record();
      
      context.markSuccess();
      context.record();
      
      const stats = collector.getStats('/api/test');
      expect(stats!.count).toBe(2);
      expect(stats!.successCount).toBe(2);
    });
  });

  describe('integration', () => {
    it('should work with try-catch pattern', () => {
      const context = new MetricsContext(collector, '/api/test');
      
      try {
        context.markSuccess();
        // Simulate operation
      } catch (error) {
        // Don't mark success on error
      } finally {
        context.record();
      }
      
      const stats = collector.getStats('/api/test');
      expect(stats!.successCount).toBe(1);
    });

    it('should track failures correctly', () => {
      const context = new MetricsContext(collector, '/api/test');
      
      // Simulate failure (don't call markSuccess)
      context.record();
      
      const stats = collector.getStats('/api/test');
      expect(stats!.failureCount).toBe(1);
      expect(stats!.getSuccessRate()).toBe(0);
    });
  });
});

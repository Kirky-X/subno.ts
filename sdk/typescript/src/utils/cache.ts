// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Response Cache Utility
 *
 * Provides simple in-memory caching for API responses to reduce redundant requests.
 */

/**
 * A cache entry with value and expiration.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Performance metrics for the cache.
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  entries: number;
  cleanupCount: number;
}

/**
 * Simple in-memory response cache with TTL support.
 */
export class ResponseCache<T = unknown> {
  private readonly cache: Map<string, CacheEntry<T>>;
  private readonly defaultTtl: number;
  private readonly maxEntries: number;
  private metrics: CacheMetrics;

  /**
   * Create a new response cache.
   *
   * @param defaultTtl Default time-to-live in seconds
   * @param maxEntries Maximum number of entries (default: 1000)
   */
  constructor(defaultTtl: number = 60, maxEntries: number = 1000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtl;
    this.maxEntries = maxEntries;
    this.metrics = {
      hits: 0,
      misses: 0,
      entries: 0,
      cleanupCount: 0,
    };
  }

  /**
   * Get a value from cache.
   *
   * @param key Cache key
   * @returns Cached value if exists and not expired, null otherwise
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      // Expired, remove it
      this.cache.delete(key);
      this.metrics.entries--;
      this.metrics.misses++;
      return null;
    }

    this.metrics.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache.
   *
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in seconds (uses default if not specified)
   */
  set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTtl) * 1000,
    };

    // Enforce max entries limit
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.metrics.entries--;
      }
    }

    this.cache.set(key, entry);
    this.metrics.entries++;
  }

  /**
   * Delete a value from cache.
   *
   * @param key Cache key
   * @returns true if key was deleted, false if not found
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.entries--;
    }
    return deleted;
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.metrics.entries = 0;
  }

  /**
   * Remove all expired entries.
   *
   * @returns Number of entries removed
   */
  cleanupExpired(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.metrics.entries--;
    }

    this.metrics.cleanupCount += expiredKeys.length;
    return expiredKeys.length;
  }

  /**
   * Get the number of entries in cache.
   *
   * @returns Number of cache entries
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache metrics.
   *
   * @returns Cache performance metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics.
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      entries: this.cache.size,
      cleanupCount: 0,
    };
  }

  /**
   * Get cache hit rate.
   *
   * @returns Hit rate as percentage (0-100)
   */
  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }
}
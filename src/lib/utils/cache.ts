// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { LRUCache } from 'lru-cache';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export interface CacheConfig<K, V> {
  /** Maximum number of items in the cache */
  max: number | Map<K, V>;
  /** Default time-to-live in milliseconds (optional) */
  ttl?: number;
  /** Called when an item is removed from the cache */
  dispose?: (value: V, key: K, reason: 'evict' | 'set' | 'delete') => void;
}

/**
 * High-performance LRU cache wrapper with TTL support
 * Uses lru-cache library for optimal memory management
 */
export class Cache<K extends string | number, V> {
  private cache: LRUCache<K, CacheEntry<V>>;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig<K, V>) {
    const options: any = {
      max: typeof config.max === 'number' ? config.max : 1000,
      dispose: (entry: CacheEntry<V>, key: K) => {
        if (config.dispose) {
          config.dispose(entry.value, key as unknown as K, 'evict');
        }
      },
    };

    if (config.ttl) {
      options.ttl = config.ttl;
      options.ttlAutopurge = true;
    }

    this.cache = new LRUCache<K, CacheEntry<V>>(options);
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.ttl !== undefined) {
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.misses++;
        return undefined;
      }
    }

    this.hits++;
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.cache.ttl,
    };

    this.cache.set(key, entry);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.ttl !== undefined) {
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        return false;
      }
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.cache.size;
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  async getOrCompute(key: K, computeFn: () => Promise<V>, ttl?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await computeFn();
    this.set(key, value, ttl);
    return value;
  }

  getOrComputeSync(key: K, computeFn: () => V, ttl?: number): V {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = computeFn();
    this.set(key, value, ttl);
    return value;
  }
}

/**
 * Pre-configured caches for common use cases
 */

// API Key validation cache (frequently accessed)
export const apiKeyCache = new Cache<
  string,
  { userId: string; permissions: string[]; isValid: boolean }
>({
  max: 5000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

// Channel lookup cache (moderately accessed)
export const channelCache = new Cache<
  string,
  { id: string; name: string; type: string; creator?: string }
>({
  max: 2000,
  ttl: 10 * 60 * 1000, // 10 minutes
});

// Public key cache (security-sensitive, shorter TTL)
export const publicKeyCache = new Cache<
  string,
  { id: string; channelId: string; algorithm: string; expiresAt?: Date }
>({
  max: 3000,
  ttl: 2 * 60 * 1000, // 2 minutes
});

// Rate limit state cache (very frequently accessed)
export const rateLimitStateCache = new Cache<string, { count: number; windowStart: number }>({
  max: 10000,
  ttl: 1 * 60 * 1000, // 1 minute
});

export function createCache<K extends string | number, V>(config: CacheConfig<K, V>): Cache<K, V> {
  return new Cache(config);
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Request deduplication utility for SDK operations.
 *
 * This module provides functionality to prevent duplicate requests from being sent
 * to the server within a short time window. This is useful for:
 * - Reducing server load
 * - Improving response speed (return cached result immediately)
 * - Preventing duplicate operations (e.g., duplicate registration)
 */

export interface PendingRequest {
  timestamp: number;
  promise: Promise<any>;
}

export interface DeduplicatorStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  pendingCount: number;
  completedCount: number;
  ttlSeconds: number;
}

/**
 * Prevents duplicate requests from being sent within a short time window.
 *
 * This class tracks in-flight requests and returns the same result to all
 * concurrent requests for the same endpoint and parameters.
 *
 * @example
 * ```typescript
 * const deduplicator = new RequestDeduplicator({ ttlSeconds: 5.0 });
 *
 * // First request
 * const result1 = await deduplicator.execute(
 *   'register_public_key',
 *   { channel_id: 'test', public_key: '...' },
 *   () => apiCall()
 * );
 *
 * // Concurrent duplicate request (will wait for first request)
 * const result2 = await deduplicator.execute(
 *   'register_public_key',
 *   { channel_id: 'test', public_key: '...' },
 *   () => apiCall()
 * );
 * // result1 === result2 (same object)
 * ```
 */
export class RequestDeduplicator {
  private pending: Map<string, PendingRequest>;
  private completed: Map<string, any>;
  private hits: number = 0;
  private misses: number = 0;
  private errors: number = 0;

  constructor(
    private options: {
      ttlSeconds?: number;
      maxPending?: number;
      maxCached?: number;
    } = {}
  ) {
    const {
      ttlSeconds = 5.0,
      maxPending = 1000,
      maxCached = 10000,
    } = options;

    this.options.ttlSeconds = ttlSeconds;
    this.options.maxPending = maxPending;
    this.options.maxCached = maxCached;

    this.pending = new Map();
    this.completed = new Map();
  }

  /**
   * Generate a unique key for the request.
   */
  private generateKey(endpoint: string, params: Record<string, any> | undefined): string {
    // Create a deterministic string from the parameters
    const paramsStr = params ? JSON.stringify(params, Object.keys(params).sort()) : '';
    const key = `${endpoint}:${paramsStr}`;

    // Use SHA256 for better distribution
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `req_${hash}`;
  }

  /**
   * Execute a request with deduplication.
   *
   * @param endpoint - API endpoint
   * @param params - Request parameters
   * @param func - Async function to execute the request
   * @param useCache - Whether to use completed request cache
   * @returns Result from the request function
   */
  async execute<T>(
    endpoint: string,
    params: Record<string, any> | undefined,
    func: () => Promise<T>,
    useCache: boolean = true
  ): Promise<T> {
    const key = this.generateKey(endpoint, params);

    // Check completed cache first
    if (useCache && this.completed.has(key)) {
      this.hits++;
      return this.completed.get(key);
    }

    // Check pending requests
    if (this.pending.has(key)) {
      // Request is pending, wait for result
      this.hits++;
      const pending = this.pending.get(key)!;
      return pending.promise as T;
    }

    // Execute the request
    this.misses++;

    // Create a promise for this request
    const promise = (async () => {
      try {
        const result = await func();

        // Store result in completed cache
        if (useCache) {
          if (this.completed.size >= (this.options.maxCached || 10000)) {
            // Remove oldest entry (simple FIFO)
            const firstKey = this.completed.keys().next().value;
            this.completed.delete(firstKey);
          }
          this.completed.set(key, result);
        }

        return result;
      } catch (error) {
        this.errors++;
        throw error;
      } finally {
        // Remove from pending
        this.pending.delete(key);
      }
    })();

    // Store pending request
    if (this.pending.size >= (this.options.maxPending || 1000)) {
      // Remove oldest pending request
      const firstKey = this.pending.keys().next().value;
      this.pending.delete(firstKey);
    }

    this.pending.set(key, {
      timestamp: Date.now(),
      promise,
    });

    return promise;
  }

  /**
   * Remove expired entries from completed cache.
   *
   * @returns Number of entries removed
   */
  cleanupExpired(): number {
    let removed = 0;
    const cutoff = Date.now() - ((this.options.ttlSeconds || 5.0) * 1000);

    // Remove oldest entries if we exceed maxCached
    while (this.completed.size > (this.options.maxCached || 10000) * 2) {
      const firstKey = this.completed.keys().next().value;
      if (firstKey) {
        this.completed.delete(firstKey);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all pending requests.
   *
   * @returns Number of pending requests cleared
   */
  clearPending(): number {
    const count = this.pending.size;
    this.pending.clear();
    return count;
  }

  /**
   * Clear all completed requests.
   *
   * @returns Number of completed requests cleared
   */
  clearCompleted(): number {
    const count = this.completed.size;
    this.completed.clear();
    return count;
  }

  /**
   * Clear all pending and completed requests.
   *
   * @returns Total number of requests cleared
   */
  clearAll(): number {
    const pendingCount = this.clearPending();
    const completedCount = this.clearCompleted();
    return pendingCount + completedCount;
  }

  /**
   * Get statistics about the deduplicator.
   *
   * @returns Dictionary with statistics
   */
  getStats(): DeduplicatorStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0.0;

    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRate,
      pendingCount: this.pending.size,
      completedCount: this.completed.size,
      ttlSeconds: this.options.ttlSeconds || 5.0,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
  }
}
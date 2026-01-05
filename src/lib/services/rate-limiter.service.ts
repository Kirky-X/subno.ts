// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { RedisRepository } from '@/lib/repositories/redis.repository';
import { env } from '@/config/env';

/**
 * Rate Limiter Service - Implements sliding window rate limiting
 * Prevents abuse by limiting request rates for different operations
 */
export class RateLimiterService {
  private redis: RedisRepository;

  constructor() {
    this.redis = new RedisRepository();
  }

  /**
   * Generic rate limit check
   * @param key - Rate limit key (e.g., "publish:192.168.1.1")
   * @param limit - Maximum requests allowed in window
   * @param windowSeconds - Time window in seconds
   * @returns true if allowed, false if rate limited
   */
  async checkLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Get current count in window
    const count = await this.redis.getRateLimitCount(key, windowStart);

    if (count >= limit) {
      return false;
    }

    // Add new request
    await this.redis.addRateLimit(key, now, windowSeconds);

    return true;
  }

  /**
   * Check publish rate limit
   * @param identifier - IP address or identifier
   * @returns true if allowed, false if rate limited
   */
  async checkPublishLimit(identifier: string): Promise<boolean> {
    return this.checkLimit(
      `publish:${identifier}`,
      env.RATE_LIMIT_PUBLISH,
      1 // 1 second window
    );
  }

  /**
   * Check register rate limit with exponential backoff on repeated failures
   * Implements progressive throttling to prevent brute force attacks
   * @param identifier - IP address or identifier
   * @returns true if allowed, false if rate limited
   */
  async checkRegisterLimit(identifier: string): Promise<boolean> {
    // Check if client has been locked out due to repeated failures
    const lockoutKey = `register:lockout:${identifier}`;
    const lockedUntil = await this.redis.get(lockoutKey);

    if (lockedUntil) {
      const lockoutTime = parseInt(lockedUntil);
      if (lockoutTime > Date.now()) {
        return false; // Still locked out
      }
    }

    const failCount = await this.redis.get(`register:fail:${identifier}`);
    const currentFailures = failCount ? parseInt(failCount) : 0;

    // Apply progressive rate limiting based on failure count
    let limit = env.RATE_LIMIT_REGISTER;
    let windowSeconds = 60;

    if (currentFailures >= 3) {
      // After 3 failures: 3 requests / 10 minutes
      limit = 3;
      windowSeconds = 600;
    }
    if (currentFailures >= 5) {
      // After 5 failures: 1 request / 30 minutes
      limit = 1;
      windowSeconds = 1800;
    }
    if (currentFailures >= 7) {
      // After 7 failures: Lock out for 1 hour
      await this.redis.setex(lockoutKey, 3600, Date.now() + 3600000);
      return false;
    }

    const allowed = await this.checkLimit(
      `register:${identifier}`,
      limit,
      windowSeconds
    );

    if (!allowed) {
      // Track failed attempts
      await this.redis.incr(`register:fail:${identifier}`);
      await this.redis.expire(`register:fail:${identifier}`, 3600); // Track for 1 hour
    }

    return allowed;
  }

  /**
   * Check subscribe rate limit
   * @param identifier - IP address or identifier
   * @returns true if allowed, false if rate limited
   */
  async checkSubscribeLimit(identifier: string): Promise<boolean> {
    return this.checkLimit(
      `subscribe:${identifier}`,
      env.RATE_LIMIT_SUBSCRIBE,
      60 // 60 second window
    );
  }

  /**
   * Get remaining requests for a key
   * @param key - Rate limit key
   * @param limit - Maximum requests allowed
   * @param windowSeconds - Time window in seconds
   * @returns Number of remaining requests
   */
  async getRemainingRequests(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const count = await this.redis.getRateLimitCount(key, windowStart);
    return Math.max(0, limit - count);
  }

  /**
   * Get retry after seconds when rate limited
   * @param key - Rate limit key
   * @param windowSeconds - Time window in seconds
   * @returns Seconds until retry is allowed
   */
  async getRetryAfter(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const count = await this.redis.getRateLimitCount(key, windowStart);

    if (count === 0) {
      return 0;
    }

    // Get the oldest request timestamp to calculate accurate retry time
    const oldestTimestamp = await this.redis.getOldestRequestTimestamp(key);

    if (oldestTimestamp === null) {
      // Fallback if we can't get the oldest timestamp
      return 1;
    }

    // Calculate when the oldest request will expire from the window
    const expiryTime = oldestTimestamp + windowSeconds * 1000;
    const retryAfter = Math.max(0, Math.ceil((expiryTime - now) / 1000));

    // Always return at least 1 second
    return Math.max(1, retryAfter);
  }
}

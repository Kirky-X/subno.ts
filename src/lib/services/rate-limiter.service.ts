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
   * Check register rate limit
   * @param identifier - IP address or identifier
   * @returns true if allowed, false if rate limited
   */
  async checkRegisterLimit(identifier: string): Promise<boolean> {
    return this.checkLimit(
      `register:${identifier}`,
      env.RATE_LIMIT_REGISTER,
      60 // 60 second window
    );
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

    // Estimate when the oldest request will expire
    // This is a simple estimation
    return 1; // Default to 1 second retry after
  }
}

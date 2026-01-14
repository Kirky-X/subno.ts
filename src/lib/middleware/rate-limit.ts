// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMIT_CONFIG, getRateLimitConfig as getConfig, getCleanupIntervalMs, getRateLimitWindowMs } from '../config';

/**
 * Rate limit configuration for different endpoint types
 */
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * In-memory storage for rate limiting
 * Uses Map with timestamps as values for sliding window
 * Implements LRU eviction to prevent unbounded memory growth
 */
class RateLimitStore {
  private store: Map<string, number[]> = new Map();
  private readonly MAX_ENTRIES = 10000; // Maximum number of entries to store

  /**
   * Remove oldest entry when cache is full (LRU strategy)
   */
  private evictOldest(): void {
    if (this.store.size >= this.MAX_ENTRIES) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.store.entries()) {
      // Keep only timestamps within the last hour (max window)
      const filtered = timestamps.filter(t => now - t < 3600000);
      if (filtered.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, filtered);
      }
    }
  }

  /**
   * Check if request is within rate limit
   * Implements LRU eviction when storing new keys
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // LRU eviction: ensure we have room for new entries
    if (!this.store.has(key) && this.store.size >= this.MAX_ENTRIES) {
      this.evictOldest();
    }

    // Get existing timestamps for this key
    const timestamps = this.store.get(key) || [];

    // Filter to only timestamps within current window
    const windowTimestamps = timestamps.filter(t => t > windowStart);

    // Check if under limit
    if (windowTimestamps.length < config.maxRequests) {
      // Add current request timestamp
      windowTimestamps.push(now);
      this.store.set(key, windowTimestamps);

      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - windowTimestamps.length,
        resetAt: now + config.windowMs,
      };
    }

    // Rate limited
    const oldestTimestamp = windowTimestamps[0];
    const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);

    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: oldestTimestamp + config.windowMs,
      retryAfter,
    };
  }

  /**
   * Get current store size (for monitoring)
   */
  getSize(): number {
    return this.store.size;
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

// Singleton store instance
const rateLimitStore = new RateLimitStore();

// Clean up with configurable interval
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimitStore.cleanup(), getCleanupIntervalMs());
}

/**
 * Get rate limit configuration for a specific endpoint type
 * Uses cached configuration from config module
 */
function getRateLimitConfig(endpointType: string): RateLimitConfig {
  return {
    windowMs: getRateLimitWindowMs(),
    maxRequests: getConfig(endpointType),
  };
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check forwarded headers first (for behind proxy)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Determine endpoint type from request
 */
function getEndpointType(request: NextRequest): string {
  const url = new URL(request.url);
  const path = url.pathname;
  
  if (path.includes('/publish')) return 'publish';
  if (path.includes('/register')) return 'register';
  if (path.includes('/subscribe')) return 'subscribe';
  if (path.includes('/revoke')) return 'revoke';
  
  return 'default';
}

/**
 * Create rate limit response headers
 */
function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
  };
}

/**
 * Rate limit middleware function
 * Use this in your middleware or API routes
 * 
 * @param request - Next.js request object
 * @param endpointType - Type of endpoint (default, publish, register, subscribe, revoke)
 * @returns RateLimitResult indicating if request is allowed
 */
export function rateLimit(
  request: NextRequest,
  endpointType?: string
): RateLimitResult {
  const type = endpointType || getEndpointType(request);
  const config = getRateLimitConfig(type);
  const clientIP = getClientIP(request);
  
  return rateLimitStore.check(clientIP, config);
}

/**
 * Create a Next.js Response with rate limit headers
 */
export function createRateLimitedResponse(
  message: string,
  result: RateLimitResult
): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'RATE_LIMITED',
      },
    },
    { status: 429 }
  );
  
  // Add rate limit headers
  for (const [key, value] of Object.entries(createRateLimitHeaders(result))) {
    response.headers.set(key, value);
  }
  
  return response;
}

/**
 * Helper to add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  for (const [key, value] of Object.entries(createRateLimitHeaders(result))) {
    response.headers.set(key, value);
  }
  return response;
}

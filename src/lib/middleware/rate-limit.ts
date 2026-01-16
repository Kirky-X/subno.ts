// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMIT_CONFIG, getRateLimitConfig as getConfig, getCleanupIntervalMs, getRateLimitWindowMs } from '../config';

// Redis client type definition with proper error handling
interface RedisClientType {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  zAdd: (key: string, score: number, member: string) => Promise<number>;
  zRemRangeByScore: (key: string, min: number | string, max: number | string) => Promise<number>;
  zCard: (key: string) => Promise<number>;
  zRangeWithScores: (key: string, start: number, stop: number) => Promise<Array<{ score: number; value: string }>>;
  expire: (key: string, seconds: number) => Promise<number>;
  on: (event: string, handler: (err?: Error) => void) => void;
  quit: () => Promise<void>;
  eval: (script: string, options: { keys: string[] }, ...args: (string | number)[]) => Promise<unknown>;
}

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
 * Lua script for atomic rate limiting with Redis
 * Uses Redis INCR for unique member generation instead of math.random()
 * This ensures thread-safety and atomicity across distributed deployments
 */
const RATE_LIMIT_LUA_SCRIPT = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local identifier = ARGV[4]

  -- Generate unique member using Redis INCR (atomic and distributed-safe)
  local counterKey = key .. ':counter'
  local memberId = redis.call('INCR', counterKey)
  local member = identifier .. ':' .. memberId

  -- Remove expired entries (older than window)
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

  -- Set expiry on counter to auto-cleanup (window + buffer)
  redis.call('EXPIRE', counterKey, math.ceil(window / 1000) + 120)

  -- Count current requests in window
  local count = redis.call('ZCARD', key)

  if count < limit then
    -- Add new request with current timestamp as score
    redis.call('ZADD', key, now, member)
    -- Set expiry slightly longer than window to auto-cleanup
    redis.call('EXPIRE', key, math.ceil(window / 1000) + 60)
    -- Return success with remaining count
    return {1, limit - count - 1, now + window}
  else
    -- Get oldest entry to calculate reset time
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local resetAt = 0
    if oldest and #oldest >= 2 then
      resetAt = tonumber(oldest[2]) + window
    else
      resetAt = now + window
    end
    local retryAfter = math.max(1, math.ceil((resetAt - now) / 1000))
    return {0, 0, resetAt, retryAfter}
  end
`;

/**
 * Redis-based distributed rate limiting store
 * Provides consistent rate limiting across multiple server instances
 */
class RedisRateLimitStore {
  private client: RedisClientType | null = null;
  private connectionPromise: Promise<void> | null = null;
  private useMemoryFallback = false;
  private memoryFallback: MemoryRateLimitStore | null = null;

  /**
   * Initialize Redis connection with lazy loading
   */
  async initialize(): Promise<void> {
    if (this.client || this.useMemoryFallback) {
      return;
    }

    // Check if Redis URL is available
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('REDIS_URL not configured, using memory fallback for rate limiting');
      this.useMemoryFallback = true;
      this.memoryFallback = new MemoryRateLimitStore();
      return;
    }

    try {
      // Dynamic import to avoid dependency issues when Redis is not installed
      const redisModule = await import('redis').catch(() => null);
      if (!redisModule || !redisModule.createClient) {
        console.warn('Redis module not available, using memory fallback');
        this.useMemoryFallback = true;
        this.memoryFallback = new MemoryRateLimitStore();
        return;
      }

      const createClient = redisModule.createClient;

      this.client = createClient({
        url: redisUrl,
      }) as RedisClientType;

      this.client.on('error', (err?: Error) => {
        console.error('Redis rate limit store error:', err?.message || 'Unknown error');
        // Switch to memory fallback on connection error
        this.useMemoryFallback = true;
        this.memoryFallback = new MemoryRateLimitStore();
        this.client = null;
      });

      this.connectionPromise = this.client.connect();
      await this.connectionPromise;
    } catch (error) {
      console.warn('Failed to connect to Redis, using memory fallback:', error);
      this.useMemoryFallback = true;
      this.memoryFallback = new MemoryRateLimitStore();
    }
  }

  /**
   * Check if request is within rate limit using Redis atomic operations
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    await this.initialize();

    if (this.useMemoryFallback && this.memoryFallback) {
      return this.memoryFallback.check(key, config);
    }

    if (!this.client) {
      // Fail CLOSED when Redis client is not available
      // This prevents bypassing rate limits when Redis fails
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt: Date.now() + config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000),
      };
    }

    try {
      // Wait for connection
      if (this.connectionPromise) {
        await this.connectionPromise;
      }

      const result = await this.client.eval(
        RATE_LIMIT_LUA_SCRIPT,
        { keys: [`ratelimit:${key}`] },
        config.maxRequests,
        config.windowMs,
        Date.now(),
        key
      ) as [number, number, number, number?];

      if (result[0] === 1) {
        return {
          success: true,
          limit: config.maxRequests,
          remaining: result[1],
          resetAt: result[2],
        };
      } else {
        return {
          success: false,
          limit: config.maxRequests,
          remaining: 0,
          resetAt: result[2],
          retryAfter: result[3],
        };
      }
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail CLOSED to prevent abuse when rate limiting is unavailable
      // This is more secure than failing open
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt: Date.now() + config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000),
      };
    }
  }

  /**
   * Get current store size (for monitoring)
   */
  async getSize(): Promise<number> {
    if (this.useMemoryFallback && this.memoryFallback) {
      return this.memoryFallback.getSize();
    }
    return 0;
  }

  /**
   * Clear all entries (for testing)
   */
  async clear(): Promise<void> {
    if (this.useMemoryFallback && this.memoryFallback) {
      this.memoryFallback.clear();
    }
  }
}

/**
 * Memory-based fallback store for when Redis is unavailable
 * Provides basic rate limiting for single-instance deployments
 */
class MemoryRateLimitStore {
  private store: Map<string, number[]> = new Map();
  private readonly MAX_ENTRIES = 10000;

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
    const maxWindow = 3600000; // 1 hour max window
    for (const [key, timestamps] of this.store.entries()) {
      const filtered = timestamps.filter(t => now - t < maxWindow);
      if (filtered.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, filtered);
      }
    }
  }

  /**
   * Check if request is within rate limit
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // LRU eviction: ensure we have room for new entries
    if (!this.store.has(key) && this.store.size >= this.MAX_ENTRIES) {
      this.evictOldest();
    }

    const timestamps = this.store.get(key) || [];
    const windowTimestamps = timestamps.filter(t => t > windowStart);

    if (windowTimestamps.length < config.maxRequests) {
      windowTimestamps.push(now);
      this.store.set(key, windowTimestamps);

      return {
        success: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - windowTimestamps.length,
        resetAt: now + config.windowMs,
      };
    }

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

  getSize(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

// Singleton store instance (Redis with memory fallback)
const rateLimitStore = new RedisRateLimitStore();

// Cleanup for memory fallback (Redis doesn't need periodic cleanup)
if (typeof setInterval !== 'undefined') {
  setInterval(async () => {
    const size = await rateLimitStore.getSize();
    if (size > 0) {
      // Only cleanup memory fallback if it has entries
      await rateLimitStore.clear();
    }
  }, getCleanupIntervalMs());
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
 * Get client IP address from request with spoofing protection
 * Only trusts X-Forwarded-For from known proxy configurations
 */
function getClientIP(request: NextRequest): string {
  // Get trusted proxy IPs from environment (comma-separated)
  const trustedProxies = process.env.TRUSTED_PROXY_IPS?.split(',').map(ip => ip.trim()) || [];
  const useProxy = trustedProxies.length > 0;

  // Check X-Forwarded-For header (only if proxy is trusted)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    
    if (useProxy) {
      // Only trust the last IP (original client) from the trusted proxy chain
      // The proxy should have appended the client IP at the end
      return ips[ips.length - 1] || 'unknown';
    } else {
      // No trusted proxies configured - only use direct connection IP
      // This prevents spoofing attacks
      console.warn('X-Forwarded-For header present but no TRUSTED_PROXY_IPS configured');
    }
  }
  
  // Use X-Real-IP header as fallback
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Try to get IP from connection remote address
  // @ts-expect-error Next.js 13+ may have ip property on request
  const reqIp = request.ip || (request as { ip?: string }).ip;
  if (reqIp) {
    return reqIp;
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
 * @returns Promise<RateLimitResult> indicating if request is allowed
 */
export async function rateLimit(
  request: NextRequest,
  endpointType?: string
): Promise<RateLimitResult> {
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

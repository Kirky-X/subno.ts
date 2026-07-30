// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { getRateLimitConfig as getConfig, getRateLimitWindowMs } from '../config';
import { RateLimitError, extractRequestContext } from '../utils/error-handler';
import { getRedisClient } from '../utils/redis-client';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Rate limiter instance cache — 按 endpointType 复用 limiter。
 * 避免每次请求都构造新的 RateLimiterRedis/RateLimiterMemory 实例。
 * RateLimiterMemory 每次新建会使内存限流完全失效（每个请求独立计数器）。
 */
const limiterCache = new Map<
  string,
  { limiter: RateLimiterRedis | RateLimiterMemory; isRedis: boolean; clientRef: unknown }
>();

/**
 * Get or create rate limiter for endpoint type.
 * 复用 Redis limiter 实例（同一 Redis 连接），内存 limiter 同样复用。
 */
async function getRateLimiter(
  endpointType: string,
): Promise<{ limiter: RateLimiterRedis | RateLimiterMemory; isRedis: boolean }> {
  const config = getRateLimitConfig(endpointType);

  const commonOptions = {
    points: config.maxRequests,
    duration: Math.ceil(config.windowMs / 1000),
    blockDuration: 0,
  };

  // 尝试获取 Redis 客户端
  let client: Awaited<ReturnType<typeof getRedisClient>> = null;
  try {
    client = await getRedisClient();
  } catch (error) {
    console.warn('Redis rate limiter failed, falling back to memory:', error);
  }

  const cached = limiterCache.get(endpointType);

  // 缓存命中且客户端引用一致（Redis 连接未变化）→ 复用
  if (cached?.clientRef === client) {
    return { limiter: cached.limiter, isRedis: cached.isRedis };
  }

  // 创建新实例
  if (client) {
    const redisLimiter = new RateLimiterRedis({
      ...commonOptions,
      storeClient: client,
      keyPrefix: `rl:${endpointType}:`,
    });
    limiterCache.set(endpointType, { limiter: redisLimiter, isRedis: true, clientRef: client });
    return { limiter: redisLimiter, isRedis: true };
  }

  // 内存限流器（单例，避免计数器失效）
  const memoryLimiter = new RateLimiterMemory(commonOptions);
  limiterCache.set(endpointType, { limiter: memoryLimiter, isRedis: false, clientRef: null });
  return { limiter: memoryLimiter, isRedis: false };
}

/**
 * Get client IP address from request with spoofing protection
 * Only trusts X-Forwarded-For from known proxy configurations
 */
function getClientIP(request: NextRequest): string {
  // Get trusted proxy IPs from environment (comma-separated)
  const trustedProxies = process.env.TRUSTED_PROXY_IPS?.split(',').map(ip => ip.trim()) ?? [];
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
  const reqIp = request.ip ?? (request as { ip?: string }).ip;
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
function createRateLimitHeaders(
  points: number,
  remainingPoints: number,
  msBeforeNext: number,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': points.toString(),
    'X-RateLimit-Remaining': Math.max(0, remainingPoints).toString(),
    'X-RateLimit-Reset': Math.ceil((Date.now() + msBeforeNext) / 1000).toString(),
    ...(msBeforeNext > 0 && { 'Retry-After': Math.ceil(msBeforeNext / 1000).toString() }),
  };
}

/**
 * Rate limit middleware function
 * Uses rate-limiter-flexible library for robust distributed rate limiting
 *
 * @param request - Next.js request object
 * @param endpointType - Type of endpoint (default, publish, register, subscribe, revoke)
 * @returns Promise<RateLimitResult> indicating if request is allowed
 */
export async function rateLimit(
  request: NextRequest,
  endpointType?: string,
): Promise<RateLimitResult> {
  const type = endpointType ?? getEndpointType(request);
  const config = getRateLimitConfig(type);
  const clientIP = getClientIP(request);

  try {
    const { limiter } = await getRateLimiter(type);

    const result = await limiter.consume(clientIP);

    return {
      success: true,
      limit: config.maxRequests,
      remaining: result.remainingPoints,
      resetAt: Date.now() + result.msBeforeNext,
    };
  } catch (error: unknown) {
    // rate-limiter-flexible 抛出 RateLimiterRes 实例表示限流超限
    if (error instanceof RateLimiterRes) {
      // Rate limit exceeded - this is expected
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt: Date.now() + error.msBeforeNext,
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
      };
    }

    // Unexpected error - log and allow request (fail open)
    console.error('Rate limiting error:', error);
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: Date.now() + config.windowMs,
    };
  }
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
 * Create a Next.js Response with rate limit headers
 * Uses unified error handling
 */
export function createRateLimitedResponse(result: RateLimitResult): NextResponse {
  const context = extractRequestContext({} as NextRequest);
  const error = new RateLimitError(result.retryAfter ?? 60, {
    requestId: context.requestId,
  });

  const response = error.toNextResponse(context.requestId);

  // Add rate limit headers
  for (const [key, value] of Object.entries(
    createRateLimitHeaders(result.limit, result.remaining, result.resetAt - Date.now()),
  )) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Helper to add rate limit headers to a successful response
 */
export function addRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  for (const [key, value] of Object.entries(
    createRateLimitHeaders(result.limit, result.remaining, result.resetAt - Date.now()),
  )) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Check rate limit and return error response if exceeded
 * Convenience function for use in API routes
 */
export async function checkRateLimit(
  request: NextRequest,
  endpointType?: string,
): Promise<NextResponse | null> {
  const result = await rateLimit(request, endpointType);

  if (!result.success) {
    return createRateLimitedResponse(result);
  }

  return null;
}

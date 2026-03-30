// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import {
  RateLimiterRedis,
  RateLimiterMemory,
  type IRateLimiterStoreOptions,
} from 'rate-limiter-flexible';
import { getRateLimitConfig as getConfig, getCleanupIntervalMs, getRateLimitWindowMs } from '../config';
import {
  RateLimitError,
  extractRequestContext,
} from '../utils/error-handler';
import { getRedisClient } from '../utils/redis-client';

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
 * Rate limiter configuration factory
 * Creates appropriate rate limiter based on Redis availability
 */
function createRateLimiter(endpointType: string) {
  const config = getRateLimitConfig(endpointType);
  
  // Common options for both Redis and Memory limiters
  const commonOptions: IRateLimiterStoreOptions = {
    points: config.maxRequests,
    duration: Math.ceil(config.windowMs / 1000), // Convert to seconds
    blockDuration: 0, // Don't block, just reject
  };

  // Try to use Redis first, fallback to memory
  return async (key: string): Promise<{
    limiter: RateLimiterRedis | RateLimiterMemory;
    isRedis: boolean;
  }> => {
    try {
      const client = await getRedisClient();
      
      if (client) {
        const redisLimiter = new RateLimiterRedis({
          ...commonOptions,
          storeClient: client,
          keyPrefix: `rl:${endpointType}:`,
        });
        return { limiter: redisLimiter, isRedis: true };
      }
    } catch (error) {
      console.warn('Redis rate limiter failed, falling back to memory:', error);
    }

    // Fallback to memory limiter
    const memoryLimiter = new RateLimiterMemory(commonOptions);
    return { limiter: memoryLimiter, isRedis: false };
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
function createRateLimitHeaders(
  points: number,
  remainingPoints: number,
  msBeforeNext: number
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
  endpointType?: string
): Promise<RateLimitResult> {
  const type = endpointType || getEndpointType(request);
  const config = getRateLimitConfig(type);
  const clientIP = getClientIP(request);
  
  try {
    const limiterFactory = createRateLimiter(type);
    const { limiter, isRedis } = await limiterFactory(clientIP);
    
    const result = await limiter.consume(clientIP);
    
    return {
      success: true,
      limit: result.totalPoints,
      remaining: result.remainingPoints,
      resetAt: Date.now() + result.msBeforeNext,
    };
  } catch (error: any) {
    if (error.remainingPoints !== undefined) {
      // Rate limit exceeded - this is expected
      return {
        success: false,
        limit: error.totalPoints || config.maxRequests,
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
export function createRateLimitedResponse(
  result: RateLimitResult
): NextResponse {
  const context = extractRequestContext({} as NextRequest);
  const error = new RateLimitError(result.retryAfter || 60, {
    requestId: context.requestId,
  });
  
  const response = error.toNextResponse(context.requestId);
  
  // Add rate limit headers
  for (const [key, value] of Object.entries(createRateLimitHeaders(
    result.limit,
    result.remaining,
    result.resetAt - Date.now()
  ))) {
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
  for (const [key, value] of Object.entries(createRateLimitHeaders(
    result.limit,
    result.remaining,
    result.resetAt - Date.now()
  ))) {
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
  endpointType?: string
): Promise<NextResponse | null> {
  const result = await rateLimit(request, endpointType);
  
  if (!result.success) {
    return createRateLimitedResponse(result);
  }
  
  return null;
}

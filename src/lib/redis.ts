// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { createClient, type RedisClientType } from 'redis';
import { env } from '@/config/env';

// Track client state
let redisClient: RedisClientType | null = null;
let connectionPromise: Promise<RedisClientType> | null = null;

// Detect serverless environment
function detectServerless(): boolean {
  return (
    process.env.VERCEL === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
    process.env.FUNCTION_NAME !== undefined
  );
}

/**
 * Get or create Redis client singleton
 * Handles serverless environment edge cases with connection pooling
 */
export async function getRedisClient(): Promise<RedisClientType> {
  // Check for existing valid connection
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const isServerless = detectServerless();

  // Create new client with connection pool configuration
  redisClient = createClient({
    url: env.REDIS_URL,
    socket: isServerless
      ? {
        // Serverless-friendly socket options
        connectTimeout: 5000,
      }
      : {
        // Connection pool configuration for traditional deployments
        connectTimeout: 10000,
        // Reconnection strategy with exponential backoff
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          // Exponential backoff: 50ms * 2^retries, max 2 seconds
          return Math.min(50 * Math.pow(2, retries), 2000);
        },
      },
  });

  // Error handlers
  redisClient.on('error', (err: Error) => {
    console.error('Redis Client Error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  redisClient.on('reconnecting', () => {
    console.log('Redis Client Reconnecting...');
  });

  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    throw err;
  }

  return redisClient;
}

/**
 * Close Redis connection gracefully
 * Important for serverless environments
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log('Redis connection closed');
    } catch (err) {
      console.error('Error closing Redis connection:', err);
    } finally {
      redisClient = null;
    }
  }
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return redisClient?.isOpen ?? false;
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const client = await getRedisClient();
    await client.ping();
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      healthy: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      latency: Date.now() - start,
    };
  }
}

// For Vercel KV compatibility - simplified API
export const kv = {
  /**
   * Get value by key
   */
  get: async <T = string>(key: string): Promise<T | null> => {
    const client = await getRedisClient();
    const value = await client.get(key);
    if (value === null) return null;
    // Try to parse as JSON, but return as-is if it's already a string
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },

  /**
   * Set value with optional expiry
   */
  set: async (
    key: string,
    value: unknown,
    options?: { ex?: number; px?: number }
  ): Promise<void> => {
    const client = await getRedisClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (options?.ex) {
      await client.setEx(key, options.ex, serialized);
    } else if (options?.px) {
      await client.pSetEx(key, options.px, serialized);
    } else {
      await client.set(key, serialized);
    }
  },

  /**
   * Delete key
   */
  del: async (key: string): Promise<void> => {
    const client = await getRedisClient();
    await client.del(key);
  },

  /**
   * Delete multiple keys
   */
  mDel: async (keys: string[]): Promise<void> => {
    if (keys.length === 0) return;
    const client = await getRedisClient();
    await client.del(keys);
  },

  /**
   * Add member to sorted set
   */
  zadd: async (key: string, score: number, member: string): Promise<void> => {
    const client = await getRedisClient();
    await client.zAdd(key, { score, value: member });
  },

  /**
   * Get members in range (highest scores first - priority queue)
   */
  zrange: async <T = string>(
    key: string,
    start: number,
    stop: number
  ): Promise<T[]> => {
    const client = await getRedisClient();
    // Use REV option for descending order (highest priority first)
    const result = await client.zRange(key, start, stop, { REV: true });
    return result as T[];
  },

  /**
   * Get highest scoring member(s)
   */
  zpopmax: async <T = string>(key: string): Promise<T[]> => {
    const client = await getRedisClient();
    const result = await client.zPopMax(key);
    if (!result) return [];
    return Array.isArray(result)
      ? result.map((item) => item.value as T)
      : [result.value as T];
  },

  /**
   * Get lowest scoring member(s)
   */
  zpopmin: async <T = string>(key: string): Promise<T[]> => {
    const client = await getRedisClient();
    const result = await client.zPopMin(key);
    if (!result) return [];
    return Array.isArray(result)
      ? result.map((item) => item.value as T)
      : [result.value as T];
  },

  /**
   * Remove members by score range
   */
  zremrangebyscore: async (
    key: string,
    min: number | string,
    max: number | string
  ): Promise<void> => {
    const client = await getRedisClient();
    await client.zRemRangeByScore(key, min, max);
  },

  /**
   * Get sorted set cardinality
   */
  zcard: async (key: string): Promise<number> => {
    const client = await getRedisClient();
    return client.zCard(key);
  },

  /**
   * Get member score
   */
  zscore: async (key: string, member: string): Promise<number | null> => {
    const client = await getRedisClient();
    const score = await client.zScore(key, member);
    return score ?? null;
  },

  /**
   * Set key expiry
   */
  expire: async (key: string, seconds: number): Promise<void> => {
    const client = await getRedisClient();
    await client.expire(key, seconds);
  },

  /**
   * Publish message to channel
   */
  publish: async (channel: string, message: string): Promise<void> => {
    const client = await getRedisClient();
    await client.publish(channel, message);
  },

  /**
   * Subscribe to channel (returns unsubscribe function)
   */
  subscribe: async (
    channel: string,
    callback: (message: string) => void
  ): Promise<() => Promise<void>> => {
    const client = await getRedisClient();
    const subscriber = client.duplicate();

    await subscriber.connect();

    await subscriber.subscribe(channel, (message: string) => {
      callback(message);
    });

    // Return cleanup function
    return async () => {
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      } catch (err) {
        console.error('Error cleaning up subscriber:', err);
      }
    };
  },

  /**
   * Get members with scores (highest scores first - priority queue)
   */
  zRangeWithScores: async (
    key: string,
    start: number,
    stop: number
  ): Promise<{ value: string; score: number }[]> => {
    const client = await getRedisClient();
    const result = await client.zRangeWithScores(key, start, stop, { REV: true });
    return result.map((item) => ({
      value: item.value,
      score: item.score,
    }));
  },

  /**
   * Increment value
   */
  incr: async (key: string): Promise<number> => {
    const client = await getRedisClient();
    return client.incr(key);
  },

  /**
   * Get or set cache with TTL
   */
  cache: async <T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> => {
    const cached = await kv.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await kv.set(key, value, { ex: ttlSeconds });
    return value;
  },
};

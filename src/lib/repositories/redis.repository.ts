// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { kv, getRedisClient } from '@/lib/redis';
import { env } from '@/config/env';

export { getRedisClient };
export { kv } from '@/lib/redis';

export class RedisRepository {
  /**
   * Priority Queue Operations (Sorted Set)
   * Optimized for O(log N + M) complexity
   */

  /**
   * Add message to priority queue
   * @param channel - Channel ID
   * @param score - Priority score (higher = more priority)
   * @param message - Message JSON string
   * @param ttl - Time to live in seconds
   */
  async addToQueue(
    channel: string,
    score: number,
    message: string,
    ttl?: number
  ): Promise<void> {
    const key = `channel:${channel}:queue`;
    await kv.zadd(key, score, message);

    if (ttl) {
      await kv.expire(key, ttl);
    }
  }

  /**
   * Get messages from priority queue (highest priority first)
   * Optimized: Uses ZREVRANGE for O(log N + M) complexity
   * @param channel - Channel ID
   * @param count - Number of messages to get
   * @returns Array of message JSON strings
   */
  async getFromQueue(channel: string, count: number = 10): Promise<string[]> {
    try {
      const key = `channel:${channel}:queue`;
      // Use ZREVRANGE to get highest scores first directly from Redis
      // This is O(log N + M) instead of O(N)
      const messages = await kv.zrange<string>(key, 0, count - 1);
      return messages;
    } catch (error) {
      console.error(`Error getting messages from queue for channel ${channel}:`, error);
      return [];
    }
  }

  /**
   * Get messages from priority queue with scores
   * @param channel - Channel ID
   * @param count - Number of messages to get
   * @returns Array of message objects with score
   */
  async getFromQueueWithScores(
    channel: string,
    count: number = 10
  ): Promise<{ message: string; score: number }[]> {
    const key = `channel:${channel}:queue`;
    const results = await kv.zRangeWithScores(key, 0, count - 1);
    return results.map((item) => ({
      message: item.value,
      score: item.score,
    }));
  }

  /**
   * Pop highest priority message from queue
   * @param channel - Channel ID
   * @returns Message JSON string or null if empty
   */
  async popFromQueue(channel: string): Promise<string | null> {
    const key = `channel:${channel}:queue`;
    const [message] = await kv.zpopmax<string>(key);
    return message || null;
  }

  /**
   * Pop multiple highest priority messages
   * @param channel - Channel ID
   * @param count - Number of messages to pop
   * @returns Array of message JSON strings
   */
  async popMultipleFromQueue(channel: string, count: number = 10): Promise<string[]> {
    const key = `channel:${channel}:queue`;
    const messages: string[] = [];
    for (let i = 0; i < count; i++) {
      const [msg] = await kv.zpopmax<string>(key);
      if (!msg) break;
      messages.push(msg);
    }
    return messages;
  }

  /**
   * Trim queue to keep only the highest priority messages
   * Uses efficient Redis operations for O(log N) complexity
   * @param channel - Channel ID
   * @param maxCount - Maximum number of messages to keep
   */
  async trimQueue(channel: string, maxCount: number): Promise<void> {
    const key = `channel:${channel}:queue`;
    const total = await kv.zcard(key);

    if (total > maxCount) {
      // Calculate how many to remove
      const toRemove = total - maxCount;

      // Use ZPOPMAX to remove highest priority messages (they're at the end in descending order)
      // But we want to keep highest priority, so remove from the start (lowest priority)
      const client = await getRedisClient();
      const pipeline = client.multi();

      // Remove 'toRemove' lowest priority items using ZRANGE and ZREM
      const items = await kv.zrange<string>(key, 0, toRemove - 1);

      if (items.length > 0) {
        for (const item of items) {
          pipeline.zRem(key, item);
        }
        await pipeline.exec();
      }
    }
  }

  /**
   * Peek at lowest priority message without removing
   * @param channel - Channel ID
   * @returns Message or null if empty
   */
  async peekLowestPriority(channel: string): Promise<string | null> {
    const key = `channel:${channel}:queue`;
    const [message] = await kv.zpopmin<string>(key);
    return message || null;
  }

  /**
   * Get queue length
   * @param channel - Channel ID
   * @returns Number of messages in queue
   */
  async getQueueLength(channel: string): Promise<number> {
    const key = `channel:${channel}:queue`;
    return kv.zcard(key);
  }

  /**
   * Check if message exists in queue
   * @param channel - Channel ID
   * @param messageId - Message ID to check
   * @returns true if exists
   */
  async messageExistsInQueue(channel: string, messageId: string): Promise<boolean> {
    const key = `channel:${channel}:queue`;
    const score = await kv.zscore(key, messageId);
    return score !== null;
  }

  /**
   * Message Cache Operations (String)
   * Used for caching full message details
   */

  /**
   * Cache message details
   * @param messageId - Message ID
   * @param message - Message JSON string
   * @param ttl - Time to live in seconds
   */
  async cacheMessage(messageId: string, message: string, ttl?: number): Promise<void> {
    const key = `message:${messageId}`;
    await kv.set(key, message, { ex: ttl || env.PUBLIC_MESSAGE_TTL });
  }

  /**
   * Get cached message
   * @param messageId - Message ID
   * @returns Message JSON string or null if not found
   */
  async getCachedMessage(messageId: string): Promise<string | null> {
    const key = `message:${messageId}`;
    return kv.get<string>(key);
  }

  /**
   * Public Key Cache Operations (String)
   * Used for caching public keys to reduce database queries
   */

  /**
   * Cache public key with caching-aside pattern
   * @param channelId - Channel ID
   * @param publicKey - PEM format public key
   * @param ttl - Time to live in seconds (default 5 minutes)
   */
  async cachePublicKey(channelId: string, publicKey: string, ttl: number = 300): Promise<void> {
    const key = `pubkey:cache:${channelId}`;
    await kv.set(key, publicKey, { ex: ttl });
  }

  /**
   * Get cached public key
   * @param channelId - Channel ID
   * @returns Public key or null if not found
   */
  async getPublicKey(channelId: string): Promise<string | null> {
    const key = `pubkey:cache:${channelId}`;
    return kv.get<string>(key);
  }

  /**
   * Delete cached public key
   * @param channelId - Channel ID
   */
  async deletePublicKey(channelId: string): Promise<void> {
    const key = `pubkey:cache:${channelId}`;
    await kv.del(key);
  }

  /**
   * Rate Limiting Operations (Sorted Set)
   * Used for sliding window rate limiting
   */

  /**
   * Add rate limit entry
   * @param key - Rate limit key (e.g., "publish:ip_address")
   * @param timestamp - Current timestamp in milliseconds
   * @param window - Time window in seconds
   */
  async addRateLimit(key: string, timestamp: number, window: number): Promise<void> {
    const rateLimitKey = `ratelimit:${key}`;
    await kv.zadd(rateLimitKey, timestamp, `${timestamp}-${Math.random()}`);
    await kv.expire(rateLimitKey, window);
  }

  /**
   * Get rate limit count within window
   * @param key - Rate limit key
   * @param windowStart - Start of window (timestamp in ms)
   * @returns Number of requests in window
   */
  async getRateLimitCount(key: string, windowStart: number): Promise<number> {
    const rateLimitKey = `ratelimit:${key}`;
    // Remove old entries outside the window
    await kv.zremrangebyscore(rateLimitKey, 0, windowStart);
    // Count remaining entries
    return kv.zcard(rateLimitKey);
  }

  /**
   * Get the oldest request timestamp for retry after calculation
   * @param key - Rate limit key
   * @returns The oldest timestamp in milliseconds, or null if no entries
   */
  async getOldestRequestTimestamp(key: string): Promise<number | null> {
    const rateLimitKey = `ratelimit:${key}`;
    // Get the oldest entry (lowest score)
    const oldest = await kv.zrange(rateLimitKey, 0, 0);
    if (oldest.length === 0) return null;
    // Extract timestamp from the entry format: "timestamp-random"
    const match = oldest[0].match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Check if rate limit is exceeded
   * @param key - Rate limit key
   * @param limit - Maximum requests allowed
   * @param window - Time window in seconds
   * @returns true if limit exceeded, false otherwise
   */
  async checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - window * 1000;
    const count = await this.getRateLimitCount(key, windowStart);
    return count >= limit;
  }

  /**
   * Subscriber Management (Set)
   * Used for tracking active subscribers
   */

  /**
   * Add subscriber to channel
   * @param channel - Channel ID
   * @param sessionId - Subscriber session ID
   */
  async addSubscriber(channel: string, sessionId: string): Promise<void> {
    const key = `channel:${channel}:subscribers`;
    await kv.zadd(key, Date.now(), sessionId);
  }

  /**
   * Remove subscriber from channel
   * @param channel - Channel ID
   * @param sessionId - Subscriber session ID
   */
  async removeSubscriber(channel: string, _sessionId: string): Promise<void> {
    const key = `channel:${channel}:subscribers`;
    await kv.zremrangebyscore(key, Date.now(), Date.now());
  }

  /**
   * Get subscriber count
   * @param channel - Channel ID
   * @returns Number of subscribers
   */
  async getSubscriberCount(channel: string): Promise<number> {
    const key = `channel:${channel}:subscribers`;
    return kv.zcard(key);
  }

  /**
   * Last-Event-ID Mapping (String)
   * Used for SSE reconnection with Last-Event-ID
   */

  /**
   * Store last processed message ID for subscriber
   * @param channel - Channel ID
   * @param sessionId - Subscriber session ID
   * @param messageId - Last processed message ID
   */
  async setLastEventId(channel: string, sessionId: string, messageId: string): Promise<void> {
    const key = `lastid:${channel}:${sessionId}`;
    await kv.set(key, messageId, { ex: 3600 }); // 1 hour TTL
  }

  /**
   * Get last processed message ID
   * @param channel - Channel ID
   * @param sessionId - Subscriber session ID
   * @returns Last processed message ID or null
   */
  async getLastEventId(channel: string, sessionId: string): Promise<string | null> {
    const key = `lastid:${channel}:${sessionId}`;
    return kv.get<string>(key);
  }

  /**
   * Publish message to channel (Pub/Sub)
   * @param channel - Channel ID
   * @param message - Message to publish
   */
  async publish(channel: string, message: string): Promise<void> {
    await kv.publish(`channel:${channel}:events`, message);
  }

  /**
   * Subscribe to channel events
   * @param channel - Channel ID
   * @param callback - Callback function for received messages
   * @returns Unsubscribe function
   */
  async subscribe(
    channel: string,
    callback: (message: string) => void
  ): Promise<() => Promise<void>> {
    return kv.subscribe(`channel:${channel}:events`, callback);
  }

  /**
   * Health check - verify Redis connection
   * @returns true if connected, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { checkRedisHealth } = await import('@/lib/redis');
      const health = await checkRedisHealth();
      return health.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Simple GET operation for rate limiting
   * @param key - Redis key
   * @returns Value or null
   */
  async get(key: string): Promise<string | null> {
    return kv.get<string>(key);
  }

  /**
   * SET with expiration
   * @param key - Redis key
   * @param seconds - TTL in seconds
   * @param value - Value to set
   */
  async setex(key: string, seconds: number, value: string | number): Promise<void> {
    await kv.set(key, value, { ex: seconds });
  }

  /**
   * INCR operation
   * @param key - Redis key
   * @returns New value
   */
  async incr(key: string): Promise<number> {
    return kv.incr(key);
  }

  /**
   * EXPIRE operation
   * @param key - Redis key
   * @param seconds - TTL in seconds
   */
  async expire(key: string, seconds: number): Promise<void> {
    await kv.expire(key, seconds);
  }
}

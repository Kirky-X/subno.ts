// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { RedisRepository, getRedisClient } from '@/lib/repositories/redis.repository';
import { kv } from '@/lib/redis';
import { db, schema } from '@/lib/db';
import { eq, and, isNotNull } from 'drizzle-orm';
import { env } from '@/config/env';
import type { PublishMessageOptions, Message, PublishResult } from '@/lib/types/message.types';
import { MessagePriority } from '@/lib/types/message.types';

/**
 * Message Service - Core message handling logic
 * Manages message publishing, priority queues, and TTL management
 */
export class MessageService {
  private redis: RedisRepository;

  constructor() {
    this.redis = new RedisRepository();
  }

  /**
   * Check if a channel exists (PostgreSQL or Redis)
   * @param channel - Channel ID
   * @returns Channel existence and type
   */
  async channelExists(channel: string): Promise<{
    exists: boolean;
    type: 'persistent' | 'temporary' | 'none';
    expiresAt?: Date;
  }> {
    // Check PostgreSQL first (persistent channels)
    const pgChannel = await db
      .select({
        id: schema.channels.id,
        expiresAt: schema.channels.expiresAt,
        isActive: schema.channels.isActive,
      })
      .from(schema.channels)
      .where(eq(schema.channels.id, channel))
      .limit(1);

    if (pgChannel.length > 0) {
      const ch = pgChannel[0];
      if (ch.isActive) {
        return {
          exists: true,
          type: 'persistent',
          expiresAt: ch.expiresAt ?? undefined,
        };
      }
    }

    // Check Redis (temporary channels)
    const client = await getRedisClient();
    const channelKey = `channel:${channel}:meta`;
    const cached = await client.get(channelKey);

    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        exists: true,
        type: 'temporary',
        expiresAt: new Date(parsed.expiresAt),
      };
    }

    return { exists: false, type: 'none' };
  }

  /**
   * Auto-create a temporary channel in Redis
   * @param channel - Channel ID
   * @param ttl - Time to live in seconds
   * @returns Whether channel was created
   */
  async createTemporaryChannel(channel: string, ttl?: number): Promise<boolean> {
    const client = await getRedisClient();
    const channelTtl = ttl || env.TEMPORARY_CHANNEL_TTL;
    const channelKey = `channel:${channel}:meta`;
    const now = Date.now();
    const expiresAt = now + channelTtl * 1000;

    // Use single SET with NX and expiry, store metadata in one operation
    const metadata = JSON.stringify({
      createdAt: now,
      expiresAt: expiresAt,
      type: 'temporary',
    });

    // SET with NX ensures atomic check-and-set
    const exists = await client.set(channelKey, metadata, { NX: true, EX: channelTtl });
    if (!exists) {
      return false;
    }

    return true;
  }

  /**
   * Publish a message to a channel
   * Supports auto-creating temporary channels
   * @param options - Message publishing options
   * @returns Publish result with message ID
   */
  async publish(options: PublishMessageOptions): Promise<PublishResult> {
    const messageId = this.generateMessageId();
    const timestamp = Date.now();

    // Auto-create temporary channel if enabled
    if (options.autoCreate !== false && env.AUTO_CREATE_CHANNELS_ENABLED) {
      const exists = await this.channelExists(options.channel);
      if (!exists.exists) {
        await this.createTemporaryChannel(options.channel, env.TEMPORARY_CHANNEL_TTL);
      }
    }

    // Calculate priority score
    const priority = options.priority ?? MessagePriority.NORMAL;
    const score = this.calculateScore(priority, timestamp);

    // Construct message object
    const message: Message = {
      id: messageId,
      channel: options.channel,
      message: options.message,
      priority,
      sender: options.sender,
      timestamp,
      encrypted: options.encrypted ?? false,
    };

    // Determine TTL based on channel type
    const ttl = this.getTTL(options.channel);

    // Add to priority queue
    await this.redis.addToQueue(options.channel, score, JSON.stringify(message), ttl);

    // Optional: cache full message for quick retrieval
    if (options.cache !== false) {
      await this.redis.cacheMessage(messageId, JSON.stringify(message), ttl);
    }

    // Enforce queue length limits
    await this.trimQueue(options.channel);

    // Publish to subscribers via Redis Pub/Sub
    await this.redis.publish(options.channel, JSON.stringify(message));

    return {
      messageId,
      timestamp,
      channel: options.channel,
      autoCreated: await this.channelExists(options.channel).then(e => e.type === 'temporary'),
    };
  }

  /**
   * Get messages from channel queue (highest priority first)
   * @param channel - Channel ID
   * @param count - Number of messages to retrieve
   * @returns Array of messages
   */
  async getMessages(channel: string, count: number = 10): Promise<Message[]> {
    const messages = await this.redis.getFromQueue(channel, count);
    return messages.map((msg) => JSON.parse(msg) as Message);
  }

  /**
   * Pop highest priority message from queue (read-and-delete)
   * @param channel - Channel ID
   * @returns Message or null if queue is empty
   */
  async popMessage(channel: string): Promise<Message | null> {
    const message = await this.redis.popFromQueue(channel);
    if (!message) return null;
    return JSON.parse(message) as Message;
  }

  /**
   * Get message queue length
   * @param channel - Channel ID
   * @returns Number of messages in queue
   */
  async getQueueLength(channel: string): Promise<number> {
    return this.redis.getQueueLength(channel);
  }

  /**
   * Get cached message by ID
   * @param messageId - Message ID
   * @returns Message or null if not found
   */
  async getCachedMessage(messageId: string): Promise<Message | null> {
    const cached = await this.redis.getCachedMessage(messageId);
    if (!cached) return null;
    return JSON.parse(cached) as Message;
  }

  /**
   * Get message statistics for a channel
   * @param channel - Channel ID
   * @returns Message statistics
   */
  async getMessageStats(channel: string): Promise<{ total: number; cached: number }> {
    const total = await this.getQueueLength(channel);
    // For cached count, we could track this separately or estimate
    // For now, just return the queue length as total
    return {
      total,
      cached: 0, // Could be tracked with additional Redis keys
    };
  }

  /**
   * Generate a unique message ID
   * Format: msg_{timestamp}_{random}
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `msg_${timestamp}_${random}`;
  }

  /**
   * Calculate priority score for sorting
   * Higher score = higher priority
   * Formula: priority * 1,000,000 + timestamp
   */
  private calculateScore(priority: number, timestamp: number): number {
    return priority * 1_000_000 + timestamp;
  }

  /**
   * Get TTL based on channel type
   * Encrypted channels get longer TTL
   */
  private getTTL(channel: string): number {
    if (channel.startsWith('enc_')) {
      return env.PRIVATE_MESSAGE_TTL;
    }
    return env.PUBLIC_MESSAGE_TTL;
  }

  /**
   * Get max queue size based on channel type
   */
  private getMaxQueueSize(channel: string): number {
    if (channel.startsWith('enc_')) {
      return env.PRIVATE_MESSAGE_MAX_COUNT;
    }
    return env.PUBLIC_MESSAGE_MAX_COUNT;
  }

  /**
   * Trim queue to maintain maximum size
   * Removes lowest priority (oldest) messages
   */
  private async trimQueue(channel: string): Promise<void> {
    const maxSize = this.getMaxQueueSize(channel);
    await this.redis.trimQueue(channel, maxSize);
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { RedisRepository, getRedisClient } from '@/lib/repositories/redis.repository';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { env } from '@/config/env';
import type { PublishMessageOptions, Message, PublishResult } from '@/lib/types/message.types';
import { MessagePriority } from '@/lib/types/message.types';
import { randomUUID } from 'crypto';

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

    try {
      // SET with NX ensures atomic check-and-set
      // Returns 'OK' if set, null if key already exists
      const result = await client.set(channelKey, metadata, { NX: true, EX: channelTtl });
      return result === 'OK';
    } catch (error) {
      console.error('Error creating temporary channel:', error);
      return false;
    }
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

    // Validate message content
    if (options.message === undefined || options.message === null || options.message === '') {
      throw new Error('Message is required');
    }
    
    // Validate sender type (runtime check for consumers bypassing Typescript)
    if (options.sender === null) {
      throw new Error('Sender cannot be null');
    }

    // Validate message size
    const messageSize = Buffer.byteLength(options.message, 'utf8');
    if (messageSize > env.MAX_MESSAGE_SIZE) {
      throw new Error(
        `Message size (${messageSize} bytes) exceeds maximum allowed size (${env.MAX_MESSAGE_SIZE} bytes)`
      );
    }

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
      signature: options.signature,
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

    // Handle both string and object returns from Redis
    const cachedStr = typeof cached === 'string' ? cached : JSON.stringify(cached);
    try {
      return JSON.parse(cachedStr) as Message;
    } catch {
      return null;
    }
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
   * Uses crypto.randomUUID() for better security and collision resistance
   * Format: UUID v4
   */
  private generateMessageId(): string {
    return randomUUID();
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

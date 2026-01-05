// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageService } from '@/lib/services/message.service';
import { MessagePriority } from '@/lib/types/message.types';
import { getRedisClient } from '@/lib/redis';

describe('MessageService', () => {
  let messageService: MessageService;
  let redis: any;

  beforeEach(async () => {
    messageService = new MessageService();
    redis = await getRedisClient();
    // Clear test data
    await redis.flushDb();
  });

  afterEach(async () => {
    // Clean up after each test
    await redis.flushDb();
  });

  describe('publish', () => {
    it('should successfully publish a public message', async () => {
      const result = await messageService.publish({
        channel: 'test-public',
        message: 'Hello World',
        priority: MessagePriority.NORMAL,
        sender: 'Alice',
      });

      expect(result).toHaveProperty('messageId');
      // Use UUID format (8-4-4-4-12 hexadecimal digits)
      expect(result.messageId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(result.channel).toBe('test-public');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should correctly calculate priority scores', async () => {
      const timestamp = 1000;

      const score1 = messageService['calculateScore'](MessagePriority.CRITICAL, timestamp);
      const score2 = messageService['calculateScore'](MessagePriority.HIGH, timestamp);
      const score3 = messageService['calculateScore'](MessagePriority.NORMAL, timestamp);
      const score4 = messageService['calculateScore'](MessagePriority.LOW, timestamp);
      const score5 = messageService['calculateScore'](MessagePriority.BULK, timestamp);

      expect(score1).toBe(100 * 1_000_000 + timestamp);
      expect(score2).toBe(75 * 1_000_000 + timestamp);
      expect(score3).toBe(50 * 1_000_000 + timestamp);
      expect(score4).toBe(25 * 1_000_000 + timestamp);
      expect(score5).toBe(0 * 1_000_000 + timestamp);

      // Critical should have highest score
      expect(score1).toBeGreaterThan(score2);
      expect(score2).toBeGreaterThan(score3);
      expect(score3).toBeGreaterThan(score4);
      expect(score4).toBeGreaterThan(score5);
    });

    it('should auto-create temporary channel when enabled', async () => {
      const channel = `test-new-channel-${Date.now()}`;

      const result = await messageService.publish({
        channel,
        message: 'Auto-created channel message',
        priority: MessagePriority.NORMAL,
        autoCreate: true,
      });

      expect(result.autoCreated).toBe(true);

      // Verify channel exists
      const exists = await messageService.channelExists(channel);
      expect(exists.exists).toBe(true);
      expect(exists.type).toBe('temporary');
    });

    it('should not auto-create channel when disabled', async () => {
      const result = await messageService.publish({
        channel: 'test-no-auto',
        message: 'No auto-create',
        priority: MessagePriority.NORMAL,
        autoCreate: false,
      });

      expect(result.autoCreated).toBe(false);
    });

    it('should use correct TTL for public channels', async () => {
      const ttl = messageService['getTTL']('public-channel');
      expect(ttl).toBeGreaterThan(0);
      // Public channels typically have shorter TTL
      expect(ttl).toBeLessThan(86400); // Less than 24 hours
    });

    it('should use correct TTL for encrypted channels', async () => {
      const ttl = messageService['getTTL']('enc_test123');
      expect(ttl).toBeGreaterThan(0);
      // Encrypted channels typically have longer TTL
      expect(ttl).toBeGreaterThanOrEqual(86400); // At least 24 hours
    });
  });

  describe('priority queue', () => {
    it('should order messages by priority (highest first)', async () => {
      const channel = 'test-priority-order';

      // Publish messages in different order
      await messageService.publish({
        channel,
        message: 'Low priority',
        priority: MessagePriority.LOW,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'Critical priority',
        priority: MessagePriority.CRITICAL,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'Normal priority',
        priority: MessagePriority.NORMAL,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'High priority',
        priority: MessagePriority.HIGH,
        cache: true,
      });

      // Get messages - should be ordered by priority
      const messages = await messageService.getMessages(channel, 10);

      expect(messages.length).toBeGreaterThanOrEqual(4);
      expect(messages[0].message).toBe('Critical priority');
      expect(messages[1].message).toBe('High priority');
      expect(messages[2].message).toBe('Normal priority');
      expect(messages[3].message).toBe('Low priority');
    });

    it('should order same priority messages by timestamp', async () => {
      const channel = 'test-timestamp-order';

      // Use unique channel to avoid test pollution
      const uniqueChannel = `test-ts-${Date.now()}`;

      await messageService.publish({
        channel: uniqueChannel,
        message: 'First',
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await messageService.publish({
        channel: uniqueChannel,
        message: 'Second',
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      const messages = await messageService.getMessages(uniqueChannel, 10);

      // Should have exactly 2 messages
      expect(messages.length).toBe(2);
      // First should come before Second (newer messages have higher score)
      expect(messages[0].message).toBe('Second');
      expect(messages[1].message).toBe('First');
    });

    it('should limit returned message count', async () => {
      const channel = 'test-count-limit';

      // Publish 5 messages
      for (let i = 1; i <= 5; i++) {
        await messageService.publish({
          channel,
          message: `Message ${i}`,
          priority: MessagePriority.NORMAL,
          cache: true,
        });
      }

      // Request only 3 messages
      const messages = await messageService.getMessages(channel, 3);

      expect(messages.length).toBeLessThanOrEqual(3);
    });
  });

  describe('message caching', () => {
    it('should cache message when cache is enabled', async () => {
      const channel = 'test-cache-enabled';

      const result = await messageService.publish({
        channel,
        message: 'Cached message',
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      // Retrieve from cache
      const cached = await messageService.getCachedMessage(result.messageId);

      expect(cached).not.toBeNull();
      expect(cached!.message).toBe('Cached message');
      expect(cached!.id).toBe(result.messageId);
    });

    it('should not cache message when cache is disabled', async () => {
      const channel = 'test-cache-disabled';

      const result = await messageService.publish({
        channel,
        message: 'Uncached message',
        priority: MessagePriority.NORMAL,
        cache: false,
      });

      // Try to retrieve from cache
      const cached = await messageService.getCachedMessage(result.messageId);

      expect(cached).toBeNull();
    });

    it('should cache message by default', async () => {
      const channel = `test-cache-default-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const result = await messageService.publish({
        channel,
        message: 'Default cached',
        priority: MessagePriority.NORMAL,
      });

      const cached = await messageService.getCachedMessage(result.messageId);

      expect(cached).not.toBeNull();
    });
  });

  describe('popMessage', () => {
    it('should pop highest priority message', async () => {
      const channel = 'test-pop';

      await messageService.publish({
        channel,
        message: 'Low',
        priority: MessagePriority.LOW,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'Critical',
        priority: MessagePriority.CRITICAL,
        cache: true,
      });

      // Pop should return Critical (highest priority)
      const popped = await messageService.popMessage(channel);

      expect(popped).not.toBeNull();
      expect(popped!.message).toBe('Critical');

      // Queue should now have only Low
      const remaining = await messageService.getQueueLength(channel);
      expect(remaining).toBe(1);
    });

    it('should return null when queue is empty', async () => {
      const channel = 'test-empty-queue';

      const popped = await messageService.popMessage(channel);

      expect(popped).toBeNull();
    });

    it('should remove message from queue after pop', async () => {
      const channel = `test-pop-remove-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await messageService.publish({
        channel,
        message: 'To be popped',
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      const lengthBefore = await messageService.getQueueLength(channel);
      expect(lengthBefore).toBe(1);

      await messageService.popMessage(channel);

      const lengthAfter = await messageService.getQueueLength(channel);
      expect(lengthAfter).toBe(0);
    });
  });

  describe('queue management', () => {
    it('should return correct queue length', async () => {
      const channel = 'test-queue-length';

      const lengthBefore = await messageService.getQueueLength(channel);
      expect(lengthBefore).toBe(0);

      await messageService.publish({
        channel,
        message: 'Message 1',
        priority: MessagePriority.NORMAL,
      });
      await messageService.publish({
        channel,
        message: 'Message 2',
        priority: MessagePriority.NORMAL,
      });

      const lengthAfter = await messageService.getQueueLength(channel);
      expect(lengthAfter).toBe(2);
    });

    it('should trim queue to max size', async () => {
      const channel = 'test-trim';

      // Publish 5 messages
      for (let i = 1; i <= 5; i++) {
        await messageService.publish({
          channel,
          message: `Message ${i}`,
          priority: MessagePriority.NORMAL,
          cache: true,
        });
      }

      // Get max queue size for public channels
      const maxSize = messageService['getMaxQueueSize'](channel);

      // Queue should not exceed max size
      const length = await messageService.getQueueLength(channel);
      expect(length).toBeLessThanOrEqual(maxSize);
    });

    it('should have different max sizes for public vs encrypted channels', async () => {
      const publicMax = messageService['getMaxQueueSize']('public-channel');
      const encryptedMax = messageService['getMaxQueueSize']('enc_test');

      // Encrypted channels typically have smaller max size
      expect(encryptedMax).toBeLessThan(publicMax);
    });
  });

  describe('message stats', () => {
    it('should return message statistics', async () => {
      const channel = 'test-stats';

      await messageService.publish({
        channel,
        message: 'Message 1',
        priority: MessagePriority.NORMAL,
      });
      await messageService.publish({
        channel,
        message: 'Message 2',
        priority: MessagePriority.HIGH,
      });

      const stats = await messageService.getMessageStats(channel);

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('cached');
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });

    it('should return zero for empty channel', async () => {
      const channel = 'test-empty-stats';

      const stats = await messageService.getMessageStats(channel);

      expect(stats.total).toBe(0);
      expect(stats.cached).toBe(0);
    });
  });

  describe('channelExists', () => {
    it('should detect non-existent channel', async () => {
      const result = await messageService.channelExists('non-existent-channel');

      expect(result.exists).toBe(false);
      expect(result.type).toBe('none');
    });

    it('should detect temporary channel', async () => {
      const channel = `test-temp-channel-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await messageService.publish({
        channel,
        message: 'Test',
        priority: MessagePriority.NORMAL,
        autoCreate: true,
      });

      const result = await messageService.channelExists(channel);

      expect(result.exists).toBe(true);
      expect(result.type).toBe('temporary');
      expect(result.expiresAt).toBeDefined();
    });
  });

  describe('message metadata', () => {
    it('should include all required message fields', async () => {
      const channel = 'test-metadata';

      const result = await messageService.publish({
        channel,
        message: 'Test message',
        priority: MessagePriority.HIGH,
        sender: 'TestUser',
        encrypted: true,
      });

      // Retrieve the message
      const messages = await messageService.getMessages(channel, 1);

      expect(messages.length).toBeGreaterThanOrEqual(1);
      const msg = messages[0];

      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('channel');
      expect(msg).toHaveProperty('message');
      expect(msg).toHaveProperty('priority');
      expect(msg).toHaveProperty('sender');
      expect(msg).toHaveProperty('timestamp');
      expect(msg).toHaveProperty('encrypted');

      expect(msg.id).toBe(result.messageId);
      expect(msg.channel).toBe(channel);
      expect(msg.message).toBe('Test message');
      expect(msg.priority).toBe(MessagePriority.HIGH);
      expect(msg.sender).toBe('TestUser');
      expect(msg.encrypted).toBe(true);
    });
  });
});
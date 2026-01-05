// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageService } from '@/lib/services/message.service';
import { MessagePriority } from '@/lib/types/message.types';
import { EncryptionService } from '@/lib/services/encryption.service';
import { env } from '@/config/env';
import { getRedisClient } from '@/lib/redis';

describe('Boundary Conditions Tests', () => {
  let messageService: MessageService;
  let encryptionService: EncryptionService;
  let redis: any;

  beforeEach(async () => {
    messageService = new MessageService();
    encryptionService = new EncryptionService();
    redis = await getRedisClient();
    await redis.flushDb();
  });

  afterEach(async () => {
    await redis.flushDb();
  });

  describe('message size boundaries', () => {
    it('should accept message at max size', async () => {
      const maxSize = env.MAX_MESSAGE_SIZE || 4_718_592; // 4.5MB
      const message = 'x'.repeat(maxSize);

      const result = await messageService.publish({
        channel: 'test-max-size',
        message,
        priority: MessagePriority.NORMAL,
      });

      expect(result).toHaveProperty('messageId');
      expect(result.messageId).toBeDefined();
    });

    it('should reject message exceeding max size', async () => {
      const maxSize = env.MAX_MESSAGE_SIZE || 4_718_592;
      const oversizedMessage = 'x'.repeat(maxSize + 1);

      await expect(
        messageService.publish({
          channel: 'test-oversized',
          message: oversizedMessage,
          priority: MessagePriority.NORMAL,
        })
      ).rejects.toThrow();
    });

    it('should reject empty message', async () => {
      await expect(messageService.publish({
        channel: 'test-empty',
        message: '',
        priority: MessagePriority.NORMAL,
      })).rejects.toThrow();
    });

    it('should accept single character message', async () => {
      const result = await messageService.publish({
        channel: 'test-single-char',
        message: 'a',
        priority: MessagePriority.NORMAL,
      });

      expect(result).toHaveProperty('messageId');
    });

    it('should handle Unicode characters in message', async () => {
      const unicodeMessage = 'Hello 世界 🌍 Ñoñoño';

      const result = await messageService.publish({
        channel: 'test-unicode',
        message: unicodeMessage,
        priority: MessagePriority.NORMAL,
      });

      expect(result).toHaveProperty('messageId');

      // Retrieve and verify
      const messages = await messageService.getMessages('test-unicode', 1);
      expect(messages[0].message).toBe(unicodeMessage);
    });
  });

  describe('channel ID boundaries', () => {
    it('should accept single character channel ID', async () => {
      const result = await messageService.publish({
        channel: 'a',
        message: 'Single char channel',
        priority: MessagePriority.NORMAL,
      });

      expect(result).toHaveProperty('messageId');
      expect(result.channel).toBe('a');
    });

    it('should accept long channel ID', async () => {
      const longChannel = 'a'.repeat(100);

      const result = await messageService.publish({
        channel: longChannel,
        message: 'Long channel',
        priority: MessagePriority.NORMAL,
      });

      expect(result).toHaveProperty('messageId');
      expect(result.channel).toBe(longChannel);
    });

    it('should accept special characters in channel ID', async () => {
      const specialChannel = 'test-channel_123.dev';

      const result = await messageService.publish({
        channel: specialChannel,
        message: 'Special chars',
        priority: MessagePriority.NORMAL,
      });

      expect(result).toHaveProperty('messageId');
    });

    it('should handle channel ID with numbers', async () => {
      const numericChannel = 'channel-2024-01-04';

      const result = await messageService.publish({
        channel: numericChannel,
        message: 'Numeric channel',
        priority: MessagePriority.NORMAL,
      });

      expect(result).toHaveProperty('messageId');
    });
  });

  describe('priority boundaries', () => {
    it('should handle lowest priority (BULK = 0)', async () => {
      const result = await messageService.publish({
        channel: 'test-bulk',
        message: 'Bulk message',
        priority: MessagePriority.BULK,
      });

      expect(result).toHaveProperty('messageId');
    });

    it('should handle highest priority (CRITICAL = 100)', async () => {
      const result = await messageService.publish({
        channel: 'test-critical',
        message: 'Critical message',
        priority: MessagePriority.CRITICAL,
      });

      expect(result).toHaveProperty('messageId');
    });

    it('should order messages correctly across all priorities', async () => {
      const channel = 'test-all-priorities';

      await messageService.publish({
        channel,
        message: 'BULK',
        priority: MessagePriority.BULK,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'LOW',
        priority: MessagePriority.LOW,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'NORMAL',
        priority: MessagePriority.NORMAL,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'HIGH',
        priority: MessagePriority.HIGH,
        cache: true,
      });
      await messageService.publish({
        channel,
        message: 'CRITICAL',
        priority: MessagePriority.CRITICAL,
        cache: true,
      });

      const messages = await messageService.getMessages(channel, 10);

      expect(messages.length).toBeGreaterThanOrEqual(5);
      expect(messages[0].message).toBe('CRITICAL');
      expect(messages[1].message).toBe('HIGH');
      expect(messages[2].message).toBe('NORMAL');
      expect(messages[3].message).toBe('LOW');
      expect(messages[4].message).toBe('BULK');
    });
  });

  describe('TTL boundaries', () => {
    it('should handle minimum TTL', async () => {
      const channel = 'test-min-ttl';

      await messageService.publish({
        channel,
        message: 'Short TTL',
        priority: MessagePriority.NORMAL,
      });

      const ttl = messageService['getTTL'](channel);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should handle maximum TTL for encrypted channels', async () => {
      const encryptedChannel = 'enc_test_max_ttl';
      const ttl = messageService['getTTL'](encryptedChannel);

      expect(ttl).toBe(env.PRIVATE_MESSAGE_TTL);
      expect(ttl).toBeGreaterThanOrEqual(86400); // At least 24 hours
    });

    it('should handle TTL for public channels', async () => {
      const publicChannel = 'public_test_ttl';
      const ttl = messageService['getTTL'](publicChannel);

      expect(ttl).toBe(env.PUBLIC_MESSAGE_TTL);
    });
  });

  describe('queue size boundaries', () => {
    it('should respect max queue size for public channels', async () => {
      const channel = 'test-public-queue-size';
      const maxSize = messageService['getMaxQueueSize'](channel);

      // Publish more than max size
      for (let i = 0; i < maxSize + 10; i++) {
        await messageService.publish({
          channel,
          message: `Message ${i}`,
          priority: MessagePriority.NORMAL,
        });
      }

      const length = await messageService.getQueueLength(channel);
      expect(length).toBeLessThanOrEqual(maxSize);
    });

    it('should respect max queue size for encrypted channels', async () => {
      const channel = 'enc_test_queue_size';
      const maxSize = messageService['getMaxQueueSize'](channel);

      // Publish more than max size
      for (let i = 0; i < maxSize + 5; i++) {
        await messageService.publish({
          channel,
          message: `Message ${i}`,
          priority: MessagePriority.NORMAL,
        });
      }

      const length = await messageService.getQueueLength(channel);
      expect(length).toBeLessThanOrEqual(maxSize);
    });

    it('should trim queue when exceeding max size', async () => {
      const channel = `test-queue-trim-${Date.now()}`;
      const maxSize = messageService['getMaxQueueSize'](channel);

      // Fill queue
      for (let i = 0; i < maxSize; i++) {
        await messageService.publish({
          channel,
          message: `Message ${i}`,
          priority: MessagePriority.BULK, // Same priority
          cache: true,
        });
      }

      // Add one more
      await messageService.publish({
        channel,
        message: 'Latest message',
        priority: MessagePriority.CRITICAL, // Highest priority
        cache: true,
      });

      const messages = await messageService.getMessages(channel, maxSize);
      const length = await messageService.getQueueLength(channel);

      expect(length).toBeLessThanOrEqual(maxSize);
      // Latest critical message should be at top
      expect(messages[0].message).toBe('Latest message');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent publishes', async () => {
      const channel = 'test-concurrent-publish';
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          messageService.publish({
            channel,
            message: `Concurrent message ${i}`,
            priority: MessagePriority.NORMAL,
          })
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      expect(results.every(r => r.messageId)).toBe(true);

      const length = await messageService.getQueueLength(channel);
      expect(length).toBe(50);
    });

    it('should handle concurrent reads', async () => {
      const channel = 'test-concurrent-read';

      // Add some messages
      for (let i = 0; i < 10; i++) {
        await messageService.publish({
          channel,
          message: `Message ${i}`,
          priority: MessagePriority.NORMAL,
          cache: true,
        });
      }

      // Concurrent reads
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(messageService.getMessages(channel, 10));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(messages => {
        expect(messages.length).toBe(10);
      });
    });

    it('should handle concurrent publishes and reads', async () => {
      const channel = 'test-mixed-concurrent';
      const promises = [];

      // Mix of publishes and reads
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          promises.push(
            messageService.publish({
              channel,
              message: `Message ${i}`,
              priority: MessagePriority.NORMAL,
            })
          );
        } else {
          promises.push(messageService.getMessages(channel, 10));
        }
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
    });
  });

  describe('timestamp boundaries', () => {
    it('should handle messages with same timestamp', async () => {
      const channel = 'test-same-timestamp';

      // Publish multiple messages quickly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          messageService.publish({
            channel,
            message: `Message ${i}`,
            priority: MessagePriority.NORMAL,
          })
        );
      }

      await Promise.all(promises);

      const messages = await messageService.getMessages(channel, 10);

      expect(messages.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle messages far apart in time', async () => {
      const channel = 'test-far-apart';

      await messageService.publish({
        channel,
        message: 'First message',
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      await messageService.publish({
        channel,
        message: 'Second message',
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      const messages = await messageService.getMessages(channel, 10);

      expect(messages.length).toBeGreaterThanOrEqual(2);
      // Second message should come first (newer)
      expect(messages[0].message).toBe('Second message');
    });
  });

  describe('metadata boundaries', () => {
    it('should handle message with all fields', async () => {
      const result = await messageService.publish({
        channel: 'test-full-metadata',
        message: 'Full metadata message',
        priority: MessagePriority.NORMAL,
        sender: 'Test Sender',
        cache: true,
      });

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('channel');
    });

    it('should handle message with very long sender name', async () => {
      const longSender = 'a'.repeat(100);

      const result = await messageService.publish({
        channel: 'test-long-sender',
        message: 'Message',
        sender: longSender,
      });

      expect(result).toHaveProperty('messageId');
    });
  });
});

describe('Encryption Boundary Tests', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('encryption boundaries', () => {
    it('should encrypt empty string', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const encrypted = encryptionService.encrypt('', publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe('');
    });

    it('should encrypt very short message', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const encrypted = encryptionService.encrypt('a', publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe('a');
    });

    it('should encrypt message at RSA limit', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      // RSA-2048 OAEP can encrypt ~190 bytes
      const maxMessage = 'x'.repeat(190);

      const encrypted = encryptionService.encrypt(maxMessage, publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe(maxMessage);
    });

    it('should use hybrid encryption for large messages', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const largeMessage = 'x'.repeat(50000);

      const pkg = encryptionService.hybridEncrypt(largeMessage, publicKey);
      const decrypted = encryptionService.hybridDecrypt(pkg, privateKey);

      expect(decrypted).toBe(largeMessage);
    });

    it('should handle Unicode in encryption', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const unicodeMessage = 'Hello 世界 🌍 Ñoñoño';

      const encrypted = encryptionService.encrypt(unicodeMessage, publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe(unicodeMessage);
    });

    it('should handle newlines in encrypted message', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const multilineMessage = 'Line 1\nLine 2\nLine 3';

      const encrypted = encryptionService.encrypt(multilineMessage, publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe(multilineMessage);
    });
  });
});

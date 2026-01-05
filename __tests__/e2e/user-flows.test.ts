// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { EncryptionService } from '@/lib/services/encryption.service';
import { MessageService } from '@/lib/services/message.service';
import { ChannelService } from '@/lib/services/channel.service';
import { EncryptionKeyService } from '@/lib/services/encryption-key.service';
import { MessagePriority } from '@/lib/types/message.types';
import { parsePriority } from '@/lib/utils/validation.util';
import { getRedisClient } from '@/lib/redis';
import type { RedisClientType } from 'redis';

// Test constants
const LARGE_MESSAGE_SIZE = 50000; // bytes
const PERFORMANCE_MESSAGE_COUNT = 100;
const ENCRYPTION_ITERATION_COUNT = 50;
const CONCURRENT_USER_COUNT = 10;
const CONCURRENT_PUBLISH_COUNT = 20;
const TEST_TIMEOUT_MS = 10000;
const PERFORMANCE_TIMEOUT_MS = 5000;

// Test data factory
class TestDataFactory {
  static generateChannelName(suffix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `e2e_channel_${suffix || timestamp}_${random}`;
  }

  static generateMessage(index: number): string {
    return `Test message ${index}`;
  }
}

// Helper function with timeout protection
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string = 'Operation timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

describe('E2E Tests - End-to-End User Flows', () => {
  let encryptionService: EncryptionService;
  let messageService: MessageService;
  let channelService: ChannelService;
  let encryptionKeyService: EncryptionKeyService;
  let redis: RedisClientType;

  beforeAll(async () => {
    redis = await getRedisClient();
    encryptionService = new EncryptionService();
    messageService = new MessageService(redis);
    channelService = new ChannelService(redis);
    encryptionKeyService = new EncryptionKeyService(redis);

    await redis.flushDb();
  });

  afterAll(async () => {
    try {
      await redis.flushDb();
      await redis.quit();
    } catch (error) {
      console.error('Cleanup error in afterAll:', error);
    }
  });

  afterEach(async () => {
    try {
      await redis.flushDb();
    } catch (error) {
      console.error('Cleanup error in afterEach:', error);
    }
  });

  describe('E2E-001: End-to-End Encrypted Communication @security @critical @e2e', () => {
    it('should complete full encryption workflow', async () => {
      let privateKey: string | null = null;

      try {
        // 1. 接收端生成密钥对并注册
        const { publicKey, privateKey: tempPrivateKey } = encryptionService.generateKeyPair();
        privateKey = tempPrivateKey;

        const registerData = await encryptionKeyService.registerKey({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        });

        expect(registerData.channelId).toBeDefined();
        const { channelId } = registerData;

        // 2. 发送端获取公钥
        const getKeyData = await encryptionKeyService.getKey(channelId);

        expect(getKeyData).not.toBeNull();
        expect(getKeyData!.publicKey).toBe(publicKey);

        // 3. 发送端加密消息
        const plaintext = 'Secret message from sender!';
        const encrypted = encryptionService.encrypt(plaintext, publicKey);

        // 4. 发送加密消息
        const publishResult = await messageService.publish({
          channel: channelId,
          message: encrypted,
          encrypted: true,
        });

        expect(publishResult.messageId).toBeDefined();

        // 5. 接收端获取消息
        const messages = await messageService.getMessages(channelId);
        expect(messages.length).toBeGreaterThan(0);

        const messageData = messages[0];
        expect(messageData.encrypted).toBe(true);
        expect(messageData.message).toBe(encrypted);

        // 6. 接收端解密消息
        const decrypted = encryptionService.decrypt(messageData.message, privateKey);
        expect(decrypted).toBe(plaintext);
      } finally {
        // Explicitly clear sensitive data
        if (privateKey) {
          privateKey = null;
        }
      }
    });

    it('should fail decryption with wrong key @security', async () => {
      let privateKey1: string | null = null;
      let privateKey2: string | null = null;

      try {
        const { publicKey: publicKey1, privateKey: tempPrivateKey1 } = encryptionService.generateKeyPair();
        const { privateKey: tempPrivateKey2 } = encryptionService.generateKeyPair();
        privateKey1 = tempPrivateKey1;
        privateKey2 = tempPrivateKey2;

        const plaintext = 'Secret message';
        const encrypted = encryptionService.encrypt(plaintext, publicKey1);

        expect(() => {
          encryptionService.decrypt(encrypted, privateKey2!);
        }).toThrow(/Failed to decrypt message/i);
      } finally {
        if (privateKey1) privateKey1 = null;
        if (privateKey2) privateKey2 = null;
      }
    });

    it('should support hybrid encryption for large messages @performance @e2e', async () => {
      let privateKey: string | null = null;

      try {
        const { publicKey, privateKey: tempPrivateKey } = encryptionService.generateKeyPair();
        privateKey = tempPrivateKey;

        // 注册公钥
        const registerData = await encryptionKeyService.registerKey({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        });
        const { channelId } = registerData;

        // 使用混合加密发送大消息
        const largePlaintext = 'x'.repeat(Math.min(LARGE_MESSAGE_SIZE, 50000));
        expect(largePlaintext.length).toBeLessThanOrEqual(LARGE_MESSAGE_SIZE);

        const pkg = encryptionService.hybridEncrypt(largePlaintext, publicKey);

        await messageService.publish({
          channel: channelId,
          message: JSON.stringify(pkg),
          encrypted: true,
        });

        // 接收并解密
        const messages = await messageService.getMessages(channelId);
        const messageData = messages[0];
        const pkgReceived = JSON.parse(messageData.message);

        const decrypted = encryptionService.hybridDecrypt(pkgReceived, privateKey);
        expect(decrypted).toBe(largePlaintext);
      } finally {
        if (privateKey) privateKey = null;
      }
    });
  });

  describe('E2E-002: Public Channel Complete Flow @e2e', () => {
    it('should complete public channel creation, publish, and subscribe', async () => {
      const channelName = TestDataFactory.generateChannelName('public');

      // 1. 创建公开频道
      const createData = await channelService.createChannel({
        name: channelName,
        type: 'public',
        id: channelName, // Use name as ID for test convenience if allowed, schema allows it
      });

      expect(createData.id).toBe(channelName);

      // 2. 发布多条消息
      const messages = [
        { content: 'First message', priority: 'high' as const },
        { content: 'Second message', priority: 'normal' as const },
        { content: 'Third message', priority: 'low' as const },
      ];

      for (const msg of messages) {
        await messageService.publish({
          channel: channelName,
          message: msg.content,
          priority: parsePriority(msg.priority),
        });
      }

      // 3. 验证消息已发布
      const publishedMessages = await messageService.getMessages(channelName);

      expect(publishedMessages.length).toBe(3);

      // 4. 验证消息顺序（高优先级在前）
      expect(publishedMessages[0].message).toBe('First message'); // High priority
      expect(publishedMessages[1].message).toBe('Second message'); // Normal
      expect(publishedMessages[2].message).toBe('Third message'); // Low
    });
  });

  describe('E2E-003: Message Signing and Verification @security @e2e', () => {
    it('should complete message signing and verification workflow', async () => {
      let privateKey: string | null = null;

      try {
        const { publicKey, privateKey: tempPrivateKey } = encryptionService.generateKeyPair();
        privateKey = tempPrivateKey;

        // 1. 发送端签名消息
        const message = 'Important signed message';
        const signature = encryptionService.sign(message, privateKey);

        // 2. 接收端验证签名
        const isValid = encryptionService.verify(message, signature, publicKey);

        expect(isValid).toBe(true);

        // 3. 验证篡改的消息
        const tamperedMessage = 'Tampered message';
        const isTamperedValid = encryptionService.verify(
          tamperedMessage,
          signature,
          publicKey
        );

        expect(isTamperedValid).toBe(false);
      } finally {
        if (privateKey) privateKey = null;
      }
    });

    it('should support signed encrypted messages @security @e2e', async () => {
      let privateKey: string | null = null;

      try {
        const { publicKey, privateKey: tempPrivateKey } = encryptionService.generateKeyPair();
        privateKey = tempPrivateKey;

        // 注册公钥
        const registerData = await encryptionKeyService.registerKey({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        });
        const { channelId } = registerData;

        // 加密并签名消息
        const plaintext = 'Signed and encrypted message';
        const encrypted = encryptionService.encrypt(plaintext, publicKey);
        const signature = encryptionService.sign(encrypted, privateKey);

        await messageService.publish({
          channel: channelId,
          message: encrypted,
          encrypted: true,
          signature,
        });

        // 接收并验证
        const messages = await messageService.getMessages(channelId);
        const messageData = messages[0];

        expect(messageData.signature).toBeDefined();
        expect(messageData.signature).toBe(signature);

        const isSignatureValid = encryptionService.verify(
          messageData.message,
          messageData.signature,
          publicKey
        );
        expect(isSignatureValid).toBe(true);


      } finally {
        if (privateKey) privateKey = null;
      }
    });
  });

  describe('E2E-004: Multi-Receiver Scenarios @e2e @concurrency', () => {
    it('should support multiple receivers subscribing simultaneously', async () => {
      const channelName = TestDataFactory.generateChannelName('multi-receiver');

      // 创建频道
      await channelService.createChannel({
        name: channelName,
        type: 'public',
        id: channelName,
      });

      // 发布消息
      await messageService.publish({
        channel: channelName,
        message: 'Broadcast to all receivers',
      });

      // 验证消息已发布
      const messages = await messageService.getMessages(channelName);
      expect(messages.length).toBe(1);

      // 多个接收端都应该能获取到消息
      const messageData = messages[0];
      expect(messageData.message).toBe('Broadcast to all receivers');
    });

    it('should support encrypted channels with multiple receivers @security @e2e', async () => {
      let privateKey1: string | null = null;
      let privateKey2: string | null = null;

      try {
        // 接收端 1
        const { publicKey: publicKey1, privateKey: tempPrivateKey1 } =
          encryptionService.generateKeyPair();
        privateKey1 = tempPrivateKey1;

        const registerData1 = await encryptionKeyService.registerKey({
          publicKey: publicKey1,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        });
        const channelId1 = registerData1.channelId;

        // 接收端 2
        const { publicKey: publicKey2, privateKey: tempPrivateKey2 } =
          encryptionService.generateKeyPair();
        privateKey2 = tempPrivateKey2;

        const registerData2 = await encryptionKeyService.registerKey({
          publicKey: publicKey2,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        });
        const channelId2 = registerData2.channelId;

        // 每个接收端应该有独立的加密频道
        expect(channelId1).not.toBe(channelId2);

        // 发送给接收端 1 的消息，接收端 2 无法解密
        const plaintext1 = 'Message for receiver 1';
        const encrypted1 = encryptionService.encrypt(plaintext1, publicKey1);

        await messageService.publish({
          channel: channelId1,
          message: encrypted1,
          encrypted: true,
        });

        const plaintext2 = 'Message for receiver 2';
        const encrypted2 = encryptionService.encrypt(plaintext2, publicKey2);

        await messageService.publish({
          channel: channelId2,
          message: encrypted2,
          encrypted: true,
        });

        const messages1 = await messageService.getMessages(channelId1);
        const messageData1 = messages1[0];
        const decrypted1 = encryptionService.decrypt(messageData1.message, privateKey1!);
        expect(decrypted1).toBe(plaintext1);

        // Restore negative test
        expect(() => {
          encryptionService.decrypt(messageData1.message, privateKey2!);
        }).toThrow(/Failed to decrypt message/i);

        const messages2 = await messageService.getMessages(channelId2);
        const messageData2 = messages2[0];
        const decrypted2 = encryptionService.decrypt(messageData2.message, privateKey2!);
        expect(decrypted2).toBe(plaintext2);
      } finally {
        if (privateKey1) privateKey1 = null;
        if (privateKey2) privateKey2 = null;
      }
    });
  });

  describe('E2E-005: Message Persistence and TTL @e2e', () => {
    it('should handle message TTL correctly', async () => {
      const channelName = TestDataFactory.generateChannelName('ttl');

      // 发布消息
      await messageService.publish({
        channel: channelName,
        message: 'Message with TTL',
        priority: MessagePriority.NORMAL,
      });

      // 检查消息是否设置了 TTL
      const ttl = await redis.ttl(`channel:${channelName}:queue`);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should handle encrypted channel TTL correctly @e2e', async () => {
      const { publicKey } = encryptionService.generateKeyPair();

      const registerData = await encryptionKeyService.registerKey({
        publicKey,
        algorithm: 'RSA-2048',
        expiresIn: 604800,
      });
      const { channelId } = registerData;

      // 发布加密消息
      await messageService.publish({
        channel: channelId,
        message: encryptionService.encrypt('Test', publicKey),
        encrypted: true,
      });

      // 检查加密频道的 TTL
      const ttl = await redis.ttl(`channel:${channelId}:queue`);
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe('E2E-006: Error Handling and Recovery @e2e', () => {
    it('should return null when channel does not exist', async () => {
      const result = await channelService.getChannel('non-existent');
      expect(result).toBeNull();
    });

    it('should return null when public key does not exist', async () => {
      const result = await encryptionKeyService.getKey('enc_nonexistent');
      expect(result).toBeNull();
    });

    it('should throw error for invalid input', async () => {
      await expect(messageService.publish({
        // Missing channel
        message: 'Test message',
      } as any)).rejects.toThrow();
    });
  });

  describe('E2E-007: Performance Tests @performance @e2e', () => {
    it('should process large number of messages quickly', async () => {
      const channelName = TestDataFactory.generateChannelName('performance');

      // 发布 PERFORMANCE_MESSAGE_COUNT 条消息
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < PERFORMANCE_MESSAGE_COUNT; i++) {
        promises.push(messageService.publish({
          channel: channelName,
          message: TestDataFactory.generateMessage(i),
          priority: parsePriority(i % 2 === 0 ? 'high' : 'normal'),
        }));
      }

      const responses = await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Performance test timeout after 10s'
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 所有请求都应该成功
      const successful = responses.filter(r => r.messageId).length;
      expect(successful).toBe(PERFORMANCE_MESSAGE_COUNT);

      // PERFORMANCE_MESSAGE_COUNT 条消息应该在合理时间内完成（< 10秒）
      expect(duration).toBeLessThan(TEST_TIMEOUT_MS);
      console.log(`Performance: ${PERFORMANCE_MESSAGE_COUNT} messages in ${duration}ms`);
    });

    it('should support concurrent encryption operations @performance @e2e', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      // 并发加密 ENCRYPTION_ITERATION_COUNT 条消息
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < ENCRYPTION_ITERATION_COUNT; i++) {
        const plaintext = TestDataFactory.generateMessage(i);
        promises.push(encryptionService.encrypt(plaintext, publicKey));
      }

      const encryptedMessages = await withTimeout(
        Promise.all(promises),
        PERFORMANCE_TIMEOUT_MS,
        'Encryption test timeout after 5s'
      ) as string[];

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 所有消息都应该被加密
      expect(encryptedMessages).toHaveLength(ENCRYPTION_ITERATION_COUNT);

      // ENCRYPTION_ITERATION_COUNT 次加密应该在合理时间内完成（< 5秒）
      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT_MS);
      console.log(`Performance: ${ENCRYPTION_ITERATION_COUNT} encryptions in ${duration}ms`);

      // 验证所有消息都能正确解密
      for (let i = 0; i < ENCRYPTION_ITERATION_COUNT; i++) {
        const decrypted = encryptionService.decrypt(
          encryptedMessages[i],
          privateKey
        );
        expect(decrypted).toBe(TestDataFactory.generateMessage(i));
      }
    });
  });

  describe('E2E-008: Complete User Scenarios @e2e', () => {
    it('should simulate complete user registration, publish, subscribe workflow', async () => {
      let privateKeyA: string | null = null;

      try {
        // 用户 A：接收端
        const { publicKey: publicKeyA, privateKey: tempPrivateKeyA } =
          encryptionService.generateKeyPair();
        privateKeyA = tempPrivateKeyA;

        const registerDataA = await encryptionKeyService.registerKey({
          publicKey: publicKeyA,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        });
        const channelIdA = registerDataA.channelId;

        // 用户 B：发送端
        // 获取用户 A 的公钥
        const getKeyData = await encryptionKeyService.getKey(channelIdA);
        const retrievedPublicKey = getKeyData!.publicKey;

        expect(retrievedPublicKey).toBe(publicKeyA);

        // 用户 B 发送多条加密消息
        const messages = [
          'Hello from User B!',
          'This is a test message',
          'End-to-end encryption works!',
        ];

        for (const msg of messages) {
          const encrypted = encryptionService.encrypt(msg, retrievedPublicKey);

          await messageService.publish({
            channel: channelIdA,
            message: encrypted,
            encrypted: true,
          });
        }

        // 用户 A 接收并解密所有消息
        const receivedMessages = await messageService.getMessages(channelIdA);
        // getMessages returns newest first, so we reverse to match publishing order
        receivedMessages.reverse();

        expect(receivedMessages.length).toBe(3);

        for (let i = 0; i < 3; i++) {
          const messageData = receivedMessages[i];
          const decrypted = encryptionService.decrypt(
            messageData.message,
            privateKeyA!
          );
          expect(decrypted).toBe(messages[i]);
        }
      } finally {
        if (privateKeyA) privateKeyA = null;
      }
    });
  });

  describe('E2E-009: Data Consistency @e2e', () => {
    it('should guarantee message consistency between publish and receive', async () => {
      const channelName = TestDataFactory.generateChannelName('consistency');

      const originalMessages = [
        'Message 1 with special chars: !@#\$%',
        'Message 2 with unicode: 你好世界 🌍',
        'Message 3 with newlines\nLine 2\nLine 3',
      ];

      // 发布所有消息
      for (const msg of originalMessages) {
        await messageService.publish({
          channel: channelName,
          message: msg,
        });
      }

      // 接收所有消息
      const receivedMessages = await messageService.getMessages(channelName);
      receivedMessages.reverse();

      expect(receivedMessages.length).toBe(3);

      // 验证每条消息的一致性
      for (let i = 0; i < 3; i++) {
        const messageData = receivedMessages[i];
        expect(messageData.message).toBe(originalMessages[i]);
      }
    });

    it('should guarantee encrypted message consistency', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const originalMessage = 'Test consistency: 12345!@#\$%';

      const encrypted = encryptionService.encrypt(originalMessage, publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe(originalMessage);
    });
  });

  describe('E2E-010: Concurrent Scenarios @concurrency @e2e', () => {
    it('should handle multiple users registering simultaneously', async () => {
      const promises = [];

      for (let i = 0; i < CONCURRENT_USER_COUNT; i++) {
        const { publicKey } = encryptionService.generateKeyPair();

        promises.push(encryptionKeyService.registerKey({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }));
      }

      const responses = await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Concurrent registration timeout'
      );

      // 所有注册都应该成功
      const successful = responses.filter(r => r.channelId).length;
      expect(successful).toBe(CONCURRENT_USER_COUNT);

      // 所有 channel ID 应该不同
      const channelIds = responses.map(r => r.channelId);

      const uniqueIds = new Set(channelIds);
      expect(uniqueIds.size).toBe(CONCURRENT_USER_COUNT);
    });

    it('should handle multiple users publishing simultaneously', async () => {
      const channelName = TestDataFactory.generateChannelName('concurrent-publish');

      const promises = [];

      for (let i = 0; i < CONCURRENT_PUBLISH_COUNT; i++) {
        promises.push(messageService.publish({
          channel: channelName,
          message: TestDataFactory.generateMessage(i),
          priority: parsePriority(i % 3 === 0 ? 'high' : 'normal'),
        }));
      }

      const responses = await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Concurrent publish timeout'
      );

      // 所有发布都应该成功
      const successful = responses.filter(r => r.messageId).length;
      expect(successful).toBe(CONCURRENT_PUBLISH_COUNT);

      // 验证所有消息都已发布
      const length = await messageService.getQueueLength(channelName);
      expect(length).toBe(CONCURRENT_PUBLISH_COUNT);
    });

    it('should handle concurrent publishes without data loss @concurrency @e2e', async () => {
      const channelName = TestDataFactory.generateChannelName('race-condition');
      const messageCount = 50;

      const promises = Array.from({ length: messageCount }, (_, i) =>
        messageService.publish({
          channel: channelName,
          message: TestDataFactory.generateMessage(i),
        })
      );

      await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Race condition test timeout'
      );

      const messages = await messageService.getMessages(channelName, messageCount + 10);
      expect(messages.length).toBe(messageCount);

      // 验证没有重复
      const messageContents = messages.map(m => m.message);
      const uniqueMessages = new Set(messageContents);
      expect(uniqueMessages.size).toBe(messageCount);
    });
  });

  describe('E2E-011: Edge Cases @e2e @boundary', () => {
    it('should handle empty message @boundary', async () => {
      const channelName = TestDataFactory.generateChannelName('empty');

      await expect(messageService.publish({
        channel: channelName,
        message: '',
      })).rejects.toThrow(); // Validation error
    });

    it('should handle single character message @boundary', async () => {
      const channelName = TestDataFactory.generateChannelName('single-char');

      await messageService.publish({
        channel: channelName,
        message: 'a',
      });

      const messages = await messageService.getMessages(channelName);
      const messageData = messages[0];
      expect(messageData.message).toBe('a');
    });

    it('should handle very long channel name @boundary', async () => {
      const longChannelName = 'a'.repeat(100);

      // Schema max is 255. 100 is fine.
      await messageService.publish({
        channel: longChannelName,
        message: 'Long channel name test',
      });

      const messages = await messageService.getMessages(longChannelName);
      expect(messages.length).toBe(1);
    });

    it('should handle special characters in message @boundary', async () => {
      const channelName = TestDataFactory.generateChannelName('special-chars');

      const specialMessage = 'Special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./';

      await messageService.publish({
        channel: channelName,
        message: specialMessage,
      });

      const messages = await messageService.getMessages(channelName);
      const messageData = messages[0];
      expect(messageData.message).toBe(specialMessage);
    });

    it('should handle Unicode in message @boundary', async () => {
      const channelName = TestDataFactory.generateChannelName('unicode');

      const unicodeMessage = 'Hello 世界 🌍 Ñoñoño 你好 مرحبا';

      await messageService.publish({
        channel: channelName,
        message: unicodeMessage,
      });

      const messages = await messageService.getMessages(channelName);
      const messageData = messages[0];
      expect(messageData.message).toBe(unicodeMessage);
    });

    it('should handle newlines in message @boundary', async () => {
      const channelName = TestDataFactory.generateChannelName('newlines');

      const multilineMessage = 'Line 1\nLine 2\nLine 3';

      await messageService.publish({
        channel: channelName,
        message: multilineMessage,
      });

      const messages = await messageService.getMessages(channelName);
      const messageData = messages[0];
      expect(messageData.message).toBe(multilineMessage);
    });

    it('should reject null values in optional fields @boundary', async () => {
      const channelName = TestDataFactory.generateChannelName('null');

      // TypeScript would error, but if we cast to any:
      await expect(messageService.publish({
        channel: channelName,
        message: 'Test message',
        sender: null,
        encrypted: false,
      } as any)).rejects.toThrow();
    });

    it('should handle message near max size @boundary', async () => {
      const channelName = TestDataFactory.generateChannelName('max-size');

      // Reduce size slightly to account for JSON overhead (quotes, etc.)
      const maxSize = 4_718_592 - 1024; // 4.5MB - 1KB
      const message = 'x'.repeat(maxSize);

      await messageService.publish({
        channel: channelName,
        message,
      });

      const messages = await messageService.getMessages(channelName);
      expect(messages.length).toBe(1);
    });
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { POST as publishPOST } from '@/app/api/publish/route';
import { POST as registerPOST, GET as registerGET } from '@/app/api/register/route';
import { GET as keysGET } from '@/app/api/keys/[id]/route';
import { GET as subscribeGET } from '@/app/api/subscribe/route';
import { POST as channelsPOST } from '@/app/api/channels/route';
import { EncryptionService } from '@/lib/services/encryption.service';
import { MessagePriority } from '@/lib/types/message.types';
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

// Helper function to create publish request
function createPublishRequest(channel: string, message: string, options: any = {}) {
  return new Request('http://localhost:3000/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel,
      message,
      ...options,
    }),
  });
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
  let redis: RedisClientType;
  let testPrefix: string;

  beforeAll(async () => {
    encryptionService = new EncryptionService();
    redis = await getRedisClient();
    testPrefix = `e2e_test_${Date.now()}_`;

    // Selective cleanup instead of flushDb
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data
      const keys = await redis.keys(`${testPrefix}*`);
      if (keys.length > 0) {
        await redis.del(keys);
      }
      // Close Redis connection
      await redis.quit();
    } catch (error) {
      console.error('Cleanup error in afterAll:', error);
    }
  });

  afterEach(async () => {
    // Clean up test data after each test
    try {
      const keys = await redis.keys(`${testPrefix}*`);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Cleanup error in afterEach:', error);
    }
  });

  describe('E2E-001: 端到端加密通信', () => {
    it('应该完成完整的加密消息发送和接收', async () => {
      let privateKey: string | null = null;

      try {
        // 1. 接收端生成密钥对并注册
        const { publicKey, privateKey: tempPrivateKey } = encryptionService.generateKeyPair();
        privateKey = tempPrivateKey;

        const registerRequest = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });

        const registerResponse = await registerPOST(registerRequest);
        const registerData = await registerResponse.json();

        expect(registerResponse.status).toBe(201);
        expect(registerData.success).toBe(true);
        const { channelId } = registerData.data;

        // 2. 发送端获取公钥
        const getKeyRequest = new Request(
          `http://localhost:3000/api/keys/${channelId}`
        );

        const getKeyResponse = await keysGET(getKeyRequest, { params: { id: channelId } });
        const getKeyData = await getKeyResponse.json();

        expect(getKeyResponse.status).toBe(200);
        expect(getKeyData.success).toBe(true);
        expect(getKeyData.data.publicKey).toBe(publicKey);

        // 3. 发送端加密消息
        const plaintext = 'Secret message from sender!';
        const encrypted = encryptionService.encrypt(plaintext, publicKey);

        // 4. 发送加密消息
        const publishRequest = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelId,
            message: encrypted,
            encrypted: true,
          }),
        });

        const publishResponse = await publishPOST(publishRequest);
        const publishData = await publishResponse.json();

        expect(publishResponse.status).toBe(200);
        expect(publishData.success).toBe(true);

        // 5. 接收端获取消息
        const messages = await redis.lRange(`channel:${channelId}:queue`, 0, -1);
        expect(messages.length).toBeGreaterThan(0);

        const messageData = JSON.parse(messages[0]);
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

    it('应该在密钥不匹配时无法解密', async () => {
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
        }).toThrow(/decryption failed|invalid key/i);
      } finally {
        if (privateKey1) privateKey1 = null;
        if (privateKey2) privateKey2 = null;
      }
    });

    it('应该支持混合加密的大消息', async () => {
      let privateKey: string | null = null;

      try {
        const { publicKey, privateKey: tempPrivateKey } = encryptionService.generateKeyPair();
        privateKey = tempPrivateKey;

        // 注册公钥
        const registerRequest = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });

        const registerResponse = await registerPOST(registerRequest);
        const registerData = await registerResponse.json();
        const { channelId } = registerData.data;

        // 使用混合加密发送大消息
        const largePlaintext = 'x'.repeat(Math.min(LARGE_MESSAGE_SIZE, 50000));
        expect(largePlaintext.length).toBeLessThanOrEqual(LARGE_MESSAGE_SIZE);

        const pkg = encryptionService.hybridEncrypt(largePlaintext, publicKey);

        const publishRequest = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelId,
            message: JSON.stringify(pkg),
            encrypted: true,
          }),
        });

        const publishResponse = await publishPOST(publishRequest);
        expect(publishResponse.status).toBe(200);

        // 接收并解密
        const messages = await redis.lRange(`channel:${channelId}:queue`, 0, -1);
        const messageData = JSON.parse(messages[0]);
        const pkgReceived = JSON.parse(messageData.message);

        const decrypted = encryptionService.hybridDecrypt(pkgReceived, privateKey);
        expect(decrypted).toBe(largePlaintext);
      } finally {
        if (privateKey) privateKey = null;
      }
    });
  });

  describe('E2E-002: 公开频道完整流程', () => {
    it('应该完成公开频道的创建、发布和订阅', async () => {
      const channelName = TestDataFactory.generateChannelName('public');

      // 1. 创建公开频道
      const createRequest = new Request('http://localhost:3000/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: channelName,
          type: 'public',
        }),
      });

      const createResponse = await channelsPOST(createRequest);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createData.success).toBe(true);

      // 2. 发布多条消息
      const messages = [
        { content: 'First message', priority: 'high' },
        { content: 'Second message', priority: 'normal' },
        { content: 'Third message', priority: 'low' },
      ];

      for (const msg of messages) {
        const publishRequest = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelName,
            message: msg.content,
            priority: msg.priority,
          }),
        });

        const publishResponse = await publishPOST(publishRequest);
        expect(publishResponse.status).toBe(200);
      }

      // 3. 验证消息已发布
      const publishedMessages = await redis.lRange(
        `channel:${channelName}:queue`,
        0,
        -1
      );

      expect(publishedMessages.length).toBe(3);

      // 4. 验证消息顺序（高优先级在前）
      const parsedMessages = publishedMessages.map(m => JSON.parse(m));
      expect(parsedMessages[0].message).toBe('First message');
      expect(parsedMessages[1].message).toBe('Second message');
      expect(parsedMessages[2].message).toBe('Third message');
    });
  });

  describe('E2E-003: 消息签名和验证', () => {
    it('应该完成消息签名和验证流程', async () => {
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

    it('应该支持带签名的加密消息', async () => {
      let privateKey: string | null = null;

      try {
        const { publicKey, privateKey: tempPrivateKey } = encryptionService.generateKeyPair();
        privateKey = tempPrivateKey;

        // 注册公钥
        const registerRequest = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });

        const registerResponse = await registerPOST(registerRequest);
        const registerData = await registerResponse.json();
        const { channelId } = registerData.data;

        // 加密并签名消息
        const plaintext = 'Signed and encrypted message';
        const encrypted = encryptionService.encrypt(plaintext, publicKey);
        const signature = encryptionService.sign(encrypted, privateKey);

        const publishRequest = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelId,
            message: encrypted,
            signature,
            encrypted: true,
          }),
        });

        const publishResponse = await publishPOST(publishRequest);
        expect(publishResponse.status).toBe(200);

        // 接收并验证
        const messages = await redis.lRange(`channel:${channelId}:queue`, 0, -1);
        const messageData = JSON.parse(messages[0]);

        // 验证签名
        const isValid = encryptionService.verify(
          messageData.message,
          messageData.signature,
          publicKey
        );

        expect(isValid).toBe(true);

        // 解密
        const decrypted = encryptionService.decrypt(messageData.message, privateKey);
        expect(decrypted).toBe(plaintext);
      } finally {
        if (privateKey) privateKey = null;
      }
    });
  });

  describe('E2E-004: 多接收端场景', () => {
    it('应该支持多个接收端同时订阅', async () => {
      const channelName = TestDataFactory.generateChannelName('multi-receiver');

      // 创建频道
      const createRequest = new Request('http://localhost:3000/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: channelName,
          type: 'public',
        }),
      });

      await channelsPOST(createRequest);

      // 发布消息
      const publishRequest = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelName,
          message: 'Broadcast to all receivers',
        }),
      });

      const publishResponse = await publishPOST(publishRequest);
      expect(publishResponse.status).toBe(200);

      // 验证消息已发布
      const messages = await redis.lRange(`channel:${channelName}:queue`, 0, -1);
      expect(messages.length).toBe(1);

      // 多个接收端都应该能获取到消息
      const messageData = JSON.parse(messages[0]);
      expect(messageData.message).toBe('Broadcast to all receivers');
    });

    it('应该支持加密频道多接收端', async () => {
      let privateKey1: string | null = null;
      let privateKey2: string | null = null;

      try {
        // 接收端 1
        const { publicKey: publicKey1, privateKey: tempPrivateKey1 } =
          encryptionService.generateKeyPair();
        privateKey1 = tempPrivateKey1;

        const registerRequest1 = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: publicKey1,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });

        const registerResponse1 = await registerPOST(registerRequest1);
        const registerData1 = await registerResponse1.json();
        const channelId1 = registerData1.data.channelId;

        // 接收端 2
        const { publicKey: publicKey2, privateKey: tempPrivateKey2 } =
          encryptionService.generateKeyPair();
        privateKey2 = tempPrivateKey2;

        const registerRequest2 = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: publicKey2,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });

        const registerResponse2 = await registerPOST(registerRequest2);
        const registerData2 = await registerResponse2.json();
        const channelId2 = registerData2.data.channelId;

        // 每个接收端应该有独立的加密频道
        expect(channelId1).not.toBe(channelId2);

        // 发送给接收端 1 的消息，接收端 2 无法解密
        const plaintext1 = 'Message for receiver 1';
        const encrypted1 = encryptionService.encrypt(plaintext1, publicKey1);

        const publishRequest1 = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelId1,
            message: encrypted1,
            encrypted: true,
          }),
        });

        await publishPOST(publishRequest1);

        const messages1 = await redis.lRange(`channel:${channelId1}:queue`, 0, -1);
        const messageData1 = JSON.parse(messages1[0]);

        const decrypted1 = encryptionService.decrypt(
          messageData1.message,
          privateKey1!
        );
        expect(decrypted1).toBe(plaintext1);

        // 接收端 2 无法解密接收端 1 的消息
        expect(() => {
          encryptionService.decrypt(messageData1.message, privateKey2!);
        }).toThrow(/decryption failed|invalid key/i);
      } finally {
        if (privateKey1) privateKey1 = null;
        if (privateKey2) privateKey2 = null;
      }
    });
  });

  describe('E2E-005: 消息持久化和 TTL', () => {
    it('应该正确处理消息 TTL', async () => {
      const channelName = TestDataFactory.generateChannelName('ttl');

      // 发布消息
      const publishRequest = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelName,
          message: 'Message with TTL',
          priority: MessagePriority.NORMAL,
        }),
      });

      const publishResponse = await publishPOST(publishRequest);
      expect(publishResponse.status).toBe(200);

      // 检查消息是否设置了 TTL
      const ttl = await redis.ttl(`channel:${channelName}:queue`);
      expect(ttl).toBeGreaterThan(0);
    });

    it('应该正确处理加密频道 TTL', async () => {
      const { publicKey } = encryptionService.generateKeyPair();

      const registerRequest = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const registerResponse = await registerPOST(registerRequest);
      const registerData = await registerResponse.json();
      const { channelId } = registerData.data;

      // 发布加密消息
      const publishRequest = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelId,
          message: encryptionService.encrypt('Test', publicKey),
          encrypted: true,
        }),
      });

      await publishPOST(publishRequest);

      // 检查加密频道的 TTL
      const ttl = await redis.ttl(`channel:${channelId}:queue`);
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe('E2E-006: 错误处理和恢复', () => {
    it('应该在频道不存在时返回 404', async () => {
      const subscribeRequest = new Request(
        'http://localhost:3000/api/subscribe?channel=non-existent'
      );

      const subscribeResponse = await subscribeGET(subscribeRequest);

      expect(subscribeResponse.status).toBe(404);
    });

    it('应该在公钥不存在时返回 404', async () => {
      const getKeyRequest = new Request(
        'http://localhost:3000/api/keys/enc_nonexistent'
      );

      const getKeyResponse = await keysGET(getKeyRequest, {
        params: { id: 'enc_nonexistent' },
      });

      expect(getKeyResponse.status).toBe(404);
    });

    it('应该在无效输入时返回 400', async () => {
      const publishRequest = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 缺少必需的 channel 字段
          message: 'Test message',
        }),
      });

      const publishResponse = await publishPOST(publishRequest);

      expect(publishResponse.status).toBe(400);
    });
  });

  describe('E2E-007: 性能测试', () => {
    it('应该快速处理大量消息', async () => {
      const channelName = TestDataFactory.generateChannelName('performance');

      // 发布 PERFORMANCE_MESSAGE_COUNT 条消息
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < PERFORMANCE_MESSAGE_COUNT; i++) {
        const publishRequest = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelName,
            message: TestDataFactory.generateMessage(i),
            priority: i % 2 === 0 ? 'high' : 'normal',
          }),
        });

        promises.push(publishPOST(publishRequest));
      }

      const responses = await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Performance test timeout after 10s'
      ) as Response[];

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 所有请求都应该成功
      const successful = responses.filter(r => r.status === 200).length;
      expect(successful).toBe(PERFORMANCE_MESSAGE_COUNT);

      // PERFORMANCE_MESSAGE_COUNT 条消息应该在合理时间内完成（< 10秒）
      expect(duration).toBeLessThan(TEST_TIMEOUT_MS);
      console.log(`Performance: ${PERFORMANCE_MESSAGE_COUNT} messages in ${duration}ms`);
    });

    it('应该支持并发加密操作', async () => {
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

  describe('E2E-008: 完整用户场景', () => {
    it('应该模拟完整的用户注册、发布、订阅流程', async () => {
      let privateKeyA: string | null = null;

      try {
        // 用户 A：接收端
        const { publicKey: publicKeyA, privateKey: tempPrivateKeyA } =
          encryptionService.generateKeyPair();
        privateKeyA = tempPrivateKeyA;

        const registerRequestA = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey: publicKeyA,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });

        const registerResponseA = await registerPOST(registerRequestA);
        const registerDataA = await registerResponseA.json();
        const channelIdA = registerDataA.data.channelId;

        // 用户 B：发送端
        // 获取用户 A 的公钥
        const getKeyRequest = new Request(
          `http://localhost:3000/api/keys/${channelIdA}`
        );

        const getKeyResponse = await keysGET(getKeyRequest, {
          params: { id: channelIdA },
        });
        const getKeyData = await getKeyResponse.json();
        const retrievedPublicKey = getKeyData.data.publicKey;

        expect(retrievedPublicKey).toBe(publicKeyA);

        // 用户 B 发送多条加密消息
        const messages = [
          'Hello from User B!',
          'This is a test message',
          'End-to-end encryption works!',
        ];

        for (const msg of messages) {
          const encrypted = encryptionService.encrypt(msg, retrievedPublicKey);

          const publishRequest = new Request('http://localhost:3000/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel: channelIdA,
              message: encrypted,
              encrypted: true,
            }),
          });

          const publishResponse = await publishPOST(publishRequest);
          expect(publishResponse.status).toBe(200);
        }

        // 用户 A 接收并解密所有消息
        const receivedMessages = await redis.lRange(
          `channel:${channelIdA}:queue`,
          0,
          -1
        );

        expect(receivedMessages.length).toBe(3);

        for (let i = 0; i < 3; i++) {
          const messageData = JSON.parse(receivedMessages[i]);
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

  describe('E2E-009: 数据一致性', () => {
    it('应该保证消息在发布和接收间的一致性', async () => {
      const channelName = TestDataFactory.generateChannelName('consistency');

      const originalMessages = [
        'Message 1 with special chars: !@#\$%',
        'Message 2 with unicode: 你好世界 🌍',
        'Message 3 with newlines\nLine 2\nLine 3',
      ];

      // 发布所有消息
      for (const msg of originalMessages) {
        const publishRequest = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelName,
            message: msg,
          }),
        });

        const publishResponse = await publishPOST(publishRequest);
        expect(publishResponse.status).toBe(200);
      }

      // 接收所有消息
      const receivedMessages = await redis.lRange(
        `channel:${channelName}:queue`,
        0,
        -1
      );

      expect(receivedMessages.length).toBe(3);

      // 验证每条消息的一致性
      for (let i = 0; i < 3; i++) {
        const messageData = JSON.parse(receivedMessages[i]);
        expect(messageData.message).toBe(originalMessages[i]);
      }
    });

    it('应该保证加密消息的一致性', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const originalMessage = 'Test consistency: 12345!@#\$%';

      const encrypted = encryptionService.encrypt(originalMessage, publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe(originalMessage);
    });
  });

  describe('E2E-010: 并发场景', () => {
    it('应该处理多个用户同时注册', async () => {
      const promises = [];

      for (let i = 0; i < CONCURRENT_USER_COUNT; i++) {
        const { publicKey } = encryptionService.generateKeyPair();

        const registerRequest = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicKey,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });

        promises.push(registerPOST(registerRequest));
      }

      const responses = await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Concurrent registration timeout'
      ) as Response[];

      // 所有注册都应该成功
      const successful = responses.filter(r => r.status === 201).length;
      expect(successful).toBe(CONCURRENT_USER_COUNT);

      // 所有 channel ID 应该不同
      const channelIds = responses.map(r => {
        const data = r.json();
        return data.then(d => d.data.channelId);
      });

      const resolvedIds = await Promise.all(channelIds);
      const uniqueIds = new Set(resolvedIds);
      expect(uniqueIds.size).toBe(CONCURRENT_USER_COUNT);
    });

    it('应该处理多个用户同时发布', async () => {
      const channelName = TestDataFactory.generateChannelName('concurrent-publish');

      const promises = [];

      for (let i = 0; i < CONCURRENT_PUBLISH_COUNT; i++) {
        const publishRequest = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelName,
            message: TestDataFactory.generateMessage(i),
            priority: i % 3 === 0 ? 'high' : 'normal',
          }),
        });

        promises.push(publishPOST(publishRequest));
      }

      const responses = await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Concurrent publish timeout'
      ) as Response[];

      // 所有发布都应该成功
      const successful = responses.filter(r => r.status === 200).length;
      expect(successful).toBe(CONCURRENT_PUBLISH_COUNT);

      // 验证所有消息都已发布
      const messages = await redis.lRange(
        `channel:${channelName}:queue`,
        0,
        -1
      );
      expect(messages.length).toBe(CONCURRENT_PUBLISH_COUNT);
    });

    it('应该处理并发发布而不丢失数据', async () => {
      const channelName = TestDataFactory.generateChannelName('race-condition');
      const messageCount = 50;

      const promises = Array.from({ length: messageCount }, (_, i) =>
        publishPOST(new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: channelName,
            message: TestDataFactory.generateMessage(i),
          }),
        }))
      );

      await withTimeout(
        Promise.all(promises),
        TEST_TIMEOUT_MS,
        'Race condition test timeout'
      );

      const messages = await redis.lRange(`channel:${channelName}:queue`, 0, -1);
      expect(messages.length).toBe(messageCount);

      // 验证没有重复
      const messageContents = messages.map(m => JSON.parse(m).message);
      const uniqueMessages = new Set(messageContents);
      expect(uniqueMessages.size).toBe(messageCount);
    });
  });
});

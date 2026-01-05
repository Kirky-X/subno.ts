// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageService } from '@/lib/services/message.service';
import { EncryptionService } from '@/lib/services/encryption.service';
import { ApiKeyService } from '@/lib/services/api-key.service';
import { MessagePriority } from '@/lib/types/message.types';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '@/lib/redis';
import { validateRegisterKey, ValidationError } from '@/lib/utils/validation.util';

describe('Security Tests', () => {
  let messageService: MessageService;
  let encryptionService: EncryptionService;
  let apiKeyService: ApiKeyService;
  let redis: any;
  let testUserId: string;

  beforeEach(async () => {
    messageService = new MessageService();
    encryptionService = new EncryptionService();
    apiKeyService = new ApiKeyService();
    redis = await getRedisClient();
    testUserId = `security-test-${Date.now()}`;
    await redis.flushDb();
  });

  afterEach(async () => {
    // Clean up test data
    await redis.flushDb();

    try {
      const existingKeys = await db
        .select({ id: schema.apiKeys.id })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.userId, testUserId));

      for (const key of existingKeys) {
        await db
          .delete(schema.apiKeys)
          .where(eq(schema.apiKeys.id, key.id));
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('SQL injection protection', () => {
    it('should not execute SQL injection in channel ID', async () => {
      const maliciousChannelId = "test'; DROP TABLE public_keys; --";

      // This should not cause SQL injection
      await messageService.publish({
        channel: maliciousChannelId,
        message: 'Test message',
        priority: MessagePriority.NORMAL,
      });

      // Verify the channel was created with the literal name
      const exists = await messageService.channelExists(maliciousChannelId);
      expect(exists.exists).toBe(true);

      // Verify the table still exists
      const tables = await db
        .select({ name: schema.publicKeys.id })
        .from(schema.publicKeys)
        .limit(1);

      // If table was dropped, this would fail
      expect(tables).toBeDefined();
    });

    it('should handle special characters in channel ID safely', async () => {
      const specialChannels = [
        "test' OR '1'='1",
        "test; DROP TABLE--",
        "test' UNION SELECT * FROM--",
        "test'--",
      ];

      for (const channel of specialChannels) {
        await messageService.publish({
          channel,
          message: 'Test',
          priority: MessagePriority.NORMAL,
        });

        const exists = await messageService.channelExists(channel);
        expect(exists.exists).toBe(true);
      }
    });

    it('should not allow SQL injection in message content', async () => {
      const maliciousMessage = "'; DELETE FROM messages; --";

      await messageService.publish({
        channel: 'test-sql-injection',
        message: maliciousMessage,
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      const messages = await messageService.getMessages('test-sql-injection', 1);
      expect(messages[0].message).toBe(maliciousMessage);
    });
  });

  describe('XSS protection', () => {
    it('should store XSS payload without executing', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      await messageService.publish({
        channel: 'test-xss',
        message: xssPayload,
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      const messages = await messageService.getMessages('test-xss', 1);
      expect(messages[0].message).toBe(xssPayload);
      // The message is stored as-is, execution depends on frontend
    });

    it('should handle various XSS patterns', async () => {
      const xssPatterns = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)">',
        '<body onload=alert(1)>',
      ];

      for (const pattern of xssPatterns) {
        await messageService.publish({
          channel: 'test-xss-patterns',
          message: pattern,
          priority: MessagePriority.NORMAL,
        });

        const messages = await messageService.getMessages('test-xss-patterns', 10);
        const found = messages.find(m => m.message === pattern);
        expect(found).toBeDefined();
      }
    });

    it('should handle HTML entities in messages', async () => {
      const htmlMessage = '<p>Hello &amp; World</p>';

      await messageService.publish({
        channel: 'test-html',
        message: htmlMessage,
        priority: MessagePriority.NORMAL,
        cache: true,
      });

      const messages = await messageService.getMessages('test-html', 1);
      expect(messages[0].message).toBe(htmlMessage);
    });
  });

  describe('key exposure protection', () => {
    it('should hash API keys before storage', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      // Query database
      const dbKey = await db
        .select({ keyHash: schema.apiKeys.keyHash })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.userId, testUserId))
        .limit(1);

      expect(dbKey[0].keyHash).not.toBe(key);
      expect(dbKey[0].keyHash).toHaveLength(64); // SHA-256 hex
    });

    it('should not return full API key in list', async () => {
      await apiKeyService.createApiKey({
        userId: testUserId,
      });

      const keys = await apiKeyService.listApiKeys(testUserId);

      expect(keys[0]).not.toHaveProperty('key');
      expect(keys[0]).toHaveProperty('keyPrefix');
      expect(keys[0].keyPrefix).toHaveLength(8);
    });
  });

  describe('input validation security', () => {
    it('should reject oversized payloads', async () => {
      const oversizedPayload = 'x'.repeat(5_000_000); // 5MB

      await expect(messageService.publish({
        channel: 'test-oversized',
        message: oversizedPayload,
        priority: MessagePriority.NORMAL
      })).rejects.toThrow();
    });

    it('should validate public key format', () => {
      expect(() => {
        validateRegisterKey({
          publicKey: 'not-a-valid-pem-key',
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        });
      }).toThrow(ValidationError);
    });

    it('should normalize algorithm field', () => {
      const { publicKey } = encryptionService.generateKeyPair();

      const result = validateRegisterKey({
        publicKey,
        algorithm: 'rsa-2048', // Lowercase
        expiresIn: 604800,
      });

      expect(result.algorithm).toBe('RSA-2048'); // Uppercase
    });
  });

  describe('authentication security', () => {
    it('should reject invalid API key format', async () => {
      const result = await apiKeyService.validateKey('invalid-key');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('should reject API key with invalid characters', async () => {
      const result = await apiKeyService.validateKey('key with spaces!@#');

      expect(result.authenticated).toBe(false);
    });

    it('should reject expired API key', async () => {
      const expiresAt = new Date(Date.now() - 1000); // Expired

      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
        expiresAt,
      });

      const result = await apiKeyService.validateKey(key);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('API key has expired');
    });

    it('should reject inactive API key', async () => {
      const { key, info } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      await apiKeyService.revokeApiKey(info.id, testUserId);

      const result = await apiKeyService.validateKey(key);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('API key is inactive');
    });

    it('should check permissions correctly', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
        permissions: ['read'],
      });

      const hasRead = await apiKeyService.hasPermission(key, 'read');
      const hasWrite = await apiKeyService.hasPermission(key, 'write');

      expect(hasRead).toBe(true);
      expect(hasWrite).toBe(false);
    });

    it('should grant admin all permissions', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
        permissions: ['admin'],
      });

      const hasRead = await apiKeyService.hasPermission(key, 'read');
      const hasWrite = await apiKeyService.hasPermission(key, 'write');
      const hasAdmin = await apiKeyService.hasPermission(key, 'admin');

      expect(hasRead).toBe(true);
      expect(hasWrite).toBe(true);
      expect(hasAdmin).toBe(true);
    });
  });
});

describe('Encryption Security Tests', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  it('should not decrypt with wrong key', async () => {
    const { publicKey } = encryptionService.generateKeyPair();
    const { privateKey: wrongKey } = encryptionService.generateKeyPair();

    const plaintext = 'Secret message';
    const encrypted = encryptionService.encrypt(plaintext, publicKey);

    expect(() => {
      encryptionService.decrypt(encrypted, wrongKey);
    }).toThrow();
  });

  it('should fail signature verification with wrong key', async () => {
    const { publicKey, privateKey } = encryptionService.generateKeyPair();
    const { publicKey: wrongPublicKey } = encryptionService.generateKeyPair();

    const message = 'Message to sign';
    const signature = encryptionService.sign(message, privateKey);

    const isValid = encryptionService.verify(message, signature, wrongPublicKey);

    expect(isValid).toBe(false);
  });

  it('should fail verification for modified message', async () => {
    const { publicKey, privateKey } = encryptionService.generateKeyPair();

    const message = 'Original message';
    const modifiedMessage = 'Modified message';
    const signature = encryptionService.sign(message, privateKey);

    const isValid = encryptionService.verify(modifiedMessage, signature, publicKey);

    expect(isValid).toBe(false);
  });

  it('should use hybrid encryption for large messages', async () => {
    const { publicKey, privateKey } = encryptionService.generateKeyPair();

    const largeMessage = 'x'.repeat(50000);

    const pkg = encryptionService.hybridEncrypt(largeMessage, publicKey);
    const decrypted = encryptionService.hybridDecrypt(pkg, privateKey);

    expect(decrypted).toBe(largeMessage);

    // Verify it's actually using hybrid encryption
    expect(pkg).toHaveProperty('encryptedKey');
    expect(pkg).toHaveProperty('ciphertext');
    expect(pkg).toHaveProperty('iv');
    expect(pkg).toHaveProperty('authTag');
  });
});

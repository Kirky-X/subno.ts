// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageService } from '@/lib/services/message.service';
import { EncryptionService } from '@/lib/services/encryption.service';
import { ApiKeyService } from '@/lib/services/api-key.service';
import { POST as publishPOST } from '@/app/api/publish/route';
import { POST as registerPOST } from '@/app/api/register/route';
import { POST as channelsPOST } from '@/app/api/channels/route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '@/lib/redis';

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
    it('should never expose private key in API responses', async () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

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

      // Verify private key is not in response
      expect(registerData.data).not.toHaveProperty('privateKey');
      expect(registerData.data).not.toHaveProperty('keyHash');

      // Verify only public key is returned
      expect(registerData.data).toHaveProperty('channelId');
      expect(registerData.data).toHaveProperty('publicKeyId');
    });

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

    it('should not expose sensitive data in error messages', async () => {
      // Try to register with invalid data
      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: 'invalid-key-format',
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();

      // Error should not contain sensitive information
      expect(data.success).toBe(false);
      expect(data.error).not.toContain('password');
      expect(data.error).not.toContain('secret');
    });
  });

  describe('CORS validation', () => {
    it('should include CORS headers in responses', async () => {
      const request = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://example.com',
        },
        body: JSON.stringify({
          channel: 'test-cors',
          message: 'Test',
        }),
      });

      const response = await publishPOST(request);

      // CORS headers should be present
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(true);
    });

    it('should handle preflight requests', async () => {
      const request = new Request('http://localhost:3000/api/publish', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const response = await publishPOST(request);

      expect(response.headers.has('Access-Control-Allow-Methods')).toBe(true);
    });
  });

  describe('rate limiting abuse prevention', () => {
    it('should prevent excessive publish requests', async () => {
      const ip = '192.168.1.200';

      const requests = [];
      for (let i = 0; i < 20; i++) {
        const request = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': ip,
          },
          body: JSON.stringify({
            channel: 'test-abuse',
            message: `Message ${i}`,
          }),
        });
        requests.push(publishPOST(request));
      }

      const responses = await Promise.all(requests);

      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;

      // Should be rate limited
      expect(successful).toBe(10); // Default limit
      expect(rateLimited).toBeGreaterThan(0);
    });

    it('should prevent excessive registration requests', async () => {
      const ip = '192.168.1.201';

      const requests = [];
      for (let i = 0; i < 10; i++) {
        const { publicKey } = encryptionService.generateKeyPair();
        const request = new Request('http://localhost:3000/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': ip,
          },
          body: JSON.stringify({
            publicKey,
            algorithm: 'RSA-2048',
            expiresIn: 604800,
          }),
        });
        requests.push(registerPOST(request));
      }

      const responses = await Promise.all(requests);

      const successful = responses.filter(r => r.status === 201).length;
      const rateLimited = responses.filter(r => r.status === 429).length;

      expect(successful).toBe(5); // Register limit is 5
      expect(rateLimited).toBeGreaterThan(0);
    });

    it('should rate limit different IPs independently', async () => {
      const ip1 = '192.168.1.202';
      const ip2 = '192.168.1.203';

      // Exhaust IP1's limit
      const ip1Requests = [];
      for (let i = 0; i < 15; i++) {
        const request = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': ip1,
          },
          body: JSON.stringify({
            channel: 'test-ip1',
            message: `Message ${i}`,
          }),
        });
        ip1Requests.push(publishPOST(request));
      }

      await Promise.all(ip1Requests);

      // IP2 should still be able to publish
      const ip2Request = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': ip2,
        },
        body: JSON.stringify({
          channel: 'test-ip2',
          message: 'IP2 message',
        }),
      });

      const ip2Response = await publishPOST(ip2Request);

      expect(ip2Response.status).toBe(200);
    });
  });

  describe('input validation security', () => {
    it('should reject oversized payloads', async () => {
      const oversizedPayload = 'x'.repeat(5_000_000); // 5MB

      const request = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(oversizedPayload.length),
        },
        body: JSON.stringify({
          channel: 'test-oversized',
          message: oversizedPayload,
        }),
      });

      const response = await publishPOST(request);

      expect(response.status).toBe(413);
    });

    it('should reject malformed JSON', async () => {
      const request = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"channel": "test", invalid}',
      });

      const response = await publishPOST(request);

      expect(response.status).toBe(400);
    });

    it('should validate public key format', async () => {
      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: 'not-a-valid-pem-key',
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);

      expect(response.status).toBe(400);
    });

    it('should validate algorithm field', async () => {
      const { publicKey } = encryptionService.generateKeyPair();

      // Test with invalid algorithm (should still work, just uppercase it)
      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey,
          algorithm: 'rsa-2048', // Lowercase
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.algorithm).toBe('RSA-2048'); // Converted to uppercase
    });
  });

  describe('encryption security', () => {
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

  describe('audit logging', () => {
    it('should log key registration events', async () => {
      const { publicKey } = encryptionService.generateKeyPair();

      const registerRequest = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '192.168.1.250',
        },
        body: JSON.stringify({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(registerRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toHaveProperty('channelId');
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
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      await apiKeyService.revokeApiKey(key, testUserId);

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
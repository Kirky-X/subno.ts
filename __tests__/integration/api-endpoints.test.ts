// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST as publishPOST } from '@/app/api/publish/route';
import { POST as registerPOST, GET as registerGET } from '@/app/api/register/route';
import { GET as keysGET, DELETE as keysDELETE } from '@/app/api/keys/[id]/route';
import { EncryptionService } from '@/lib/services/encryption.service';
import { MessagePriority } from '@/lib/types/message.types';
import { getRedisClient } from '@/lib/redis';

describe('API Integration Tests', () => {
  let encryptionService: EncryptionService;
  let redis: any;

  beforeAll(async () => {
    encryptionService = new EncryptionService();
    redis = await getRedisClient();
    await redis.flushDb();
  });

  afterAll(async () => {
    await redis.flushDb();
  });

  describe('POST /api/publish', () => {
    it('should successfully publish a message', async () => {
      const request = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'test-api-publish',
          message: 'API test message',
          priority: 'normal',
          sender: 'TestUser',
        }),
      });

      const response = await publishPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('messageId');
      expect(data.data.messageId).toMatch(/^msg_\d+_\w+$/);
      expect(data.data.channel).toBe('test-api-publish');
    });

    it('should handle different priority levels', async () => {
      const priorities = ['critical', 'high', 'normal', 'low', 'bulk'];

      for (const priority of priorities) {
        const request = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: `test-priority-${priority}`,
            message: `Message with ${priority} priority`,
            priority,
          }),
        });

        const response = await publishPOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      }
    });

    it('should return error for missing channel', async () => {
      const request = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
        }),
      });

      const response = await publishPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBeDefined();
    });

    it('should return error for invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await publishPOST(request);

      expect(response.status).toBe(400);
    });

    it('should handle rate limiting', async () => {
      const ip = '192.168.1.100';

      // Send requests up to the limit
      const requests = [];
      for (let i = 0; i < 15; i++) {
        const request = new Request('http://localhost:3000/api/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': ip,
          },
          body: JSON.stringify({
            channel: 'test-rate-limit',
            message: `Message ${i}`,
          }),
        });
        requests.push(publishPOST(request));
      }

      const responses = await Promise.all(requests);

      // First 10 should succeed, rest should be rate limited
      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;

      expect(successful).toBe(10);
      expect(rateLimited).toBeGreaterThan(0);
    });
  });

  describe('POST /api/register', () => {
    it('should successfully register a public key', async () => {
      const { publicKey } = encryptionService.generateKeyPair();

      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('channelId');
      expect(data.data.channelId).toMatch(/^enc_[a-f0-9]{16}$/);
      expect(data.data).toHaveProperty('publicKeyId');
      expect(data.data.algorithm).toBe('RSA-2048');
      expect(data.data).toHaveProperty('expiresAt');
      expect(data.data.expiresIn).toBe(604800);
    });

    it('should auto-convert algorithm to uppercase', async () => {
      const { publicKey } = encryptionService.generateKeyPair();

      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey,
          algorithm: 'rsa-4096',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.algorithm).toBe('RSA-4096');
    });

    it('should return error for invalid public key format', async () => {
      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: 'not-a-valid-key',
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for missing required fields', async () => {
      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should handle rate limiting', async () => {
      const ip = '192.168.1.101';

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

      expect(successful).toBe(5); // Rate limit for register is 5
      expect(rateLimited).toBeGreaterThan(0);
    });
  });

  describe('GET /api/register', () => {
    it('should get registration by channelId', async () => {
      const { publicKey } = encryptionService.generateKeyPair();

      // First register
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
      const channelId = registerData.data.channelId;

      // Then get registration
      const getRequest = new Request(
        `http://localhost:3000/api/register?channelId=${channelId}`
      );
      const getResponse = await registerGET(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(getData.data.channelId).toBe(channelId);
      expect(getData.data.algorithm).toBe('RSA-2048');
      expect(getData.data.isExpired).toBe(false);
    });

    it('should return 404 for non-existent channel', async () => {
      const getRequest = new Request(
        'http://localhost:3000/api/register?channelId=enc_nonexistent'
      );
      const getResponse = await registerGET(getRequest);

      expect(getResponse.status).toBe(404);
    });

    it('should return 400 when neither channelId nor keyId provided', async () => {
      const getRequest = new Request('http://localhost:3000/api/register');
      const getResponse = await registerGET(getRequest);

      expect(getResponse.status).toBe(400);
    });
  });

  describe('GET /api/keys/[id]', () => {
    let testChannelId: string;
    let testKeyId: string;

    beforeAll(async () => {
      // Setup: Register a key
      const { publicKey } = encryptionService.generateKeyPair();
      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();
      testChannelId = data.data.channelId;
      testKeyId = data.data.publicKeyId;
    });

    it('should get public key by channelId', async () => {
      const request = new Request(
        `http://localhost:3000/api/keys/${testChannelId}`
      );

      const response = await keysGET(request, { params: { id: testChannelId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('publicKey');
      expect(data.data.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(data.data.channelId).toBe(testChannelId);
      expect(data.data.algorithm).toBe('RSA-2048');
    });

    it('should return 404 for non-existent key', async () => {
      const request = new Request(
        'http://localhost:3000/api/keys/enc_nonexistent'
      );

      const response = await keysGET(request, { params: { id: 'enc_nonexistent' } });

      expect(response.status).toBe(404);
    });

    it('should not expose sensitive information', async () => {
      const request = new Request(
        `http://localhost:3000/api/keys/${testChannelId}`
      );

      const response = await keysGET(request, { params: { id: testChannelId } });
      const data = await response.json();

      // Should not contain private key or other sensitive data
      expect(data.data).not.toHaveProperty('privateKey');
      expect(data.data).not.toHaveProperty('keyHash');
      expect(data.data).not.toHaveProperty('metadata');
    });
  });

  describe('DELETE /api/keys/[id]', () => {
    let testChannelId: string;

    beforeEach(async () => {
      // Setup: Register a key for each test
      const { publicKey } = encryptionService.generateKeyPair();
      const request = new Request('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey,
          algorithm: 'RSA-2048',
          expiresIn: 604800,
        }),
      });

      const response = await registerPOST(request);
      const data = await response.json();
      testChannelId = data.data.channelId;
    });

    it('should delete a key', async () => {
      const request = new Request(
        `http://localhost:3000/api/keys/${testChannelId}`,
        {
          method: 'DELETE',
          headers: {
            'X-API-Key': 'test-api-key', // Would need actual API key
          },
        }
      );

      const response = await keysDELETE(request, { params: { id: testChannelId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent key', async () => {
      const request = new Request(
        'http://localhost:3000/api/keys/enc_nonexistent',
        { method: 'DELETE' }
      );

      const response = await keysDELETE(request, { params: { id: 'enc_nonexistent' } });

      expect(response.status).toBe(404);
    });
  });

  describe('End-to-end encrypted communication', () => {
    it('should complete full encryption workflow', async () => {
      // 1. Receiver generates key pair and registers
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
      const channelId = registerData.data.channelId;

      // 2. Sender retrieves public key
      const getKeyRequest = new Request(
        `http://localhost:3000/api/keys/${channelId}`
      );

      const getKeyResponse = await keysGET(getKeyRequest, {
        params: { id: channelId },
      });
      const getKeyData = await getKeyResponse.json();

      expect(getKeyData.data.publicKey).toBe(publicKey);

      // 3. Sender encrypts message
      const plaintext = 'Secret message!';
      const encrypted = encryptionService.encrypt(plaintext, publicKey);

      // 4. Sender publishes encrypted message
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

      // 5. Receiver retrieves message
      const messages = await redis.lRange(`channel:${channelId}:queue`, 0, -1);
      expect(messages.length).toBeGreaterThan(0);

      const messageData = JSON.parse(messages[0]);
      expect(messageData.encrypted).toBe(true);

      // 6. Receiver decrypts message
      const decrypted = encryptionService.decrypt(messageData.message, privateKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong key', async () => {
      const { publicKey } = encryptionService.generateKeyPair();
      const { privateKey: wrongPrivateKey } = encryptionService.generateKeyPair();

      const plaintext = 'Secret';
      const encrypted = encryptionService.encrypt(plaintext, publicKey);

      expect(() => {
        encryptionService.decrypt(encrypted, wrongPrivateKey);
      }).toThrow();
    });
  });
});
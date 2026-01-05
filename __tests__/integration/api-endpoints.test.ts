// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getRedisClient } from '@/lib/redis';
import { EncryptionService } from '@/lib/services/encryption.service';
import { POST as publishPOST, GET as publishGET } from '../../app/api/publish/route';
import { POST as registerPOST, GET as registerGET } from '../../app/api/register/route';
import { GET as keysGET, DELETE as keysDELETE } from '../../app/api/keys/[id]/route';
import { getApiKeyService } from '@/lib/services/api-key.service';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

describe('API Integration Tests', () => {
  let encryptionService: EncryptionService;
  let redis: any;
  let channelId: string;
  let testUserId: string;
  let adminApiKey: string;

  beforeAll(async () => {
    encryptionService = new EncryptionService();
    redis = await getRedisClient();
    await redis.flushDb();

    testUserId = `api-endpoints-${Date.now()}`;
    const apiKeyService = getApiKeyService();
    const created = await apiKeyService.createApiKey({
      userId: testUserId,
      permissions: ['read'],
    });
    adminApiKey = created.key;
  });

  afterAll(async () => {
    await redis.flushDb();

    const keyRows = await db
      .select({ id: schema.apiKeys.id })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, testUserId));

    for (const row of keyRows) {
      await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, row.id));
    }

    if (channelId) {
      await db
        .delete(schema.publicKeys)
        .where(eq(schema.publicKeys.channelId, channelId));
    }
  });

  it('should register a public key', async () => {
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

    const response = await registerPOST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('channelId');
    expect(data.data.channelId).toMatch(/^enc_[a-f0-9]{16}$/);
    expect(data.data).toHaveProperty('publicKeyId');

    channelId = data.data.channelId;
  });

  it('should get registration by channelId', async () => {
    const request = new Request(
      `http://localhost:3000/api/register?channelId=${channelId}`
    );

    const response = await registerGET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.channelId).toBe(channelId);
    expect(data.data.algorithm).toBe('RSA-2048');
    expect(data.data.isExpired).toBe(false);
  });

  it('should publish and retrieve messages for channel', async () => {
    const publishRequest = new Request('http://localhost:3000/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: channelId,
        message: 'API test message',
        priority: 'normal',
        sender: 'TestUser',
        cache: true,
      }),
    });

    const publishResponse = await publishPOST(publishRequest as any);
    const publishData = await publishResponse.json();

    expect(publishResponse.status).toBe(201);
    expect(publishData.success).toBe(true);
    expect(publishData.data).toHaveProperty('messageId');

    const getRequest = new Request(
      `http://localhost:3000/api/publish?channel=${channelId}&count=5`
    );
    const getResponse = await publishGET(getRequest as any);
    const getData = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getData.success).toBe(true);
    expect(getData.data.channel).toBe(channelId);
    expect(getData.data.queueLength).toBeGreaterThanOrEqual(1);
  });

  it('should get public key by channelId', async () => {
    const request = new Request(`http://localhost:3000/api/keys/${channelId}`);
    const response = await keysGET(request as any, { params: Promise.resolve({ id: channelId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.channelId).toBe(channelId);
    expect(data.data.publicKey).toContain('BEGIN PUBLIC KEY');
  });

  it('should revoke public key by channelId', async () => {
    const request = new Request(`http://localhost:3000/api/keys/${channelId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': adminApiKey,
      },
    });

    const response = await keysDELETE(request as any, { params: Promise.resolve({ id: channelId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.channelId).toBe(channelId);
  });
});

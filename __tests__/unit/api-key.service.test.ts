// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiKeyService, ApiKeyPermission } from '@/lib/services/api-key.service';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let testUserId: string;

  beforeEach(async () => {
    apiKeyService = new ApiKeyService();
    testUserId = `test-user-${Date.now()}`;

    // Clean up any existing test keys
    const existingKeys = await db
      .select({ id: schema.apiKeys.id })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, testUserId));

    for (const key of existingKeys) {
      await db
        .delete(schema.apiKeys)
        .where(eq(schema.apiKeys.id, key.id));
    }
  });

  afterEach(async () => {
    // Clean up test data
    const existingKeys = await db
      .select({ id: schema.apiKeys.id })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, testUserId));

    for (const key of existingKeys) {
      await db
        .delete(schema.apiKeys)
        .where(eq(schema.apiKeys.id, key.id));
    }
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      const result = await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Test Key',
        permissions: ['read'],
      });

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('info');

      expect(result.key).toBeDefined();
      expect(result.key.length).toBeGreaterThan(8);

      expect(result.info).toMatchObject({
        userId: testUserId,
        name: 'Test Key',
        permissions: ['read'],
        isActive: true,
      });

      expect(result.info.id).toBeDefined();
      expect(result.info.keyPrefix).toBeDefined();
      expect(result.info.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique key prefix', async () => {
      const result1 = await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Key 1',
      });

      const result2 = await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Key 2',
      });

      expect(result1.info.keyPrefix).not.toBe(result2.info.keyPrefix);
    });

    it('should support custom permissions', async () => {
      const result = await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Admin Key',
        permissions: ['read', 'write', 'admin'],
      });

      expect(result.info.permissions).toEqual(['read', 'write', 'admin']);
    });

    it('should support expiration date', async () => {
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now

      const result = await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Expiring Key',
        expiresAt,
      });

      expect(result.info.expiresAt).toEqual(expiresAt);
    });

    it('should store hashed key, not plaintext', async () => {
      const result = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      // Query database
      const dbKey = await db
        .select({ keyHash: schema.apiKeys.keyHash })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.id, result.info.id))
        .limit(1);

      expect(dbKey.length).toBe(1);
      expect(dbKey[0].keyHash).not.toBe(result.key);
      expect(dbKey[0].keyHash).toHaveLength(64); // SHA-256 hex
    });
  });

  describe('validateKey', () => {
    it('should validate a valid API key', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      const result = await apiKeyService.validateKey(key);

      expect(result.authenticated).toBe(true);
      expect(result.apiKeyInfo).toBeDefined();
      expect(result.apiKeyInfo!.userId).toBe(testUserId);
    });

    it('should reject invalid key format', async () => {
      const result = await apiKeyService.validateKey('invalid-key');

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('should reject non-existent key', async () => {
      const fakeKey = 'abcdefghijklmnopqrstuvwxyz123456789012';

      const result = await apiKeyService.validateKey(fakeKey);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should reject inactive key', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      // Revoke the key
      await apiKeyService.revokeApiKey(key, testUserId);

      const result = await apiKeyService.validateKey(key);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('API key is inactive');
    });

    it('should reject expired key', async () => {
      const expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago

      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
        expiresAt,
      });

      const result = await apiKeyService.validateKey(key);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('API key has expired');
    });

    it('should update last used timestamp', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      // First validation
      await apiKeyService.validateKey(key);

      const dbKey = await db
        .select({ lastUsedAt: schema.apiKeys.lastUsedAt })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.userId, testUserId))
        .limit(1);

      expect(dbKey[0].lastUsedAt).toBeDefined();
      expect(dbKey[0].lastUsedAt).toBeInstanceOf(Date);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      const revoked = await apiKeyService.revokeApiKey(key, testUserId);

      expect(revoked).toBe(true);

      // Verify key is inactive
      const result = await apiKeyService.validateKey(key);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('API key is inactive');
    });

    it('should not revoke key from different user', async () => {
      const otherUserId = `other-user-${Date.now()}`;
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      const revoked = await apiKeyService.revokeApiKey(key, otherUserId);

      expect(revoked).toBe(false);

      // Key should still be active
      const result = await apiKeyService.validateKey(key);
      expect(result.authenticated).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const revoked = await apiKeyService.revokeApiKey('non-existent-key', testUserId);

      expect(revoked).toBe(false);
    });
  });

  describe('listApiKeys', () => {
    it('should list all API keys for a user', async () => {
      await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Key 1',
      });
      await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Key 2',
      });
      await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Key 3',
      });

      const keys = await apiKeyService.listApiKeys(testUserId);

      expect(keys).toHaveLength(3);
      expect(keys.every(k => k.userId === testUserId)).toBe(true);
      expect(keys.map(k => k.name)).toEqual(['Key 1', 'Key 2', 'Key 3']);
    });

    it('should not include full key in list', async () => {
      await apiKeyService.createApiKey({
        userId: testUserId,
      });

      const keys = await apiKeyService.listApiKeys(testUserId);

      expect(keys).toHaveLength(1);
      expect(keys[0]).not.toHaveProperty('key');
      expect(keys[0]).toHaveProperty('keyPrefix');
    });

    it('should return empty array for user with no keys', async () => {
      const keys = await apiKeyService.listApiKeys(testUserId);

      expect(keys).toHaveLength(0);
    });

    it('should not list keys from other users', async () => {
      const otherUserId = `other-user-${Date.now()}`;

      await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'My Key',
      });

      await apiKeyService.createApiKey({
        userId: otherUserId,
        name: 'Their Key',
      });

      const myKeys = await apiKeyService.listApiKeys(testUserId);
      const theirKeys = await apiKeyService.listApiKeys(otherUserId);

      expect(myKeys).toHaveLength(1);
      expect(theirKeys).toHaveLength(1);
      expect(myKeys[0].name).toBe('My Key');
      expect(theirKeys[0].name).toBe('Their Key');
    });
  });

  describe('hasPermission', () => {
    it('should grant admin permission for admin keys', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
        permissions: ['admin'],
      });

      const hasRead = await apiKeyService.hasPermission(key, 'read');
      const hasWrite = await apiKeyService.hasPermission(key, 'write');

      expect(hasRead).toBe(true);
      expect(hasWrite).toBe(true);
    });

    it('should grant specific permission', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
        permissions: ['read'],
      });

      const hasRead = await apiKeyService.hasPermission(key, 'read');
      const hasWrite = await apiKeyService.hasPermission(key, 'write');

      expect(hasRead).toBe(true);
      expect(hasWrite).toBe(false);
    });

    it('should deny permission for invalid key', async () => {
      const hasPermission = await apiKeyService.hasPermission('invalid-key', 'read');

      expect(hasPermission).toBe(false);
    });

    it('should deny permission for revoked key', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
        permissions: ['read', 'write'],
      });

      await apiKeyService.revokeApiKey(key, testUserId);

      const hasPermission = await apiKeyService.hasPermission(key, 'read');

      expect(hasPermission).toBe(false);
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should mark expired keys as inactive', async () => {
      const expiresAt = new Date(Date.now() - 1000); // Expired

      await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Expired Key',
        expiresAt,
      });

      await apiKeyService.createApiKey({
        userId: testUserId,
        name: 'Active Key',
      });

      const cleaned = await apiKeyService.cleanupExpiredKeys();

      expect(cleaned).toBe(1);

      // Verify expired key is inactive
      const keys = await apiKeyService.listApiKeys(testUserId);
      const expiredKey = keys.find(k => k.name === 'Expired Key');
      const activeKey = keys.find(k => k.name === 'Active Key');

      expect(expiredKey!.isActive).toBe(false);
      expect(activeKey!.isActive).toBe(true);
    });

    it('should return 0 when no expired keys exist', async () => {
      await apiKeyService.createApiKey({
        userId: testUserId,
      });

      const cleaned = await apiKeyService.cleanupExpiredKeys();

      expect(cleaned).toBe(0);
    });
  });

  describe('key format', () => {
    it('should generate keys with valid characters', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      // Base64url characters: A-Z, a-z, 0-9, -, _
      expect(key).toMatch(/^[a-zA-Z0-9_-]+$/);
    });

    it('should generate keys of correct length', async () => {
      const { key } = await apiKeyService.createApiKey({
        userId: testUserId,
      });

      // 32 bytes = 256 bits, base64url encoded
      expect(key.length).toBe(43); // 32 * 8 / 6 rounded up
    });

    it('should generate unique keys', async () => {
      const keys = await Promise.all([
        apiKeyService.createApiKey({ userId: testUserId }),
        apiKeyService.createApiKey({ userId: testUserId }),
        apiKeyService.createApiKey({ userId: testUserId }),
      ]);

      const keyValues = keys.map(k => k.key);
      const uniqueKeys = new Set(keyValues);

      expect(uniqueKeys.size).toBe(3);
    });
  });
});
// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import crypto from 'crypto';
import { db, schema } from '@/lib/db';
import { eq, and, isNotNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Key permissions
 */
export type ApiKeyPermission = 'read' | 'write' | 'admin';

/**
 * API Key info returned by the service
 */
export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  userId: string;
  name: string | null;
  permissions: ApiKeyPermission[];
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

/**
 * API Key creation options
 */
export interface CreateApiKeyOptions {
  userId: string;
  name?: string;
  permissions?: ApiKeyPermission[];
  expiresAt?: Date;
}

/**
 * API Key authentication result
 */
export interface ApiKeyAuthResult {
  authenticated: boolean;
  apiKeyInfo?: ApiKeyInfo;
  error?: string;
}

/**
 * API Key Service - Handles API key generation, validation, and management
 */
export class ApiKeyService {
  private readonly keyLength = 32; // 256 bits
  private readonly keyPrefixLength = 8;

  /**
   * Generate a new API key
   * @param options - API key creation options
   * @returns Object with the new API key (only returned once) and info
   */
  async createApiKey(options: CreateApiKeyOptions): Promise<{ key: string; info: ApiKeyInfo }> {
    // Generate random key
    const keyBytes = crypto.randomBytes(this.keyLength);
    const key = keyBytes.toString('base64url');
    const keyPrefix = key.substring(0, this.keyPrefixLength);

    // Hash the key for storage
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const result = await db.insert(schema.apiKeys).values({
      keyHash,
      keyPrefix,
      userId: options.userId,
      name: options.name || null,
      permissions: options.permissions || ['read'],
      isActive: true,
      expiresAt: options.expiresAt || null,
    }).returning();

    const inserted = result[0];

    return {
      key, // Only returned once!
      info: {
        id: inserted.id,
        keyPrefix: inserted.keyPrefix,
        userId: inserted.userId,
        name: inserted.name,
        permissions: inserted.permissions as ApiKeyPermission[],
        isActive: inserted.isActive,
        createdAt: inserted.createdAt,
        lastUsedAt: inserted.lastUsedAt,
        expiresAt: inserted.expiresAt,
      },
    };
  }

  /**
   * Validate an API key
   * @param key - API key to validate
   * @returns Authentication result with key info if valid
   */
  async validateKey(key: string): Promise<ApiKeyAuthResult> {
    if (!key || key.length < this.keyLength) {
      return { authenticated: false, error: 'Invalid API key format' };
    }

    // Validate format
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return { authenticated: false, error: 'Invalid API key characters' };
    }

    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keyPrefix = key.substring(0, this.keyPrefixLength);

    // Look up key in database
    const result = await db
      .select({
        id: schema.apiKeys.id,
        keyPrefix: schema.apiKeys.keyPrefix,
        userId: schema.apiKeys.userId,
        name: schema.apiKeys.name,
        permissions: schema.apiKeys.permissions,
        isActive: schema.apiKeys.isActive,
        createdAt: schema.apiKeys.createdAt,
        lastUsedAt: schema.apiKeys.lastUsedAt,
        expiresAt: schema.apiKeys.expiresAt,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.keyHash, keyHash))
      .limit(1);

    if (result.length === 0) {
      return { authenticated: false, error: 'Invalid API key' };
    }

    const apiKey = result[0];

    // Check if active
    if (!apiKey.isActive) {
      return { authenticated: false, error: 'API key is inactive' };
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { authenticated: false, error: 'API key has expired' };
    }

    // Update last used timestamp
    await db
      .update(schema.apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiKeys.id, apiKey.id));

    return {
      authenticated: true,
      apiKeyInfo: {
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        userId: apiKey.userId,
        name: apiKey.name,
        permissions: apiKey.permissions as ApiKeyPermission[],
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt,
        expiresAt: apiKey.expiresAt,
      },
    };
  }

  /**
   * Revoke an API key
   * @param keyId - API key ID to revoke
   * @param userId - User ID (for authorization)
   * @returns true if revoked successfully
   */
  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(schema.apiKeys)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.apiKeys.id, keyId),
          eq(schema.apiKeys.userId, userId)
        )
      )
      .returning({ id: schema.apiKeys.id });

    return result.length > 0;
  }

  /**
   * List API keys for a user
   * @param userId - User ID
   * @returns Array of API key info (without the full key)
   */
  async listApiKeys(userId: string): Promise<ApiKeyInfo[]> {
    const result = await db
      .select({
        id: schema.apiKeys.id,
        keyPrefix: schema.apiKeys.keyPrefix,
        userId: schema.apiKeys.userId,
        name: schema.apiKeys.name,
        permissions: schema.apiKeys.permissions,
        isActive: schema.apiKeys.isActive,
        createdAt: schema.apiKeys.createdAt,
        lastUsedAt: schema.apiKeys.lastUsedAt,
        expiresAt: schema.apiKeys.expiresAt,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, userId))
      .orderBy(schema.apiKeys.createdAt);

    return result.map((key) => ({
      id: key.id,
      keyPrefix: key.keyPrefix,
      userId: key.userId,
      name: key.name,
      permissions: key.permissions as ApiKeyPermission[],
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
    }));
  }

  /**
   * Check if API key has specific permission
   * @param key - API key to check
   * @param requiredPermission - Required permission
   * @returns true if key has permission
   */
  async hasPermission(key: string, requiredPermission: ApiKeyPermission): Promise<boolean> {
    const result = await this.validateKey(key);

    if (!result.authenticated || !result.apiKeyInfo) {
      return false;
    }

    return result.apiKeyInfo.permissions.includes('admin') ||
      result.apiKeyInfo.permissions.includes(requiredPermission);
  }

  /**
   * Clean up expired API keys (mark as inactive)
   * @returns Number of keys cleaned up
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await db
      .update(schema.apiKeys)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.apiKeys.isActive, true),
          isNotNull(schema.apiKeys.expiresAt),
          and(
            // Drizzle ORM doesn't support direct comparison, use raw query
            // This is a workaround
          )
        )
      );

    // For now, use a simpler approach
    const now = new Date();
    const expiredKeys = await db
      .select({ id: schema.apiKeys.id })
      .from(schema.apiKeys)
      .where(
        and(
          eq(schema.apiKeys.isActive, true),
          isNotNull(schema.apiKeys.expiresAt)
        )
      );

    let cleaned = 0;
    for (const key of expiredKeys) {
      const keyData = await db
        .select({ expiresAt: schema.apiKeys.expiresAt })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.id, key.id))
        .limit(1);

      if (keyData.length > 0 && keyData[0].expiresAt && new Date(keyData[0].expiresAt) < now) {
        await db
          .update(schema.apiKeys)
          .set({ isActive: false })
          .where(eq(schema.apiKeys.id, key.id));
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Singleton instance
let apiKeyServiceInstance: ApiKeyService | null = null;

export function getApiKeyService(): ApiKeyService {
  if (!apiKeyServiceInstance) {
    apiKeyServiceInstance = new ApiKeyService();
  }
  return apiKeyServiceInstance;
}

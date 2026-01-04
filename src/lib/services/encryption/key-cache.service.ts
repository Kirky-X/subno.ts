// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { db, schema } from '@/lib/db';
import { eq, and, isNull, gt, desc } from 'drizzle-orm';
import { getRsaService } from './rsa.service';
import { RedisRepository } from '@/lib/repositories/redis.repository';

/**
 * Public key cache TTL in seconds (7 days default)
 */
export const PUBLIC_KEY_CACHE_TTL = 604800;

/**
 * Public key information
 */
export interface PublicKeyInfo {
  id: string;
  channelId: string;
  publicKey: string;
  algorithm: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Key Cache Service - Manages public key caching with cache-aside pattern
 */
export class KeyCacheService {
  private readonly redisRepository = new RedisRepository();
  private readonly rsaService = getRsaService();
  private readonly defaultTTL = PUBLIC_KEY_CACHE_TTL;

  /**
   * Get public key from cache or database
   * @param channelId - Channel ID
   * @returns Public key info or null if not found
   */
  async getPublicKey(channelId: string): Promise<PublicKeyInfo | null> {
    // Try cache first
    const cacheKey = `pubkey:${channelId}`;
    const cached = await this.redisRepository.getPublicKey(channelId);

    if (cached) {
      return {
        channelId,
        publicKey: cached,
      } as PublicKeyInfo;
    }

    // Query database
    const result = await db
      .select({
        id: schema.publicKeys.id,
        channelId: schema.publicKeys.channelId,
        publicKey: schema.publicKeys.publicKey,
        algorithm: schema.publicKeys.algorithm,
        createdAt: schema.publicKeys.createdAt,
        expiresAt: schema.publicKeys.expiresAt,
        lastUsedAt: schema.publicKeys.lastUsedAt,
        metadata: schema.publicKeys.metadata,
      })
      .from(schema.publicKeys)
      .where(eq(schema.publicKeys.channelId, channelId))
      .orderBy(desc(schema.publicKeys.createdAt))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const key = result[0];

    // Check if expired
    if (new Date(key.expiresAt) < new Date()) {
      return null;
    }

    const keyInfo: PublicKeyInfo = {
      id: key.id,
      channelId: key.channelId,
      publicKey: key.publicKey,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt || undefined,
      metadata: key.metadata as Record<string, unknown> | undefined,
    };

    // Cache the result
    await this.redisRepository.cachePublicKey(channelId, key.publicKey, this.defaultTTL);

    return keyInfo;
  }

  /**
   * Register a new public key for a channel
   * @param channelId - Channel ID
   * @param publicKey - Public key in PEM format
   * @param algorithm - Algorithm used (e.g., 'RSA-2048')
   * @param expiresAt - Expiration date
   * @param metadata - Optional metadata
   * @returns Created public key info
   */
  async registerPublicKey(
    channelId: string,
    publicKey: string,
    algorithm: string,
    expiresAt: Date,
    metadata?: Record<string, unknown>
  ): Promise<PublicKeyInfo> {
    // Validate public key format
    if (!this.rsaService.isValidPublicKey(publicKey)) {
      throw new KeyCacheError('Invalid public key format', 'INVALID_PUBLIC_KEY');
    }

    const now = new Date();

    // Insert new key (replacing existing if any)
    const result = await db
      .insert(schema.publicKeys)
      .values({
        channelId,
        publicKey,
        algorithm,
        expiresAt,
        metadata: metadata || null,
      })
      .onConflictDoUpdate({
        target: schema.publicKeys.channelId,
        set: {
          publicKey,
          algorithm,
          expiresAt,
          metadata: metadata || null,
        },
      })
      .returning();

    const key = result[0];

    const keyInfo: PublicKeyInfo = {
      id: key.id,
      channelId: key.channelId,
      publicKey: key.publicKey,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      metadata: key.metadata as Record<string, unknown> | undefined,
    };

    // Cache the new key
    await this.redisRepository.cachePublicKey(channelId, key.publicKey, this.defaultTTL);

    return keyInfo;
  }

  /**
   * Revoke (delete) a public key
   * @param channelId - Channel ID
   * @returns true if key was revoked
   */
  async revokePublicKey(channelId: string): Promise<boolean> {
    const result = await db
      .delete(schema.publicKeys)
      .where(eq(schema.publicKeys.channelId, channelId))
      .returning({ id: schema.publicKeys.id });

    // Invalidate cache
    await this.redisRepository.deletePublicKey(channelId);

    return result.length > 0;
  }

  /**
   * Check if channel has a valid (non-expired) public key
   * @param channelId - Channel ID
   * @returns true if valid key exists
   */
  async hasValidPublicKey(channelId: string): Promise<boolean> {
    const keyInfo = await this.getPublicKey(channelId);
    return keyInfo !== null;
  }

  /**
   * Clean up expired public keys from database
   * @returns Number of keys cleaned up
   */
  async cleanupExpiredKeys(): Promise<number> {
    const now = new Date();

    const result = await db
      .delete(schema.publicKeys)
      .where(lt(schema.publicKeys.expiresAt, now))
      .returning({ id: schema.publicKeys.id });

    return result.length;
  }
}

/**
 * Key Cache Service error class
 */
export class KeyCacheError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'KeyCacheError';
    this.code = code;
  }
}

// Singleton instance
let keyCacheServiceInstance: KeyCacheService | null = null;

export function getKeyCacheService(): KeyCacheService {
  if (!keyCacheServiceInstance) {
    keyCacheServiceInstance = new KeyCacheService();
  }
  return keyCacheServiceInstance;
}
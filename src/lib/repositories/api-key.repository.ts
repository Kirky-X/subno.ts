// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { apiKeys, type ApiKey } from '../../db/schema';
import { eq, and, desc, lt, isNull, gt, or } from 'drizzle-orm';
import { SECURITY_CONFIG } from '../utils/secure-compare';

export class ApiKeyRepository {
  private db = getDatabase();

  async findById(id: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Validate that an API key has the required permission.
   * Returns true only if the key exists, is active, not deleted, and has the permission.
   * 
   * @param keyHash - The API key hash to validate
   * @param requiredPermission - The permission to check for (e.g., 'admin', 'key_revoke')
   * @returns true if the key is valid and has the required permission
   */
  async validatePermission(
    keyHash: string,
    requiredPermission: string
  ): Promise<boolean> {
    const key = await this.findByKeyHash(keyHash);
    
    if (!key) {
      return false;
    }

    // Check if key is active and not deleted
    if (!key.isActive || key.isDeleted) {
      return false;
    }

    // Check if key has expired
    if (key.expiresAt && key.expiresAt < new Date()) {
      return false;
    }

    // Check if key has the required permission
    const permissions = key.permissions as string[];
    return permissions.includes('admin') || permissions.includes(requiredPermission);
  }

  async findByUserId(userId: string, options?: {
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiKey[]> {
    const { includeDeleted = false, limit = 50, offset = 0 } = options || {};

    let condition;
    if (includeDeleted) {
      condition = undefined;
    } else {
      condition = eq(apiKeys.isDeleted, false);
    }

    const result = await this.db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.userId, userId),
        condition
      ))
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async findActive(options?: {
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiKey[]> {
    const { includeExpired = false, limit = 100, offset = 0 } = options || {};

    let whereConditions = and(
      eq(apiKeys.isActive, true),
      eq(apiKeys.isDeleted, false)
    );
    
    if (!includeExpired) {
      whereConditions = and(
        whereConditions,
        isNull(apiKeys.expiresAt),
        gt(apiKeys.createdAt, new Date(Date.now() - SECURITY_CONFIG.DEFAULT_API_KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000))
      );
    }

    const result = await this.db
      .select()
      .from(apiKeys)
      .where(whereConditions)
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async softDelete(
    id: string,
    revokedBy: string,
    reason: string
  ): Promise<ApiKey | null> {
    const result = await this.db
      .update(apiKeys)
      .set({
        isDeleted: true,
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
        revocationReason: reason,
      })
      .where(and(
        eq(apiKeys.id, id),
        eq(apiKeys.isDeleted, false)
      ))
      .returning();
    return result[0] || null;
  }

  async restore(id: string): Promise<ApiKey | null> {
    const result = await this.db
      .update(apiKeys)
      .set({
        isDeleted: false,
        isActive: true,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
      })
      .where(eq(apiKeys.id, id))
      .returning();
    return result[0] || null;
  }

  async getDeletedKeys(olderThan: Date): Promise<ApiKey[]> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.isDeleted, true),
        lt(apiKeys.revokedAt!, olderThan)
      ));
    return result;
  }

  async permanentDelete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(apiKeys)
      .where(eq(apiKeys.id, id));
    
    // Drizzle delete returns { rowCount: number | null }
    const rowCount = (result as { rowCount?: number | null }).rowCount ?? 0;
    return rowCount > 0;
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async deactivate(id: string): Promise<ApiKey | null> {
    const result = await this.db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, id))
      .returning();
    return result[0] || null;
  }
}

export const apiKeyRepository = new ApiKeyRepository();

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { apiKeys, type ApiKey } from '../../db/schema';
import { eq, and, desc, lt, isNull, gt } from 'drizzle-orm';
import { KEY_MANAGEMENT_CONFIG } from '../utils/secure-compare';
import { QueryBuilder } from './query-builder';

export class ApiKeyRepository {
  private db = getDatabase();

  /**
   * Calculate the expiry date based on configured days
   */
  private calculateExpiryDate(): Date {
    return new Date(Date.now() - KEY_MANAGEMENT_CONFIG.DEFAULT_API_KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Build find conditions using the unified QueryBuilder
   */
  private buildFindConditions(options: {
    includeDeleted?: boolean;
    includeExpired?: boolean;
    userId?: string;
  }): ReturnType<QueryBuilder<ApiKey>['build']> {
    const builder = new QueryBuilder<ApiKey>();

    if (options.userId) {
      builder.whereEqual(apiKeys.userId, options.userId);
    }

    if (!options.includeDeleted) {
      builder.whereEqual(apiKeys.isDeleted, false);
    }

    if (!options.includeExpired) {
      builder.whereIsNull(apiKeys.expiresAt);
      builder.whereGt(apiKeys.createdAt, this.calculateExpiryDate());
    }

    return builder.build();
  }

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

    const condition = this.buildFindConditions({ 
      includeDeleted, 
      userId 
    });

    const result = await this.db
      .select()
      .from(apiKeys)
      .where(condition)
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

    const condition = this.buildFindConditions({ includeExpired });

    const result = await this.db
      .select()
      .from(apiKeys)
      .where(condition)
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
    return result[0] ?? null;
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
    return result[0] ?? null;
  }

  async getDeletedKeys(olderThan: Date): Promise<ApiKey[]> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.isDeleted, true),
        lt(apiKeys.revokedAt, olderThan)
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
    return result[0] ?? null;
  }
}

export const apiKeyRepository = new ApiKeyRepository();

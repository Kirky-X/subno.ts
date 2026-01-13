// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../db';
import { apiKeys, type ApiKey } from '../db/schema';
import { eq, and, desc, lt, isNull, gt, or } from 'drizzle-orm';

export class ApiKeyRepository {
  private db = getDatabase();

  async findById(id: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    return result[0] || null;
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
        gt(apiKeys.createdAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
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
    return (result.rowCount ?? 0) > 0;
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

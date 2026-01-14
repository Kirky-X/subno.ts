// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { publicKeys, revocationConfirmations } from '../../db/schema';
import { eq, lt, sql, and, inArray } from 'drizzle-orm';
import { sanitizeErrorMessage, SECURITY_CONFIG } from '../utils/secure-compare';

interface CleanupResult {
  deletedKeys: number;
  expiredConfirmations: number;
  cleanedUpAt: Date;
  errors: string[];
}

export class CleanupService {
  private db = getDatabase();

  private getRevokedKeysCleanupDays(): number {
    const days = process.env.REVOKED_KEY_CLEANUP_DAYS;
    return days ? parseInt(days, 10) : SECURITY_CONFIG.DEFAULT_CLEANUP_DAYS;
  }

  async cleanupExpiredRevocations(): Promise<{ count: number; errors: string[] }> {
    try {
      // Get all expired pending confirmations
      const expiredConfirmations = await this.db
        .select({ id: revocationConfirmations.id })
        .from(revocationConfirmations)
        .where(and(
          eq(revocationConfirmations.status, 'pending'),
          lt(revocationConfirmations.expiresAt, new Date())
        ));

      if (expiredConfirmations.length === 0) {
        return { count: 0, errors: [] };
      }

      // Batch update all expired confirmations
      const ids = expiredConfirmations.map(c => c.id);
      await this.db
        .update(revocationConfirmations)
        .set({ status: 'expired' })
        .where(inArray(revocationConfirmations.id, ids));

      return { count: ids.length, errors: [] };
    } catch (err) {
      return { count: 0, errors: ['Failed to cleanup expired confirmations'] };
    }
  }

  async cleanupRevokedKeys(olderThanDays?: number): Promise<{ count: number; errors: string[] }> {
    const days = olderThanDays || this.getRevokedKeysCleanupDays();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Find keys that should be permanently deleted
      const keysToDelete = await this.db
        .select({ id: publicKeys.id })
        .from(publicKeys)
        .where(and(
          eq(publicKeys.isDeleted, true),
          sql`${publicKeys.revokedAt} IS NOT NULL`,
          lt(publicKeys.revokedAt!, cutoffDate)
        ));

      if (keysToDelete.length === 0) {
        return { count: 0, errors: [] };
      }

      // Process in batches to avoid memory issues
      const batchSize = SECURITY_CONFIG.BATCH_SIZE;
      let totalDeleted = 0;

      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        const batchIds = batch.map(k => k.id);

        await this.db
          .delete(publicKeys)
          .where(inArray(publicKeys.id, batchIds));

        totalDeleted += batchIds.length;
      }

      return { count: totalDeleted, errors: [] };
    } catch (err) {
      return { count: 0, errors: ['Failed to cleanup revoked keys'] };
    }
  }

  async executeFullCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedKeys: 0,
      expiredConfirmations: 0,
      cleanedUpAt: new Date(),
      errors: [],
    };

    const expResult = await this.cleanupExpiredRevocations();
    result.expiredConfirmations = expResult.count;
    result.errors.push(...expResult.errors);

    const keyResult = await this.cleanupRevokedKeys();
    result.deletedKeys = keyResult.count;
    result.errors.push(...keyResult.errors);

    return result;
  }

  async getCleanupStatus(): Promise<{
    pendingConfirmations: number;
    revokedKeys: number;
    revocableKeys: number;
    cleanupDays: number;
  }> {
    const cleanupDays = this.getRevokedKeysCleanupDays();

    const [pendingConfirmations] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(revocationConfirmations)
      .where(eq(revocationConfirmations.status, 'pending'));

    const [revokedKeys] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(publicKeys)
      .where(eq(publicKeys.isDeleted, true));

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);

    const [revocableKeys] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(publicKeys)
      .where(and(
        eq(publicKeys.isDeleted, true),
        sql`${publicKeys.revokedAt} IS NOT NULL`,
        lt(publicKeys.revokedAt!, cutoffDate)
      ));

    return {
      pendingConfirmations: Number(pendingConfirmations?.count || 0),
      revokedKeys: Number(revokedKeys?.count || 0),
      revocableKeys: Number(revocableKeys?.count || 0),
      cleanupDays,
    };
  }
}

export const cleanupService = new CleanupService();

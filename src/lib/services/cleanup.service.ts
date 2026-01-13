// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../db';
import { publicKeys, revocationConfirmations } from '../db/schema';
import { eq, lt, sql, and } from 'drizzle-orm';

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
    return days ? parseInt(days, 10) : 30;
  }

  async cleanupExpiredRevocations(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Get all expired pending confirmations
      const expiredConfirmations = await this.db
        .select({ id: revocationConfirmations.id })
        .from(revocationConfirmations)
        .where(and(
          eq(revocationConfirmations.status, 'pending'),
          lt(revocationConfirmations.expiresAt, new Date())
        ));

      // Update each to expired status
      for (const conf of expiredConfirmations) {
        try {
          await this.db
            .update(revocationConfirmations)
            .set({ status: 'expired' })
            .where(eq(revocationConfirmations.id, conf.id));
          count++;
        } catch (err) {
          errors.push(`Failed to expire confirmation ${conf.id}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to get expired confirmations: ${err}`);
    }

    return { count, errors };
  }

  async cleanupRevokedKeys(olderThanDays?: number): Promise<{ count: number; errors: string[] }> {
    const days = olderThanDays || this.getRevokedKeysCleanupDays();
    const errors: string[] = [];
    let count = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Find keys that should be permanently deleted
      const keysToDelete = await this.db
        .select({ id: publicKeys.id, channelId: publicKeys.channelId })
        .from(publicKeys)
        .where(and(
          eq(publicKeys.isDeleted, true),
          sql`${publicKeys.revokedAt} IS NOT NULL`,
          lt(publicKeys.revokedAt!, cutoffDate)
        ));

      for (const key of keysToDelete) {
        try {
          await this.db
            .delete(publicKeys)
            .where(eq(publicKeys.id, key.id));
          count++;
        } catch (err) {
          errors.push(`Failed to delete key ${key.id}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Failed to get keys for deletion: ${err}`);
    }

    return { count, errors };
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

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { publicKeys, revocationConfirmations } from '../../db/schema';
import { eq, lt, sql, and, inArray } from 'drizzle-orm';
import { sanitizeErrorMessage, secureCompare, KEY_MANAGEMENT_CONFIG } from '../utils/secure-compare';

interface CleanupResult {
  deletedKeys: number;
  expiredConfirmations: number;
  cleanedUpAt: Date;
  errors: string[];
}

export class CleanupService {
  private db = getDatabase();

  private getRevokedKeysCleanupDays(): number {
    const minDays = 1;
    const maxDays = 365;
    const days = process.env.REVOKED_KEY_CLEANUP_DAYS;
    const value = days ? parseInt(days, 10) : KEY_MANAGEMENT_CONFIG.DEFAULT_CLEANUP_DAYS;
    if (isNaN(value) || value < minDays) return KEY_MANAGEMENT_CONFIG.DEFAULT_CLEANUP_DAYS;
    if (value > maxDays) return maxDays;
    return value;
  }

  /**
   * Validate CRON_SECRET for cleanup operations
   * CRON_SECRET is always required, regardless of environment
   */
  static validateCronSecret(request: Request): { valid: boolean; error?: string } {
    const cronSecret = process.env.CRON_SECRET;
    const nodeEnv = process.env.NODE_ENV;

    // CRON_SECRET is always required
    if (!cronSecret) {
      if (nodeEnv === 'production') {
        return { valid: false, error: 'CRON_SECRET must be configured in production environment' };
      }
      return { valid: false, error: 'CRON_SECRET must be configured' };
    }

    // Reject default placeholder secrets
    const defaultSecrets = [
      'your-cron-secret-change-this-in-production',
      'change-me',
      'default-cron-secret',
      'cron-secret',
      'secret',
    ];
    if (defaultSecrets.some(defaultSecret => 
      cronSecret.toLowerCase().includes(defaultSecret.toLowerCase())
    )) {
      return { valid: false, error: 'CRON_SECRET cannot be a default/placeholder value' };
    }

    // Check minimum length
    if (cronSecret.length < 32) {
      return { valid: false, error: 'CRON_SECRET must be at least 32 characters long' };
    }

    const requestSecret = request.headers.get('X-Cron-Secret') ||
                          request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!requestSecret) {
      return { valid: false, error: 'Cron secret required' };
    }

    // Use constant-time comparison to prevent timing attacks
    if (!secureCompare(requestSecret, cronSecret)) {
      return { valid: false, error: 'Invalid cron secret' };
    }

    return { valid: true };
  }

  private async batchProcess<T>(
    items: T[],
    processor: (batch: T[]) => Promise<void>
  ): Promise<void> {
    const batchSize = KEY_MANAGEMENT_CONFIG.BATCH_SIZE;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processor(batch);
    }
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

      let totalDeleted = 0;
      await this.batchProcess(keysToDelete, async (batch) => {
        const batchIds = batch.map(k => k.id);
        await this.db
          .delete(publicKeys)
          .where(inArray(publicKeys.id, batchIds));
        totalDeleted += batchIds.length;
      });

      return { count: totalDeleted, errors: [] };
    } catch (err) {
      return { count: 0, errors: ['Failed to cleanup revoked keys'] };
    }
  }

  async executeFullCleanup(): Promise<CleanupResult> {
    const [expResult, keyResult] = await Promise.all([
      this.cleanupExpiredRevocations(),
      this.cleanupRevokedKeys(),
    ]);

    return {
      deletedKeys: keyResult.count,
      expiredConfirmations: expResult.count,
      cleanedUpAt: new Date(),
      errors: [...expResult.errors, ...keyResult.errors],
    };
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

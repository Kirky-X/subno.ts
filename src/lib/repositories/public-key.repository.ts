// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { publicKeys, type PublicKey } from '../../db/schema';
import { eq, ne, and, isNull, desc, lt, gte } from 'drizzle-orm';
import { channelRepository } from './channel.repository';

export class PublicKeyRepository {
  private db = getDatabase();

  async findById(id: string): Promise<PublicKey | null> {
    const result = await this.db
      .select()
      .from(publicKeys)
      .where(eq(publicKeys.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findByChannelId(channelId: string): Promise<PublicKey | null> {
    const result = await this.db
      .select()
      .from(publicKeys)
      .where(and(
        eq(publicKeys.channelId, channelId),
        eq(publicKeys.isDeleted, false)
      ))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Find public key by channel ID with ownership verification.
   * SECURITY: This method verifies that the requesting user is the channel creator.
   * 
   * @param channelId - The channel ID to look up
   * @param userId - The user ID requesting access
   * @param requireCreator - Whether to require creator ownership (default: true)
   * @returns The public key if found and user has access, null otherwise
   */
  async findByChannelIdWithAccess(
    channelId: string,
    userId: string,
    requireCreator = true
  ): Promise<PublicKey | null> {
    // First verify the user has access to the channel
    const accessCheck = await channelRepository.verifyAccess(
      channelId,
      userId,
      requireCreator
    );

    if (!accessCheck.hasAccess) {
      // Log unauthorized access attempt
      console.warn(`Unauthorized access attempt to channel ${channelId} by user ${userId}`);
      return null;
    }

    // User has access, return the public key
    return this.findByChannelId(channelId);
  }

  /**
   * Check if user has access to a specific public key.
   * SECURITY: Verifies channel ownership before allowing access.
   * 
   * @param keyId - The public key ID
   * @param userId - The user ID requesting access
   * @returns Object with hasAccess boolean and key if accessible
   */
  async verifyKeyAccess(
    keyId: string,
    userId: string
  ): Promise<{ hasAccess: boolean; key?: PublicKey; error?: string }> {
    const key = await this.findById(keyId);
    
    if (!key) {
      return { hasAccess: false, error: 'Key not found' };
    }

    // Verify channel ownership
    const accessCheck = await channelRepository.verifyAccess(
      key.channelId,
      userId,
      true
    );

    if (!accessCheck.hasAccess) {
      return { hasAccess: false, error: accessCheck.error };
    }

    return { hasAccess: true, key };
  }

  async findAll(options?: {
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PublicKey[]> {
    const { includeDeleted = false, limit = 50, offset = 0 } = options || {};

    let condition;
    if (includeDeleted) {
      condition = undefined; // Return all
    } else {
      condition = eq(publicKeys.isDeleted, false);
    }

    const result = await this.db
      .select()
      .from(publicKeys)
      .where(condition)
      .orderBy(desc(publicKeys.createdAt))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async softDelete(
    id: string,
    revokedBy: string,
    reason: string
  ): Promise<PublicKey | null> {
    const result = await this.db
      .update(publicKeys)
      .set({
        isDeleted: true,
        revokedAt: new Date(),
        revokedBy,
        revocationReason: reason,
      })
      .where(and(
        eq(publicKeys.id, id),
        eq(publicKeys.isDeleted, false)
      ))
      .returning();
    return result[0] || null;
  }

  async restore(id: string): Promise<PublicKey | null> {
    const result = await this.db
      .update(publicKeys)
      .set({
        isDeleted: false,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
      })
      .where(eq(publicKeys.id, id))
      .returning();
    return result[0] || null;
  }

  async getDeletedKeys(olderThan: Date): Promise<PublicKey[]> {
    const result = await this.db
      .select()
      .from(publicKeys)
      .where(and(
        eq(publicKeys.isDeleted, true),
        lt(publicKeys.revokedAt!, olderThan)
      ));
    return result;
  }

  async permanentDelete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(publicKeys)
      .where(eq(publicKeys.id, id));
    return ((result as unknown as { rowCount: number }).rowCount ?? 0) > 0;
  }
}

export const publicKeyRepository = new PublicKeyRepository();

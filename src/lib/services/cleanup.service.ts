// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { db, schema } from '@/lib/db';
import { kv, getRedisClient } from '@/lib/redis';
import { eq, lt, and, isNotNull } from 'drizzle-orm';
import { env } from '@/config/env';

const BATCH_SIZE = env.CLEANUP_BATCH_SIZE || 1000;

export interface CleanupResult {
  deleted: number;
  errors: string[];
}

/**
 * Generic batch delete function
 */
export async function batchDelete<T extends { id: string }>(
  items: T[],
  tableName: string,
  deleteFn: (id: string) => Promise<void>
): Promise<CleanupResult> {
  const errors: string[] = [];
  let deleted = 0;

  for (const item of items) {
    try {
      await deleteFn(item.id);
      deleted++;
    } catch (err) {
      errors.push(`Failed to delete ${tableName} ${item.id}: ${err}`);
    }
  }

  return { deleted, errors };
}

/**
 * Clean up expired public keys from database and Redis cache
 */
export async function cleanupExpiredKeys(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deleted = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const client = await getRedisClient();

      const expiredKeys = await db
        .select({
          id: schema.publicKeys.id,
          channelId: schema.publicKeys.channelId,
        })
        .from(schema.publicKeys)
        .where(lt(schema.publicKeys.expiresAt, new Date()))
        .limit(BATCH_SIZE);

      if (expiredKeys.length === 0) {
        hasMore = false;
        break;
      }

      for (const key of expiredKeys) {
        try {
          await db
            .delete(schema.publicKeys)
            .where(eq(schema.publicKeys.id, key.id));

          await client.del(`pubkey:${key.channelId}`);
          deleted++;
        } catch (err) {
          errors.push(`Failed to delete key ${key.id}: ${err}`);
        }
      }

      if (expiredKeys.length < BATCH_SIZE) {
        hasMore = false;
      }
    } catch (err) {
      errors.push(`Batch error: ${err}`);
      hasMore = false;
    }
  }

  return { deleted, errors };
}

/**
 * Clean up old audit logs
 */
export async function cleanupOldAuditLogs(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deleted = 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (env.AUDIT_LOG_RETENTION_DAYS || 90));

    const result = await db
      .delete(schema.auditLogs)
      .where(lt(schema.auditLogs.createdAt, cutoffDate));

    deleted = (result as { affectedRows?: number }).affectedRows ?? 0;
  } catch (err) {
    errors.push(`Failed to cleanup audit logs: ${err}`);
  }

  return { deleted, errors };
}

/**
 * Clean up orphaned Redis keys (no corresponding channel in database)
 */
export async function cleanupOrphanedRedisKeys(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deleted = 0;

  try {
    const client = await getRedisClient();

    // Get all active channels
    const activeChannels = await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(eq(schema.channels.isActive, true));

    const activeChannelIds = new Set(activeChannels.map((c) => c.id));

    let cursor = 0;
    const keysToDelete: string[] = [];

    do {
      // Use proper TypeScript typing for scan command
      const scanResult = await client.scan(String(cursor), {
        MATCH: 'pubkey:*',
        COUNT: BATCH_SIZE,
      });
      cursor = Number(scanResult.cursor);

      for (const key of scanResult.keys) {
        // Validate key format before processing
        if (typeof key === 'string' && key.startsWith('pubkey:')) {
          const channelId = key.replace('pubkey:', '');
          // Only delete if channelId is not in active channels
          if (!activeChannelIds.has(channelId)) {
            keysToDelete.push(key);
          }
        }
      }
    } while (cursor !== 0);

    if (keysToDelete.length > 0) {
      await kv.mDel(keysToDelete);
      deleted = keysToDelete.length;
    }
  } catch (err) {
    errors.push(`Failed to cleanup orphaned keys: ${err}`);
  }

  return { deleted, errors };
}

/**
 * Clean up expired persistent channels from PostgreSQL
 */
export async function cleanupExpiredChannels(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deleted = 0;

  try {
    const now = new Date();

    const result = await db
      .update(schema.channels)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.channels.isActive, true),
          isNotNull(schema.channels.expiresAt),
          lt(schema.channels.expiresAt, now)
        )
      );

    deleted = (result as { affectedRows?: number }).affectedRows ?? 0;
  } catch (err) {
    errors.push(`Failed to cleanup expired channels: ${err}`);
  }

  return { deleted, errors };
}

/**
 * Clean up expired temporary channels from Redis
 */
export async function cleanupTempChannels(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deleted = 0;

  try {
    const client = await getRedisClient();

    let cursor = 0;
    const keysToDelete: string[] = [];

    do {
      // Use proper TypeScript typing for scan command
      const scanResult = await client.scan(String(cursor), {
        MATCH: 'channel:*',
        COUNT: BATCH_SIZE,
      });
      cursor = Number(scanResult.cursor);

      for (const key of scanResult.keys) {
        const ttl = await client.ttl(key);
        if (ttl === -2) {
          keysToDelete.push(key);
        } else if (ttl === -1) {
          continue;
        } else if (ttl <= 0) {
          keysToDelete.push(key);
        }
      }
    } while (cursor !== 0);

    if (keysToDelete.length > 0) {
      await kv.mDel(keysToDelete);
      deleted = keysToDelete.length;
    }
  } catch (err) {
    errors.push(`Failed to cleanup temp channels: ${err}`);
  }

  return { deleted, errors };
}

/**
 * Clean up old messages
 */
export async function cleanupOldMessages(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deleted = 0;

  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(
      cutoffDate.getHours() - (env.MESSAGE_CLEANUP_MAX_AGE_HOURS || 12)
    );

    const result = await db
      .delete(schema.messages)
      .where(lt(schema.messages.createdAt, cutoffDate));

    deleted = (result as { affectedRows?: number }).affectedRows ?? 0;
  } catch (err) {
    errors.push(`Failed to cleanup old messages: ${err}`);
  }

  return { deleted, errors };
}

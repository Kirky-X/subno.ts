// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/config/env';
import { getAuditService, AuditAction } from '@/lib/services/audit.service';
import { CreateChannelSchema } from '@/lib/utils/validation.util';
import type { z } from 'zod';
import type { RedisClientType } from 'redis';

const auditService = getAuditService();
const MAX_METADATA_SIZE = env.MAX_CHANNEL_METADATA_SIZE;
const CHANNEL_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export class ChannelService {
  private redis?: RedisClientType;

  constructor(redis?: RedisClientType) {
    this.redis = redis;
  }

  /**
   * Create a new channel
   */
  async createChannel(data: z.infer<typeof CreateChannelSchema>, ip: string = 'unknown') {
    const validationResult = CreateChannelSchema.safeParse(data);
    if (!validationResult.success) {
      throw new Error('Validation failed: ' + JSON.stringify(validationResult.error.issues));
    }
    const validatedData = validationResult.data;

    const channelId = validatedData.id || `pub_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    if (!CHANNEL_ID_PATTERN.test(channelId)) {
      throw new Error('Invalid channel ID format');
    }

    if (validatedData.metadata) {
      const metadataSize = Buffer.byteLength(JSON.stringify(validatedData.metadata), 'utf8');
      if (metadataSize > MAX_METADATA_SIZE) {
        throw new Error(`Channel metadata too large. Maximum size is ${MAX_METADATA_SIZE} bytes`);
      }
    }

    const existing = await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(eq(schema.channels.id, channelId))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Channel '${channelId}' already exists`);
    }

    let expiresAt: Date;
    if (validatedData.expiresIn !== undefined && validatedData.expiresIn !== null) {
      const maxExpiry = env.PERSISTENT_CHANNEL_MAX_TTL;
      const expirySeconds = Math.min(validatedData.expiresIn, maxExpiry);
      expiresAt = new Date(Date.now() + expirySeconds * 1000);
    } else {
      expiresAt = new Date(Date.now() + env.PERSISTENT_CHANNEL_DEFAULT_TTL * 1000);
    }

    const result = await db.insert(schema.channels).values({
      id: channelId,
      name: validatedData.name || channelId,
      description: validatedData.description || null,
      type: validatedData.type || 'public',
      creator: validatedData.creator || null,
      expiresAt,
      metadata: validatedData.metadata || null,
    }).returning();

    const channel = result[0];

    await auditService.log(AuditAction.CHANNEL_CREATED, {
      channelId,
      userId: validatedData.creator || undefined,
      ip,
    });

    return {
      ...channel,
      createdAt: channel.createdAt.toISOString(),
      expiresAt: channel.expiresAt?.toISOString() || null,
    };
  }

  /**
   * Get a channel by ID
   */
  async getChannel(id: string) {
    if (!CHANNEL_ID_PATTERN.test(id)) {
      throw new Error('Invalid channel ID format');
    }

    const result = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const channel = result[0];
    return {
      ...channel,
      createdAt: channel.createdAt.toISOString(),
      expiresAt: channel.expiresAt?.toISOString() || null,
    };
  }
}

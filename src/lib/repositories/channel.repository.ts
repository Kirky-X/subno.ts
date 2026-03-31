// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { channels, type Channel } from '../../db/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';

export class ChannelRepository {
  private db = getDatabase();

  /**
   * Find channel by ID
   */
  async findById(id: string): Promise<Channel | null> {
    const result = await this.db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find channel by name
   */
  async findByName(name: string): Promise<Channel | null> {
    const result = await this.db.select().from(channels).where(eq(channels.name, name)).limit(1);
    return result[0] ?? null;
  }

  /**
   * Find channels by creator with pagination
   */
  async findByCreator(creator: string): Promise<Channel[]> {
    const result = await this.db
      .select()
      .from(channels)
      .where(eq(channels.creator, creator))
      .orderBy(desc(channels.createdAt));
    return result;
  }

  /**
   * Find channels by creator with pagination support
   */
  async findByCreatorWithPagination(
    creator: string,
    limit: number,
    offset: number,
  ): Promise<{ channels: Channel[]; total: number }> {
    const [channelData, countResult] = await Promise.all([
      this.db
        .select()
        .from(channels)
        .where(and(eq(channels.creator, creator), eq(channels.isActive, true)))
        .orderBy(desc(channels.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(channels)
        .where(and(eq(channels.creator, creator), eq(channels.isActive, true))),
    ]);

    return {
      channels: channelData,
      total: Number(countResult[0]?.count || 0),
    };
  }

  /**
   * Find active channels
   */
  async findActive(limit = 100): Promise<Channel[]> {
    const result = await this.db
      .select()
      .from(channels)
      .where(eq(channels.isActive, true))
      .orderBy(desc(channels.createdAt))
      .limit(limit);
    return result;
  }

  /**
   * Find active channels with pagination support
   */
  async findActiveWithPagination(
    limit: number,
    offset: number,
    type?: string,
  ): Promise<{ channels: Channel[]; total: number }> {
    const conditions = [eq(channels.isActive, true)];
    if (type) {
      conditions.push(eq(channels.type, type));
    }

    const [channelData, countResult] = await Promise.all([
      this.db
        .select()
        .from(channels)
        .where(and(...conditions))
        .orderBy(desc(channels.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(channels)
        .where(and(...conditions)),
    ]);

    return {
      channels: channelData,
      total: Number(countResult[0]?.count || 0),
    };
  }

  /**
   * Create a new channel
   */
  async create(data: {
    id: string;
    name: string;
    type: string;
    creator?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<Channel> {
    const result = await this.db
      .insert(channels)
      .values({
        id: data.id,
        name: data.name,
        type: data.type,
        creator: data.creator,
        description: data.description,
        metadata: data.metadata,
        expiresAt: data.expiresAt,
      })
      .returning();
    return result[0];
  }

  /**
   * Update channel
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      type: string;
      metadata: Record<string, unknown>;
      isActive: boolean;
    }>,
  ): Promise<Channel | null> {
    const result = await this.db.update(channels).set(data).where(eq(channels.id, id)).returning();
    return result[0] ?? null;
  }

  /**
   * Soft delete channel
   */
  async softDelete(id: string): Promise<Channel | null> {
    const result = await this.db
      .update(channels)
      .set({ isActive: false })
      .where(and(eq(channels.id, id), eq(channels.isActive, true)))
      .returning();
    return result[0] ?? null;
  }

  /**
   * Check if user is the creator of the channel
   */
  async isCreator(channelId: string, userId: string): Promise<boolean> {
    const channel = await this.findById(channelId);
    return channel?.creator === userId;
  }

  /**
   * Verify user has access to channel (creator or has explicit permission)
   * This is the key security function for ownership verification
   */
  async verifyAccess(
    channelId: string,
    userId: string,
    requireCreator = true,
  ): Promise<{ hasAccess: boolean; channel?: Channel; error?: string }> {
    const channel = await this.findById(channelId);

    if (!channel) {
      return { hasAccess: false, error: 'Channel not found' };
    }

    if (!channel.isActive) {
      return { hasAccess: false, error: 'Channel is inactive' };
    }

    if (requireCreator) {
      // Strict ownership check - only creator can access
      if (channel.creator !== userId) {
        return { hasAccess: false, error: 'Not authorized to access this channel' };
      }
    }

    return { hasAccess: true, channel };
  }
}

export const channelRepository = new ChannelRepository();

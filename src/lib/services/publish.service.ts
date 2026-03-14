// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { messages, type NewMessage } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { auditService } from './audit.service';
import { channelRepository } from '../repositories/channel.repository';
import { getRedisClient } from '../utils/redis-client';

export type MessagePriority = 'critical' | 'high' | 'normal' | 'low' | 'bulk';

export interface PublishRequest {
  channel: string;
  message: string;
  priority?: MessagePriority;
  sender?: string;
  cache?: boolean;
  encrypted?: boolean;
  autoCreate?: boolean;
  signature?: string;
}

export interface PublishResult {
  success: boolean;
  messageId?: string;
  channel?: string;
  publishedAt?: string;
  autoCreated?: boolean;
  error?: string;
  code?: string;
}

export interface QueueStatusResult {
  success: boolean;
  data?: {
    channel: string;
    messages: Array<{
      id: string;
      message: string;
      sender?: string;
      timestamp: number;
      priority: string;
    }>;
    queueLength: number;
  };
  error?: string;
  code?: string;
}

const PRIORITY_MAP: Record<MessagePriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  bulk: 0,
};

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

export class PublishService {
  private db = getDatabase();

  async publish(request: PublishRequest, context?: {
    ip?: string;
    userAgent?: string;
    userId?: string;
  }): Promise<PublishResult> {
    if (!request.channel) {
      return {
        success: false,
        error: '缺少频道参数',
        code: 'MISSING_CHANNEL',
      };
    }

    if (!request.message) {
      return {
        success: false,
        error: '缺少消息内容',
        code: 'MISSING_MESSAGE',
      };
    }

    if (Buffer.byteLength(request.message, 'utf-8') > MAX_MESSAGE_SIZE) {
      return {
        success: false,
        error: '消息大小超过限制（最大 1MB）',
        code: 'MESSAGE_TOO_LARGE',
      };
    }

    const priority = request.priority || 'normal';
    const priorityValue = PRIORITY_MAP[priority];

    let channel = await channelRepository.findById(request.channel);
    let autoCreated = false;

    if (!channel) {
      if (request.autoCreate) {
        const createResult = await channelRepository.create({
          id: request.channel,
          name: `Channel ${request.channel}`,
          type: 'public',
        });
        channel = createResult;
        autoCreated = true;
      } else {
        return {
          success: false,
          error: '频道不存在',
          code: 'CHANNEL_NOT_FOUND',
        };
      }
    }

    if (!channel.isActive) {
      return {
        success: false,
        error: '频道已停用',
        code: 'CHANNEL_INACTIVE',
      };
    }

    const messageId = this.generateMessageId(request.channel);
    const now = new Date();

    const newMessage: NewMessage = {
      id: messageId,
      channelId: request.channel,
      content: request.message,
      priority: priorityValue,
      sender: request.sender,
      encrypted: request.encrypted || false,
      cached: request.cache !== false,
      signature: request.signature,
      createdAt: now,
    };

    try {
      await this.db.insert(messages).values(newMessage);

      await this.publishToRedis(request.channel, {
        id: messageId,
        channel: request.channel,
        message: request.message,
        sender: request.sender,
        priority,
        timestamp: now.getTime(),
      });

      await auditService.log({
        action: 'message_published',
        channelId: request.channel,
        messageId,
        userId: context?.userId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        success: true,
        metadata: {
          priority,
          encrypted: request.encrypted,
          autoCreated,
        },
      });

      return {
        success: true,
        messageId,
        channel: request.channel,
        publishedAt: now.toISOString(),
        autoCreated,
      };
    } catch (error) {
      await auditService.log({
        action: 'message_publish_failed',
        channelId: request.channel,
        userId: context?.userId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: '消息发布失败',
        code: 'PUBLISH_FAILED',
      };
    }
  }

  async getQueueStatus(channel: string, count = 10): Promise<QueueStatusResult> {
    try {
      const result = await this.db
        .select()
        .from(messages)
        .where(eq(messages.channelId, channel))
        .orderBy(desc(messages.priority), desc(messages.createdAt))
        .limit(count);

      const messageList = result.map(m => ({
        id: m.id,
        message: m.content,
        sender: m.sender || undefined,
        timestamp: m.createdAt.getTime(),
        priority: this.getPriorityName(m.priority),
      }));

      const totalResult = await this.db
        .select()
        .from(messages)
        .where(eq(messages.channelId, channel));

      return {
        success: true,
        data: {
          channel,
          messages: messageList,
          queueLength: totalResult.length,
        },
      };
    } catch {
      return {
        success: false,
        error: '查询失败',
        code: 'QUERY_FAILED',
      };
    }
  }

  private generateMessageId(_channel: string): string {
    const timestamp = Date.now();
    const random = crypto.randomUUID().split('-')[0];
    return `msg_${timestamp}_${random}`;
  }

  private getPriorityName(value: number): string {
    if (value >= 100) return 'critical';
    if (value >= 75) return 'high';
    if (value >= 50) return 'normal';
    if (value >= 25) return 'low';
    return 'bulk';
  }

  private async publishToRedis(channel: string, data: unknown): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.publish(`channel:${channel}`, JSON.stringify(data));
      }
    } catch {
      // Redis publish failure is not critical - message is stored in DB
    }
  }
}

export const publishService = new PublishService();

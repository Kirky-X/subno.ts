// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { channelRepository } from '../repositories/channel.repository';
import { auditService } from './audit.service';
import type { Channel } from '../../db/schema';
import { ChannelType } from '../enums/channel.enums';

export interface CreateChannelRequest {
  id?: string;
  name?: string;
  description?: string;
  type?: ChannelType | 'public' | 'encrypted' | 'temporary';
  creator?: string;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateChannelResult {
  success: boolean;
  channel?: {
    id: string;
    name: string;
    type: string;
    createdAt: string;
    expiresAt?: string;
    isActive: boolean;
  };
  error?: string;
  code?: string;
}

export interface QueryChannelsResult {
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
    isActive: boolean;
  }>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: string;
  code?: string;
}

const MAX_EXPIRATION_SECONDS = 30 * 24 * 60 * 60;

/**
 * Validate and normalize channel type
 */
function validateChannelType(type: string | undefined): { valid: boolean; normalizedType: ChannelType; error?: string } {
  const defaultType = ChannelType.PUBLIC;
  
  if (!type) {
    return { valid: true, normalizedType: defaultType };
  }

  // If already a ChannelType enum value
  if (Object.values(ChannelType).includes(type as ChannelType)) {
    return { valid: true, normalizedType: type as ChannelType };
  }

  // Validate string value
  if (validateChannelType(type).valid) {
    return { valid: true, normalizedType: type as ChannelType };
  }

  return { 
    valid: false, 
    normalizedType: defaultType, 
    error: `Invalid channel type. Must be one of: ${Object.values(ChannelType).join(', ')}` 
  };
}

export class ChannelService {
  async create(request: CreateChannelRequest, context?: {
    ip?: string;
    userAgent?: string;
  }): Promise<CreateChannelResult> {
    // Validate and normalize channel type using enum
    const typeValidation = validateChannelType(request.type);
    if (!typeValidation.valid) {
      return {
        success: false,
        error: typeValidation.error,
        code: 'INVALID_CHANNEL_TYPE',
      };
    }
    
    const type = typeValidation.normalizedType;
    const channelId = request.id || this.generateChannelId(type);
    const name = request.name || `Channel ${channelId}`;

    let expiresAt: Date | undefined;
    if (request.expiresIn) {
      if (request.expiresIn > MAX_EXPIRATION_SECONDS) {
        return {
          success: false,
          error: `有效期不能超过 ${MAX_EXPIRATION_SECONDS} 秒（30天）`,
          code: 'INVALID_EXPIRATION',
        };
      }
      expiresAt = new Date(Date.now() + request.expiresIn * 1000);
    }

    if (type === ChannelType.TEMPORARY && !expiresAt) {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    try {
      const existingChannel = await channelRepository.findById(channelId);
      if (existingChannel) {
        return {
          success: false,
          error: '频道 ID 已存在',
          code: 'CHANNEL_EXISTS',
        };
      }

      const channel = await channelRepository.create({
        id: channelId,
        name,
        description: request.description,
        type,
        creator: request.creator,
        metadata: request.metadata,
        expiresAt,
      });

      await auditService.log({
        action: 'channel_created',
        channelId: channel.id,
        userId: request.creator,
        ip: context?.ip,
        userAgent: context?.userAgent,
        success: true,
        metadata: {
          type,
          name,
        },
      });

      return {
        success: true,
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          createdAt: channel.createdAt.toISOString(),
          expiresAt: channel.expiresAt?.toISOString(),
          isActive: channel.isActive,
        },
      };
    } catch (error) {
      await auditService.log({
        action: 'channel_creation_failed',
        channelId,
        userId: request.creator,
        ip: context?.ip,
        userAgent: context?.userAgent,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: '创建频道失败',
        code: 'CREATION_FAILED',
      };
    }
  }

  async query(options?: {
    id?: string;
    type?: string;
    creator?: string;
    limit?: number;
    offset?: number;
  }): Promise<QueryChannelsResult> {
    const limit = Math.min(options?.limit || 50, 100);
    const offset = options?.offset || 0;

    try {
      if (options?.id) {
        const channel = await channelRepository.findById(options.id);
        if (!channel) {
          return {
            success: false,
            error: '频道不存在',
            code: 'NOT_FOUND',
          };
        }

        return {
          success: true,
          data: [{
            id: channel.id,
            name: channel.name,
            type: channel.type,
            createdAt: channel.createdAt.toISOString(),
            isActive: channel.isActive,
          }],
          pagination: {
            total: 1,
            limit,
            offset,
            hasMore: false,
          },
        };
      }

      let channels: Channel[];
      let total: number;

      if (options?.creator) {
        // ✅ 使用数据库级别分页，避免 N+1 查询和内存分页问题
        const result = await channelRepository.findByCreatorWithPagination(
          options.creator,
          limit,
          offset
        );
        channels = result.channels;
        total = result.total;
      } else {
        // ✅ 使用数据库级别分页
        const result = await channelRepository.findActiveWithPagination(
          limit,
          offset,
          options?.type
        );
        channels = result.channels;
        total = result.total;
      }

      return {
        success: true,
        data: channels.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          createdAt: c.createdAt.toISOString(),
          isActive: c.isActive,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + channels.length < total,
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

  private generateChannelId(type: string): string {
    const prefix = type === 'encrypted' ? 'enc_' : 
                   type === 'temporary' ? 'tmp_' : 'pub_';
    const randomBytes = crypto.randomUUID().split('-')[0];
    return `${prefix}${randomBytes}`;
  }
}

export const channelService = new ChannelService();

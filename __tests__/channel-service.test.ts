// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelService } from '@/src/lib/services/channel.service';
import { channelRepository } from '@/src/lib/repositories/channel.repository';
import { auditService } from '@/src/lib/services/audit.service';
import { ChannelType } from '@/src/lib/enums/channel.enums';

vi.mock('@/src/lib/repositories/channel.repository', () => ({
  channelRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByType: vi.fn(),
    findAll: vi.fn(),
  },
}));

vi.mock('@/src/lib/services/audit.service', () => ({
  auditService: {
    log: vi.fn(),
  },
}));

describe('ChannelService', () => {
  let service: ChannelService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChannelService();
  });

  describe('create', () => {
    it('应该成功创建公共频道', async () => {
      const mockRequest = {
        name: 'Test Channel',
        type: 'public',
      };

      vi.mocked(channelRepository.create).mockResolvedValueOnce({
        id: 'ch_123',
        name: 'Test Channel',
        type: ChannelType.PUBLIC,
        createdAt: new Date(),
        isActive: true,
      });

      const result = await service.create(mockRequest);

      expect(result.success).toBe(true);
      expect(result.channel?.id).toBe('ch_123');
      expect(result.channel?.type).toBe('public');
      expect(channelRepository.create).toHaveBeenCalled();
    });

    it('应该成功创建加密频道', async () => {
      const mockRequest = {
        type: 'encrypted',
      };

      vi.mocked(channelRepository.create).mockResolvedValueOnce({
        id: 'ch_enc456',
        type: ChannelType.ENCRYPTED,
        createdAt: new Date(),
        isActive: true,
      });

      const result = await service.create(mockRequest);

      expect(result.success).toBe(true);
      expect(result.channel?.type).toBe('encrypted');
    });

    it('应该成功创建临时频道', async () => {
      const mockRequest = {
        type: 'temporary',
        expiresIn: 3600,
      };

      vi.mocked(channelRepository.create).mockResolvedValueOnce({
        id: 'ch_temp789',
        type: ChannelType.TEMPORARY,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: true,
      });

      const result = await service.create(mockRequest);

      expect(result.success).toBe(true);
      expect(result.channel?.type).toBe('temporary');
    });

    it('应该使用默认类型（public）当未指定时', async () => {
      const mockRequest = { name: 'Default Channel' };

      vi.mocked(channelRepository.create).mockResolvedValueOnce({
        id: 'ch_default',
        type: ChannelType.PUBLIC,
        createdAt: new Date(),
        isActive: true,
      });

      const result = await service.create(mockRequest);

      expect(result.success).toBe(true);
      expect(result.channel?.type).toBe('public');
    });

    it('应该生成自动 ID 当未提供时', async () => {
      const mockRequest = {};

      vi.mocked(channelRepository.create).mockResolvedValueOnce({
        id: 'ch_auto_generated',
        type: ChannelType.PUBLIC,
        createdAt: new Date(),
        isActive: true,
      });

      const result = await service.create(mockRequest);

      expect(result.success).toBe(true);
      expect(result.channel?.id).toBeDefined();
    });

    it('应该拒绝无效的频道类型', async () => {
      const mockRequest = {
        type: 'invalid_type' as any,
      };

      const result = await service.create(mockRequest);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_CHANNEL_TYPE');
    });

    it('应该拒绝超过最大有效期的请求', async () => {
      const mockRequest = {
        type: 'temporary',
        expiresIn: 30 * 24 * 60 * 60 + 1, // 超过 30 天
      };

      const result = await service.create(mockRequest);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_EXPIRATION');
    });

    it('应该接受自定义元数据', async () => {
      const mockRequest = {
        metadata: { custom: 'data', nested: { key: 'value' } },
      };

      vi.mocked(channelRepository.create).mockResolvedValueOnce({
        id: 'ch_meta',
        type: ChannelType.PUBLIC,
        createdAt: new Date(),
        isActive: true,
      });

      const result = await service.create(mockRequest);

      expect(result.success).toBe(true);
      expect(channelRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.any(Object),
        })
      );
    });

    it('应该处理频道已存在的错误', async () => {
      const mockRequest = { id: 'existing_id' };

      vi.mocked(channelRepository.create).mockRejectedValueOnce(
        new Error('Channel already exists')
      );

      const result = await service.create(mockRequest);

      expect(result.success).toBe(false);
      expect(result.code).toBe('CHANNEL_EXISTS');
    });

    it('应该记录审计日志', async () => {
      const mockRequest = { name: 'Audit Test' };

      vi.mocked(channelRepository.create).mockResolvedValueOnce({
        id: 'ch_audit',
        type: ChannelType.PUBLIC,
        createdAt: new Date(),
        isActive: true,
      });

      await service.create(mockRequest, { ip: '127.0.0.1', userAgent: 'Test' });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'channel_created',
          success: true,
        })
      );
    });
  });

  describe('query', () => {
    it('应该通过 ID 查询频道', async () => {
      const mockChannels = [
        { id: 'ch_123', name: 'Test', type: ChannelType.PUBLIC, isActive: true },
      ];

      vi.mocked(channelRepository.findById).mockResolvedValueOnce(mockChannels[0]);

      const result = await service.query({ id: 'ch_123' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('应该按类型查询频道', async () => {
      const mockChannels = [
        { id: 'ch_enc1', type: ChannelType.ENCRYPTED },
        { id: 'ch_enc2', type: ChannelType.ENCRYPTED },
      ];

      vi.mocked(channelRepository.findByType).mockResolvedValueOnce(mockChannels);

      const result = await service.query({ type: 'encrypted' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(channelRepository.findByType).toHaveBeenCalledWith(ChannelType.ENCRYPTED);
    });

    it('应该支持分页查询', async () => {
      const mockChannels = Array(20).fill(null).map((_, i) => ({
        id: `ch_${i}`,
        type: ChannelType.PUBLIC,
      }));

      vi.mocked(channelRepository.findAll).mockResolvedValueOnce({
        channels: mockChannels.slice(0, 10),
        total: 20,
      });

      const result = await service.query({ limit: 10, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination?.total).toBe(20);
    });

    it('应该处理频道不存在', async () => {
      vi.mocked(channelRepository.findById).mockResolvedValueOnce(null);

      const result = await service.query({ id: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('应该按创建者查询', async () => {
      const mockChannels = [
        { id: 'ch_1', creator: 'user123' },
        { id: 'ch_2', creator: 'user123' },
      ];

      vi.mocked(channelRepository.findAll).mockResolvedValueOnce({
        channels: mockChannels,
        total: 2,
      });

      const result = await service.query({ creator: 'user123' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('应该返回空数组当没有匹配结果', async () => {
      vi.mocked(channelRepository.findByType).mockResolvedValueOnce([]);

      const result = await service.query({ type: 'encrypted' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });
});

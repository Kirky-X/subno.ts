// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { channelRepository } from '@/src/lib/repositories/channel.repository';
import { getDatabase } from '@/src/db';
import { channels } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

describe('ChannelRepository', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('create', () => {
    it('应该成功创建频道', async () => {
      const mockChannel = {
        id: 'ch_123',
        name: 'Test Channel',
        type: 'public',
        createdAt: new Date(),
        isActive: true,
      };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockChannel]);

      const result = await channelRepository.create({
        id: 'ch_123',
        name: 'Test Channel',
        type: 'public',
      });

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith(channels);
      expect(mockDb.values).toHaveBeenCalledWith(expect.any(Object));
    });

    it('应该设置默认名称当未提供时', async () => {
      const mockChannel = {
        id: 'ch_456',
        name: 'Channel ch_456',
        type: 'public',
      };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockChannel]);

      await channelRepository.create({
        id: 'ch_456',
        type: 'public',
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining('Channel'),
        })
      );
    });

    it('应该接受 expiresAt', async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);
      const mockChannel = {
        id: 'ch_temp',
        type: 'temporary',
        expiresAt: futureDate,
      };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockChannel]);

      await channelRepository.create({
        id: 'ch_temp',
        type: 'temporary',
        expiresAt: futureDate,
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: futureDate,
        })
      );
    });

    it('应该接受 metadata', async () => {
      const mockChannel = {
        id: 'ch_meta',
        type: 'public',
        metadata: { key: 'value' },
      };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockChannel]);

      await channelRepository.create({
        id: 'ch_meta',
        type: 'public',
        metadata: { key: 'value' },
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { key: 'value' },
        })
      );
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(mockDb.returning).mockRejectedValueOnce(new Error('DB error'));

      await expect(
        channelRepository.create({ id: 'ch_fail', type: 'public' })
      ).rejects.toThrow('DB error');
    });
  });

  describe('findById', () => {
    it('应该通过 ID 查找频道', async () => {
      const mockChannels = [
        { id: 'ch_123', name: 'Test', type: 'public' },
      ];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockChannels);

      const result = await channelRepository.findById('ch_123');

      expect(result).toEqual(mockChannels[0]);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('应该返回 null 当频道不存在', async () => {
      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await channelRepository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('应该只返回活跃频道', async () => {
      const mockChannels = [
        { id: 'ch_active', isActive: true },
      ];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockChannels);

      await channelRepository.findById('ch_active');

      expect(mockDb.where).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            value: true,
          }),
        ])
      );
    });
  });

  describe('findByType', () => {
    it('应该按类型查找频道', async () => {
      const mockChannels = [
        { id: 'ch_enc1', type: 'encrypted' },
        { id: 'ch_enc2', type: 'encrypted' },
      ];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockChannels);

      const result = await channelRepository.findByType('encrypted');

      expect(result).toEqual(mockChannels);
      expect(result).toHaveLength(2);
    });

    it('应该返回空数组当没有匹配结果', async () => {
      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await channelRepository.findByType('encrypted');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('应该查询所有频道（带分页）', async () => {
      const mockChannels = Array(20).fill(null).map((_, i) => ({
        id: `ch_${i}`,
        type: 'public',
      }));

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockReturnValue(mockDb);
      vi.mocked(mockDb.offset).mockReturnValue(mockDb);
      vi.mocked(mockDb.orderBy).mockResolvedValueOnce(mockChannels.slice(0, 10));

      const result = await channelRepository.findAll({ limit: 10, offset: 0 });

      expect(result.channels).toHaveLength(10);
      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
    });

    it('应该支持不带分页的查询', async () => {
      const mockChannels = [{ id: 'ch_1' }];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.orderBy).mockResolvedValueOnce(mockChannels);

      const result = await channelRepository.findAll();

      expect(result.channels).toEqual(mockChannels);
    });

    it('应该按创建时间倒序排序', async () => {
      const mockChannels = [{ id: 'ch_1', createdAt: new Date() }];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.orderBy).mockResolvedValueOnce(mockChannels);

      await channelRepository.findAll();

      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('应该更新频道信息', async () => {
      const mockUpdated = {
        id: 'ch_update',
        name: 'Updated Name',
        type: 'encrypted',
      };

      vi.mocked(mockDb.update).mockReturnValue(mockDb);
      vi.mocked(mockDb.set).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockUpdated]);

      const result = await channelRepository.update('ch_update', {
        name: 'Updated Name',
        type: 'encrypted',
      });

      expect(result).toEqual(mockUpdated);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
        })
      );
    });

    it('应该返回 null 当频道不存在', async () => {
      vi.mocked(mockDb.update).mockReturnValue(mockDb);
      vi.mocked(mockDb.set).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await channelRepository.update('nonexistent', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });

    it('应该部分更新', async () => {
      const mockUpdated = { id: 'ch_partial', isActive: false };

      vi.mocked(mockDb.update).mockReturnValue(mockDb);
      vi.mocked(mockDb.set).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockUpdated]);

      await channelRepository.update('ch_partial', { isActive: false });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        })
      );
    });
  });

  describe('delete', () => {
    it('应该删除频道', async () => {
      vi.mocked(mockDb.delete).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'ch_deleted' }]);

      const result = await channelRepository.delete('ch_delete');

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('应该返回 false 当频道不存在', async () => {
      vi.mocked(mockDb.delete).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await channelRepository.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});

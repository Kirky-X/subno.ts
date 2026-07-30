// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelRepository } from '@/src/lib/repositories/channel.repository';
import { getDatabase } from '@/src/db';
import { channels } from '@/src/db/schema';

vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

describe('ChannelRepository', () => {
  let mockDb: any;
  let repository: ChannelRepository;

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
    // Instantiate after mocking getDatabase so the class field `db` resolves
    // to mockDb. The exported singleton is created at module-load time (before
    // the mock is configured), so we create a fresh instance per test instead.
    repository = new ChannelRepository();
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

      const result = await repository.create({
        id: 'ch_123',
        name: 'Test Channel',
        type: 'public',
      });

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith(channels);
      expect(mockDb.values).toHaveBeenCalledWith(expect.any(Object));
    });

    it('应该接受 expiresAt', async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);
      const mockChannel = {
        id: 'ch_temp',
        name: 'Temp Channel',
        type: 'temporary',
        expiresAt: futureDate,
      };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockChannel]);

      await repository.create({
        id: 'ch_temp',
        name: 'Temp Channel',
        type: 'temporary',
        expiresAt: futureDate,
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: futureDate,
        }),
      );
    });

    it('应该接受 metadata', async () => {
      const mockChannel = {
        id: 'ch_meta',
        name: 'Meta Channel',
        type: 'public',
        metadata: { key: 'value' },
      };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockChannel]);

      await repository.create({
        id: 'ch_meta',
        name: 'Meta Channel',
        type: 'public',
        metadata: { key: 'value' },
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { key: 'value' },
        }),
      );
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(mockDb.returning).mockRejectedValueOnce(new Error('DB error'));

      await expect(
        repository.create({ id: 'ch_fail', name: 'Fail Channel', type: 'public' }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('findById', () => {
    it('应该通过 ID 查找频道', async () => {
      const mockChannels = [{ id: 'ch_123', name: 'Test', type: 'public' }];

      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockChannels);

      const result = await repository.findById('ch_123');

      expect(result).toEqual(mockChannels[0]);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('应该返回 null 当频道不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('应该更新频道信息', async () => {
      const mockUpdated = {
        id: 'ch_update',
        name: 'Updated Name',
        type: 'encrypted',
      };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockUpdated]);

      const result = await repository.update('ch_update', {
        name: 'Updated Name',
        type: 'encrypted',
      });

      expect(result).toEqual(mockUpdated);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
        }),
      );
    });

    it('应该返回 null 当频道不存在', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.update('nonexistent', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });

    it('应该部分更新', async () => {
      const mockUpdated = { id: 'ch_partial', isActive: false };

      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockUpdated]);

      await repository.update('ch_partial', { isActive: false });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });
  });

  describe('findByName', () => {
    it('应该通过名称查找频道', async () => {
      const mockChannel = { id: 'ch_1', name: 'my-channel', type: 'public' };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockChannel]);

      const result = await repository.findByName('my-channel');

      expect(result).toEqual(mockChannel);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('应该返回 null 当名称不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByCreator', () => {
    it('应该返回指定创建者的所有频道', async () => {
      const mockChannels = [
        { id: 'ch_1', creator: 'user-1', createdAt: new Date() },
        { id: 'ch_2', creator: 'user-1', createdAt: new Date() },
      ];
      vi.mocked(mockDb.orderBy).mockResolvedValueOnce(mockChannels);

      const result = await repository.findByCreator('user-1');

      expect(result).toEqual(mockChannels);
      expect(result).toHaveLength(2);
    });

    it('应该返回空数组当创建者无频道', async () => {
      vi.mocked(mockDb.orderBy).mockResolvedValueOnce([]);

      const result = await repository.findByCreator('empty-user');

      expect(result).toEqual([]);
    });
  });

  describe('findByCreatorWithPagination', () => {
    it('应返回分页频道列表和总数', async () => {
      const mockChannels = [
        { id: 'ch_1', creator: 'user-1', isActive: true },
        { id: 'ch_2', creator: 'user-1', isActive: true },
      ];
      // 第一条查询链: select().from().where().orderBy().limit().offset()
      // 第二条查询链: select({count}).from().where()
      // where 被调用两次：第一次返回 mockDb 继续链式，第二次返回 count 结果
      vi.mocked(mockDb.where)
        .mockReturnValueOnce(mockDb)
        .mockResolvedValueOnce([{ count: 2 }]);
      vi.mocked(mockDb.offset).mockResolvedValueOnce(mockChannels);

      const result = await repository.findByCreatorWithPagination('user-1', 10, 0);

      expect(result.channels).toEqual(mockChannels);
      expect(result.total).toBe(2);
    });

    it('应返回 total=0 当无匹配频道', async () => {
      vi.mocked(mockDb.where)
        .mockReturnValueOnce(mockDb)
        .mockResolvedValueOnce([{ count: 0 }]);
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      const result = await repository.findByCreatorWithPagination('user-1', 10, 0);

      expect(result.channels).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('应处理 countResult 为空的情况', async () => {
      vi.mocked(mockDb.where).mockReturnValueOnce(mockDb).mockResolvedValueOnce([]);
      vi.mocked(mockDb.offset).mockResolvedValueOnce([{ id: 'ch_1' }]);

      const result = await repository.findByCreatorWithPagination('user-1', 10, 0);

      expect(result.total).toBe(0);
    });
  });

  describe('findActive', () => {
    it('应返回活跃频道列表', async () => {
      const mockChannels = [
        { id: 'ch_1', isActive: true },
        { id: 'ch_2', isActive: true },
      ];
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockChannels);

      const result = await repository.findActive();

      expect(result).toEqual(mockChannels);
      expect(result).toHaveLength(2);
    });

    it('应支持自定义 limit', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      await repository.findActive(5);

      expect(mockDb.limit).toHaveBeenCalledWith(5);
    });

    it('应使用默认 limit=100', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      await repository.findActive();

      expect(mockDb.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('findActiveWithPagination', () => {
    it('应返回活跃频道分页列表（不带 type 筛选）', async () => {
      const mockChannels = [
        { id: 'ch_1', isActive: true },
        { id: 'ch_2', isActive: true },
      ];
      vi.mocked(mockDb.where)
        .mockReturnValueOnce(mockDb)
        .mockResolvedValueOnce([{ count: 2 }]);
      vi.mocked(mockDb.offset).mockResolvedValueOnce(mockChannels);

      const result = await repository.findActiveWithPagination(10, 0);

      expect(result.channels).toEqual(mockChannels);
      expect(result.total).toBe(2);
    });

    it('应支持按 type 筛选', async () => {
      const mockChannels = [{ id: 'ch_1', isActive: true, type: 'encrypted' }];
      vi.mocked(mockDb.where)
        .mockReturnValueOnce(mockDb)
        .mockResolvedValueOnce([{ count: 1 }]);
      vi.mocked(mockDb.offset).mockResolvedValueOnce(mockChannels);

      const result = await repository.findActiveWithPagination(10, 0, 'encrypted');

      expect(result.channels).toEqual(mockChannels);
      expect(result.total).toBe(1);
    });

    it('应处理空结果', async () => {
      vi.mocked(mockDb.where)
        .mockReturnValueOnce(mockDb)
        .mockResolvedValueOnce([{ count: 0 }]);
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      const result = await repository.findActiveWithPagination(10, 0, 'temporary');

      expect(result.channels).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('应处理 countResult 为 undefined 的情况', async () => {
      vi.mocked(mockDb.where).mockReturnValueOnce(mockDb).mockResolvedValueOnce([]);
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      const result = await repository.findActiveWithPagination(10, 0);

      expect(result.total).toBe(0);
    });
  });

  describe('softDelete', () => {
    it('应软删除活跃频道', async () => {
      const mockDeleted = { id: 'ch_1', isActive: false };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockDeleted]);

      const result = await repository.softDelete('ch_1');

      expect(result).toEqual(mockDeleted);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ isActive: false });
    });

    it('应返回 null 当频道不存在或已非活跃', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.softDelete('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('isCreator', () => {
    it('应返回 true 当用户是创建者', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([{ id: 'ch_1', creator: 'user-1' }]);

      const result = await repository.isCreator('ch_1', 'user-1');

      expect(result).toBe(true);
    });

    it('应返回 false 当用户不是创建者', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([{ id: 'ch_1', creator: 'user-2' }]);

      const result = await repository.isCreator('ch_1', 'user-1');

      expect(result).toBe(false);
    });

    it('应返回 false 当频道不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.isCreator('nonexistent', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('verifyAccess', () => {
    it('应返回 hasAccess=false 当频道不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.verifyAccess('nonexistent', 'user-1');

      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Channel not found');
      expect(result.channel).toBeUndefined();
    });

    it('应返回 hasAccess=false 当频道未激活', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        { id: 'ch_1', creator: 'user-1', isActive: false },
      ]);

      const result = await repository.verifyAccess('ch_1', 'user-1');

      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Channel is inactive');
    });

    it('应返回 hasAccess=false 当 requireCreator=true 且用户非创建者', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        { id: 'ch_1', creator: 'user-2', isActive: true },
      ]);

      const result = await repository.verifyAccess('ch_1', 'user-1', true);

      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Not authorized to access this channel');
    });

    it('应返回 hasAccess=true 当 requireCreator=true 且用户是创建者', async () => {
      const mockChannel = { id: 'ch_1', creator: 'user-1', isActive: true };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockChannel]);

      const result = await repository.verifyAccess('ch_1', 'user-1', true);

      expect(result.hasAccess).toBe(true);
      expect(result.channel).toEqual(mockChannel);
      expect(result.error).toBeUndefined();
    });

    it('应返回 hasAccess=true 当 requireCreator=false 且频道活跃', async () => {
      const mockChannel = { id: 'ch_1', creator: 'user-2', isActive: true };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockChannel]);

      const result = await repository.verifyAccess('ch_1', 'user-1', false);

      expect(result.hasAccess).toBe(true);
      expect(result.channel).toEqual(mockChannel);
    });

    it('应默认 requireCreator=true', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        { id: 'ch_1', creator: 'user-2', isActive: true },
      ]);

      const result = await repository.verifyAccess('ch_1', 'user-1');

      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Not authorized to access this channel');
    });
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicKeyRepository } from '@/src/lib/repositories/public-key.repository';
import { getDatabase } from '@/src/db';
import { publicKeys } from '@/src/db/schema';

vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

// Mock channelRepository 以隔离 findByChannelIdWithAccess / verifyKeyAccess
vi.mock('@/src/lib/repositories/channel.repository', () => ({
  channelRepository: {
    verifyAccess: vi.fn(),
  },
}));

import { channelRepository } from '@/src/lib/repositories/channel.repository';

describe('PublicKeyRepository', () => {
  let mockDb: any;
  let repository: PublicKeyRepository;

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
      delete: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb);
    repository = new PublicKeyRepository();
  });

  describe('findById', () => {
    it('应通过 ID 查找公钥', async () => {
      const mockKey = { id: 'pk-1', channelId: 'ch-1', publicKey: 'key-data' };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockKey]);

      const result = await repository.findById('pk-1');

      expect(result).toEqual(mockKey);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('应返回 null 当公钥不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByChannelId', () => {
    it('应通过 channelId 查找未删除的公钥', async () => {
      const mockKey = { id: 'pk-1', channelId: 'ch-1', isDeleted: false };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockKey]);

      const result = await repository.findByChannelId('ch-1');

      expect(result).toEqual(mockKey);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('应返回 null 当频道无公钥', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findByChannelId('ch-nokey');

      expect(result).toBeNull();
    });
  });

  describe('findByChannelIdWithAccess', () => {
    it('应返回公钥当用户有访问权限', async () => {
      const mockKey = { id: 'pk-1', channelId: 'ch-1', isDeleted: false };
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: true,
        channel: { id: 'ch-1', creator: 'user-1' } as any,
      });
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockKey]);

      const result = await repository.findByChannelIdWithAccess('ch-1', 'user-1');

      expect(result).toEqual(mockKey);
      expect(channelRepository.verifyAccess).toHaveBeenCalledWith('ch-1', 'user-1', true);
    });

    it('应返回 null 当用户无访问权限', async () => {
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: false,
        error: 'Not authorized',
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await repository.findByChannelIdWithAccess('ch-1', 'user-2');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        'Unauthorized access attempt to channel ch-1 by user user-2',
      );
      warnSpy.mockRestore();
    });

    it('应默认 requireCreator=true', async () => {
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: true,
      });
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      await repository.findByChannelIdWithAccess('ch-1', 'user-1');

      expect(channelRepository.verifyAccess).toHaveBeenCalledWith('ch-1', 'user-1', true);
    });

    it('应支持 requireCreator=false', async () => {
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: true,
      });
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      await repository.findByChannelIdWithAccess('ch-1', 'user-1', false);

      expect(channelRepository.verifyAccess).toHaveBeenCalledWith('ch-1', 'user-1', false);
    });
  });

  describe('verifyKeyAccess', () => {
    it('应返回 hasAccess=false 当 key 不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.verifyKeyAccess('nonexistent', 'user-1');

      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Key not found');
      expect(result.key).toBeUndefined();
    });

    it('应返回 hasAccess=true 当用户有频道访问权限', async () => {
      const mockKey = { id: 'pk-1', channelId: 'ch-1', publicKey: 'data' };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockKey]);
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: true,
        channel: { id: 'ch-1', creator: 'user-1' } as any,
      });

      const result = await repository.verifyKeyAccess('pk-1', 'user-1');

      expect(result.hasAccess).toBe(true);
      expect(result.key).toEqual(mockKey);
      expect(result.error).toBeUndefined();
    });

    it('应返回 hasAccess=false 当用户无频道访问权限', async () => {
      const mockKey = { id: 'pk-1', channelId: 'ch-1', publicKey: 'data' };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockKey]);
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: false,
        error: 'Not authorized to access this channel',
      });

      const result = await repository.verifyKeyAccess('pk-1', 'user-2');

      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Not authorized to access this channel');
      expect(result.key).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('应返回未删除的公钥（默认）', async () => {
      const mockKeys = [
        { id: 'pk-1', isDeleted: false, createdAt: new Date() },
        { id: 'pk-2', isDeleted: false, createdAt: new Date() },
      ];
      vi.mocked(mockDb.offset).mockResolvedValueOnce(mockKeys);

      const result = await repository.findAll();

      expect(result).toEqual(mockKeys);
      expect(mockDb.limit).toHaveBeenCalledWith(50);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
      expect(mockDb.where).toHaveBeenCalledWith(expect.anything());
    });

    it('应支持 includeDeleted=true（不添加 where 条件）', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      await repository.findAll({ includeDeleted: true });

      // where(undefined) 被调用
      expect(mockDb.where).toHaveBeenCalledWith(undefined);
    });

    it('应支持自定义 limit 和 offset', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      await repository.findAll({ limit: 10, offset: 5 });

      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(5);
    });

    it('应处理空结果', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('softDelete', () => {
    it('应软删除未删除的公钥', async () => {
      const mockDeleted = {
        id: 'pk-1',
        isDeleted: true,
        revokedBy: 'admin-1',
        revocationReason: 'rotated',
      };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockDeleted]);

      const result = await repository.softDelete('pk-1', 'admin-1', 'key rotated');

      expect(result).toEqual(mockDeleted);
      expect(mockDb.update).toHaveBeenCalledWith(publicKeys);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: true,
          revokedBy: 'admin-1',
          revocationReason: 'key rotated',
        }),
      );
    });

    it('应返回 null 当公钥已删除或不存在', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.softDelete('nonexistent', 'admin-1', 'reason');

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    it('应恢复已删除的公钥', async () => {
      const mockRestored = {
        id: 'pk-1',
        isDeleted: false,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
      };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockRestored]);

      const result = await repository.restore('pk-1');

      expect(result).toEqual(mockRestored);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: false,
          revokedAt: null,
          revokedBy: null,
          revocationReason: null,
        }),
      );
    });

    it('应返回 null 当公钥不存在', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.restore('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getDeletedKeys', () => {
    it('应返回指定时间前删除的公钥', async () => {
      const olderThan = new Date('2026-01-01');
      const mockKeys = [
        { id: 'pk-1', isDeleted: true, revokedAt: new Date('2025-12-01') },
        { id: 'pk-2', isDeleted: true, revokedAt: new Date('2025-11-01') },
      ];
      vi.mocked(mockDb.where).mockResolvedValueOnce(mockKeys);

      const result = await repository.getDeletedKeys(olderThan);

      expect(result).toEqual(mockKeys);
      expect(result).toHaveLength(2);
    });

    it('应返回空数组当无匹配公钥', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce([]);

      const result = await repository.getDeletedKeys(new Date());

      expect(result).toEqual([]);
    });
  });

  describe('permanentDelete', () => {
    it('应返回 true 当删除成功', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 1 });

      const result = await repository.permanentDelete('pk-1');

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledWith(publicKeys);
    });

    it('应返回 false 当 rowCount 为 0', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 0 });

      const result = await repository.permanentDelete('nonexistent');

      expect(result).toBe(false);
    });

    it('应返回 false 当 rowCount 为 null/undefined', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: null });

      const result = await repository.permanentDelete('pk-1');

      expect(result).toBe(false);
    });

    it('应返回 false 当结果无 rowCount 字段', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({});

      const result = await repository.permanentDelete('pk-1');

      expect(result).toBe(false);
    });
  });
});

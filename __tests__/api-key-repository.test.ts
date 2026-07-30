// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiKeyRepository } from '@/src/lib/repositories/api-key.repository';
import { getDatabase } from '@/src/db';
import { apiKeys } from '@/src/db/schema';

vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

describe('ApiKeyRepository', () => {
  let mockDb: any;
  let repository: ApiKeyRepository;

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
    repository = new ApiKeyRepository();
  });

  describe('findById', () => {
    it('应通过 ID 查找 API key', async () => {
      const mockKey = { id: 'key-1', keyHash: 'hash-1', userId: 'user-1' };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockKey]);

      const result = await repository.findById('key-1');

      expect(result).toEqual(mockKey);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('应返回 null 当 key 不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByKeyHash', () => {
    it('应通过 keyHash 查找 API key', async () => {
      const mockKey = { id: 'key-1', keyHash: 'hash-abc', userId: 'user-1' };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockKey]);

      const result = await repository.findByKeyHash('hash-abc');

      expect(result).toEqual(mockKey);
    });

    it('应返回 null 当 hash 不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findByKeyHash('nonexistent-hash');

      expect(result).toBeNull();
    });
  });

  describe('validatePermission', () => {
    it('应返回 false 当 key 不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.validatePermission('hash-1', 'read');

      expect(result).toBe(false);
    });

    it('应返回 false 当 key 未激活', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        { id: 'key-1', isActive: false, isDeleted: false, permissions: ['read'] },
      ]);

      const result = await repository.validatePermission('hash-1', 'read');

      expect(result).toBe(false);
    });

    it('应返回 false 当 key 已删除', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        { id: 'key-1', isActive: true, isDeleted: true, permissions: ['read'] },
      ]);

      const result = await repository.validatePermission('hash-1', 'read');

      expect(result).toBe(false);
    });

    it('应返回 false 当 key 已过期', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        {
          id: 'key-1',
          isActive: true,
          isDeleted: false,
          expiresAt: new Date('2020-01-01'),
          permissions: ['read'],
        },
      ]);

      const result = await repository.validatePermission('hash-1', 'read');

      expect(result).toBe(false);
    });

    it('应返回 true 当 key 有 admin 权限', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        {
          id: 'key-1',
          isActive: true,
          isDeleted: false,
          expiresAt: null,
          permissions: ['admin'],
        },
      ]);

      const result = await repository.validatePermission('hash-1', 'write');

      expect(result).toBe(true);
    });

    it('应返回 true 当 key 有所需权限', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        {
          id: 'key-1',
          isActive: true,
          isDeleted: false,
          expiresAt: null,
          permissions: ['read', 'write'],
        },
      ]);

      const result = await repository.validatePermission('hash-1', 'write');

      expect(result).toBe(true);
    });

    it('应返回 false 当 key 缺少所需权限', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        {
          id: 'key-1',
          isActive: true,
          isDeleted: false,
          expiresAt: null,
          permissions: ['read'],
        },
      ]);

      const result = await repository.validatePermission('hash-1', 'delete');

      expect(result).toBe(false);
    });

    it('应返回 true 当 expiresAt 在未来', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      vi.mocked(mockDb.limit).mockResolvedValueOnce([
        {
          id: 'key-1',
          isActive: true,
          isDeleted: false,
          expiresAt: futureDate,
          permissions: ['read'],
        },
      ]);

      const result = await repository.validatePermission('hash-1', 'read');

      expect(result).toBe(true);
    });
  });

  describe('findByUserId', () => {
    it('应返回指定用户的 API keys（默认选项）', async () => {
      const mockKeys = [{ id: 'key-1', userId: 'user-1', isDeleted: false, createdAt: new Date() }];
      vi.mocked(mockDb.offset).mockResolvedValueOnce(mockKeys);

      const result = await repository.findByUserId('user-1');

      expect(result).toEqual(mockKeys);
      expect(mockDb.limit).toHaveBeenCalledWith(50);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
    });

    it('应支持自定义 limit 和 offset', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      await repository.findByUserId('user-1', { limit: 10, offset: 20 });

      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(20);
    });

    it('应支持 includeDeleted=true', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      await repository.findByUserId('user-1', { includeDeleted: true });

      // where 被调用，构建条件
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('应处理空结果', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      const result = await repository.findByUserId('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('findActive', () => {
    it('应返回活跃的 API keys（默认选项）', async () => {
      const mockKeys = [{ id: 'key-1', isActive: true, isDeleted: false, createdAt: new Date() }];
      vi.mocked(mockDb.offset).mockResolvedValueOnce(mockKeys);

      const result = await repository.findActive();

      expect(result).toEqual(mockKeys);
      expect(mockDb.limit).toHaveBeenCalledWith(100);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
    });

    it('应支持自定义 limit 和 offset', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      await repository.findActive({ limit: 5, offset: 10 });

      expect(mockDb.limit).toHaveBeenCalledWith(5);
      expect(mockDb.offset).toHaveBeenCalledWith(10);
    });

    it('应支持 includeExpired=true', async () => {
      vi.mocked(mockDb.offset).mockResolvedValueOnce([]);

      await repository.findActive({ includeExpired: true });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('应软删除未删除的 key', async () => {
      const mockDeleted = {
        id: 'key-1',
        isDeleted: true,
        isActive: false,
        revokedBy: 'admin-1',
        revocationReason: 'compromised',
      };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockDeleted]);

      const result = await repository.softDelete('key-1', 'admin-1', 'compromised key');

      expect(result).toEqual(mockDeleted);
      expect(mockDb.update).toHaveBeenCalledWith(apiKeys);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: true,
          isActive: false,
          revokedBy: 'admin-1',
          revocationReason: 'compromised key',
        }),
      );
    });

    it('应返回 null 当 key 已删除或不存在', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.softDelete('nonexistent', 'admin-1', 'reason');

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    it('应恢复已删除的 key', async () => {
      const mockRestored = {
        id: 'key-1',
        isDeleted: false,
        isActive: true,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
      };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockRestored]);

      const result = await repository.restore('key-1');

      expect(result).toEqual(mockRestored);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: false,
          isActive: true,
          revokedAt: null,
          revokedBy: null,
          revocationReason: null,
        }),
      );
    });

    it('应返回 null 当 key 不存在', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.restore('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getDeletedKeys', () => {
    it('应返回指定时间前删除的 keys', async () => {
      const olderThan = new Date('2026-01-01');
      const mockKeys = [
        { id: 'key-1', isDeleted: true, revokedAt: new Date('2025-12-01') },
        { id: 'key-2', isDeleted: true, revokedAt: new Date('2025-11-01') },
      ];
      vi.mocked(mockDb.where).mockResolvedValueOnce(mockKeys);

      const result = await repository.getDeletedKeys(olderThan);

      expect(result).toEqual(mockKeys);
      expect(result).toHaveLength(2);
    });

    it('应返回空数组当无匹配 keys', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce([]);

      const result = await repository.getDeletedKeys(new Date());

      expect(result).toEqual([]);
    });
  });

  describe('permanentDelete', () => {
    it('应返回 true 当删除成功', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 1 });

      const result = await repository.permanentDelete('key-1');

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledWith(apiKeys);
    });

    it('应返回 false 当 rowCount 为 0', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 0 });

      const result = await repository.permanentDelete('nonexistent');

      expect(result).toBe(false);
    });

    it('应返回 false 当 rowCount 为 null', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: null });

      const result = await repository.permanentDelete('key-1');

      expect(result).toBe(false);
    });

    it('应返回 false 当结果无 rowCount 字段', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce({});

      const result = await repository.permanentDelete('key-1');

      expect(result).toBe(false);
    });
  });

  describe('updateLastUsed', () => {
    it('应更新 lastUsedAt 字段', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce(undefined);

      await repository.updateLastUsed('key-1');

      expect(mockDb.update).toHaveBeenCalledWith(apiKeys);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });
  });

  describe('deactivate', () => {
    it('应停用 API key', async () => {
      const mockDeactivated = { id: 'key-1', isActive: false };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockDeactivated]);

      const result = await repository.deactivate('key-1');

      expect(result).toEqual(mockDeactivated);
      expect(mockDb.set).toHaveBeenCalledWith({ isActive: false });
    });

    it('应返回 null 当 key 不存在', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.deactivate('nonexistent');

      expect(result).toBeNull();
    });
  });
});

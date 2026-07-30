// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CleanupService } from '@/src/lib/services/cleanup.service';

// Mock db
vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '@/src/db';

describe('CleanupService', () => {
  let service: CleanupService;
  let mockDb: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // 构造链式 mock db
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb);
    service = new CleanupService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateCronSecret', () => {
    const createRequest = (headers: Record<string, string> = {}) =>
      ({
        headers: {
          get: (name: string) => headers[name] ?? null,
        },
      }) as unknown as Request;

    it('CRON_SECRET 未设置时应返回 invalid', () => {
      delete process.env.CRON_SECRET;
      const result = CleanupService.validateCronSecret(createRequest());
      expect(result.valid).toBe(false);
      expect(result.error).toContain('CRON_SECRET must be configured');
    });

    it('生产环境且 CRON_SECRET 未设置时应返回生产环境错误消息', () => {
      delete process.env.CRON_SECRET;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      const result = CleanupService.validateCronSecret(createRequest());
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CRON_SECRET must be configured in production environment');
    });

    it('非生产环境且 CRON_SECRET 未设置时应返回通用错误消息', () => {
      delete process.env.CRON_SECRET;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      const result = CleanupService.validateCronSecret(createRequest());
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CRON_SECRET must be configured');
    });

    it('CRON_SECRET 为默认占位符时应返回 invalid', () => {
      process.env.CRON_SECRET = 'your-cron-secret-change-this-in-production';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'your-cron-secret-change-this-in-production',
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CRON_SECRET cannot be a default/placeholder value');
    });

    it('CRON_SECRET 为 "change-me" 时应返回 invalid', () => {
      process.env.CRON_SECRET = 'change-me-and-make-it-long-enough-32-chars';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'change-me-and-make-it-long-enough-32-chars',
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CRON_SECRET cannot be a default/placeholder value');
    });

    it('CRON_SECRET 为 "default-cron-secret" 时应返回 invalid', () => {
      process.env.CRON_SECRET = 'default-cron-secret-with-padding-32chars';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'default-cron-secret-with-padding-32chars',
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CRON_SECRET cannot be a default/placeholder value');
    });

    it('CRON_SECRET 为 "cron-secret" 时应返回 invalid', () => {
      process.env.CRON_SECRET = 'cron-secret-with-extra-padding-32-chars';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'cron-secret-with-extra-padding-32-chars',
        }),
      );
      expect(result.valid).toBe(false);
    });

    it('CRON_SECRET 为 "secret" 时应返回 invalid', () => {
      process.env.CRON_SECRET = 'secret-padding-to-reach-32-chars-min!!';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'secret-padding-to-reach-32-chars-min!!',
        }),
      );
      expect(result.valid).toBe(false);
    });

    it('CRON_SECRET 长度小于 32 时应返回 invalid', () => {
      process.env.CRON_SECRET = 'short-token-only-20-chars';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'short-token-only-20-chars',
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CRON_SECRET must be at least 32 characters long');
    });

    it('请求未提供 secret 时应返回 invalid', () => {
      process.env.CRON_SECRET = 'this-is-a-valid-cron-token-for-testing-1234567890';
      const result = CleanupService.validateCronSecret(createRequest());
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cron secret required');
    });

    it('请求提供的 secret 不正确时应返回 invalid', () => {
      process.env.CRON_SECRET = 'this-is-a-valid-cron-token-for-testing-1234567890';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'wrong-secret-32-chars-minimum!!!!',
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid cron secret');
    });

    it('通过 X-Cron-Secret 头提供正确 secret 时应返回 valid', () => {
      process.env.CRON_SECRET = 'this-is-a-valid-cron-token-for-testing-1234567890';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'this-is-a-valid-cron-token-for-testing-1234567890',
        }),
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('通过 Authorization Bearer 头提供正确 secret 时应返回 valid', () => {
      process.env.CRON_SECRET = 'this-is-a-valid-cron-token-for-testing-1234567890';
      const result = CleanupService.validateCronSecret(
        createRequest({
          Authorization: 'Bearer this-is-a-valid-cron-token-for-testing-1234567890',
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('X-Cron-Secret 优先于 Authorization', () => {
      process.env.CRON_SECRET = 'this-is-a-valid-cron-token-for-testing-1234567890';
      const result = CleanupService.validateCronSecret(
        createRequest({
          'X-Cron-Secret': 'this-is-a-valid-cron-token-for-testing-1234567890',
          Authorization: 'Bearer a-different-and-wrong-token-value-1234567890',
        }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('getRevokedKeysCleanupDays (private, via direct call)', () => {
    const call = () =>
      (
        service as unknown as { getRevokedKeysCleanupDays: () => number }
      ).getRevokedKeysCleanupDays();

    it('未设置环境变量时应返回默认值 30', () => {
      delete process.env.REVOKED_KEY_CLEANUP_DAYS;
      expect(call()).toBe(30);
    });

    it('环境变量为无效字符串时应返回默认值 30', () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = 'invalid';
      expect(call()).toBe(30);
    });

    it('环境变量小于 1 时应返回默认值 30', () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = '0';
      expect(call()).toBe(30);
    });

    it('环境变量为负数时应返回默认值 30', () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = '-5';
      expect(call()).toBe(30);
    });

    it('环境变量为有效值时应返回该值', () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = '45';
      expect(call()).toBe(45);
    });

    it('环境变量为 1 时应返回 1（边界）', () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = '1';
      expect(call()).toBe(1);
    });

    it('环境变量超过 365 时应返回 365（上限）', () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = '500';
      expect(call()).toBe(365);
    });

    it('环境变量为 365 时应返回 365（边界）', () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = '365';
      expect(call()).toBe(365);
    });
  });

  describe('cleanupExpiredRevocations', () => {
    it('无过期确认时应返回 count=0', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce([]);

      const result = await service.cleanupExpiredRevocations();

      expect(result).toEqual({ count: 0, errors: [] });
    });

    it('有过期确认时应批量更新状态并返回 count', async () => {
      const expiredConfirmations = [{ id: 'conf-1' }, { id: 'conf-2' }, { id: 'conf-3' }];
      // select().from().where() 返回过期确认列表
      vi.mocked(mockDb.where).mockResolvedValueOnce(expiredConfirmations);
      // update().set().where() 返回更新结果
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 3 });

      const result = await service.cleanupExpiredRevocations();

      expect(result).toEqual({ count: 3, errors: [] });
      // 验证 update 被调用
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ status: 'expired' });
    });

    it('查询出错时应返回错误信息', async () => {
      vi.mocked(mockDb.where).mockRejectedValueOnce(new Error('DB error'));

      const result = await service.cleanupExpiredRevocations();

      expect(result).toEqual({
        count: 0,
        errors: ['Failed to cleanup expired confirmations'],
      });
    });

    it('查询出错（非 Error）时应返回错误信息', async () => {
      vi.mocked(mockDb.where).mockRejectedValueOnce('string error');

      const result = await service.cleanupExpiredRevocations();

      expect(result).toEqual({
        count: 0,
        errors: ['Failed to cleanup expired confirmations'],
      });
    });
  });

  describe('cleanupRevokedKeys', () => {
    it('无可清理 key 时应返回 count=0', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce([]);

      const result = await service.cleanupRevokedKeys();

      expect(result).toEqual({ count: 0, errors: [] });
    });

    it('有可清理 key 时应批量删除并返回 count', async () => {
      const keysToDelete = [{ id: 'pk-1' }, { id: 'pk-2' }];
      vi.mocked(mockDb.where).mockResolvedValueOnce(keysToDelete);
      // delete().where() 返回结果
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 2 });

      const result = await service.cleanupRevokedKeys();

      expect(result).toEqual({ count: 2, errors: [] });
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('应支持自定义 olderThanDays', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce([]);

      await service.cleanupRevokedKeys(60);

      // 验证不抛错即可
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('查询出错时应返回错误信息', async () => {
      vi.mocked(mockDb.where).mockRejectedValueOnce(new Error('DB error'));

      const result = await service.cleanupRevokedKeys();

      expect(result).toEqual({
        count: 0,
        errors: ['Failed to cleanup revoked keys'],
      });
    });

    it('查询出错（非 Error）时应返回错误信息', async () => {
      vi.mocked(mockDb.where).mockRejectedValueOnce('string error');

      const result = await service.cleanupRevokedKeys();

      expect(result).toEqual({
        count: 0,
        errors: ['Failed to cleanup revoked keys'],
      });
    });

    it('应正确处理大批量数据（batchProcess 分批）', async () => {
      // BATCH_SIZE = 500，构造 600 个 key 测试分批
      const keysToDelete = Array(600)
        .fill(null)
        .map((_, i) => ({ id: `pk-${i}` }));
      vi.mocked(mockDb.where).mockResolvedValueOnce(keysToDelete);
      // 第一批 delete
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 500 });
      // 第二批 delete
      vi.mocked(mockDb.where).mockResolvedValueOnce({ rowCount: 100 });

      const result = await service.cleanupRevokedKeys();

      expect(result.count).toBe(600);
      expect(result.errors).toEqual([]);
      // delete 被调用 2 次（分两批）
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeFullCleanup', () => {
    it('应并行执行两个清理任务并合并结果', async () => {
      // 直接 spy 方法避免 Promise.all 并行时 mockResolvedValueOnce 消费顺序不确定
      vi.spyOn(service, 'cleanupExpiredRevocations').mockResolvedValueOnce({
        count: 2,
        errors: [],
      });
      vi.spyOn(service, 'cleanupRevokedKeys').mockResolvedValueOnce({
        count: 1,
        errors: [],
      });

      const result = await service.executeFullCleanup();

      expect(result.deletedKeys).toBe(1);
      expect(result.expiredConfirmations).toBe(2);
      expect(result.errors).toEqual([]);
      expect(result.cleanedUpAt).toBeInstanceOf(Date);
    });

    it('两个任务都有错误时应合并错误', async () => {
      vi.spyOn(service, 'cleanupExpiredRevocations').mockResolvedValueOnce({
        count: 0,
        errors: ['Failed to cleanup expired confirmations'],
      });
      vi.spyOn(service, 'cleanupRevokedKeys').mockResolvedValueOnce({
        count: 0,
        errors: ['Failed to cleanup revoked keys'],
      });

      const result = await service.executeFullCleanup();

      expect(result.deletedKeys).toBe(0);
      expect(result.expiredConfirmations).toBe(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Failed to cleanup expired confirmations');
      expect(result.errors).toContain('Failed to cleanup revoked keys');
    });
  });

  describe('getCleanupStatus', () => {
    it('应返回清理状态统计', async () => {
      // 3 个 select 查询，每个返回 [{ count: N }]
      vi.mocked(mockDb.where)
        // pendingConfirmations
        .mockResolvedValueOnce([{ count: 5 }])
        // revokedKeys
        .mockResolvedValueOnce([{ count: 10 }])
        // revocableKeys
        .mockResolvedValueOnce([{ count: 3 }]);

      const result = await service.getCleanupStatus();

      expect(result).toEqual({
        pendingConfirmations: 5,
        revokedKeys: 10,
        revocableKeys: 3,
        cleanupDays: 30, // 默认值
      });
    });

    it('查询返回空数组时 count 应为 0', async () => {
      vi.mocked(mockDb.where)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getCleanupStatus();

      expect(result.pendingConfirmations).toBe(0);
      expect(result.revokedKeys).toBe(0);
      expect(result.revocableKeys).toBe(0);
    });

    it('查询返回的 count 为 null 时应转为 0', async () => {
      vi.mocked(mockDb.where)
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([{ count: null }])
        .mockResolvedValueOnce([{ count: null }]);

      const result = await service.getCleanupStatus();

      expect(result.pendingConfirmations).toBe(0);
      expect(result.revokedKeys).toBe(0);
      expect(result.revocableKeys).toBe(0);
    });

    it('应反映自定义 cleanupDays', async () => {
      process.env.REVOKED_KEY_CLEANUP_DAYS = '60';
      vi.mocked(mockDb.where)
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await service.getCleanupStatus();

      expect(result.cleanupDays).toBe(60);
    });
  });

  describe('batchProcess (private, via direct call)', () => {
    it('应按 BATCH_SIZE (500) 分批处理', async () => {
      const items = Array(1200)
        .fill(null)
        .map((_, i) => i);
      const processor = vi.fn().mockResolvedValue(undefined);

      const internal = service as unknown as {
        batchProcess: <T>(items: T[], processor: (batch: T[]) => Promise<void>) => Promise<void>;
      };
      await internal.batchProcess(items, processor);

      // 1200 / 500 = 2.4 → 3 批
      expect(processor).toHaveBeenCalledTimes(3);
      // 第一批 500 个
      expect(processor.mock.calls[0][0]).toHaveLength(500);
      // 第二批 500 个
      expect(processor.mock.calls[1][0]).toHaveLength(500);
      // 第三批 200 个
      expect(processor.mock.calls[2][0]).toHaveLength(200);
    });

    it('空列表应不调用 processor', async () => {
      const processor = vi.fn().mockResolvedValue(undefined);
      const internal = service as unknown as {
        batchProcess: <T>(items: T[], processor: (batch: T[]) => Promise<void>) => Promise<void>;
      };
      await internal.batchProcess([], processor);
      expect(processor).not.toHaveBeenCalled();
    });

    it('列表长度恰好为 BATCH_SIZE 时应只调用一次', async () => {
      const items = Array(500)
        .fill(null)
        .map((_, i) => i);
      const processor = vi.fn().mockResolvedValue(undefined);
      const internal = service as unknown as {
        batchProcess: <T>(items: T[], processor: (batch: T[]) => Promise<void>) => Promise<void>;
      };
      await internal.batchProcess(items, processor);
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor.mock.calls[0][0]).toHaveLength(500);
    });
  });
});

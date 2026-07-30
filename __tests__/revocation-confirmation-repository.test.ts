// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { RevocationConfirmationRepository } from '@/src/lib/repositories/revocation-confirmation.repository';
import { getDatabase } from '@/src/db';
import { revocationConfirmations } from '@/src/db/schema';

vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

// 使用与 SECURITY_CONFIG 一致的参数计算真实哈希，以便测试 verifyConfirmationCode
const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH = 64;

async function computeConfirmationHash(code: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(code, salt, PBKDF2_ITERATIONS, HASH_LENGTH, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ':' + derivedKey.toString('hex'));
    });
  });
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

describe('RevocationConfirmationRepository', () => {
  let mockDb: any;
  let repository: RevocationConfirmationRepository;

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
      orderBy: vi.fn().mockReturnThis(),
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb);
    repository = new RevocationConfirmationRepository();
  });

  describe('create', () => {
    it('应成功创建撤销确认（默认过期时间）', async () => {
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        reason: 'key compromised',
        status: 'pending',
        expiresAt: new Date(),
      };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockConfirmation]);

      const result = await repository.create({
        keyId: 'pk-1',
        reason: 'key compromised',
      });

      expect(result.confirmation).toEqual(mockConfirmation);
      expect(result.confirmationCode).toBeDefined();
      expect(typeof result.confirmationCode).toBe('string');
      expect(result.confirmationCode).toHaveLength(64); // 32 bytes hex
      expect(mockDb.insert).toHaveBeenCalledWith(revocationConfirmations);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          keyId: 'pk-1',
          reason: 'key compromised',
          status: 'pending',
          confirmationCodeHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('应支持 apiKeyId 和自定义 expiresInHours', async () => {
      const mockConfirmation = {
        id: 'rc-2',
        keyId: 'pk-1',
        apiKeyId: 'ak-1',
        reason: 'rotation',
        status: 'pending',
      };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockConfirmation]);

      const result = await repository.create({
        keyId: 'pk-1',
        apiKeyId: 'ak-1',
        reason: 'rotation',
        expiresInHours: 48,
      });

      expect(result.confirmation).toEqual(mockConfirmation);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: 'ak-1',
        }),
      );
    });

    it('应将 expiresInHours < 1 钳制为最小值 1 小时', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'rc-3' }]);

      const before = new Date();
      await repository.create({
        keyId: 'pk-1',
        reason: 'test',
        expiresInHours: 0.5,
      });
      const after = new Date();

      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      const expiresAt = valuesCall.expiresAt as Date;
      // 0.5 小时被钳制为 1 小时
      const minExpected = new Date(before.getTime() + 1 * 60 * 60 * 1000 - 1000);
      const maxExpected = new Date(after.getTime() + 1 * 60 * 60 * 1000 + 1000);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(minExpected.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(maxExpected.getTime());
    });

    it('应将 expiresInHours > 最大值钳制为 1 年', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'rc-4' }]);

      const before = new Date();
      await repository.create({
        keyId: 'pk-1',
        reason: 'test',
        expiresInHours: 10000,
      });
      const after = new Date();

      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      const expiresAt = valuesCall.expiresAt as Date;
      // 10000 小时被钳制为 24*365=8760 小时
      const maxHours = 24 * 365;
      const minExpected = new Date(before.getTime() + maxHours * 60 * 60 * 1000 - 1000);
      const maxExpected = new Date(after.getTime() + maxHours * 60 * 60 * 1000 + 1000);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(minExpected.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(maxExpected.getTime());
    });

    it('生成的 confirmationCodeHash 应为 salt:hex 格式', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'rc-5' }]);

      await repository.create({
        keyId: 'pk-1',
        reason: 'test',
      });

      const valuesCall = vi.mocked(mockDb.values).mock.calls[0][0];
      const hash = valuesCall.confirmationCodeHash as string;
      expect(hash).toContain(':');
      const [salt, hex] = hash.split(':');
      expect(salt).toHaveLength(64); // 32 bytes hex
      expect(hex).toHaveLength(128); // 64 bytes hex
    });

    it('应处理数据库错误', async () => {
      vi.mocked(mockDb.returning).mockRejectedValueOnce(new Error('DB insert failed'));

      await expect(repository.create({ keyId: 'pk-1', reason: 'test' })).rejects.toThrow(
        'DB insert failed',
      );
    });

    it('应处理哈希计算错误（pbkdf2 失败）', async () => {
      const pbkdf2Spy = vi.spyOn(crypto, 'pbkdf2');
      pbkdf2Spy.mockImplementationOnce((...args: unknown[]) => {
        const callback = args[args.length - 1] as (err: Error | null) => void;
        callback(new Error('pbkdf2 failed'));
      });

      await expect(repository.create({ keyId: 'pk-1', reason: 'test' })).rejects.toThrow(
        'pbkdf2 failed',
      );

      pbkdf2Spy.mockRestore();
    });
  });

  describe('findById', () => {
    it('应通过 ID 查找撤销确认', async () => {
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        status: 'pending',
      };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);

      const result = await repository.findById('rc-1');

      expect(result).toEqual(mockConfirmation);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('应返回 null 当确认不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByKeyId', () => {
    it('应通过 keyId 查找 pending 状态的确认', async () => {
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        status: 'pending',
        createdAt: new Date(),
      };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);

      const result = await repository.findByKeyId('pk-1');

      expect(result).toEqual(mockConfirmation);
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('应返回 null 当无 pending 确认', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.findByKeyId('pk-1');

      expect(result).toBeNull();
    });
  });

  describe('verifyConfirmationCode', () => {
    it('应返回 valid=false 当确认不存在', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.verifyConfirmationCode('nonexistent', 'code');

      expect(result.valid).toBe(false);
      expect(result.confirmation).toBeNull();
      expect(result.isLocked).toBe(false);
    });

    it('应返回 valid=false 和 isLocked=true 当确认已锁定', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        confirmationCodeHash: 'salt:hash',
        status: 'pending',
        attemptCount: 5,
        expiresAt: new Date(Date.now() + 86400000),
        lockedUntil: futureDate,
      };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);

      const result = await repository.verifyConfirmationCode('rc-1', 'code');

      expect(result.valid).toBe(false);
      expect(result.confirmation).toEqual(mockConfirmation);
      expect(result.isLocked).toBe(true);
    });

    it('应返回 valid=false 并标记 expired 当确认已过期', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        confirmationCodeHash: 'salt:hash',
        status: 'pending',
        attemptCount: 0,
        expiresAt: pastDate,
        lockedUntil: null,
      };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([
        { ...mockConfirmation, status: 'expired' },
      ]);

      const result = await repository.verifyConfirmationCode('rc-1', 'code');

      expect(result.valid).toBe(false);
      expect(result.confirmation).toBeNull();
      expect(result.isLocked).toBe(false);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('应返回 valid=false 当状态不是 pending', async () => {
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        confirmationCodeHash: 'salt:hash',
        status: 'confirmed',
        attemptCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        lockedUntil: null,
      };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);

      const result = await repository.verifyConfirmationCode('rc-1', 'code');

      expect(result.valid).toBe(false);
      expect(result.confirmation).toEqual(mockConfirmation);
      expect(result.isLocked).toBe(false);
    });

    it('应返回 valid=true 当验证码正确', async () => {
      const code = 'my-test-confirmation-code';
      const salt = generateSalt();
      const hash = await computeConfirmationHash(code, salt);
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        confirmationCodeHash: hash,
        status: 'pending',
        attemptCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        lockedUntil: null,
      };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);

      const result = await repository.verifyConfirmationCode('rc-1', code);

      expect(result.valid).toBe(true);
      expect(result.confirmation).toEqual(mockConfirmation);
      expect(result.isLocked).toBe(false);
    });

    it('应返回 valid=false 并递增尝试次数当验证码错误（未锁定）', async () => {
      const code = 'correct-code';
      const wrongCode = 'wrong-code';
      const salt = generateSalt();
      const hash = await computeConfirmationHash(code, salt);
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        confirmationCodeHash: hash,
        status: 'pending',
        attemptCount: 0,
        expiresAt: new Date(Date.now() + 86400000),
        lockedUntil: null,
      };
      // findById 的 where 返回 mockDb 继续链，updateLockout 的 where 返回 undefined
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);
      vi.mocked(mockDb.where).mockReturnValueOnce(mockDb).mockResolvedValueOnce(undefined);

      const result = await repository.verifyConfirmationCode('rc-1', wrongCode);

      expect(result.valid).toBe(false);
      expect(result.isLocked).toBe(false);
      expect(result.confirmation).toEqual({ ...mockConfirmation, attemptCount: 1 });
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ attemptCount: 1 }));
    });

    it('应返回 isLocked=true 当错误尝试达到上限', async () => {
      const code = 'correct-code';
      const wrongCode = 'wrong-code';
      const salt = generateSalt();
      const hash = await computeConfirmationHash(code, salt);
      const mockConfirmation = {
        id: 'rc-1',
        keyId: 'pk-1',
        confirmationCodeHash: hash,
        status: 'pending',
        attemptCount: 4, // 4 + 1 = 5 >= maxAttempts(5)
        expiresAt: new Date(Date.now() + 86400000),
        lockedUntil: null,
      };
      vi.mocked(mockDb.limit).mockResolvedValueOnce([mockConfirmation]);
      vi.mocked(mockDb.where).mockReturnValueOnce(mockDb).mockResolvedValueOnce(undefined);

      const result = await repository.verifyConfirmationCode('rc-1', wrongCode);

      expect(result.valid).toBe(false);
      expect(result.isLocked).toBe(true);
      expect(result.confirmation).toEqual({ ...mockConfirmation, attemptCount: 5 });
      // 锁定时 set 应包含 lockedUntil
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptCount: 5,
          lockedUntil: expect.any(Date),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('应更新状态为 confirmed 并设置 confirmedAt 和 confirmedBy', async () => {
      const mockUpdated = {
        id: 'rc-1',
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: 'admin-1',
      };
      vi.mocked(mockDb.returning).mockResolvedValueOnce([mockUpdated]);

      const result = await repository.updateStatus('rc-1', 'confirmed', 'admin-1');

      expect(result).toEqual(mockUpdated);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'confirmed',
          confirmedAt: expect.any(Date),
          confirmedBy: 'admin-1',
        }),
      );
    });

    it('应更新状态为 pending（不设置 confirmedAt）', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'rc-1', status: 'pending' }]);

      await repository.updateStatus('rc-1', 'pending');

      expect(mockDb.set).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('应更新状态为 cancelled', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'rc-1', status: 'cancelled' }]);

      await repository.updateStatus('rc-1', 'cancelled');

      expect(mockDb.set).toHaveBeenCalledWith({ status: 'cancelled' });
    });

    it('应更新状态为 expired', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'rc-1', status: 'expired' }]);

      await repository.updateStatus('rc-1', 'expired');

      expect(mockDb.set).toHaveBeenCalledWith({ status: 'expired' });
    });

    it('应返回 null 当确认不存在', async () => {
      vi.mocked(mockDb.returning).mockResolvedValueOnce([]);

      const result = await repository.updateStatus('nonexistent', 'cancelled');

      expect(result).toBeNull();
    });
  });

  describe('getExpiredConfirmations', () => {
    it('应返回所有过期的 pending 确认', async () => {
      const mockExpired = [
        { id: 'rc-1', status: 'pending', expiresAt: new Date('2020-01-01') },
        { id: 'rc-2', status: 'pending', expiresAt: new Date('2020-02-01') },
      ];
      vi.mocked(mockDb.where).mockResolvedValueOnce(mockExpired);

      const result = await repository.getExpiredConfirmations();

      expect(result).toEqual(mockExpired);
      expect(result).toHaveLength(2);
    });

    it('应返回空数组当无过期确认', async () => {
      vi.mocked(mockDb.where).mockResolvedValueOnce([]);

      const result = await repository.getExpiredConfirmations();

      expect(result).toEqual([]);
    });
  });

  describe('getPendingConfirmations', () => {
    it('应返回 pending 确认（默认 limit=1000）', async () => {
      const mockPending = [
        { id: 'rc-1', status: 'pending' },
        { id: 'rc-2', status: 'pending' },
      ];
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockPending);

      const result = await repository.getPendingConfirmations();

      expect(result).toEqual(mockPending);
      expect(mockDb.limit).toHaveBeenCalledWith(1000);
    });

    it('应支持自定义 limit', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      await repository.getPendingConfirmations(50);

      expect(mockDb.limit).toHaveBeenCalledWith(50);
    });

    it('应处理空结果', async () => {
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await repository.getPendingConfirmations();

      expect(result).toEqual([]);
    });
  });
});

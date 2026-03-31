// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegisterService } from '@/src/lib/services/register.service';
import { channelRepository } from '@/src/lib/repositories/channel.repository';
import { auditService } from '@/src/lib/services/audit.service';
import { getDatabase } from '@/src/db';
import { publicKeys } from '@/src/db/schema';

vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/src/lib/repositories/channel.repository', () => ({
  channelRepository: {
    create: vi.fn(),
  },
}));

vi.mock('@/src/lib/services/audit.service', () => ({
  auditService: {
    log: vi.fn(),
  },
}));

describe('RegisterService', () => {
  let service: RegisterService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(getDatabase).mockReturnValue(mockDb);
    service = new RegisterService();
  });

  describe('validatePublicKey', () => {
    it('应该验证有效的 RSA 公钥', () => {
      const validKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----`;
      
      const result = service.validatePublicKey(validKey, 'RSA-2048');
      
      expect(result).toBe(true);
    });

    it('应该验证有效的 ECC 公钥', () => {
      const validKey = `-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----`;
      
      const result = service.validatePublicKey(validKey, 'ECC-SECP256K1');
      
      expect(result).toBe(true);
    });

    it('应该拒绝空公钥', () => {
      const result = service.validatePublicKey('', 'RSA-2048');
      expect(result).toBe(false);
    });

    it('应该拒绝 null 公钥', () => {
      const result = service.validatePublicKey(null as any, 'RSA-2048');
      expect(result).toBe(false);
    });

    it('应该拒绝缺少 BEGIN 标记的公钥', () => {
      const invalidKey = 'INVALID_KEY_CONTENT';
      const result = service.validatePublicKey(invalidKey, 'RSA-2048');
      expect(result).toBe(false);
    });

    it('应该拒绝缺少 END 标记的公钥', () => {
      const invalidKey = '-----BEGIN PUBLIC KEY-----\nSOME_CONTENT';
      const result = service.validatePublicKey(invalidKey, 'RSA-2048');
      expect(result).toBe(false);
    });

    it('应该拒绝无效算法', () => {
      const validKey = `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`;
      const result = service.validatePublicKey(validKey, 'INVALID_ALGORITHM' as any);
      expect(result).toBe(false);
    });

    it('应该接受带空格的公钥', () => {
      const validKey = `  -----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----  `;
      const result = service.validatePublicKey(validKey, 'RSA-2048');
      expect(result).toBe(true);
    });
  });

  describe('generateChannelId', () => {
    it('应该生成以 enc_开头的频道 ID', () => {
      const channelId = service.generateChannelId();
      
      expect(channelId).toMatch(/^enc_[a-f0-9]+$/);
    });

    it('应该生成唯一 ID', () => {
      const id1 = service.generateChannelId();
      const id2 = service.generateChannelId();
      
      expect(id1).not.toBe(id2);
    });

    it('应该生成 16 字符的 hex（加上 enc_前缀共 21 字符）', () => {
      const channelId = service.generateChannelId();
      
      expect(channelId.length).toBe(21); // enc_ (4) + 16 hex chars
    });
  });

  describe('register', () => {
    const validPublicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----`;

    it('应该成功注册公钥（默认算法）', async () => {
      const mockChannelId = 'enc_abc123';
      const mockKeyId = 'pk_xyz789';
      
      vi.mocked(channelRepository.create).mockResolvedValueOnce(undefined);
      vi.mocked(mockDb.insert).mockReturnValue(mockDb);
      vi.mocked(mockDb.values).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: mockKeyId }]);

      const result = await service.register({
        publicKey: validPublicKey,
      });

      expect(result.success).toBe(true);
      expect(result.channelId).toMatch(/^enc_/);
      expect(result.algorithm).toBe('RSA-2048');
      expect(channelRepository.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'public_key_registered',
          success: true,
        })
      );
    });

    it('应该成功注册公钥（指定算法）', async () => {
      vi.mocked(mockDb.insert).mockReturnValue(mockDb);
      vi.mocked(mockDb.values).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'pk_123' }]);

      const result = await service.register({
        publicKey: validPublicKey,
        algorithm: 'RSA-4096',
      });

      expect(result.success).toBe(true);
      expect(result.algorithm).toBe('RSA-4096');
    });

    it('应该拒绝无效的公钥', async () => {
      const result = await service.register({
        publicKey: 'INVALID_KEY',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_PUBLIC_KEY');
      expect(result.error).toContain('公钥');
    });

    it('应该拒绝超过最大有效期的请求', async () => {
      const result = await service.register({
        publicKey: validPublicKey,
        expiresIn: 30 * 24 * 60 * 60 + 1, // 超过 30 天
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_EXPIRATION');
    });

    it('应该接受自定义有效期', async () => {
      vi.mocked(mockDb.insert).mockReturnValue(mockDb);
      vi.mocked(mockDb.values).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'pk_123' }]);

      const result = await service.register({
        publicKey: validPublicKey,
        expiresIn: 3600, // 1 hour
      });

      expect(result.success).toBe(true);
      expect(result.expiresIn).toBe(3600);
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(channelRepository.create).mockRejectedValueOnce(new Error('DB error'));

      const result = await service.register({
        publicKey: validPublicKey,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('REGISTRATION_FAILED');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'public_key_registration_failed',
          success: false,
        })
      );
    });

    it('应该接受 metadata 字段', async () => {
      vi.mocked(mockDb.insert).mockReturnValue(mockDb);
      vi.mocked(mockDb.values).mockReturnValue(mockDb);
      vi.mocked(mockDb.returning).mockResolvedValueOnce([{ id: 'pk_123' }]);

      const result = await service.register({
        publicKey: validPublicKey,
        metadata: { custom: 'data' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('queryByChannelId', () => {
    it('应该查询到公钥信息', async () => {
      const mockResult = [{
        id: 'pk_123',
        channelId: 'enc_abc',
        algorithm: 'RSA-2048',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        isDeleted: false,
      }];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockResult);

      const result = await service.queryByChannelId('enc_abc');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('pk_123');
      expect(result.data?.isExpired).toBe(false);
    });

    it('应该处理公钥不存在', async () => {
      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await service.queryByChannelId('nonexistent');

      expect(result.success).toBe(false);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('应该检测过期的公钥', async () => {
      const mockResult = [{
        id: 'pk_123',
        channelId: 'enc_abc',
        algorithm: 'RSA-2048',
        createdAt: new Date(Date.now() - 100000),
        expiresAt: new Date(Date.now() - 1000), // Expired
        isDeleted: false,
      }];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockResult);

      const result = await service.queryByChannelId('enc_abc');

      expect(result.success).toBe(true);
      expect(result.data?.isExpired).toBe(true);
    });

    it('应该处理查询错误', async () => {
      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockRejectedValueOnce(new Error('Query failed'));

      const result = await service.queryByChannelId('enc_abc');

      expect(result.success).toBe(false);
      expect(result.code).toBe('QUERY_FAILED');
    });
  });

  describe('queryByKeyId', () => {
    it('应该通过 keyId 查询公钥', async () => {
      const mockResult = [{
        id: 'pk_456',
        channelId: 'enc_def',
        algorithm: 'RSA-2048',
        createdAt: new Date(),
        isDeleted: false,
      }];

      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce(mockResult);

      const result = await service.queryByKeyId('pk_456');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('pk_456');
    });

    it('应该处理 keyId 不存在', async () => {
      vi.mocked(mockDb.select).mockReturnValue(mockDb);
      vi.mocked(mockDb.from).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);
      vi.mocked(mockDb.limit).mockResolvedValueOnce([]);

      const result = await service.queryByKeyId('nonexistent');

      expect(result.success).toBe(false);
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('updateLastUsed', () => {
    it('应该更新最后使用时间', async () => {
      vi.mocked(mockDb.update).mockReturnValue(mockDb);
      vi.mocked(mockDb.set).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockReturnValue(mockDb);

      await service.updateLastUsed('enc_test');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('应该静默失败', async () => {
      vi.mocked(mockDb.update).mockReturnValue(mockDb);
      vi.mocked(mockDb.set).mockReturnValue(mockDb);
      vi.mocked(mockDb.where).mockRejectedValueOnce(new Error('Update failed'));

      // Should not throw
      await expect(service.updateLastUsed('enc_test')).resolves.not.toThrow();
    });
  });
});


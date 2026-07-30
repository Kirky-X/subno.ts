// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyRevocationService } from '@/src/lib/services/key-revocation.service';

// Mock repositories 模块
vi.mock('@/src/lib/repositories', () => ({
  publicKeyRepository: {
    findById: vi.fn(),
    softDelete: vi.fn(),
  },
  apiKeyRepository: {
    findById: vi.fn(),
  },
  revocationConfirmationRepository: {
    findByKeyId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    verifyConfirmationCode: vi.fn(),
    updateStatus: vi.fn(),
  },
  channelRepository: {
    verifyAccess: vi.fn(),
  },
}));

import {
  publicKeyRepository,
  apiKeyRepository,
  revocationConfirmationRepository,
  channelRepository,
} from '@/src/lib/repositories';

describe('KeyRevocationService', () => {
  let service: KeyRevocationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KeyRevocationService();
  });

  // 工厂：构造一个有效的 API Key
  const buildApiKey = (
    overrides: Partial<{
      isActive: boolean;
      isDeleted: boolean;
      expiresAt: Date | null;
      permissions: string[];
      userId: string;
    }> = {},
  ) => ({
    id: 'api-key-1',
    keyHash: 'hash',
    keyPrefix: 'pre',
    userId: overrides.userId ?? 'user-1',
    name: 'key',
    permissions: overrides.permissions ?? ['key_revoke'],
    isActive: overrides.isActive ?? true,
    createdAt: new Date(),
    lastUsedAt: null,
    expiresAt: overrides.expiresAt ?? null,
    isDeleted: overrides.isDeleted ?? false,
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
  });

  const buildKey = (
    overrides: Partial<{
      id: string;
      channelId: string;
      isDeleted: boolean;
      revokedAt: Date | null;
      revokedBy: string | null;
    }> = {},
  ) => ({
    id: overrides.id ?? 'pk-1',
    channelId: overrides.channelId ?? 'ch-1',
    publicKey: 'pub',
    algorithm: 'RSA-2048',
    metadata: {},
    createdAt: new Date(),
    expiresAt: null,
    lastUsedAt: null,
    isDeleted: overrides.isDeleted ?? false,
    revokedAt: overrides.revokedAt ?? null,
    revokedBy: overrides.revokedBy ?? null,
    revocationReason: null,
  });

  const buildConfirmation = (
    overrides: Partial<{
      id: string;
      keyId: string;
      apiKeyId: string | null;
      status: string;
      expiresAt: Date;
      reason: string;
      attemptCount: number;
      lockedUntil: Date | null;
    }> = {},
  ) => ({
    id: overrides.id ?? 'conf-1',
    keyId: overrides.keyId ?? 'pk-1',
    apiKeyId: overrides.apiKeyId === undefined ? 'api-key-1' : overrides.apiKeyId,
    confirmationCodeHash: 'hash:hex',
    status: overrides.status ?? 'pending',
    reason: overrides.reason ?? 'valid reason text',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 3600_000),
    attemptCount: overrides.attemptCount ?? 0,
    lockedUntil: overrides.lockedUntil ?? null,
    createdAt: new Date(),
    confirmedAt: null,
    confirmedBy: null,
  });

  // Helper：为 requestRevocation 准备 mocks（包含 validateApiKeyPermission 内部的额外调用）
  // publicKeyRepository.findById 在 requestRevocation 中被 Promise.all 与
  // validateApiKeyPermission 各调用一次，因此需要 mock 两次
  // 非 admin 用户在 validateApiKeyPermission 内还会调用 channelRepository.verifyAccess
  const mockForRequestRevocation = (
    key: ReturnType<typeof buildKey> | null,
    options: { isAdmin?: boolean; hasAccess?: boolean } = {},
  ) => {
    vi.mocked(publicKeyRepository.findById)
      // 第一次：validateApiKeyPermission 内部调用
      .mockResolvedValueOnce(key)
      // 第二次：requestRevocation 中的 Promise.all 调用
      .mockResolvedValueOnce(key);
    if (!options.isAdmin && key) {
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: options.hasAccess ?? true,
      });
    }
  };

  describe('validateReason (private, via direct call)', () => {
    const call = (reason: unknown) =>
      (
        service as unknown as {
          validateReason: (r: string) => { error: string; code: string } | null;
        }
      ).validateReason(reason as string);

    it('应拒绝非字符串 reason', () => {
      const r = call(123 as unknown as string);
      expect(r).toEqual({ error: 'Reason must be a string', code: 'INVALID_INPUT' });
    });

    it('应拒绝过短的 reason', () => {
      const r = call('short');
      expect(r).toEqual({
        error: 'Reason must be at least 10 characters',
        code: 'INVALID_REASON',
      });
    });

    it('应拒绝过长的 reason', () => {
      const r = call('a'.repeat(1001));
      expect(r).toEqual({
        error: 'Reason must not exceed 1000 characters',
        code: 'INVALID_REASON',
      });
    });

    it('应拒绝包含控制字符的 reason', () => {
      const r = call('valid reason\x00 with control char');
      expect(r).toEqual({ error: 'Reason contains invalid characters', code: 'INVALID_INPUT' });
    });

    it('应接受合法的 reason', () => {
      const r = call('a valid revocation reason');
      expect(r).toBeNull();
    });

    it('应接受刚好 10 字符的 reason（边界）', () => {
      const r = call('0123456789');
      expect(r).toBeNull();
    });

    it('应接受刚好 1000 字符的 reason（边界）', () => {
      const r = call('a'.repeat(1000));
      expect(r).toBeNull();
    });

    it('应接受包含换行符的 reason（合法控制字符）', () => {
      const r = call('valid reason\nwith new line');
      expect(r).toBeNull();
    });
  });

  describe('validateApiKeyPermission (private, via direct call)', () => {
    const call = (apiKeyId: string, targetKeyId: string) =>
      (
        service as unknown as {
          validateApiKeyPermission: (
            a: string,
            t: string,
          ) => Promise<{ valid: boolean; error?: string; code?: string }>;
        }
      ).validateApiKeyPermission(apiKeyId, targetKeyId);

    it('API key 不存在时应返回 INVALID_API_KEY', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(null);
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({ valid: false, error: 'API key not found', code: 'INVALID_API_KEY' });
    });

    it('API key 停用时应返回 INACTIVE_API_KEY', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey({ isActive: false }));
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({ valid: false, error: 'API key is inactive', code: 'INACTIVE_API_KEY' });
    });

    it('API key 过期时应返回 EXPIRED_API_KEY', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(
        buildApiKey({ expiresAt: new Date(Date.now() - 1000) }),
      );
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({ valid: false, error: 'API key has expired', code: 'EXPIRED_API_KEY' });
    });

    it('API key 已撤销时应返回 REVOKED_API_KEY', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey({ isDeleted: true }));
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({
        valid: false,
        error: 'API key has been revoked',
        code: 'REVOKED_API_KEY',
      });
    });

    it('API key 无权限时应返回 FORBIDDEN', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(
        buildApiKey({ permissions: ['read'] }),
      );
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({
        valid: false,
        error: 'Insufficient permissions for key revocation',
        code: 'FORBIDDEN',
      });
    });

    it('目标 key 不存在时应返回 NOT_FOUND', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(null);
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({ valid: false, error: 'Target key not found', code: 'NOT_FOUND' });
    });

    it('admin 权限应跳过 ownership 检查', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(
        buildApiKey({ permissions: ['admin'] }),
      );
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(buildKey());
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({ valid: true });
      expect(channelRepository.verifyAccess).not.toHaveBeenCalled();
    });

    it('非 admin 用户且为频道创建者时应通过', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(buildKey());
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: true,
        channel: undefined,
      });
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({ valid: true });
      expect(channelRepository.verifyAccess).toHaveBeenCalledWith('ch-1', 'user-1', true);
    });

    it('非 admin 用户且非频道创建者时应返回 FORBIDDEN', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(buildKey());
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({
        hasAccess: false,
        error: 'Not authorized to access this channel',
      });
      const r = await call('api-key-1', 'pk-1');
      expect(r).toEqual({
        valid: false,
        error: 'Not authorized to access this channel',
        code: 'FORBIDDEN',
      });
    });

    it('verifyAccess 没返回 error 时应使用默认消息', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(buildKey());
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({ hasAccess: false });
      const r = await call('api-key-1', 'pk-1');
      expect(r.error).toBe('Not authorized to revoke this key');
      expect(r.code).toBe('FORBIDDEN');
    });
  });

  describe('requestRevocation', () => {
    const validRequest = {
      keyId: 'pk-1',
      apiKeyId: 'api-key-1',
      reason: 'a valid revocation reason',
    };

    it('权限校验失败时应返回错误', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(null);
      const r = await service.requestRevocation(validRequest);
      expect(r.success).toBe(false);
      expect(r.code).toBe('INVALID_API_KEY');
    });

    it('权限校验通过但 Promise.all 中的 key 为 null 时应返回 Key not found', async () => {
      // 边界场景：validateApiKeyPermission 内的 findById 返回 key（权限校验通过），
      // 但 Promise.all 中的 findById 返回 null（key 在两次调用间被删除）
      // 注意：Promise.all 同步阶段先调用 findById，validateApiKeyPermission 微任务阶段后调用
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      vi.mocked(publicKeyRepository.findById)
        // 第一次：requestRevocation 中的 Promise.all 调用，返回 null
        .mockResolvedValueOnce(null)
        // 第二次：validateApiKeyPermission 内部调用，返回有效 key
        .mockResolvedValueOnce(buildKey());
      vi.mocked(channelRepository.verifyAccess).mockResolvedValueOnce({ hasAccess: true });
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(null);
      const r = await service.requestRevocation(validRequest);
      expect(r).toEqual({ success: false, error: 'Key not found', code: 'NOT_FOUND' });
    });

    it('权限校验失败（target key 不存在）时应返回 Target key not found', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      mockForRequestRevocation(null);
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(null);
      const r = await service.requestRevocation(validRequest);
      expect(r).toEqual({
        success: false,
        error: 'Target key not found',
        code: 'NOT_FOUND',
      });
    });

    it('key 已撤销时应返回 ALREADY_REVOKED', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      mockForRequestRevocation(buildKey({ isDeleted: true }));
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(null);
      const r = await service.requestRevocation(validRequest);
      expect(r).toEqual({ success: false, error: 'Key already revoked', code: 'ALREADY_REVOKED' });
    });

    it('reason 校验失败（过短）时应返回 INVALID_REASON', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      mockForRequestRevocation(buildKey());
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(null);
      const r = await service.requestRevocation({ ...validRequest, reason: 'short' });
      expect(r).toEqual({
        success: false,
        error: 'Reason must be at least 10 characters',
        code: 'INVALID_REASON',
      });
    });

    it('已存在 pending 撤销时应返回 REVOCATION_PENDING 并附带 revocationId/expiresAt', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      mockForRequestRevocation(buildKey());
      const expiresAt = new Date(Date.now() + 3600_000);
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(
        buildConfirmation({ id: 'conf-existing', expiresAt }),
      );
      const r = await service.requestRevocation(validRequest);
      expect(r.success).toBe(false);
      expect(r.code).toBe('REVOCATION_PENDING');
      expect(r.revocationId).toBe('conf-existing');
      expect(r.expiresAt).toBe(expiresAt.toISOString());
    });

    it('非 pending 状态的已存在确认不应阻止新建', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      mockForRequestRevocation(buildKey());
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(
        buildConfirmation({ status: 'cancelled' }),
      );
      const expiresAt = new Date(Date.now() + 3600_000);
      vi.mocked(revocationConfirmationRepository.create).mockResolvedValueOnce({
        confirmation: buildConfirmation({ id: 'conf-new', expiresAt }),
        confirmationCode: 'code',
      });
      const r = await service.requestRevocation(validRequest);
      expect(r.success).toBe(true);
      expect(r.revocationId).toBe('conf-new');
      expect(r.expiresAt).toBe(expiresAt.toISOString());
      expect(revocationConfirmationRepository.create).toHaveBeenCalledWith({
        keyId: 'pk-1',
        apiKeyId: 'api-key-1',
        reason: 'a valid revocation reason',
        expiresInHours: undefined,
      });
    });

    it('成功创建撤销请求时应返回 revocationId 与 expiresAt', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(buildApiKey());
      mockForRequestRevocation(buildKey());
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(null);
      const expiresAt = new Date(Date.now() + 7200_000);
      vi.mocked(revocationConfirmationRepository.create).mockResolvedValueOnce({
        confirmation: buildConfirmation({ id: 'conf-2', expiresAt }),
        confirmationCode: 'code-2',
      });
      const r = await service.requestRevocation({
        ...validRequest,
        confirmationHours: 2,
      });
      expect(r.success).toBe(true);
      expect(r.revocationId).toBe('conf-2');
      expect(revocationConfirmationRepository.create).toHaveBeenCalledWith({
        keyId: 'pk-1',
        apiKeyId: 'api-key-1',
        reason: 'a valid revocation reason',
        expiresInHours: 2,
      });
    });

    it('admin 用户应能撤销任意 key', async () => {
      vi.mocked(apiKeyRepository.findById).mockResolvedValueOnce(
        buildApiKey({ permissions: ['admin'] }),
      );
      mockForRequestRevocation(buildKey(), { isAdmin: true });
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(null);
      const expiresAt = new Date();
      vi.mocked(revocationConfirmationRepository.create).mockResolvedValueOnce({
        confirmation: buildConfirmation({ id: 'conf-admin', expiresAt }),
        confirmationCode: 'code',
      });
      const r = await service.requestRevocation(validRequest);
      expect(r.success).toBe(true);
    });
  });

  describe('confirmRevocation', () => {
    it('锁定状态时应返回 LOCKED', async () => {
      vi.mocked(revocationConfirmationRepository.verifyConfirmationCode).mockResolvedValueOnce({
        valid: false,
        confirmation: buildConfirmation(),
        isLocked: true,
      });
      const r = await service.confirmRevocation('conf-1', 'code', 'user-1');
      expect(r).toEqual({
        success: false,
        error: 'Too many failed attempts. Please try again later.',
        code: 'LOCKED',
      });
    });

    it('验证失败且无 confirmation 时应返回 NOT_FOUND', async () => {
      vi.mocked(revocationConfirmationRepository.verifyConfirmationCode).mockResolvedValueOnce({
        valid: false,
        confirmation: null,
        isLocked: false,
      });
      const r = await service.confirmRevocation('conf-1', 'code', 'user-1');
      expect(r).toEqual({
        success: false,
        error: 'Revocation not found or expired',
        code: 'NOT_FOUND',
      });
    });

    it('验证失败但有 confirmation 时应返回 INVALID_CODE', async () => {
      vi.mocked(revocationConfirmationRepository.verifyConfirmationCode).mockResolvedValueOnce({
        valid: false,
        confirmation: buildConfirmation(),
        isLocked: false,
      });
      const r = await service.confirmRevocation('conf-1', 'wrong-code', 'user-1');
      expect(r).toEqual({
        success: false,
        error: 'Invalid confirmation code',
        code: 'INVALID_CODE',
      });
    });

    it('key 不存在时应返回 NOT_FOUND', async () => {
      vi.mocked(revocationConfirmationRepository.verifyConfirmationCode).mockResolvedValueOnce({
        valid: true,
        confirmation: buildConfirmation({ keyId: 'pk-1' }),
        isLocked: false,
      });
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(null);
      const r = await service.confirmRevocation('conf-1', 'code', 'user-1');
      expect(r).toEqual({ success: false, error: 'Key not found', code: 'NOT_FOUND' });
    });

    it('softDelete 返回 null 时应返回 DELETE_FAILED', async () => {
      vi.mocked(revocationConfirmationRepository.verifyConfirmationCode).mockResolvedValueOnce({
        valid: true,
        confirmation: buildConfirmation({ keyId: 'pk-1', reason: 'some reason' }),
        isLocked: false,
      });
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(buildKey());
      vi.mocked(publicKeyRepository.softDelete).mockResolvedValueOnce(null);
      const r = await service.confirmRevocation('conf-1', 'code', 'user-1');
      expect(r).toEqual({ success: false, error: 'Failed to delete key', code: 'DELETE_FAILED' });
    });

    it('成功确认时应返回 deletedId 和 channelId 并更新状态', async () => {
      const confirmation = buildConfirmation({ keyId: 'pk-1', reason: 'some reason' });
      vi.mocked(revocationConfirmationRepository.verifyConfirmationCode).mockResolvedValueOnce({
        valid: true,
        confirmation,
        isLocked: false,
      });
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(buildKey());
      const deletedKey = buildKey({ id: 'pk-1', channelId: 'ch-99' });
      vi.mocked(publicKeyRepository.softDelete).mockResolvedValueOnce(deletedKey);
      vi.mocked(revocationConfirmationRepository.updateStatus).mockResolvedValueOnce(confirmation);

      const r = await service.confirmRevocation('conf-1', 'code', 'user-1');

      expect(r).toEqual({ success: true, deletedId: 'pk-1', channelId: 'ch-99' });
      expect(publicKeyRepository.softDelete).toHaveBeenCalledWith('pk-1', 'user-1', 'some reason');
      expect(revocationConfirmationRepository.updateStatus).toHaveBeenCalledWith(
        'conf-1',
        'confirmed',
        'user-1',
      );
    });
  });

  describe('cancelRevocation', () => {
    it('confirmation 不存在时应返回 NOT_FOUND', async () => {
      vi.mocked(revocationConfirmationRepository.findById).mockResolvedValueOnce(null);
      const r = await service.cancelRevocation('conf-1', 'user-1');
      expect(r).toEqual({ success: false, error: 'Revocation not found', code: 'NOT_FOUND' });
    });

    it('非 pending 状态时应返回 INVALID_STATE', async () => {
      vi.mocked(revocationConfirmationRepository.findById).mockResolvedValueOnce(
        buildConfirmation({ status: 'confirmed' }),
      );
      const r = await service.cancelRevocation('conf-1', 'user-1');
      expect(r).toEqual({
        success: false,
        error: 'Revocation is not in pending state',
        code: 'INVALID_STATE',
      });
    });

    it('pending 状态时应成功取消并更新状态', async () => {
      vi.mocked(revocationConfirmationRepository.findById).mockResolvedValueOnce(
        buildConfirmation({ status: 'pending' }),
      );
      vi.mocked(revocationConfirmationRepository.updateStatus).mockResolvedValueOnce(
        buildConfirmation({ status: 'cancelled' }),
      );
      const r = await service.cancelRevocation('conf-1', 'user-1');
      expect(r).toEqual({ success: true });
      expect(revocationConfirmationRepository.updateStatus).toHaveBeenCalledWith(
        'conf-1',
        'cancelled',
        'user-1',
      );
    });
  });

  describe('getRevocationStatus', () => {
    it('confirmation 不存在时应返回 NOT_FOUND', async () => {
      vi.mocked(revocationConfirmationRepository.findById).mockResolvedValueOnce(null);
      const r = await service.getRevocationStatus('conf-1');
      expect(r).toEqual({ success: false, error: 'Revocation not found', code: 'NOT_FOUND' });
    });

    it('confirmation 存在但 key 不存在时应返回部分信息', async () => {
      const expiresAt = new Date(Date.now() + 3600_000);
      vi.mocked(revocationConfirmationRepository.findById).mockResolvedValueOnce(
        buildConfirmation({
          id: 'conf-1',
          keyId: 'pk-1',
          apiKeyId: 'api-key-1',
          status: 'pending',
          expiresAt,
        }),
      );
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(null);
      const r = await service.getRevocationStatus('conf-1');
      expect(r).toEqual({
        success: true,
        status: 'pending',
        keyId: 'pk-1',
        channelId: undefined,
        revokedAt: undefined,
        revokedBy: undefined,
        expiresAt: expiresAt.toISOString(),
        requestedByApiKeyId: 'api-key-1',
      });
    });

    it('confirmation 与 key 都存在时应返回完整信息', async () => {
      const expiresAt = new Date(Date.now() + 3600_000);
      const revokedAt = new Date('2025-01-01');
      vi.mocked(revocationConfirmationRepository.findById).mockResolvedValueOnce(
        buildConfirmation({
          id: 'conf-1',
          keyId: 'pk-1',
          apiKeyId: null,
          status: 'confirmed',
          expiresAt,
        }),
      );
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(
        buildKey({ id: 'pk-1', channelId: 'ch-9', revokedAt, revokedBy: 'user-9' }),
      );
      const r = await service.getRevocationStatus('conf-1');
      expect(r).toEqual({
        success: true,
        status: 'confirmed',
        keyId: 'pk-1',
        channelId: 'ch-9',
        revokedAt: revokedAt.toISOString(),
        revokedBy: 'user-9',
        expiresAt: expiresAt.toISOString(),
        requestedByApiKeyId: undefined,
      });
    });
  });

  describe('getPendingRevocationByKeyId', () => {
    it('不存在 pending confirmation 时应返回 not_found 状态', async () => {
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(null);
      const r = await service.getPendingRevocationByKeyId('pk-1');
      expect(r).toEqual({
        success: false,
        error: 'No pending revocation',
        code: 'NOT_FOUND',
        status: 'not_found',
      });
    });

    it('存在 pending 时应委托给 getRevocationStatus', async () => {
      const expiresAt = new Date(Date.now() + 3600_000);
      vi.mocked(revocationConfirmationRepository.findByKeyId).mockResolvedValueOnce(
        buildConfirmation({ id: 'conf-1', keyId: 'pk-1', expiresAt }),
      );
      vi.mocked(revocationConfirmationRepository.findById).mockResolvedValueOnce(
        buildConfirmation({ id: 'conf-1', keyId: 'pk-1', expiresAt }),
      );
      vi.mocked(publicKeyRepository.findById).mockResolvedValueOnce(
        buildKey({ id: 'pk-1', channelId: 'ch-1' }),
      );
      const r = await service.getPendingRevocationByKeyId('pk-1');
      expect(r.success).toBe(true);
      expect(r.status).toBe('pending');
      expect(r.keyId).toBe('pk-1');
      expect(r.channelId).toBe('ch-1');
    });
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock repositories 以避免数据库连接
vi.mock('@/src/lib/repositories', () => ({
  apiKeyRepository: {
    findByKeyHash: vi.fn(),
  },
  publicKeyRepository: {},
  channelRepository: {},
  revocationConfirmationRepository: {},
}));

// Mock db 以避免创建数据库连接池（CleanupService import 时会触发）
vi.mock('@/src/lib/db', () => ({
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  setDatabase: vi.fn(),
}));

import {
  requireApiKey,
  requireApiKeyWithPermissions,
  getApiKeyInfo,
  createApiKeyValidator,
} from '@/src/lib/middleware/api-key';
import { ApiKeyPermission } from '@/src/lib/enums/permission.enums';
import { apiKeyCache } from '@/src/lib/utils/cache';
import { CleanupService } from '@/src/lib/services/cleanup.service';
import { apiKeyRepository } from '@/src/lib/repositories';

describe('API Key Middleware', () => {
  const createMockRequest = (headers: Record<string, string> = {}) => {
    return new NextRequest('http://localhost:3000/api/test', {
      headers: {
        ...headers,
      },
    });
  };

  // 合法 API Key：32+ 字符，仅字母数字和连字符
  const VALID_API_KEY = 'test-api-key-with-at-least-32-characters';

  describe('requireApiKey', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      vi.clearAllMocks();
      apiKeyCache.clear();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该允许有效的 API Key', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-1',
        userId: 'user-1',
        permissions: [],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });

      const result = await requireApiKey(request);

      expect(result).toBeNull(); // 允许通过
    });

    it('应该拒绝缺少 API Key 的请求', async () => {
      const request = createMockRequest({});

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝无效的 API Key（数据库未找到）', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce(null);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝过短的 API Key', async () => {
      const request = createMockRequest({ 'x-api-key': 'short-key' });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝包含无效字符的 API Key', async () => {
      const request = createMockRequest({ 'x-api-key': 'key-with-special-chars!@#$%' });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该处理空的 API Key header', async () => {
      const request = createMockRequest({ 'x-api-key': '' });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝已停用的 API Key', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-2',
        userId: 'user-2',
        permissions: [],
        isActive: false,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝已过期的 API Key', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-3',
        userId: 'user-3',
        permissions: [],
        isActive: true,
        isDeleted: false,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝已撤销的 API Key', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-4',
        userId: 'user-4',
        permissions: [],
        isActive: true,
        isDeleted: true,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });
  });

  describe('CleanupService.validateCronSecret', () => {
    const originalEnv = { ...process.env };
    // 32+ 字符，不包含占位符子串（"cron-secret"/"secret"/"change-me" 等）
    const TEST_CRON_SECRET = 'test-cron-auth-token-32-chars-min!!';

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.CRON_SECRET = TEST_CRON_SECRET;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该允许有效的 Cron 认证（Authorization Bearer）', () => {
      const request = createMockRequest({
        authorization: `Bearer ${TEST_CRON_SECRET}`,
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(true);
    });

    it('应该允许有效的 Cron 认证（X-Cron-Secret header）', () => {
      const request = createMockRequest({
        'x-cron-secret': TEST_CRON_SECRET,
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(true);
    });

    it('应该拒绝缺少认证的请求', () => {
      const request = createMockRequest({});

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(false);
    });

    it('应该拒绝无效的 Cron Token', () => {
      const request = createMockRequest({
        authorization: 'Bearer wrong-token',
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(false);
    });

    it('应该拒绝 Basic Auth 格式', () => {
      const request = createMockRequest({
        authorization: 'Basic d3Jvbmc=',
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(false);
    });

    it('应该处理空的 Authorization header', () => {
      const request = createMockRequest({
        authorization: '',
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(false);
    });

    it('应该拒绝未配置 CRON_SECRET 的环境', () => {
      delete process.env.CRON_SECRET;

      const request = createMockRequest({
        authorization: `Bearer ${TEST_CRON_SECRET}`,
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(false);
    });

    it('应该拒绝过短的 CRON_SECRET', () => {
      process.env.CRON_SECRET = 'short';

      const request = createMockRequest({
        authorization: 'Bearer short',
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(false);
    });

    it('应该拒绝默认占位符 CRON_SECRET', () => {
      process.env.CRON_SECRET = 'cron-secret-placeholder-32-chars!!!';

      const request = createMockRequest({
        authorization: 'Bearer cron-secret-placeholder-32-chars!!!',
      });

      const result = CleanupService.validateCronSecret(request);

      expect(result.valid).toBe(false);
    });
  });

  describe('createApiKeyValidator - 权限检查', () => {
    const originalEnv = { ...process.env };
    const VALID_API_KEY = 'test-api-key-with-at-least-32-characters';

    beforeEach(() => {
      vi.clearAllMocks();
      apiKeyCache.clear();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该在权限满足时返回 null 并附加 apiKey 信息到 request', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-1',
        userId: 'user-perm-1',
        permissions: [ApiKeyPermission.READ, ApiKeyPermission.WRITE],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const validator = createApiKeyValidator([ApiKeyPermission.READ]);
      const result = await validator(request);

      expect(result).toBeNull();
      // 验证 apiKey 信息已附加到 request
      const reqWithKey = request as NextRequest & {
        apiKey?: { id: string; userId: string; permissions: string[] };
      };
      expect(reqWithKey.apiKey).toBeDefined();
      expect(reqWithKey.apiKey!.id).toBe('key-perm-1');
      expect(reqWithKey.apiKey!.userId).toBe('user-perm-1');
      expect(reqWithKey.apiKey!.permissions).toContain(ApiKeyPermission.READ);
    });

    it('应该在权限不满足时返回 403', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-2',
        userId: 'user-perm-2',
        permissions: [ApiKeyPermission.READ], // 只有 READ
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      // 需要 PUBLISH，但 key 只有 READ
      const validator = createApiKeyValidator([ApiKeyPermission.PUBLISH]);
      const result = await validator(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
      const body = await result?.json();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      // 注意：INSUFFICIENT_PERMISSIONS 不在 safeDetailCodes 中，details 不会返回
    });

    it('应该在需要多个权限且全部满足时返回 null', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-3',
        userId: 'user-perm-3',
        permissions: [ApiKeyPermission.READ, ApiKeyPermission.WRITE, ApiKeyPermission.PUBLISH],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const validator = createApiKeyValidator([ApiKeyPermission.READ, ApiKeyPermission.WRITE]);
      const result = await validator(request);

      expect(result).toBeNull();
    });

    it('应该在需要多个权限但部分缺失时返回 403', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-4',
        userId: 'user-perm-4',
        permissions: [ApiKeyPermission.READ], // 缺少 WRITE
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const validator = createApiKeyValidator([ApiKeyPermission.READ, ApiKeyPermission.WRITE]);
      const result = await validator(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });

    it('应该在 requiredPermissions 为空数组时跳过权限检查', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-5',
        userId: 'user-perm-5',
        permissions: [],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const validator = createApiKeyValidator([]);
      const result = await validator(request);

      expect(result).toBeNull();
    });

    it('应该在 key 无效时先返回 401（权限检查不执行）', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce(null);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const validator = createApiKeyValidator([ApiKeyPermission.ADMIN]);
      const result = await validator(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401); // 认证失败，不是 403
    });

    it('应该将 permissions 附加到 request 即使为空数组', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-6',
        userId: 'user-perm-6',
        permissions: [],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const validator = createApiKeyValidator();
      await validator(request);

      const reqWithKey = request as NextRequest & {
        apiKey?: { permissions: string[] };
      };
      expect(reqWithKey.apiKey).toBeDefined();
      expect(reqWithKey.apiKey!.permissions).toEqual([]);
    });

    it('应该在 permissions 为 undefined 时使用空数组 fallback', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-7',
        userId: 'user-perm-7',
        permissions: undefined as unknown as string[],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const validator = createApiKeyValidator();
      const result = await validator(request);

      expect(result).toBeNull();
      const reqWithKey = request as NextRequest & {
        apiKey?: { permissions: string[] };
      };
      expect(reqWithKey.apiKey).toBeDefined();
      expect(reqWithKey.apiKey!.permissions).toEqual([]);
    });

    it('应该在有效 key 但 permissions 为 undefined 且需要权限检查时使用空数组 fallback (line 236)', async () => {
      // 覆盖 line 236: result.permissions || [] 在权限检查块内的回退路径
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-perm-8',
        userId: 'user-perm-8',
        permissions: undefined as unknown as string[],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      // 提供 requiredPermissions 以进入权限检查块，触发 result.permissions || [] 回退
      const validator = createApiKeyValidator([ApiKeyPermission.READ]);
      const result = await validator(request);

      // permissions 回退为 []，不包含 READ，应返回 403
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
      const body = await result?.json();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('requireApiKeyWithPermissions', () => {
    const originalEnv = { ...process.env };
    const VALID_API_KEY = 'test-api-key-with-at-least-32-characters';

    beforeEach(() => {
      vi.clearAllMocks();
      apiKeyCache.clear();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该在权限满足时返回 null', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-rp-1',
        userId: 'user-rp-1',
        permissions: [ApiKeyPermission.PUBLISH, ApiKeyPermission.REVOKE],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const result = await requireApiKeyWithPermissions(request, [
        ApiKeyPermission.PUBLISH,
        ApiKeyPermission.REVOKE,
      ]);

      expect(result).toBeNull();
    });

    it('应该在权限不满足时返回 403', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-rp-2',
        userId: 'user-rp-2',
        permissions: [ApiKeyPermission.READ],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const result = await requireApiKeyWithPermissions(request, [ApiKeyPermission.REVOKE]);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });
  });

  describe('getApiKeyInfo', () => {
    const originalEnv = { ...process.env };
    const VALID_API_KEY = 'test-api-key-with-at-least-32-characters';

    beforeEach(() => {
      vi.clearAllMocks();
      apiKeyCache.clear();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该在 key 有效时返回 {keyId, userId, permissions}', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-info-1',
        userId: 'user-info-1',
        permissions: [ApiKeyPermission.READ, ApiKeyPermission.WRITE],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).not.toBeNull();
      expect(info!.keyId).toBe('key-info-1');
      expect(info!.userId).toBe('user-info-1');
      expect(info!.permissions).toContain(ApiKeyPermission.READ);
      expect(info!.permissions).toContain(ApiKeyPermission.WRITE);
    });

    it('应该在 key 缺失时返回 null', async () => {
      const request = createMockRequest({});
      const info = await getApiKeyInfo(request);

      expect(info).toBeNull();
    });

    it('应该在 key 无效时返回 null', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce(null);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).toBeNull();
    });

    it('应该在 key 已停用时返回 null', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-info-2',
        userId: 'user-info-2',
        permissions: [],
        isActive: false,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).toBeNull();
    });

    it('应该在 key 已过期时返回 null', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-info-3',
        userId: 'user-info-3',
        permissions: [],
        isActive: true,
        isDeleted: false,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).toBeNull();
    });

    it('应该在 key 已撤销时返回 null', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-info-4',
        userId: 'user-info-4',
        permissions: [],
        isActive: true,
        isDeleted: true,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).toBeNull();
    });

    it('应该在数据库查询抛错时返回 null', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockRejectedValueOnce(
        new Error('DB connection failed'),
      );

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).toBeNull();
    });

    it('应该在数据库查询抛出非 Error 值时返回 null', async () => {
      // 测试 error instanceof Error ? ... : 'unknown' 的 false 分支
      vi.mocked(apiKeyRepository.findByKeyHash).mockRejectedValueOnce(
        'string error' as unknown as Error,
      );

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).toBeNull();
    });

    it('应该在 permissions 为 undefined 时返回空数组', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-info-5',
        userId: 'user-info-5',
        permissions: undefined as unknown as string[],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      expect(info).not.toBeNull();
      expect(info!.permissions).toEqual([]);
    });
  });

  describe('validateApiKey - 格式校验边界', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      vi.clearAllMocks();
      apiKeyCache.clear();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该拒绝过长的 API Key（> 128 字符）', async () => {
      const longKey = 'a'.repeat(129);
      const request = createMockRequest({ 'x-api-key': longKey });
      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
      const body = await result?.json();
      expect(body.error.code).toBe('INVALID_API_KEY');
    });

    it('应该拒绝包含无效字符但长度足够的 API Key', async () => {
      // 32+ 字符但包含特殊字符（! @ # 不在 VALID_PATTERN 中）
      const invalidCharKey = 'key-with-special-chars!@#$%abcdefghijklmnopqrstuvwxyz';
      const request = createMockRequest({ 'x-api-key': invalidCharKey });
      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
      const body = await result?.json();
      expect(body.error.code).toBe('INVALID_API_KEY');
    });

    it('应该接受恰好 128 字符的 API Key（边界值）', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-boundary',
        userId: 'user-boundary',
        permissions: [],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const maxLengthKey = 'a'.repeat(128);
      const request = createMockRequest({ 'x-api-key': maxLengthKey });
      const result = await requireApiKey(request);

      expect(result).toBeNull();
    });
  });

  describe('validateApiKey - 缓存行为', () => {
    const originalEnv = { ...process.env };
    const VALID_API_KEY = 'test-api-key-with-at-least-32-characters';

    beforeEach(() => {
      vi.clearAllMocks();
      apiKeyCache.clear();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该在缓存命中有效 key 时跳过数据库查询', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce({
        id: 'key-cache-1',
        userId: 'user-cache-1',
        permissions: [ApiKeyPermission.READ],
        isActive: true,
        isDeleted: false,
        expiresAt: null,
      } as any);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });

      // 第一次调用 → 数据库查询 + 缓存
      const result1 = await requireApiKey(request);
      expect(result1).toBeNull();
      expect(apiKeyRepository.findByKeyHash).toHaveBeenCalledTimes(1);

      // 第二次调用 → 应该命中缓存，不查询数据库
      const result2 = await requireApiKey(request);
      expect(result2).toBeNull();
      expect(apiKeyRepository.findByKeyHash).toHaveBeenCalledTimes(1); // 仍然只调用 1 次
    });

    it('应该在缓存命中无效 key 时跳过数据库查询', async () => {
      vi.mocked(apiKeyRepository.findByKeyHash).mockResolvedValueOnce(null);

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });

      // 第一次调用 → 数据库查询 + 缓存负面结果
      const result1 = await requireApiKey(request);
      expect(result1).not.toBeNull();
      expect(result1?.status).toBe(401);
      expect(apiKeyRepository.findByKeyHash).toHaveBeenCalledTimes(1);

      // 第二次调用 → 应该命中缓存（isValid: false），不查询数据库
      const result2 = await requireApiKey(request);
      expect(result2).not.toBeNull();
      expect(result2?.status).toBe(401);
      expect(apiKeyRepository.findByKeyHash).toHaveBeenCalledTimes(1);
    });

    it('应该从缓存的 userId 中提取 keyId（split(":") 路径）', async () => {
      // 缓存命中有效 key 时，keyId = cached.userId.split(':')[0]
      // 通过手动设置缓存来测试此路径
      const { createHash } = await import('crypto');
      const keyHash = createHash('sha256').update(VALID_API_KEY).digest('hex');
      apiKeyCache.set(
        keyHash,
        {
          userId: 'key-from-cache:user-123',
          permissions: [ApiKeyPermission.READ],
          isValid: true,
        },
        5 * 60 * 1000,
      );

      const request = createMockRequest({ 'x-api-key': VALID_API_KEY });
      const info = await getApiKeyInfo(request);

      // keyId 应该是 userId.split(':')[0] = 'key-from-cache'
      expect(info).not.toBeNull();
      expect(info!.keyId).toBe('key-from-cache');
      expect(info!.userId).toBe('key-from-cache:user-123');
      // 不应该查询数据库
      expect(apiKeyRepository.findByKeyHash).not.toHaveBeenCalled();
    });
  });
});

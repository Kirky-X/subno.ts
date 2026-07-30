// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock cleanup.service 以控制 validateCronSecret 静态方法
vi.mock('@/src/lib/services/cleanup.service', () => ({
  CleanupService: {
    validateCronSecret: vi.fn(),
  },
}));

// Mock services 以提供 auditService 和 cleanupService
vi.mock('@/src/lib/services', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
  cleanupService: {
    cleanupRevokedKeys: vi.fn(),
    cleanupExpiredRevocations: vi.fn(),
  },
}));

// Mock repositories 以提供 channelRepository
vi.mock('@/src/lib/repositories', () => ({
  channelRepository: {
    findActive: vi.fn(),
    softDelete: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock db 以避免创建数据库连接池
vi.mock('@/src/db', () => ({
  getDatabase: vi.fn(),
}));

// Mock db schema 以提供 auditLogs 表定义
vi.mock('@/src/db/schema', () => ({
  auditLogs: {
    createdAt: 'audit_logs.created_at',
  },
}));

// Mock drizzle-orm 以避免 lt() 处理 undefined 列时报错
vi.mock('drizzle-orm', () => ({
  lt: vi.fn(() => ({})),
}));

import { cleanupService, auditService } from '@/src/lib/services';
import { channelRepository } from '@/src/lib/repositories';
import { getDatabase } from '@/src/db';
import { CleanupService } from '@/src/lib/services/cleanup.service';
import { GET as cleanupChannels } from '@/app/api/cron/cleanup-channels/route';
import { GET as cleanupKeys } from '@/app/api/cron/cleanup-keys/route';

describe('Cron API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认：认证通过
    vi.mocked(CleanupService.validateCronSecret).mockReturnValue({ valid: true });
    // 默认：auditService.log 不抛错
    vi.mocked(auditService.log).mockResolvedValue(undefined as any);
    // 默认：getDatabase 返回 mock db（支持 delete().where().returning() 链式调用）
    vi.mocked(getDatabase).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
  });

  const createMockCronRequest = (url: string) => {
    return new NextRequest(url, {
      headers: {
        Authorization: 'Bearer cron-secret-token',
      },
    });
  };

  describe('GET /api/cron/cleanup-channels', () => {
    it('应该成功清理过期频道', async () => {
      const expiredDate = new Date(Date.now() - 86400000);
      vi.mocked(channelRepository.findActive).mockResolvedValueOnce([
        { id: 'ch-1', type: 'temporary', expiresAt: expiredDate },
        { id: 'ch-2', type: 'persistent', expiresAt: expiredDate },
        { id: 'ch-3', type: 'temporary', expiresAt: expiredDate },
      ] as any);
      vi.mocked(channelRepository.softDelete).mockResolvedValue(undefined as any);
      vi.mocked(channelRepository.update).mockResolvedValue(undefined as any);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.temporaryChannelsDeleted).toBe(2);
      expect(data.data.persistentChannelsMarkedInactive).toBe(1);

      expect(channelRepository.findActive).toHaveBeenCalledWith(1000);
      expect(channelRepository.softDelete).toHaveBeenCalledTimes(2);
      expect(channelRepository.update).toHaveBeenCalledTimes(1);
    });

    it('应该处理没有频道的情况', async () => {
      vi.mocked(channelRepository.findActive).mockResolvedValueOnce([]);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.temporaryChannelsDeleted).toBe(0);
      expect(data.data.persistentChannelsMarkedInactive).toBe(0);
    });

    it('应该拒绝未认证的请求', async () => {
      vi.mocked(CleanupService.validateCronSecret).mockReturnValueOnce({
        valid: false,
        error: 'Invalid cron secret',
      });

      const request = new NextRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(401);
    });

    it('应该处理清理错误', async () => {
      vi.mocked(channelRepository.findActive).mockRejectedValueOnce(new Error('Database error'));

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(500);
    });

    it('应该跳过未过期的频道', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      vi.mocked(channelRepository.findActive).mockResolvedValueOnce([
        { id: 'ch-1', type: 'temporary', expiresAt: futureDate },
      ] as any);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.temporaryChannelsDeleted).toBe(0);
      expect(data.data.persistentChannelsMarkedInactive).toBe(0);
      expect(channelRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/cron/cleanup-keys', () => {
    it('应该成功清理过期密钥', async () => {
      vi.mocked(cleanupService.cleanupRevokedKeys).mockResolvedValueOnce({
        count: 10,
        errors: [],
      });
      vi.mocked(cleanupService.cleanupExpiredRevocations).mockResolvedValueOnce({
        count: 5,
        errors: [],
      });

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.results.expiredKeys.deleted).toBe(10);
      expect(data.data.results.expiredRevocations.updated).toBe(5);
      expect(data.data.results.auditLogs.deleted).toBe(0);
      expect(data.data.errors).toEqual([]);

      expect(cleanupService.cleanupRevokedKeys).toHaveBeenCalled();
      expect(cleanupService.cleanupExpiredRevocations).toHaveBeenCalled();
    });

    it('应该处理没有密钥的情况', async () => {
      vi.mocked(cleanupService.cleanupRevokedKeys).mockResolvedValueOnce({
        count: 0,
        errors: [],
      });
      vi.mocked(cleanupService.cleanupExpiredRevocations).mockResolvedValueOnce({
        count: 0,
        errors: [],
      });

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.results.expiredKeys.deleted).toBe(0);
      expect(data.data.results.expiredRevocations.updated).toBe(0);
    });

    it('应该拒绝未认证的请求', async () => {
      vi.mocked(CleanupService.validateCronSecret).mockReturnValueOnce({
        valid: false,
        error: 'Auth failed',
      });

      const request = new NextRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(401);
    });

    it('应该在响应中包含清理错误信息', async () => {
      vi.mocked(cleanupService.cleanupRevokedKeys).mockResolvedValueOnce({
        count: 3,
        errors: ['Failed to delete key pk_1'],
      });
      vi.mocked(cleanupService.cleanupExpiredRevocations).mockResolvedValueOnce({
        count: 2,
        errors: ['Failed to update confirmation conf_1'],
      });

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request, { params: Promise.resolve({}) });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.results.expiredKeys.deleted).toBe(3);
      expect(data.data.results.expiredRevocations.updated).toBe(2);
      expect(data.data.errors).toHaveLength(2);
      expect(data.data.errors).toContain('Failed to delete key pk_1');
      expect(data.data.errors).toContain('Failed to update confirmation conf_1');
    });
  });
});

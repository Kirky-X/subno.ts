// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { cleanupService } from '@/src/lib/services';
import { GET as cleanupChannels } from '@/app/api/cron/cleanup-channels/route';
import { GET as cleanupKeys } from '@/app/api/cron/cleanup-keys/route';

vi.mock('@/src/lib/middleware/api-key', () => ({
  validateCronAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/src/lib/services', () => ({
  cleanupService: {
    cleanupExpiredChannels: vi.fn(),
    cleanupExpiredKeys: vi.fn(),
  },
}));

describe('Cron API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockCronRequest = (url: string) => {
    return new NextRequest(url, {
      headers: {
        'Authorization': 'Bearer cron-secret-token',
      },
    });
  };

  describe('GET /api/cron/cleanup-channels', () => {
    it('应该成功清理过期频道', async () => {
      const mockResult = { 
        success: true, 
        deleted: 5,
        channels: ['ch_1', 'ch_2', 'ch_3']
      };

      vi.mocked(cleanupService.cleanupExpiredChannels).mockResolvedValueOnce(mockResult);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(5);

      expect(cleanupService.cleanupExpiredChannels).toHaveBeenCalled();
    });

    it('应该处理没有频道的情况', async () => {
      const mockResult = { success: true, deleted: 0, channels: [] };

      vi.mocked(cleanupService.cleanupExpiredChannels).mockResolvedValueOnce(mockResult);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.deleted).toBe(0);
    });

    it('应该拒绝未认证的请求', async () => {
      const { validateCronAuth } = await import('@/src/lib/middleware/api-key');
      vi.mocked(validateCronAuth).mockResolvedValueOnce(
        new Error('Cron authentication failed')
      );

      const request = new NextRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request);

      expect(response.status).toBe(401);
    });

    it('应该处理清理错误', async () => {
      const mockError = { success: false, error: 'Database error' };

      vi.mocked(cleanupService.cleanupExpiredChannels).mockResolvedValueOnce(mockError);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-channels');
      const response = await cleanupChannels(request);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/cron/cleanup-keys', () => {
    it('应该成功清理过期密钥', async () => {
      const mockResult = { 
        success: true, 
        deleted: 10,
        keys: ['pk_1', 'pk_2']
      };

      vi.mocked(cleanupService.cleanupExpiredKeys).mockResolvedValueOnce(mockResult);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(10);

      expect(cleanupService.cleanupExpiredKeys).toHaveBeenCalled();
    });

    it('应该处理没有密钥的情况', async () => {
      const mockResult = { success: true, deleted: 0, keys: [] };

      vi.mocked(cleanupService.cleanupExpiredKeys).mockResolvedValueOnce(mockResult);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.deleted).toBe(0);
    });

    it('应该拒绝未认证的请求', async () => {
      const { validateCronAuth } = await import('@/src/lib/middleware/api-key');
      vi.mocked(validateCronAuth).mockResolvedValueOnce(new Error('Auth failed'));

      const request = new NextRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request);

      expect(response.status).toBe(401);
    });

    it('应该处理撤销中的密钥', async () => {
      const mockResult = { 
        success: true, 
        deleted: 3,
        revokedPending: 2,
        keys: ['pk_1']
      };

      vi.mocked(cleanupService.cleanupExpiredKeys).mockResolvedValueOnce(mockResult);

      const request = createMockCronRequest('http://localhost:3000/api/cron/cleanup-keys');
      const response = await cleanupKeys(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.revokedPending).toBe(2);
    });
  });
});

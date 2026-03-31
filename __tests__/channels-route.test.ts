// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { channelService } from '@/src/lib/services';
import { POST, GET } from '@/app/api/channels/route';

vi.mock('@/src/lib/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/src/lib/middleware/api-key', () => ({
  requireApiKey: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/src/lib/services', () => ({
  channelService: {
    create: vi.fn(),
    query: vi.fn(),
  },
}));

describe('/api/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockRequest = (bodyOrParams: any, method: string = 'POST', headers: Record<string, string> = {}) => {
    const url = method === 'POST' 
      ? 'http://localhost:3000/api/channels'
      : `http://localhost:3000/api/channels?${new URLSearchParams(bodyOrParams).toString()}`;
    
    return new NextRequest(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: method === 'POST' ? JSON.stringify(bodyOrParams) : undefined,
    });
  };

  describe('POST /api/channels - 创建频道', () => {
    it('应该成功创建公共频道', async () => {
      const mockBody = { name: 'Test Channel', type: 'public' };
      const mockResult = { 
        success: true, 
        channel: { id: 'ch_123', name: 'Test Channel', type: 'public' } 
      };

      vi.mocked(channelService.create).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('ch_123');
    });

    it('应该成功创建加密频道', async () => {
      const mockBody = { type: 'encrypted' };
      const mockResult = { success: true, channel: { type: 'encrypted' } };

      vi.mocked(channelService.create).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      await POST(request);

      expect(channelService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'encrypted' }),
        expect.any(Object)
      );
    });

    it('应该成功创建临时频道', async () => {
      const mockBody = { type: 'temporary', expiresIn: 3600 };
      const mockResult = { success: true };

      vi.mocked(channelService.create).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('应该拒绝超过最大有效期的请求', async () => {
      const mockBody = { expiresIn: 30 * 24 * 60 * 60 + 1 };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该拒绝频道名称过长的请求', async () => {
      const mockBody = { name: 'a'.repeat(256) };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该处理频道已存在的错误', async () => {
      const mockError = { success: false, code: 'CHANNEL_EXISTS', error: '频道已存在' };

      vi.mocked(channelService.create).mockResolvedValueOnce(mockError);

      const request = createMockRequest({ name: 'Existing Channel' });
      const response = await POST(request);

      expect(response.status).toBe(409);
    });

    it('应该拒绝缺少认证的请求', async () => {
      const { requireApiKey } = await import('@/src/lib/middleware/api-key');
      vi.mocked(requireApiKey).mockResolvedValueOnce(new Error('认证失败'));

      const request = createMockRequest({ name: 'Test' });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/channels - 查询频道', () => {
    it('应该通过 ID 查询频道', async () => {
      const mockResult = { 
        success: true, 
        data: [{ id: 'ch_123', name: 'Test' }] 
      };

      vi.mocked(channelService.query).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ id: 'ch_123' }, 'GET');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(1);
    });

    it('应该按类型查询频道', async () => {
      const mockResult = { success: true, data: [] };

      vi.mocked(channelService.query).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ type: 'public' }, 'GET');
      await GET(request);

      expect(channelService.query).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public' })
      );
    });

    it('应该支持分页查询', async () => {
      const mockResult = { 
        success: true, 
        data: [],
        pagination: { limit: 10, offset: 0, total: 0 }
      };

      vi.mocked(channelService.query).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ limit: '10', offset: '20' }, 'GET');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pagination).toBeDefined();
    });

    it('应该处理频道不存在的情况', async () => {
      const mockError = { success: false, code: 'NOT_FOUND' };

      vi.mocked(channelService.query).mockResolvedValueOnce(mockError);

      const request = createMockRequest({ id: 'nonexistent' }, 'GET');
      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it('应该按创建者查询', async () => {
      const mockResult = { success: true, data: [] };

      vi.mocked(channelService.query).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ creator: 'user123' }, 'GET');
      await GET(request);

      expect(channelService.query).toHaveBeenCalledWith(
        expect.objectContaining({ creator: 'user123' })
      );
    });
  });
});

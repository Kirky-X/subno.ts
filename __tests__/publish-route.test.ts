// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { publishService } from '@/src/lib/services';
import { POST, GET } from '@/app/api/publish/route';

vi.mock('@/src/lib/middleware/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock('@/src/lib/middleware/api-key', () => ({ requireApiKey: vi.fn().mockResolvedValue(null) }));
vi.mock('@/src/lib/services', () => ({
  publishService: {
    publish: vi.fn(),
    getQueueStatus: vi.fn(),
  },
}));

describe('/api/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (bodyOrParams: any, method: string = 'POST') => {
    const url = method === 'POST'
      ? 'http://localhost:3000/api/publish'
      : `http://localhost:3000/api/publish?${new URLSearchParams(bodyOrParams).toString()}`;
    
    return new NextRequest(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(bodyOrParams) : undefined,
    });
  };

  describe('POST /api/publish - 发布消息', () => {
    it('应该成功发布消息', async () => {
      const mockBody = { channelId: 'ch_123', message: 'test' };
      const mockResult = { success: true, messageId: 'msg_456' };

      vi.mocked(publishService.publish).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('应该拒绝缺少 channel 的请求', async () => {
      const mockBody = { message: 'test' };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该拒绝缺少消息内容的请求', async () => {
      const mockBody = { channelId: 'ch_123' };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该处理频道不存在的错误', async () => {
      const mockError = { success: false, code: 'CHANNEL_NOT_FOUND' };

      vi.mocked(publishService.publish).mockResolvedValueOnce(mockError);

      const request = createMockRequest({ channelId: 'nonexistent', message: 'test' });
      const response = await POST(request);

      expect(response.status).toBe(404);
    });

    it('应该支持加密消息', async () => {
      const mockBody = { channelId: 'ch_123', message: 'encrypted', encrypted: true };
      const mockResult = { success: true };

      vi.mocked(publishService.publish).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/publish - 查询队列状态', () => {
    it('应该返回队列状态', async () => {
      const mockResult = { 
        success: true, 
        data: { pending: 10, processing: 2, failed: 0 } 
      };

      vi.mocked(publishService.getQueueStatus).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({}, 'GET');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.pending).toBe(10);
    });

    it('应该支持按频道查询队列', async () => {
      const mockResult = { success: true, data: { pending: 5 } };

      vi.mocked(publishService.getQueueStatus).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ channelId: 'ch_123' }, 'GET');
      await GET(request);

      expect(publishService.getQueueStatus).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'ch_123' })
      );
    });
  });
});

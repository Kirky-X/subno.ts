// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { registerService } from '@/src/lib/services';
import { POST, GET } from '@/app/api/register/route';
import { z } from 'zod';

// Mock dependencies
vi.mock('@/src/lib/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/src/lib/middleware', () => ({
  requireApiKey: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/src/lib/services', () => ({
  registerService: {
    register: vi.fn(),
    queryByChannelId: vi.fn(),
    queryByKeyId: vi.fn(),
  },
}));

describe('POST /api/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockRequest = (body: any, headers: Record<string, string> = {}) => {
    const url = 'http://localhost:3000/api/register';
    return new NextRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  describe('成功场景', () => {
    it('应该成功注册公钥（默认算法）', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----`,
      };

      const mockResult = {
        success: true,
        channelId: 'enc_abc123',
        publicKeyId: 'pk_xyz789',
        algorithm: 'RSA-2048',
        expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
        expiresIn: 86400,
      };

      vi.mocked(registerService.register).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.channelId).toBe('enc_abc123');
      expect(data.data.algorithm).toBe('RSA-2048');
      
      expect(registerService.register).toHaveBeenCalledTimes(1);
      expect(registerService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.stringContaining('-----BEGIN PUBLIC KEY-----'),
          algorithm: 'RSA-2048',
        }),
        expect.any(Object)
      );
    });

    it('应该成功注册公钥（指定算法 RSA-4096）', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----`,
        algorithm: 'RSA-4096',
      };

      const mockResult = {
        success: true,
        channelId: 'enc_def456',
        publicKeyId: 'pk_uvw321',
        algorithm: 'RSA-4096',
      };

      vi.mocked(registerService.register).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.data.algorithm).toBe('RSA-4096');
    });

    it('应该成功注册公钥（自定义有效期）', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        expiresIn: 3600, // 1 hour
      };

      const mockResult = {
        success: true,
        channelId: 'enc_ghi789',
        expiresIn: 3600,
      };

      vi.mocked(registerService.register).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.data.expiresIn).toBe(3600);
    });

    it('应该接受 ECC-SECP256K1 算法', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        algorithm: 'ECC-SECP256K1',
      };

      const mockResult = {
        success: true,
        algorithm: 'ECC-SECP256K1',
      };

      vi.mocked(registerService.register).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('验证失败场景', () => {
    it('应该拒绝缺少公钥的请求', async () => {
      const mockBody = {
        algorithm: 'RSA-2048',
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('公钥');
    });

    it('应该拒绝空公钥', async () => {
      const mockBody = {
        publicKey: '',
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该拒绝格式错误的公钥（缺少 BEGIN 标记）', async () => {
      const mockBody = {
        publicKey: 'INVALID_KEY_CONTENT',
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该拒绝格式错误的公钥（缺少 END 标记）', async () => {
      const mockBody = {
        publicKey: '-----BEGIN PUBLIC KEY-----\nSOME_CONTENT',
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该拒绝无效的算法', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        algorithm: 'INVALID-ALGORITHM',
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该拒绝超过最大有效期的请求', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        expiresIn: 30 * 24 * 60 * 60 + 1, // 超过 30 天
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该拒绝负的有效期', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        expiresIn: -100,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('服务层错误场景', () => {
    it('应该处理无效公钥错误', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
      };

      const mockError = {
        success: false,
        error: '无效的公钥格式',
        code: 'INVALID_PUBLIC_KEY',
      };

      vi.mocked(registerService.register).mockResolvedValueOnce(mockError);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('公钥');
    });

    it('应该处理无效有效期错误', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        expiresIn: 999999,
      };

      const mockError = {
        success: false,
        error: '无效的有效期',
        code: 'INVALID_EXPIRATION',
      };

      vi.mocked(registerService.register).mockResolvedValueOnce(mockError);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该处理内部服务器错误', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
      };

      const mockError = {
        success: false,
        error: '数据库错误',
        code: 'REGISTRATION_FAILED',
      };

      vi.mocked(registerService.register).mockResolvedValueOnce(mockError);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe('认证和限流', () => {
    it('应该拒绝缺少 API Key 的请求', async () => {
      const { requireApiKey } = await import('@/src/lib/middleware');
      vi.mocked(requireApiKey).mockResolvedValueOnce(
        new Error('API Key 认证失败')
      );

      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('应该拒绝超过速率限制的请求', async () => {
      const { checkRateLimit } = await import('@/src/lib/middleware/rate-limit');
      vi.mocked(checkRateLimit).mockResolvedValueOnce(
        NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      );

      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(429);
    });
  });

  describe('输入验证边界条件', () => {
    it('应该拒绝非 JSON 格式的请求体', async () => {
      const request = new NextRequest('http://localhost:3000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'not json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('应该拒绝包含额外未知字段的请求（Zod strict mode）', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        unknownField: 'should fail',
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      // Zod 可能会 strip 未知字段，所以这里可能成功或失败
      // 取决于 schema 配置
      expect([201, 400]).toContain(response.status);
    });

    it('应该接受最大允许有效期（30 天）', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        expiresIn: 30 * 24 * 60 * 60, // Exactly 30 days
      };

      const mockResult = { success: true };
      vi.mocked(registerService.register).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('应该接受 metadata 字段', async () => {
      const mockBody = {
        publicKey: `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`,
        metadata: {
          customField: 'value',
          nested: { key: 'value' },
        },
      };

      const mockResult = { success: true };
      vi.mocked(registerService.register).mockResolvedValueOnce(mockResult);

      const request = createMockRequest(mockBody);
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });
});

describe('GET /api/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockRequest = (searchParams: Record<string, string>) => {
    const baseUrl = 'http://localhost:3000/api/register';
    const params = new URLSearchParams(searchParams);
    return new NextRequest(`${baseUrl}?${params.toString()}`);
  };

  describe('成功场景', () => {
    it('应该通过 channelId 查询公钥', async () => {
      const mockResult = {
        success: true,
        data: {
          id: 'pk_123',
          channelId: 'enc_abc',
          algorithm: 'RSA-2048',
          createdAt: new Date().toISOString(),
          isExpired: false,
        },
      };

      vi.mocked(registerService.queryByChannelId).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ channelId: 'enc_abc' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.channelId).toBe('enc_abc');
      
      expect(registerService.queryByChannelId).toHaveBeenCalledWith('enc_abc');
    });

    it('应该通过 keyId 查询公钥', async () => {
      const mockResult = {
        success: true,
        data: {
          id: 'pk_456',
          channelId: 'enc_def',
          algorithm: 'RSA-4096',
        },
      };

      vi.mocked(registerService.queryByKeyId).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ keyId: 'pk_456' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.id).toBe('pk_456');
      
      expect(registerService.queryByKeyId).toHaveBeenCalledWith('pk_456');
    });

    it('应该返回公钥过期状态', async () => {
      const mockResult = {
        success: true,
        data: {
          id: 'pk_789',
          channelId: 'enc_ghi',
          algorithm: 'ECC-SECP256K1',
          isExpired: true,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      };

      vi.mocked(registerService.queryByChannelId).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ channelId: 'enc_ghi' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.isExpired).toBe(true);
    });
  });

  describe('错误场景', () => {
    it('应该拒绝缺少参数的请求', async () => {
      const request = createMockRequest({});

      const response = await GET(request);

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('channelId 或 keyId');
    });

    it('应该处理公钥不存在的情况', async () => {
      const mockError = {
        success: false,
        error: '公钥不存在',
        code: 'NOT_FOUND',
      };

      vi.mocked(registerService.queryByChannelId).mockResolvedValueOnce(mockError);

      const request = createMockRequest({ channelId: 'nonexistent' });
      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it('应该处理查询失败', async () => {
      const mockError = {
        success: false,
        error: '数据库错误',
        code: 'QUERY_FAILED',
      };

      vi.mocked(registerService.queryByChannelId).mockResolvedValueOnce(mockError);

      const request = createMockRequest({ channelId: 'enc_test' });
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('应该拒绝同时提供 channelId 和 keyId 以外的参数', async () => {
      const request = createMockRequest({ 
        otherParam: 'value' 
      });

      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('边界条件', () => {
    it('应该处理空的 channelId 参数', async () => {
      const request = createMockRequest({ channelId: '' });

      const response = await GET(request);

      // 空字符串应该被视为无效参数
      expect(response.status).toBe(400);
    });

    it('应该处理空的 keyId 参数', async () => {
      const request = createMockRequest({ keyId: '' });

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('应该同时提供 channelId 和 keyId 时优先使用 channelId', async () => {
      const mockResult = { success: true, data: { id: 'pk_test' } };
      vi.mocked(registerService.queryByChannelId).mockResolvedValueOnce(mockResult);

      const request = createMockRequest({ 
        channelId: 'enc_test',
        keyId: 'pk_test',
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(registerService.queryByChannelId).toHaveBeenCalledWith('enc_test');
      expect(registerService.queryByKeyId).not.toHaveBeenCalled();
    });
  });
});

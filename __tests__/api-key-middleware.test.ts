// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requireApiKey } from '@/src/lib/middleware/api-key';
import { validateCronAuth } from '@/src/lib/middleware/api-key';
import { NextRequest } from 'next/server';

describe('API Key Middleware', () => {
  const createMockRequest = (headers: Record<string, string> = {}) => {
    return new NextRequest('http://localhost:3000/api/test', {
      headers: {
        ...headers,
      },
    });
  };

  describe('requireApiKey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该允许有效的 API Key', async () => {
      process.env.API_KEY = 'test-api-key';

      const request = createMockRequest({
        'x-api-key': 'test-api-key',
      });

      const result = await requireApiKey(request);

      expect(result).toBeNull(); // 允许通过
    });

    it('应该拒绝缺少 API Key 的请求', async () => {
      process.env.API_KEY = 'test-api-key';

      const request = createMockRequest({});

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝无效的 API Key', async () => {
      process.env.API_KEY = 'test-api-key';

      const request = createMockRequest({
        'x-api-key': 'wrong-key',
      });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该接受备用 header 名称', async () => {
      process.env.API_KEY = 'test-api-key';

      const request = createMockRequest({
        'authorization': 'Bearer test-api-key',
      });

      const result = await requireApiKey(request);

      expect(result).toBeNull();
    });

    it('应该处理空的 API Key header', async () => {
      process.env.API_KEY = 'test-api-key';

      const request = createMockRequest({
        'x-api-key': '',
      });

      const result = await requireApiKey(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该忽略大小写', async () => {
      process.env.API_KEY = 'Test-Key';

      const request = createMockRequest({
        'x-api-key': 'test-key',
      });

      const result = await requireApiKey(request);

      expect(result).toBeNull();
    });
  });

  describe('validateCronAuth', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv, CRON_SECRET: 'cron-secret' };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('应该允许有效的 Cron 认证', async () => {
      const request = createMockRequest({
        'authorization': 'Bearer cron-secret',
      });

      const result = await validateCronAuth(request);

      expect(result).toBeNull();
    });

    it('应该拒绝缺少认证的请求', async () => {
      const request = createMockRequest({});

      const result = await validateCronAuth(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝无效的 Cron Token', async () => {
      const request = createMockRequest({
        'authorization': 'Bearer wrong-token',
      });

      const result = await validateCronAuth(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该拒绝 Basic Auth 格式', async () => {
      const request = createMockRequest({
        'authorization': 'Basic d3Jvbmc=',
      });

      const result = await validateCronAuth(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('应该处理空的 Authorization header', async () => {
      const request = createMockRequest({
        'authorization': '',
      });

      const result = await validateCronAuth(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });
  });
});

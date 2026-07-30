// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateErrorId,
  createError,
  createErrorResponse,
  handleError,
  withErrorHandling,
  ERROR_CODES,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  rateLimitError,
  internalError,
} from '@/src/lib/utils/error.utils';

describe('error.utils', () => {
  describe('generateErrorId', () => {
    it('应该生成 8 字符的 ID', () => {
      const id = generateErrorId();
      expect(id).toHaveLength(8);
    });

    it('应该每次生成不同的 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateErrorId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('createError', () => {
    it('应该使用默认 severity 创建错误', () => {
      const err = createError('test message', 'TEST_CODE');
      expect(err.message).toBe('test message');
      expect(err.code).toBe('TEST_CODE');
      expect(err.severity).toBe('medium');
      expect(err.id).toHaveLength(8);
      expect(err.timestamp).toBeInstanceOf(Date);
    });

    it('应该接受自定义 severity', () => {
      const err = createError('msg', 'CODE', 'critical');
      expect(err.severity).toBe('critical');
    });

    it('应该接受 originalError', () => {
      const original = new Error('original');
      const err = createError('msg', 'CODE', 'medium', original);
      expect(err.originalError).toBe(original);
    });

    it('应该接受 metadata', () => {
      const err = createError('msg', 'CODE', 'medium', undefined, { key: 'value', count: 42 });
      expect(err.metadata).toEqual({ key: 'value', count: 42 });
    });

    it('应该对所有 severity 级别工作', () => {
      for (const severity of ['low', 'medium', 'high', 'critical'] as const) {
        const err = createError('msg', 'CODE', severity);
        expect(err.severity).toBe(severity);
      }
    });
  });

  describe('createErrorResponse', () => {
    it('应该在非生产环境且 includeDetails=true 时显示消息', () => {
      const err = createError('detailed message', 'CODE');
      const response = createErrorResponse(err, true);
      expect(response.success).toBe(false);
      expect(response.error.message).toBe('detailed message');
      expect(response.error.code).toBe('CODE');
      expect(response.error.errorId).toBe(err.id);
      expect(response.error.timestamp).toBe(err.timestamp.toISOString());
    });

    it('应该在非生产环境且 includeDetails=false 时隐藏消息', () => {
      const err = createError('detailed message', 'CODE');
      const response = createErrorResponse(err, false);
      expect(response.error.message).toBe('An unexpected error occurred');
    });

    it('应该默认隐藏消息（includeDetails 默认 false）', () => {
      const err = createError('detailed message', 'CODE');
      const response = createErrorResponse(err);
      expect(response.error.message).toBe('An unexpected error occurred');
    });

    it('应该在生产环境即使 includeDetails=false 也隐藏消息', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      try {
        const err = createError('detailed message', 'CODE');
        const response = createErrorResponse(err, false);
        expect(response.error.message).toBe('An unexpected error occurred');
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      }
    });

    it('应该在生产环境 includeDetails=true 时仍显示消息', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      try {
        const err = createError('detailed message', 'CODE');
        const response = createErrorResponse(err, true);
        expect(response.error.message).toBe('detailed message');
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      }
    });
  });

  describe('handleError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('应该处理 Error 实例并提取 message', () => {
      const original = new Error('boom');
      const err = handleError(original, 'CODE', 'medium');
      expect(err.message).toBe('boom');
      expect(err.originalError).toBe(original);
      expect(err.code).toBe('CODE');
      expect(err.metadata).toEqual({ path: undefined, method: undefined });
    });

    it('应该处理非 Error 值并使用 Unknown error', () => {
      const err = handleError('string error', 'CODE', 'medium');
      expect(err.message).toBe('Unknown error');
      expect(err.originalError).toBe('string error');
    });

    it('应该处理 null/undefined 错误', () => {
      const err = handleError(null, 'CODE', 'medium');
      expect(err.message).toBe('Unknown error');
    });

    it('应该在 critical 级别使用 console.error', () => {
      handleError(new Error('critical'), 'CODE', 'critical');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[CRITICAL]', expect.any(String));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('应该在 high 级别使用 console.error', () => {
      handleError(new Error('high'), 'CODE', 'high');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[HIGH]', expect.any(String));
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('应该在 medium/low 级别使用 console.warn', () => {
      handleError(new Error('medium'), 'CODE', 'medium');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[ERROR]', expect.any(String));
    });

    it('应该传递 path 和 method 到 metadata', () => {
      const err = handleError(new Error('x'), 'CODE', 'medium', '/api/test', 'POST');
      expect(err.metadata).toEqual({ path: '/api/test', method: 'POST' });
    });

    it('应该使用默认 severity', () => {
      const err = handleError(new Error('x'), 'CODE');
      expect(err.severity).toBe('medium');
    });
  });

  describe('withErrorHandling', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('应该在成功时返回 handler 的结果', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      const wrapped = withErrorHandling(handler);
      const result = await wrapped('arg');
      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledWith('arg');
    });

    it('应该在失败时记录错误并重新抛出', async () => {
      const error = new Error('handler failed');
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = withErrorHandling(handler);
      await expect(wrapped()).rejects.toThrow('handler failed');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('应该使用默认 code 和 severity', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('x'));
      const wrapped = withErrorHandling(handler);
      await expect(wrapped()).rejects.toThrow();
    });

    it('应该接受自定义 code 和 severity', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('x'));
      const wrapped = withErrorHandling(handler, 'CUSTOM_CODE', 'critical');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(wrapped()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[CRITICAL]', expect.any(String));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('ERROR_CODES', () => {
    it('应该包含所有预定义错误码', () => {
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ERROR_CODES.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(ERROR_CODES.CONFLICT).toBe('CONFLICT');
      expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ERROR_CODES.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ERROR_CODES.EXTERNAL_SERVICE_ERROR).toBe('EXTERNAL_SERVICE_ERROR');
      expect(ERROR_CODES.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    });
  });

  describe('validationError', () => {
    it('应该创建验证错误', () => {
      const err = validationError('invalid input');
      expect(err.message).toBe('invalid input');
      expect(err.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(err.severity).toBe('medium');
    });

    it('应该接受 metadata', () => {
      const err = validationError('invalid', { field: 'email' });
      expect(err.metadata).toEqual({ field: 'email' });
    });
  });

  describe('notFoundError', () => {
    it('应该创建未找到错误', () => {
      const err = notFoundError('User', '123');
      expect(err.message).toBe('User not found');
      expect(err.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(err.severity).toBe('low');
      expect(err.metadata).toEqual({ resource: 'User', id: '123' });
    });

    it('应该不传 id 也能工作', () => {
      const err = notFoundError('Channel');
      expect(err.metadata).toEqual({ resource: 'Channel', id: undefined });
    });
  });

  describe('unauthorizedError', () => {
    it('应该使用默认消息', () => {
      const err = unauthorizedError();
      expect(err.message).toBe('Authentication required');
      expect(err.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('应该接受自定义消息', () => {
      const err = unauthorizedError('Token expired');
      expect(err.message).toBe('Token expired');
    });
  });

  describe('forbiddenError', () => {
    it('应该使用默认消息', () => {
      const err = forbiddenError();
      expect(err.message).toBe('Access denied');
      expect(err.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('应该接受自定义消息', () => {
      const err = forbiddenError('No permission');
      expect(err.message).toBe('No permission');
    });
  });

  describe('rateLimitError', () => {
    it('应该创建速率限制错误', () => {
      const err = rateLimitError();
      expect(err.message).toBe('Rate limit exceeded');
      expect(err.code).toBe(ERROR_CODES.RATE_LIMITED);
      expect(err.metadata).toEqual({ retryAfter: undefined });
    });

    it('应该接受 retryAfter', () => {
      const err = rateLimitError(60);
      expect(err.metadata).toEqual({ retryAfter: 60 });
    });
  });

  describe('internalError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('应该创建内部错误（带原始错误）', () => {
      const original = new Error('db down');
      const err = internalError(original);
      expect(err.message).toBe('db down');
      expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(err.severity).toBe('high');
      expect(err.originalError).toBe(original);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[HIGH]', expect.any(String));
    });

    it('应该在无原始错误时使用默认消息', () => {
      const err = internalError();
      expect(err.message).toBe('Internal server error');
    });
  });
});

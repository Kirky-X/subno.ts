// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ResourceError,
  RateLimitError,
  ServerError,
  ErrorHandler,
  errorHandler,
  withErrorHandler,
  successResponse,
  errorResponse,
  Errors,
  isRetryableError,
  isClientError,
  isServerError,
  extractRequestContext,
  generateRequestId,
  ErrorCode,
  HTTP_STATUS_MAP,
} from '@/src/lib/utils/error-handler';

describe('error-handler', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * 创建模拟 NextRequest
   */
  function createMockRequest(
    url = 'http://localhost:3000/api/test',
    headers: Record<string, string> = {},
    method = 'GET',
  ): NextRequest {
    return new NextRequest(url, { method, headers });
  }

  // ==========================================================================
  // ErrorCode 枚举
  // ==========================================================================
  describe('ErrorCode', () => {
    it('应该包含所有认证错误码', () => {
      expect(ErrorCode.MISSING_API_KEY).toBe('MISSING_API_KEY');
      expect(ErrorCode.INVALID_API_KEY).toBe('INVALID_API_KEY');
      expect(ErrorCode.INACTIVE_API_KEY).toBe('INACTIVE_API_KEY');
      expect(ErrorCode.REVOKED_API_KEY).toBe('REVOKED_API_KEY');
      expect(ErrorCode.EXPIRED_API_KEY).toBe('EXPIRED_API_KEY');
      expect(ErrorCode.AUTH_FAILED).toBe('AUTH_FAILED');
      expect(ErrorCode.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
      expect(ErrorCode.INVALID_ADMIN_KEY).toBe('INVALID_ADMIN_KEY');
    });

    it('应该包含所有授权错误码', () => {
      expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCode.INSUFFICIENT_PERMISSIONS).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('应该包含所有服务器错误码', () => {
      expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCode.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorCode.UNKNOWN).toBe('UNKNOWN');
    });
  });

  // ==========================================================================
  // HTTP_STATUS_MAP
  // ==========================================================================
  describe('HTTP_STATUS_MAP', () => {
    it('应该将认证错误映射到 401', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.MISSING_API_KEY]).toBe(401);
      expect(HTTP_STATUS_MAP[ErrorCode.INVALID_API_KEY]).toBe(401);
      expect(HTTP_STATUS_MAP[ErrorCode.AUTH_FAILED]).toBe(401);
    });

    it('应该将授权错误映射到 403', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.FORBIDDEN]).toBe(403);
      expect(HTTP_STATUS_MAP[ErrorCode.INSUFFICIENT_PERMISSIONS]).toBe(403);
    });

    it('应该将验证错误映射到 400', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.VALIDATION_ERROR]).toBe(400);
      expect(HTTP_STATUS_MAP[ErrorCode.INVALID_PARAMETER]).toBe(400);
      expect(HTTP_STATUS_MAP[ErrorCode.MISSING_PARAMETER]).toBe(400);
    });

    it('应该将 NOT_FOUND 映射到 404', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.NOT_FOUND]).toBe(404);
    });

    it('应该将 CONFLICT 映射到 409', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.CONFLICT]).toBe(409);
      expect(HTTP_STATUS_MAP[ErrorCode.ALREADY_EXISTS]).toBe(409);
    });

    it('应该将 KEY_EXPIRED 映射到 410', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.KEY_EXPIRED]).toBe(410);
    });

    it('应该将 RATE_LIMIT_EXCEEDED 映射到 429', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.RATE_LIMIT_EXCEEDED]).toBe(429);
    });

    it('应该将服务器错误映射到 5xx', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.INTERNAL_ERROR]).toBe(500);
      expect(HTTP_STATUS_MAP[ErrorCode.BAD_GATEWAY]).toBe(502);
      expect(HTTP_STATUS_MAP[ErrorCode.SERVICE_UNAVAILABLE]).toBe(503);
      expect(HTTP_STATUS_MAP[ErrorCode.GATEWAY_TIMEOUT]).toBe(504);
    });

    it('应该将 LOCKED 映射到 423', () => {
      expect(HTTP_STATUS_MAP[ErrorCode.LOCKED]).toBe(423);
    });
  });

  // ==========================================================================
  // extractRequestContext
  // ==========================================================================
  describe('extractRequestContext', () => {
    it('应该从 x-request-id header 提取 requestId', () => {
      const request = createMockRequest(undefined, {
        'x-request-id': 'req-123',
      });
      const ctx = extractRequestContext(request);
      expect(ctx.requestId).toBe('req-123');
    });

    it('应该从 x-correlation-id header 提取 requestId（fallback）', () => {
      const request = createMockRequest(undefined, {
        'x-correlation-id': 'corr-456',
      });
      const ctx = extractRequestContext(request);
      expect(ctx.requestId).toBe('corr-456');
    });

    it('应该在无 request-id header 时生成新 ID', () => {
      const request = createMockRequest();
      const ctx = extractRequestContext(request);
      expect(ctx.requestId).toHaveLength(8); // crypto.randomUUID().substring(0, 8)
    });

    it('应该提取 path、method、clientIP、userAgent', () => {
      const request = createMockRequest(
        'http://localhost:3000/api/users',
        {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
          'user-agent': 'TestAgent/1.0',
        },
        'POST',
      );
      const ctx = extractRequestContext(request);
      expect(ctx.path).toBe('/api/users');
      expect(ctx.method).toBe('POST');
      expect(ctx.clientIP).toBe('1.2.3.4'); // split(',')[0].trim()
      expect(ctx.userAgent).toBe('TestAgent/1.0');
    });

    it('应该使用 x-real-ip 作为 clientIP fallback', () => {
      const request = createMockRequest(undefined, {
        'x-real-ip': '9.8.7.6',
      });
      const ctx = extractRequestContext(request);
      expect(ctx.clientIP).toBe('9.8.7.6');
    });

    it('应该在无 IP header 时返回 unknown', () => {
      const request = createMockRequest();
      const ctx = extractRequestContext(request);
      expect(ctx.clientIP).toBe('unknown');
      expect(ctx.userAgent).toBe('unknown');
    });

    it('应该优先使用 x-request-id 而非 x-correlation-id', () => {
      const request = createMockRequest(undefined, {
        'x-request-id': 'from-request-id',
        'x-correlation-id': 'from-correlation',
      });
      const ctx = extractRequestContext(request);
      expect(ctx.requestId).toBe('from-request-id');
    });
  });

  // ==========================================================================
  // generateRequestId
  // ==========================================================================
  describe('generateRequestId', () => {
    it('应该生成 8 字符的 ID', () => {
      const id = generateRequestId();
      expect(id).toHaveLength(8);
    });

    it('应该每次生成不同的 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });
  });

  // ==========================================================================
  // AppError
  // ==========================================================================
  describe('AppError', () => {
    it('应该使用默认消息构造（USER_FRIENDLY_MESSAGES）', () => {
      const err = new AppError(ErrorCode.NOT_FOUND);
      expect(err.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.message).toBe('请求的资源不存在');
      expect(err.status).toBe(404);
      expect(err.severity).toBe('low');
      expect(err.name).toBe('AppError');
      expect(err.timestamp).toBeInstanceOf(Date);
    });

    it('应该接受自定义消息', () => {
      const err = new AppError(ErrorCode.NOT_FOUND, '自定义消息');
      expect(err.message).toBe('自定义消息');
    });

    it('应该接受 options（details、originalError、severity、requestId）', () => {
      const original = new Error('original');
      const err = new AppError(ErrorCode.INTERNAL_ERROR, 'msg', {
        details: { key: 'value' },
        originalError: original,
        severity: 'critical',
        requestId: 'req-1',
      });
      expect(err.details).toEqual({ key: 'value' });
      expect(err.originalError).toBe(original);
      expect(err.severity).toBe('critical');
      expect(err.requestId).toBe('req-1');
    });

    it('应该使用默认 severity 当未提供时', () => {
      const err = new AppError(ErrorCode.ENCRYPTION_ERROR);
      expect(err.severity).toBe('critical'); // DEFAULT_SEVERITY_MAP
    });

    it('getUserMessage 应该返回用户友好消息', () => {
      const err = new AppError(ErrorCode.NOT_FOUND, '内部消息');
      expect(err.getUserMessage()).toBe('请求的资源不存在');
    });

    it('toErrorResponse 应该返回标准错误响应格式', () => {
      const err = new AppError(ErrorCode.NOT_FOUND, 'msg', {
        requestId: 'req-1',
      });
      const response = err.toErrorResponse();
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(response.error.message).toBe('请求的资源不存在');
      expect(response.error.requestId).toBe('req-1');
      expect(response.error.timestamp).toBe(err.timestamp.toISOString());
    });

    it('toErrorResponse 应该使用传入的 requestId 覆盖', () => {
      const err = new AppError(ErrorCode.NOT_FOUND, 'msg', {
        requestId: 'original',
      });
      const response = err.toErrorResponse('override-id');
      expect(response.error.requestId).toBe('override-id');
    });

    it('toErrorResponse 应该在 requestId 缺失时生成新 ID', () => {
      const err = new AppError(ErrorCode.NOT_FOUND);
      const response = err.toErrorResponse();
      expect(response.error.requestId).toHaveLength(8);
    });

    it('toErrorResponse 在非生产环境对安全错误码包含 details', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      const err = new ValidationError('msg', {
        details: { field: 'email' },
      });
      const response = err.toErrorResponse();
      expect(response.error.details).toEqual({ field: 'email' });
    });

    it('toErrorResponse 在非生产环境对非安全错误码不包含 details', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      const err = new AppError(ErrorCode.NOT_FOUND, 'msg', {
        details: { secret: 'data' },
      });
      const response = err.toErrorResponse();
      expect(response.error.details).toBeUndefined();
    });

    it('toErrorResponse 在生产环境不包含 details', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      const err = new ValidationError('msg', {
        details: { field: 'email' },
      });
      const response = err.toErrorResponse();
      expect(response.error.details).toBeUndefined();
    });

    it('toErrorResponse 在无 details 时不包含 details 字段', () => {
      const err = new ValidationError('msg');
      const response = err.toErrorResponse();
      expect(response.error.details).toBeUndefined();
    });

    it('toNextResponse 应该返回 NextResponse', () => {
      const err = new AppError(ErrorCode.NOT_FOUND);
      const response = err.toNextResponse();
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(404);
    });

    it('toLogFormat 应该返回日志格式对象', () => {
      const original = new Error('orig');
      const err = new AppError(ErrorCode.DATABASE_ERROR, 'db failed', {
        details: { table: 'users' },
        originalError: original,
        requestId: 'req-log',
        severity: 'high',
      });
      const log = err.toLogFormat({
        path: '/api/test',
        method: 'POST',
        clientIP: '1.1.1.1',
        userId: 'user-1',
        apiKeyId: 'key-1',
      });
      expect(log.errorCode).toBe(ErrorCode.DATABASE_ERROR);
      expect(log.errorMessage).toBe('db failed');
      expect(log.errorStatus).toBe(500);
      expect(log.severity).toBe('high');
      expect(log.path).toBe('/api/test');
      expect(log.method).toBe('POST');
      expect(log.clientIP).toBe('1.1.1.1');
      expect(log.userId).toBe('user-1');
      expect(log.apiKeyId).toBe('key-1');
      expect(log.details).toEqual({ table: 'users' });
      expect(log.originalError).toBe('orig');
      expect(log.stack).toBeDefined();
    });

    it('toLogFormat 应该使用 error 自身的 requestId 当 context 无 requestId', () => {
      const err = new AppError(ErrorCode.INTERNAL_ERROR, 'msg', {
        requestId: 'err-req-id',
      });
      const log = err.toLogFormat();
      expect(log.requestId).toBe('err-req-id');
    });

    it('toLogFormat 应该使用 context 的 requestId 优先', () => {
      const err = new AppError(ErrorCode.INTERNAL_ERROR, 'msg', {
        requestId: 'err-req-id',
      });
      const log = err.toLogFormat({ requestId: 'ctx-req-id' });
      expect(log.requestId).toBe('ctx-req-id');
    });
  });

  // ==========================================================================
  // AuthenticationError
  // ==========================================================================
  describe('AuthenticationError', () => {
    it('应该默认使用 AUTH_FAILED code', () => {
      const err = new AuthenticationError('认证失败');
      expect(err.code).toBe(ErrorCode.AUTH_FAILED);
      expect(err.status).toBe(401);
      expect(err.severity).toBe('medium');
      expect(err.name).toBe('AuthenticationError');
    });

    it('应该接受自定义 code', () => {
      const err = new AuthenticationError('msg', {
        code: ErrorCode.INVALID_API_KEY,
      });
      expect(err.code).toBe(ErrorCode.INVALID_API_KEY);
    });

    it('应该接受自定义 severity', () => {
      const err = new AuthenticationError('msg', { severity: 'high' });
      expect(err.severity).toBe('high');
    });
  });

  // ==========================================================================
  // AuthorizationError
  // ==========================================================================
  describe('AuthorizationError', () => {
    it('应该默认使用 FORBIDDEN code', () => {
      const err = new AuthorizationError('禁止访问');
      expect(err.code).toBe(ErrorCode.FORBIDDEN);
      expect(err.status).toBe(403);
      expect(err.severity).toBe('medium');
      expect(err.name).toBe('AuthorizationError');
    });

    it('应该接受自定义 code', () => {
      const err = new AuthorizationError('msg', {
        code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      });
      expect(err.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
    });
  });

  // ==========================================================================
  // ValidationError
  // ==========================================================================
  describe('ValidationError', () => {
    it('应该默认使用 VALIDATION_ERROR code', () => {
      const err = new ValidationError('验证失败');
      expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.status).toBe(400);
      expect(err.severity).toBe('low');
      expect(err.name).toBe('ValidationError');
    });

    it('应该接受自定义 code', () => {
      const err = new ValidationError('msg', {
        code: ErrorCode.INVALID_PARAMETER,
      });
      expect(err.code).toBe(ErrorCode.INVALID_PARAMETER);
    });
  });

  // ==========================================================================
  // ResourceError
  // ==========================================================================
  describe('ResourceError', () => {
    it('应该默认使用 NOT_FOUND code', () => {
      const err = new ResourceError('未找到');
      expect(err.code).toBe(ErrorCode.NOT_FOUND);
      expect(err.status).toBe(404);
      expect(err.severity).toBe('low');
      expect(err.name).toBe('ResourceError');
    });

    it('应该接受自定义 code', () => {
      const err = new ResourceError('msg', { code: ErrorCode.CONFLICT });
      expect(err.code).toBe(ErrorCode.CONFLICT);
      expect(err.status).toBe(409);
    });
  });

  // ==========================================================================
  // RateLimitError
  // ==========================================================================
  describe('RateLimitError', () => {
    it('应该使用 RATE_LIMIT_EXCEEDED code 和默认 retryAfter=60', () => {
      const err = new RateLimitError();
      expect(err.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(err.status).toBe(429);
      expect(err.retryAfter).toBe(60);
      expect(err.name).toBe('RateLimitError');
      expect(err.details).toEqual({ retryAfter: 60 });
    });

    it('应该接受自定义 retryAfter', () => {
      const err = new RateLimitError(30);
      expect(err.retryAfter).toBe(30);
      expect(err.details).toEqual({ retryAfter: 30 });
    });

    it('toNextResponse 应该设置 Retry-After 和 X-RateLimit-Reset headers', () => {
      const err = new RateLimitError(120);
      const response = err.toNextResponse();
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('120');
      expect(response.headers.get('X-RateLimit-Reset')).not.toBeNull();
      // X-RateLimit-Reset = Math.ceil(Date.now() / 1000 + 120)
      const resetValue = Number(response.headers.get('X-RateLimit-Reset'));
      const expected = Math.ceil(Date.now() / 1000 + 120);
      expect(resetValue).toBeGreaterThanOrEqual(expected - 1);
      expect(resetValue).toBeLessThanOrEqual(expected + 1);
    });

    it('toErrorResponse 不应在 details 中包含 retryAfter（RATE_LIMIT_EXCEEDED 不在 safeDetailCodes）', () => {
      const err = new RateLimitError(45);
      const response = err.toErrorResponse();
      // RATE_LIMIT_EXCEEDED 不在 safeDetailCodes 中，details 不会返回到响应体
      expect(response.error.details).toBeUndefined();
      // retryAfter 通过 error 实例属性暴露
      expect(err.retryAfter).toBe(45);
      // retryAfter 通过 toNextResponse 的 Retry-After header 暴露
      const nextResponse = err.toNextResponse();
      expect(nextResponse.headers.get('Retry-After')).toBe('45');
    });
  });

  // ==========================================================================
  // ServerError
  // ==========================================================================
  describe('ServerError', () => {
    it('应该默认使用 INTERNAL_ERROR code', () => {
      const err = new ServerError('服务器错误');
      expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(err.status).toBe(500);
      expect(err.severity).toBe('high');
      expect(err.name).toBe('ServerError');
    });

    it('应该接受自定义 code', () => {
      const err = new ServerError('msg', { code: ErrorCode.DATABASE_ERROR });
      expect(err.code).toBe(ErrorCode.DATABASE_ERROR);
    });

    it('应该接受自定义 severity', () => {
      const err = new ServerError('msg', { severity: 'critical' });
      expect(err.severity).toBe('critical');
    });

    it('应该接受 originalError', () => {
      const original = new Error('db down');
      const err = new ServerError('msg', { originalError: original });
      expect(err.originalError).toBe(original);
    });
  });

  // ==========================================================================
  // ErrorHandler
  // ==========================================================================
  describe('ErrorHandler', () => {
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

    describe('normalizeError', () => {
      it('应该直接返回 AppError 实例', () => {
        const handler = new ErrorHandler();
        const original = new ValidationError('test');
        const result = handler.normalizeError(original);
        expect(result).toBe(original); // 同一引用
      });

      it('应该将数据库错误转换为 ServerError(DATABASE_ERROR)', () => {
        const handler = new ErrorHandler();
        const err = new Error('connection refused: ECONNREFUSED');
        const result = handler.normalizeError(err);
        expect(result).toBeInstanceOf(ServerError);
        expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
        expect(result.status).toBe(500);
        expect(result.originalError).toBe(err);
      });

      it('应该将 duplicate key 错误识别为数据库错误', () => {
        const handler = new ErrorHandler();
        const err = new Error('duplicate key value violates unique constraint');
        const result = handler.normalizeError(err);
        expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
      });

      it('应该将 foreign key 错误识别为数据库错误', () => {
        const handler = new ErrorHandler();
        const err = new Error('foreign key constraint failed');
        const result = handler.normalizeError(err);
        expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
      });

      it('应该将 syntax error 错误识别为数据库错误', () => {
        const handler = new ErrorHandler();
        const err = new Error('syntax error at or near "SELECT"');
        const result = handler.normalizeError(err);
        expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
      });

      it('应该将 timeout 错误转换为 ServerError(TIMEOUT_ERROR)', () => {
        const handler = new ErrorHandler();
        const err = new Error('operation timeout');
        const result = handler.normalizeError(err);
        expect(result).toBeInstanceOf(ServerError);
        expect(result.code).toBe(ErrorCode.TIMEOUT_ERROR);
        expect(result.originalError).toBe(err);
      });

      it('应该将 timed out 错误识别为超时错误', () => {
        const handler = new ErrorHandler();
        const err = new Error('request timed out');
        const result = handler.normalizeError(err);
        expect(result.code).toBe(ErrorCode.TIMEOUT_ERROR);
      });

      it('应该将 ETIMEDOUT 错误识别为数据库错误（优先匹配）', () => {
        const handler = new ErrorHandler();
        const err = new Error('ETIMEDOUT');
        const result = handler.normalizeError(err);
        // ETIMEDOUT 在数据库和超时模式中都有，但数据库检查先执行
        expect(result.code).toBe(ErrorCode.DATABASE_ERROR);
      });

      it('应该将普通 Error 转换为 ServerError(INTERNAL_ERROR)', () => {
        const handler = new ErrorHandler();
        const err = new Error('something went wrong');
        const result = handler.normalizeError(err);
        expect(result).toBeInstanceOf(ServerError);
        expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(result.originalError).toBe(err);
      });

      it('应该将非 Error 值转换为 AppError(UNKNOWN)', () => {
        const handler = new ErrorHandler();
        const result = handler.normalizeError('string error');
        expect(result).toBeInstanceOf(AppError);
        expect(result.code).toBe(ErrorCode.UNKNOWN);
        expect(result.message).toBe('未知错误');
      });

      it('应该将 null 转换为 AppError(UNKNOWN)', () => {
        const handler = new ErrorHandler();
        const result = handler.normalizeError(null);
        expect(result.code).toBe(ErrorCode.UNKNOWN);
      });

      it('应该将 context.requestId 传递给转换后的错误', () => {
        const handler = new ErrorHandler();
        const err = new Error('boom');
        const result = handler.normalizeError(err, { requestId: 'ctx-req' });
        expect(result.requestId).toBe('ctx-req');
      });
    });

    describe('handle', () => {
      it('应该处理错误并返回 NextResponse', () => {
        const handler = new ErrorHandler();
        const err = new ValidationError('test');
        const response = handler.handle(err);
        expect(response).toBeInstanceOf(NextResponse);
        expect(response.status).toBe(400);
      });

      it('应该记录错误日志（默认 logger）', () => {
        const handler = new ErrorHandler();
        const err = new ServerError('high severity');
        handler.handle(err);
        // severity 'high' → console.error
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('应该在 severity 为 medium/low 时使用 console.warn', () => {
        const handler = new ErrorHandler();
        const err = new ValidationError('low severity');
        handler.handle(err);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('应该使用自定义 logger', () => {
        const customLogger = vi.fn();
        const handler = new ErrorHandler({ logger: customLogger });
        const err = new ValidationError('test');
        handler.handle(err, { path: '/x' });
        expect(customLogger).toHaveBeenCalledWith(err, { path: '/x' });
        // 自定义 logger 时不应调用 console
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('应该在 logErrors=false 时不记录日志', () => {
        const handler = new ErrorHandler({ logErrors: false });
        const err = new ServerError('test');
        handler.handle(err);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('应该在 context 有 requestId 时传递给响应', async () => {
        const handler = new ErrorHandler();
        const err = new ValidationError('test');
        const response = handler.handle(err, { requestId: 'handle-req' });
        const body = await response.json();
        expect(body.error.requestId).toBe('handle-req');
      });
    });

    describe('logError severity 路由', () => {
      it('应该在 critical 级别使用 console.error', () => {
        const handler = new ErrorHandler();
        const err = new AppError(ErrorCode.ENCRYPTION_ERROR, 'critical');
        handler.handle(err);
        expect(consoleErrorSpy).toHaveBeenCalledWith('[CRITICAL]', expect.any(String));
      });

      it('应该在 high 级别使用 console.error', () => {
        const handler = new ErrorHandler();
        const err = new ServerError('high');
        handler.handle(err);
        expect(consoleErrorSpy).toHaveBeenCalledWith('[HIGH]', expect.any(String));
      });

      it('应该在 medium 级别使用 console.warn', () => {
        const handler = new ErrorHandler();
        const err = new AuthenticationError('medium');
        handler.handle(err);
        expect(consoleWarnSpy).toHaveBeenCalledWith('[MEDIUM]', expect.any(String));
      });

      it('应该在 low 级别使用 console.warn', () => {
        const handler = new ErrorHandler();
        const err = new ValidationError('low');
        handler.handle(err);
        expect(consoleWarnSpy).toHaveBeenCalledWith('[LOW]', expect.any(String));
      });
    });
  });

  // ==========================================================================
  // errorHandler 单例
  // ==========================================================================
  describe('errorHandler 单例', () => {
    it('应该是 ErrorHandler 实例', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('应该能处理错误', () => {
      const response = errorHandler.handle(new Error('test'));
      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(500);
    });
  });

  // ==========================================================================
  // withErrorHandler
  // ==========================================================================
  describe('withErrorHandler', () => {
    it('应该在 handler 成功时返回其结果', async () => {
      const mockResponse = NextResponse.json({ ok: true });
      const handler = vi.fn().mockResolvedValue(mockResponse);
      const wrapped = withErrorHandler(handler);

      const request = createMockRequest();
      const result = await wrapped(request, { params: Promise.resolve({}) });

      expect(result).toBe(mockResponse);
      expect(handler).toHaveBeenCalledWith(request, { params: expect.any(Promise) });
    });

    it('应该在 handler 抛出 AppError 时返回错误响应', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new ValidationError('bad input'));
      const wrapped = withErrorHandler(handler);

      const request = createMockRequest();
      const result = await wrapped(request, { params: Promise.resolve({}) });

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(400);
      errorSpy.mockRestore();
    });

    it('应该在 handler 抛出普通 Error 时返回 500', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new Error('unexpected'));
      const wrapped = withErrorHandler(handler);

      const request = createMockRequest();
      const result = await wrapped(request, { params: Promise.resolve({}) });

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(500);
      errorSpy.mockRestore();
    });

    it('应该在 handler 抛出非 Error 值时返回 500', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue('string error');
      const wrapped = withErrorHandler(handler);

      const request = createMockRequest();
      const result = await wrapped(request, { params: Promise.resolve({}) });

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(500);
      errorSpy.mockRestore();
    });

    it('应该从 request 提取上下文并传递给 errorHandler', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new Error('fail'));
      const wrapped = withErrorHandler(handler);

      const request = createMockRequest(undefined, {
        'x-request-id': 'wrapped-req',
      });
      const result = await wrapped(request, { params: Promise.resolve({}) });

      const body = await result.json();
      expect(body.error.requestId).toBe('wrapped-req');
      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // successResponse
  // ==========================================================================
  describe('successResponse', () => {
    it('应该返回只包含 data 的成功响应', () => {
      const response = successResponse({ id: 1 });
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1 });
      expect(response.message).toBeUndefined();
    });

    it('应该返回包含 message 的成功响应', () => {
      const response = successResponse({ id: 1 }, 'created');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1 });
      expect(response.message).toBe('created');
    });

    it('应该忽略空 message', () => {
      const response = successResponse({ id: 1 }, '');
      expect(response.message).toBeUndefined();
    });

    it('应该忽略 requestId 参数（_requestId 未使用）', () => {
      const response = successResponse({ id: 1 }, 'msg', 'req-id');
      expect(response.success).toBe(true);
      // requestId 不在成功响应中
      expect((response as unknown as Record<string, unknown>).requestId).toBeUndefined();
    });
  });

  // ==========================================================================
  // errorResponse
  // ==========================================================================
  describe('errorResponse', () => {
    it('应该使用默认消息（USER_FRIENDLY_MESSAGES）', () => {
      const response = errorResponse(ErrorCode.NOT_FOUND);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(response.error.message).toBe('请求的资源不存在');
      expect(response.error.requestId).toHaveLength(8);
      expect(response.error.timestamp).toBeDefined();
    });

    it('应该使用自定义消息', () => {
      const response = errorResponse(ErrorCode.NOT_FOUND, '自定义消息');
      expect(response.error.message).toBe('自定义消息');
    });

    it('应该使用传入的 requestId', () => {
      const response = errorResponse(ErrorCode.NOT_FOUND, 'msg', {
        requestId: 'custom-req',
      });
      expect(response.error.requestId).toBe('custom-req');
    });

    it('应该包含 details', () => {
      const response = errorResponse(ErrorCode.VALIDATION_ERROR, 'msg', {
        details: { field: 'email' },
      });
      expect(response.error.details).toEqual({ field: 'email' });
    });

    it('应该在无 details 时不包含 details 字段', () => {
      const response = errorResponse(ErrorCode.NOT_FOUND);
      expect(response.error.details).toBeUndefined();
    });
  });

  // ==========================================================================
  // Errors helpers
  // ==========================================================================
  describe('Errors helpers', () => {
    describe('missingApiKey', () => {
      it('应该创建 AuthenticationError(MISSING_API_KEY)', () => {
        const err = Errors.missingApiKey('req-1');
        expect(err).toBeInstanceOf(AuthenticationError);
        expect(err.code).toBe(ErrorCode.MISSING_API_KEY);
        expect(err.status).toBe(401);
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('invalidApiKey', () => {
      it('应该创建 AuthenticationError(INVALID_API_KEY)', () => {
        const err = Errors.invalidApiKey();
        expect(err.code).toBe(ErrorCode.INVALID_API_KEY);
      });
    });

    describe('inactiveApiKey', () => {
      it('应该创建 AuthenticationError(INACTIVE_API_KEY)', () => {
        const err = Errors.inactiveApiKey();
        expect(err.code).toBe(ErrorCode.INACTIVE_API_KEY);
      });
    });

    describe('revokedApiKey', () => {
      it('应该创建 AuthenticationError(REVOKED_API_KEY)', () => {
        const err = Errors.revokedApiKey();
        expect(err.code).toBe(ErrorCode.REVOKED_API_KEY);
      });
    });

    describe('expiredApiKey', () => {
      it('应该创建 AuthenticationError(EXPIRED_API_KEY)', () => {
        const err = Errors.expiredApiKey();
        expect(err.code).toBe(ErrorCode.EXPIRED_API_KEY);
      });
    });

    describe('forbidden', () => {
      it('应该使用默认消息创建 AuthorizationError', () => {
        const err = Errors.forbidden();
        expect(err).toBeInstanceOf(AuthorizationError);
        expect(err.code).toBe(ErrorCode.FORBIDDEN);
        // message 为 undefined 时，AppError 使用 USER_FRIENDLY_MESSAGES[FORBIDDEN]
        expect(err.message).toBe('访问被拒绝');
      });

      it('应该接受自定义消息', () => {
        const err = Errors.forbidden('禁止访问');
        expect(err.message).toBe('禁止访问');
      });

      it('应该接受 requestId', () => {
        const err = Errors.forbidden('msg', 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('insufficientPermissions', () => {
      it('应该创建 AuthorizationError(INSUFFICIENT_PERMISSIONS)', () => {
        const err = Errors.insufficientPermissions(['read', 'write']);
        expect(err.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
        expect(err.details).toEqual({ required: ['read', 'write'] });
      });

      it('应该在没有 required 参数时不设置 details', () => {
        const err = Errors.insufficientPermissions();
        expect(err.details).toBeUndefined();
      });

      it('应该接受 requestId', () => {
        const err = Errors.insufficientPermissions(['read'], 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('notFound', () => {
      it('应该使用资源名创建 ResourceError', () => {
        const err = Errors.notFound('Channel');
        expect(err).toBeInstanceOf(ResourceError);
        expect(err.code).toBe(ErrorCode.NOT_FOUND);
        expect(err.message).toBe('Channel 不存在');
      });

      it('应该使用默认消息当无资源名', () => {
        const err = Errors.notFound();
        expect(err.message).toBe('请求的资源不存在');
      });

      it('应该接受 requestId', () => {
        const err = Errors.notFound('User', 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('validationError', () => {
      it('应该创建 ValidationError 并包含 details', () => {
        const err = Errors.validationError('bad input', { field: 'email' });
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(err.message).toBe('bad input');
        expect(err.details).toEqual({ field: 'email' });
      });

      it('应该接受 requestId', () => {
        const err = Errors.validationError('msg', undefined, 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('invalidParameter', () => {
      it('应该创建 ValidationError(INVALID_PARAMETER) 并包含参数信息', () => {
        const err = Errors.invalidParameter('email', 'invalid format');
        expect(err.code).toBe(ErrorCode.INVALID_PARAMETER);
        expect(err.message).toBe('无效的参数: email');
        expect(err.details).toEqual({ parameter: 'email', reason: 'invalid format' });
      });

      it('应该接受 requestId', () => {
        const err = Errors.invalidParameter('email', undefined, 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('missingParameter', () => {
      it('应该创建 ValidationError(MISSING_PARAMETER) 并包含参数名', () => {
        const err = Errors.missingParameter('name');
        expect(err.code).toBe(ErrorCode.MISSING_PARAMETER);
        expect(err.message).toBe('缺少必需的参数: name');
        expect(err.details).toEqual({ parameter: 'name' });
      });

      it('应该接受 requestId', () => {
        const err = Errors.missingParameter('name', 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('conflict', () => {
      it('应该创建 ResourceError(CONFLICT)', () => {
        const err = Errors.conflict('资源已存在');
        expect(err).toBeInstanceOf(ResourceError);
        expect(err.code).toBe(ErrorCode.CONFLICT);
        expect(err.status).toBe(409);
        expect(err.message).toBe('资源已存在');
      });

      it('应该接受 requestId', () => {
        const err = Errors.conflict('msg', 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('rateLimited', () => {
      it('应该创建 RateLimitError 并包含 retryAfter', () => {
        const err = Errors.rateLimited(30);
        expect(err).toBeInstanceOf(RateLimitError);
        expect(err.retryAfter).toBe(30);
        expect(err.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      });

      it('应该使用默认 retryAfter=60', () => {
        const err = Errors.rateLimited();
        expect(err.retryAfter).toBe(60);
      });

      it('应该接受 requestId', () => {
        const err = Errors.rateLimited(60, 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('internal', () => {
      it('应该创建 ServerError(INTERNAL_ERROR) 并包含 originalError', () => {
        const original = new Error('db down');
        const err = Errors.internal(original);
        expect(err).toBeInstanceOf(ServerError);
        expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(err.originalError).toBe(original);
      });

      it('应该在无 originalError 时正常工作', () => {
        const err = Errors.internal();
        expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
        expect(err.originalError).toBeUndefined();
      });

      it('应该接受 requestId', () => {
        const err = Errors.internal(undefined, 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });

    describe('databaseError', () => {
      it('应该创建 ServerError(DATABASE_ERROR) 并包含 originalError', () => {
        const original = new Error('connection lost');
        const err = Errors.databaseError(original);
        expect(err).toBeInstanceOf(ServerError);
        expect(err.code).toBe(ErrorCode.DATABASE_ERROR);
        expect(err.originalError).toBe(original);
      });

      it('应该在无 originalError 时正常工作', () => {
        const err = Errors.databaseError();
        expect(err.code).toBe(ErrorCode.DATABASE_ERROR);
      });

      it('应该接受 requestId', () => {
        const err = Errors.databaseError(undefined, 'req-1');
        expect(err.requestId).toBe('req-1');
      });
    });
  });

  // ==========================================================================
  // isRetryableError
  // ==========================================================================
  describe('isRetryableError', () => {
    it('应该对 5xx 服务器错误返回 true', () => {
      const err = new ServerError('internal');
      expect(isRetryableError(err)).toBe(true);
    });

    it('应该对 RATE_LIMIT_EXCEEDED 返回 true', () => {
      const err = new RateLimitError();
      expect(isRetryableError(err)).toBe(true);
    });

    it('应该对 TIMEOUT_ERROR 返回 true', () => {
      const err = new ServerError('timeout', { code: ErrorCode.TIMEOUT_ERROR });
      expect(isRetryableError(err)).toBe(true);
    });

    it('应该对 SERVICE_UNAVAILABLE 返回 true', () => {
      const err = new ServerError('unavailable', {
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      expect(isRetryableError(err)).toBe(true);
    });

    it('应该对 4xx 客户端错误返回 false', () => {
      const err = new ValidationError('bad request');
      expect(isRetryableError(err)).toBe(false);
    });

    it('应该对非 AppError 返回 true', () => {
      expect(isRetryableError(new Error('unknown'))).toBe(true);
      expect(isRetryableError('string')).toBe(true);
      expect(isRetryableError(null)).toBe(true);
    });
  });

  // ==========================================================================
  // isClientError
  // ==========================================================================
  describe('isClientError', () => {
    it('应该对 4xx AppError 返回 true', () => {
      expect(isClientError(new ValidationError('test'))).toBe(true);
      expect(isClientError(new AuthenticationError('test'))).toBe(true);
      expect(isClientError(new AuthorizationError('test'))).toBe(true);
      expect(isClientError(new ResourceError('test'))).toBe(true);
    });

    it('应该对 5xx AppError 返回 false', () => {
      expect(isClientError(new ServerError('test'))).toBe(false);
    });

    it('应该对 RATE_LIMIT_EXCEEDED (429) 返回 true', () => {
      expect(isClientError(new RateLimitError())).toBe(true);
    });

    it('应该对非 AppError 返回 false', () => {
      expect(isClientError(new Error('test'))).toBe(false);
      expect(isClientError('string')).toBe(false);
      expect(isClientError(null)).toBe(false);
    });
  });

  // ==========================================================================
  // isServerError
  // ==========================================================================
  describe('isServerError', () => {
    it('应该对 5xx AppError 返回 true', () => {
      expect(isServerError(new ServerError('test'))).toBe(true);
    });

    it('应该对 4xx AppError 返回 false', () => {
      expect(isServerError(new ValidationError('test'))).toBe(false);
      expect(isServerError(new AuthenticationError('test'))).toBe(false);
    });

    it('应该对非 AppError 返回 false', () => {
      expect(isServerError(new Error('test'))).toBe(false);
      expect(isServerError('string')).toBe(false);
    });
  });
});

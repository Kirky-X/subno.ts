// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import { mapServiceError, ServiceResult } from '@/src/lib/utils/service-error-mapper';
import { ValidationError, ResourceError, AppError, ErrorCode } from '@/src/lib/utils/error-handler';

describe('service-error-mapper', () => {
  const requestId = 'req-test-1';

  function expectCodeAndStatus(
    result: Error,
    ExpectedClass: new (...args: any[]) => AppError,
    expectedCode: ErrorCode,
    expectedStatus: number,
  ): void {
    expect(result).toBeInstanceOf(ExpectedClass);
    expect(result).toBeInstanceOf(AppError);
    const appError = result as AppError;
    expect(appError.code).toBe(expectedCode);
    expect(appError.status).toBe(expectedStatus);
    expect(appError.requestId).toBe(requestId);
  }

  describe('mapServiceError - 已映射的错误码', () => {
    it('应该将 CHANNEL_NOT_FOUND 映射为 ResourceError (NOT_FOUND, 404)', () => {
      const result: ServiceResult = {
        success: false,
        code: 'CHANNEL_NOT_FOUND',
        error: '频道不存在',
      };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ResourceError, ErrorCode.NOT_FOUND, 404);
      expect(err.message).toContain('频道');
    });

    it('应该将 CHANNEL_INACTIVE 映射为 ResourceError (INVALID_STATE, 400)', () => {
      const result: ServiceResult = { success: false, code: 'CHANNEL_INACTIVE', error: '频道停用' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ResourceError, ErrorCode.INVALID_STATE, 400);
      expect(err.message).toBe('频道已停用');
    });

    it('应该将 MISSING_CHANNEL 映射为 ValidationError (MISSING_PARAMETER, 400)', () => {
      const result: ServiceResult = { success: false, code: 'MISSING_CHANNEL', error: '缺频道' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ValidationError, ErrorCode.MISSING_PARAMETER, 400);
      expect(err.message).toBe('缺少频道参数');
    });

    it('应该将 MISSING_MESSAGE 映射为 ValidationError (MISSING_PARAMETER, 400)', () => {
      const result: ServiceResult = { success: false, code: 'MISSING_MESSAGE', error: '缺消息' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ValidationError, ErrorCode.MISSING_PARAMETER, 400);
      expect(err.message).toBe('缺少消息内容');
    });

    it('应该将 MESSAGE_TOO_LARGE 映射为 ValidationError (VALIDATION_ERROR, 400)', () => {
      const result: ServiceResult = { success: false, code: 'MESSAGE_TOO_LARGE', error: '太大' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ValidationError, ErrorCode.VALIDATION_ERROR, 400);
      expect(err.message).toBe('消息大小超过限制');
    });

    it('应该将 NOT_FOUND 映射为 ResourceError (NOT_FOUND, 404)', () => {
      const result: ServiceResult = { success: false, code: 'NOT_FOUND', error: '资源不存在' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ResourceError, ErrorCode.NOT_FOUND, 404);
      expect(err.message).toContain('资源');
    });

    it('应该将 ALREADY_REVOKED 映射为 ResourceError (ALREADY_REVOKED, 409)', () => {
      const result: ServiceResult = { success: false, code: 'ALREADY_REVOKED', error: '已撤销' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ResourceError, ErrorCode.ALREADY_REVOKED, 409);
      expect(err.message).toBe('密钥已被撤销');
    });

    it('应该将 REVOCATION_PENDING 映射为 ResourceError (REVOCATION_PENDING, 409)', () => {
      const result: ServiceResult = { success: false, code: 'REVOCATION_PENDING', error: '处理中' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ResourceError, ErrorCode.REVOCATION_PENDING, 409);
      expect(err.message).toBe('撤销请求正在处理中');
    });

    it('应该将 INVALID_PUBLIC_KEY 映射为 ValidationError (VALIDATION_ERROR, 400)', () => {
      const result: ServiceResult = { success: false, code: 'INVALID_PUBLIC_KEY', error: '坏公钥' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ValidationError, ErrorCode.VALIDATION_ERROR, 400);
      expect(err.message).toBe('无效的公钥格式');
    });

    it('应该将 KEY_EXPIRED 映射为 ResourceError (KEY_EXPIRED, 410)', () => {
      const result: ServiceResult = { success: false, code: 'KEY_EXPIRED', error: '已过期' };
      const err = mapServiceError(result, requestId);
      expectCodeAndStatus(err, ResourceError, ErrorCode.KEY_EXPIRED, 410);
      expect(err.message).toBe('密钥已过期');
    });
  });

  describe('mapServiceError - 未映射的错误码', () => {
    it('应该将未知 code 映射为 internal ServerError', () => {
      const result: ServiceResult = {
        success: false,
        code: 'UNKNOWN_CODE',
        error: '未知错误',
      };
      const err = mapServiceError(result, requestId);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.INTERNAL_ERROR);
      expect((err as AppError).status).toBe(500);
      expect((err as AppError).requestId).toBe(requestId);
      expect(err.message).toBe('服务器内部错误');
    });
  });

  describe('mapServiceError - 缺少 code', () => {
    it('应该将无 code 的结果映射为 internal ServerError', () => {
      const result: ServiceResult = { success: false, error: '操作失败' };
      const err = mapServiceError(result, requestId);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.INTERNAL_ERROR);
      expect((err as AppError).status).toBe(500);
      expect((err as AppError).requestId).toBe(requestId);
    });

    it('应该在无 code 且无 error 时使用默认消息', () => {
      const result: ServiceResult = { success: false };
      const err = mapServiceError(result, requestId);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.INTERNAL_ERROR);
      // Errors.internal 使用 '服务器内部错误' 默认消息
      expect(err.message).toBe('服务器内部错误');
    });
  });

  describe('mapServiceError - requestId 传递', () => {
    it('应该将 requestId 传递给生成的错误', () => {
      const result: ServiceResult = { success: false, code: 'CHANNEL_NOT_FOUND', error: 'x' };
      const err = mapServiceError(result, 'req-xyz-123');
      expect((err as AppError).requestId).toBe('req-xyz-123');
    });
  });
});

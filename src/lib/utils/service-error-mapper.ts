// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { ValidationError, ResourceError, Errors, ErrorCode } from './error-handler';

export type ServiceResult = { success: false; error?: string; code?: string };

const SERVICE_ERROR_MAP: Record<string, (error: string, requestId: string) => Error> = {
  'CHANNEL_NOT_FOUND': (error, requestId) => Errors.notFound('频道', requestId),
  'CHANNEL_INACTIVE': (error, requestId) => new ResourceError('频道已停用', { 
    code: ErrorCode.INVALID_STATE, 
    requestId 
  }),
  'MISSING_CHANNEL': (error, requestId) => new ValidationError('缺少频道参数', { 
    code: ErrorCode.MISSING_PARAMETER, 
    requestId 
  }),
  'MISSING_MESSAGE': (error, requestId) => new ValidationError('缺少消息内容', { 
    code: ErrorCode.MISSING_PARAMETER, 
    requestId 
  }),
  'MESSAGE_TOO_LARGE': (error, requestId) => new ValidationError('消息大小超过限制', { 
    code: ErrorCode.VALIDATION_ERROR, 
    requestId 
  }),
  'NOT_FOUND': (error, requestId) => Errors.notFound('资源', requestId),
  'ALREADY_REVOKED': (error, requestId) => new ResourceError('密钥已被撤销', { 
    code: ErrorCode.ALREADY_REVOKED, 
    requestId 
  }),
  'REVOCATION_PENDING': (error, requestId) => new ResourceError('撤销请求正在处理中', { 
    code: ErrorCode.REVOCATION_PENDING, 
    requestId 
  }),
  'INVALID_PUBLIC_KEY': (error, requestId) => new ValidationError('无效的公钥格式', { 
    code: ErrorCode.VALIDATION_ERROR, 
    requestId 
  }),
  'KEY_EXPIRED': (error, requestId) => new ResourceError('密钥已过期', { 
    code: ErrorCode.KEY_EXPIRED, 
    requestId 
  }),
};

export function mapServiceError(
  result: ServiceResult,
  requestId: string
): Error {
  if (!result.code) {
    return Errors.internal(new Error(result.error || '操作失败'), requestId);
  }
  
  const mapper = SERVICE_ERROR_MAP[result.code];
  return mapper 
    ? mapper(result.error || '操作失败', requestId)
    : Errors.internal(new Error(result.error), requestId);
}

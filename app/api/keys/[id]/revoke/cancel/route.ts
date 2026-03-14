// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService, auditService, apiKeyRepository } from '@/src/lib/services';
import {
  withErrorHandler,
  extractRequestContext,
  successResponse,
  Errors,
  ErrorCode,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ServerError,
} from '@/src/lib/utils/error-handler';

// POST /api/keys/:id/revoke/cancel - Cancel pending revocation
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const context = extractRequestContext(request);
  const { id: revocationId } = await params;
  const apiKey = request.headers.get('X-API-Key');
  const clientIP = context.clientIP || 'unknown';
  
  if (!apiKey) {
    throw new AuthenticationError('API 密钥是必需的', {
      code: ErrorCode.AUTH_REQUIRED,
      requestId: context.requestId,
    });
  }

  // Validate API key has permission to cancel
  const hasPermission = await apiKeyRepository.validatePermission(apiKey, 'key_revoke');
  if (!hasPermission) {
    await auditService.log({
      action: 'cancel_revocation_unauthorized',
      ip: clientIP,
      success: false,
      metadata: { revocationId, reason: 'Insufficient permissions' },
    });
    throw new AuthorizationError('权限不足以执行密钥撤销操作', {
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      requestId: context.requestId,
    });
  }

  const result = await keyRevocationService.cancelRevocation(revocationId, apiKey);

  if (!result.success) {
    switch (result.code) {
      case 'NOT_FOUND':
        throw Errors.notFound('撤销记录', context.requestId);
      case 'INVALID_STATE':
        throw new ValidationError('无效的操作状态', {
          code: ErrorCode.INVALID_STATE,
          requestId: context.requestId,
        });
      default:
        throw new ServerError(result.error || '取消撤销失败', {
          requestId: context.requestId,
        });
    }
  }

  return NextResponse.json(successResponse(null, '撤销请求已成功取消'));
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService, auditService } from '@/src/lib/services';
import { requireApiKeyWithPermissions, getApiKeyInfo } from '@/src/lib/middleware';
import { Permission } from '@/src/lib/types/permissions';
import {
  withErrorHandler,
  extractRequestContext,
  successResponse,
  Errors,
  ErrorCode,
  ResourceError,
  ValidationError,
  ServerError,
  AuthenticationError,
  AuthorizationError,
} from '@/src/lib/utils/error-handler';

// POST /api/keys/:id/revoke - Request key revocation
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const context = extractRequestContext(request);
  const { id: keyId } = await params;
  
  // Validate API key and check permissions
  // Requires either 'key_revoke' or 'admin' permission
  const authError = await requireApiKeyWithPermissions(request, [Permission.KEY_REVOKE]);
  if (authError) {
    throw new AuthorizationError('权限不足以执行密钥撤销操作', {
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      requestId: context.requestId,
    });
  }

  // Get API key info for audit logging
  const apiKeyInfo = await getApiKeyInfo(request);
  if (!apiKeyInfo) {
    throw new AuthenticationError('无法获取 API 密钥信息', {
      code: ErrorCode.AUTH_FAILED,
      requestId: context.requestId,
    });
  }

  const body = await request.json();
  const clientIP = context.clientIP || 'unknown';
  const userAgent = context.userAgent || 'unknown';

  const result = await keyRevocationService.requestRevocation({
    keyId,
    apiKeyId: apiKeyInfo.keyId,
    reason: body.reason,
    confirmationHours: body.confirmationHours,
  });

  if (!result.success) {
    // Log failed revocation attempt
    await auditService.log({
      action: 'key_revoke_request',
      keyId,
      apiKeyId: apiKeyInfo.keyId,
      ip: clientIP,
      userAgent,
      success: false,
      error: result.error,
      metadata: { code: result.code },
    });

    // 根据错误码抛出对应的错误
    switch (result.code) {
      case 'NOT_FOUND':
        throw Errors.notFound('密钥', context.requestId);
      case 'ALREADY_REVOKED':
        throw new ResourceError('密钥已被撤销', {
          code: ErrorCode.ALREADY_REVOKED,
          requestId: context.requestId,
        });
      case 'INVALID_REASON':
        throw new ValidationError('无效的原因说明', {
          code: ErrorCode.INVALID_REASON,
          requestId: context.requestId,
        });
      case 'INVALID_INPUT':
        throw new ValidationError('无效的输入', {
          code: ErrorCode.INVALID_INPUT,
          requestId: context.requestId,
        });
      case 'REVOCATION_PENDING':
        throw new ResourceError('撤销请求正在处理中', {
          code: ErrorCode.REVOCATION_PENDING,
          requestId: context.requestId,
        });
      case 'FORBIDDEN':
        throw Errors.forbidden('权限不足', context.requestId);
      default:
        throw new ServerError(result.error || '请求撤销失败', {
          requestId: context.requestId,
        });
    }
  }

  // Log successful revocation request
  await auditService.log({
    action: 'key_revoke_request',
    keyId,
    apiKeyId: apiKeyInfo.keyId,
    ip: clientIP,
    userAgent,
    success: true,
    metadata: {
      revocationId: result.revocationId,
      reason: body.reason,
    },
  });

  return NextResponse.json(
    successResponse({
      revocationId: result.revocationId,
      keyId,
      status: 'pending',
      expiresAt: result.expiresAt,
      confirmationCodeSent: true,
    }),
    { status: 201 }
  );
});

// GET /api/keys/:id/revoke/status - Get revocation status
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const context = extractRequestContext(request);
  
  // Validate API key - requires at least read permission
  const authError = await requireApiKeyWithPermissions(request, [Permission.READ]);
  if (authError) {
    throw new AuthorizationError('权限不足以查看撤销状态', {
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      requestId: context.requestId,
    });
  }

  const { id: revocationId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const keyId = searchParams.get('keyId');

  let result;
  
  if (keyId) {
    result = await keyRevocationService.getPendingRevocationByKeyId(keyId);
  } else {
    result = await keyRevocationService.getRevocationStatus(revocationId);
  }

  if (!result.success) {
    if (result.code === 'NOT_FOUND') {
      throw Errors.notFound('撤销记录', context.requestId);
    }
    throw new ServerError(result.error || '获取撤销状态失败', {
      requestId: context.requestId,
    });
  }

  return NextResponse.json(successResponse({
    status: result.status,
    keyId: result.keyId,
    channelId: result.channelId,
    revokedAt: result.revokedAt,
    revokedBy: result.revokedBy,
    expiresAt: result.expiresAt,
  }));
});

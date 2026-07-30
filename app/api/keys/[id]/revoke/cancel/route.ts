// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService, auditService } from '@/src/lib/services';
import {
  withErrorHandler,
  extractRequestContext,
  successResponse,
  Errors,
  ErrorCode,
  ValidationError,
  AuthenticationError,
  ServerError,
} from '@/src/lib/utils/error-handler';
import { requireApiKeyWithPermissions, getApiKeyInfo } from '@/src/lib/middleware/api-key';
import { ApiKeyPermission } from '@/src/lib/enums/permission.enums';

// POST /api/keys/:id/revoke/cancel - Cancel pending revocation
export const POST = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = extractRequestContext(request);
    const { id: revocationId } = await params;
    const clientIP = context.clientIP ?? 'unknown';

    // 使用标准中间件验证 API key + 权限（修复认证绕过：原实现传原始 key 给期望 keyHash 的函数）
    const authError = await requireApiKeyWithPermissions(request, [ApiKeyPermission.REVOKE]);
    if (authError) {
      await auditService.log({
        action: 'cancel_revocation_unauthorized',
        ip: clientIP,
        success: false,
        metadata: { revocationId, reason: 'Authentication/permission failed' },
      });
      return authError;
    }

    const apiKeyInfo = await getApiKeyInfo(request);
    if (!apiKeyInfo) {
      throw new AuthenticationError('API 密钥验证失败', {
        code: ErrorCode.AUTH_FAILED,
        requestId: context.requestId,
      });
    }

    // 使用 keyId 作为操作者标识（而非原始 API key）
    const result = await keyRevocationService.cancelRevocation(revocationId, apiKeyInfo.keyId);

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
          throw new ServerError(result.error ?? '取消撤销失败', {
            requestId: context.requestId,
          });
      }
    }

    return NextResponse.json(successResponse(null, '撤销请求已成功取消'));
  },
);

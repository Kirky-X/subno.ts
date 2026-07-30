// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService, auditService } from '@/src/lib/services';
import { requireApiKeyWithPermissions, getApiKeyInfo } from '@/src/lib/middleware';
import { ApiKeyPermission } from '@/src/lib/enums/permission.enums';
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/keys/:id/revoke - Request key revocation
export const POST = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = extractRequestContext(request);
    const { id: keyId } = await params;

    if (!UUID_PATTERN.test(keyId)) {
      throw Errors.notFound('密钥', context.requestId);
    }

    // Validate API key and check permissions
    // requireApiKeyWithPermissions 已正确区分：
    //   - 无 API Key / 无效 Key → 401 AuthenticationError
    //   - Key 有效但权限不足 → 403 AuthorizationError
    // SECURITY NOTE: Ownership verification is performed in the service layer
    // The KeyRevocationService.validateApiKeyPermission method verifies that:
    // 1. The API key has 'key_revoke' or 'admin' permission
    // 2. For non-admin users, only keys from channels they created can be revoked
    const authError = await requireApiKeyWithPermissions(request, [ApiKeyPermission.REVOKE]);
    if (authError) {
      return authError;
    }

    // Get API key info for audit logging
    const apiKeyInfo = await getApiKeyInfo(request);
    if (!apiKeyInfo) {
      throw new AuthenticationError('无法获取 API 密钥信息', {
        code: ErrorCode.AUTH_FAILED,
        requestId: context.requestId,
      });
    }

    let body: { reason?: string; confirmationHours?: number };
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('无效的 JSON 格式', {
        code: ErrorCode.INVALID_REQUEST,
        requestId: context.requestId,
      });
    }
    const clientIP = context.clientIP ?? 'unknown';
    const userAgent = context.userAgent ?? 'unknown';

    const result = await keyRevocationService.requestRevocation({
      keyId,
      apiKeyId: apiKeyInfo.keyId,
      reason: body.reason ?? '',
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
          throw Errors.forbidden('权限不足或无权撤销此密钥', context.requestId);
        default:
          throw new ServerError(result.error ?? '请求撤销失败', {
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
      { status: 201 },
    );
  },
);

// GET /api/keys/:id/revoke/status - Get revocation status
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const context = extractRequestContext(request);

    // Validate API key - requires at least read permission
    // requireApiKeyWithPermissions 已正确区分 401（无 Key）与 403（权限不足）
    const authError = await requireApiKeyWithPermissions(request, [ApiKeyPermission.READ]);
    if (authError) {
      return authError;
    }

    // 获取 API 密钥信息用于所有权验证 (修复 H2: IDOR)
    const apiKeyInfo = await getApiKeyInfo(request);
    if (!apiKeyInfo) {
      throw new AuthenticationError('无法获取 API 密钥信息', {
        code: ErrorCode.AUTH_FAILED,
        requestId: context.requestId,
      });
    }

    const { id: revocationId } = await params;

    if (!UUID_PATTERN.test(revocationId)) {
      throw Errors.notFound('撤销记录', context.requestId);
    }

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
      throw new ServerError(result.error ?? '获取撤销状态失败', {
        requestId: context.requestId,
      });
    }

    // 所有权验证: 仅允许管理员或撤销请求发起者查看状态
    const isAdmin = apiKeyInfo.permissions.includes(ApiKeyPermission.ADMIN);
    const isOwner = result.requestedByApiKeyId === apiKeyInfo.keyId;
    if (!isAdmin && !isOwner) {
      throw new AuthorizationError('无权查看此撤销记录', {
        code: ErrorCode.INSUFFICIENT_PERMISSIONS,
        requestId: context.requestId,
      });
    }

    return NextResponse.json(
      successResponse({
        status: result.status,
        keyId: result.keyId,
        channelId: result.channelId,
        revokedAt: result.revokedAt,
        revokedBy: result.revokedBy,
        expiresAt: result.expiresAt,
      }),
    );
  },
);

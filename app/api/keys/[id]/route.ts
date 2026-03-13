// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService } from '@/src/lib/services';
import { secureCompare, validateLength, KEY_MANAGEMENT_CONFIG } from '@/src/lib/utils/secure-compare';
import { auditService } from '@/src/lib/services/audit.service';
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
} from '@/src/lib/utils/error-handler';

// DELETE /api/keys/:id
// - 新模式: 带 confirmationCode 参数，执行两阶段确认删除
// - 旧模式: 直接删除 (需要 ADMIN_MASTER_KEY)
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const context = extractRequestContext(request);
  const { id: keyId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const confirmationCode = searchParams.get('confirmationCode');
  
  const apiKey = request.headers.get('X-API-Key');
  const adminKey = request.headers.get('X-Admin-Key');
  const clientIP = context.clientIP || 'unknown';
  const userAgent = context.userAgent || 'unknown';

  // 模式1: 两阶段确认删除 (需要 API Key + 确认码)
  if (confirmationCode && apiKey) {
    const result = await keyRevocationService.confirmRevocation(
      keyId,
      confirmationCode,
      apiKey
    );

    if (!result.success) {
      // 根据错误码抛出对应的错误
      switch (result.code) {
        case 'NOT_FOUND':
          throw new ResourceError('密钥不存在', {
            code: ErrorCode.NOT_FOUND,
            requestId: context.requestId,
          });
        case 'INVALID_CODE':
          throw new ValidationError('无效的确认码', {
            code: ErrorCode.INVALID_CODE,
            requestId: context.requestId,
          });
        case 'LOCKED':
          throw Errors.rateLimited(60, context.requestId);
        case 'DELETE_FAILED':
          throw new ServerError('删除操作失败', {
            code: ErrorCode.DELETE_FAILED,
            requestId: context.requestId,
          });
        default:
          throw new ServerError(result.error || '确认撤销失败', {
            requestId: context.requestId,
          });
      }
    }

    // Audit log for successful revocation confirmation
    await auditService.log({
      action: 'key_revoke_confirmed',
      keyId: keyId,
      channelId: result.channelId,
      apiKeyId: apiKey,
      ip: clientIP,
      userAgent: userAgent,
      success: true,
      metadata: {
        deletedId: result.deletedId,
      },
    });

    return NextResponse.json(successResponse({
      deletedId: result.deletedId,
      channelId: result.channelId,
      deletedAt: new Date().toISOString(),
      deletedBy: apiKey,
    }, '公钥撤销成功'));
  }

  // 模式2: 直接删除 (仅限紧急情况，需要 ADMIN_MASTER_KEY)
  if (adminKey) {
    const envAdminKey = process.env.ADMIN_MASTER_KEY;
    
    // 使用安全比较防止时序攻击
    if (!envAdminKey || !secureCompare(adminKey, envAdminKey)) {
      // Audit log for failed admin authentication attempt
      await auditService.log({
        action: 'key_direct_delete_attempt',
        keyId: keyId,
        ip: clientIP,
        userAgent: userAgent,
        success: false,
        error: 'Invalid admin key',
      });

      throw new AuthenticationError('无效的管理员密钥', {
        code: ErrorCode.INVALID_ADMIN_KEY,
        requestId: context.requestId,
      });
    }

    // 直接删除需要 reason
    const body = await request.json().catch(() => ({}));
    const reasonValidation = validateLength(
      body.reason, 
      KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MIN_LENGTH, 
      KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MAX_LENGTH
    );
    
    if (!body.reason || !reasonValidation) {
      throw new ValidationError(
        `直接删除需要提供原因说明（最少 ${KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MIN_LENGTH} 个字符）`,
        {
          code: ErrorCode.INVALID_REASON,
          requestId: context.requestId,
        }
      );
    }

    // 导入 repository
    const { publicKeyRepository } = await import('@/src/lib/repositories');
    const key = await publicKeyRepository.findById(keyId);
    
    if (!key) {
      throw Errors.notFound('密钥', context.requestId);
    }

    // 执行软删除
    const deletedKey = await publicKeyRepository.softDelete(
      keyId,
      'admin_direct',
      body.reason
    );

    if (!deletedKey) {
      throw new ServerError('删除操作失败', {
        code: ErrorCode.DELETE_FAILED,
        requestId: context.requestId,
      });
    }

    // Audit log for direct deletion - CRITICAL SECURITY EVENT
    await auditService.log({
      action: 'key_direct_delete',
      keyId: keyId,
      channelId: key.channelId,
      ip: clientIP,
      userAgent: userAgent,
      success: true,
      metadata: {
        reason: body.reason,
        deletedId: deletedKey.id,
        isSecurityEvent: true,
      },
    });

    return NextResponse.json(successResponse({
      deletedId: deletedKey.id,
      channelId: deletedKey.channelId,
      deletedAt: new Date().toISOString(),
      deletedBy: 'admin_direct',
    }, '公钥撤销成功（直接删除）'));
  }

  // 无效请求
  throw new ValidationError(
    '请提供 X-API-Key 和 confirmationCode，或提供 X-Admin-Key 进行直接删除',
    {
      code: ErrorCode.INVALID_REQUEST,
      requestId: context.requestId,
    }
  );
});

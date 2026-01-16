// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { keyRevocationService } from '@/src/lib/services';
import { secureCompare, validateLength, KEY_MANAGEMENT_CONFIG } from '@/src/lib/utils/secure-compare';
import { auditService } from '@/src/lib/services/audit.service';

// DELETE /api/keys/:id
// - 新模式: 带 confirmationCode 参数，执行两阶段确认删除
// - 旧模式: 直接删除 (需要 ADMIN_MASTER_KEY)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: keyId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const confirmationCode = searchParams.get('confirmationCode');
    
    const apiKey = request.headers.get('X-API-Key');
    const adminKey = request.headers.get('X-Admin-Key');
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 模式1: 两阶段确认删除 (需要 API Key + 确认码)
    if (confirmationCode && apiKey) {
      const result = await keyRevocationService.confirmRevocation(
        keyId,
        confirmationCode,
        apiKey
      );

      if (!result.success) {
        const statusCodes: Record<string, number> = {
          NOT_FOUND: 404,
          INVALID_CODE: 400,
          LOCKED: 429,
          DELETE_FAILED: 500,
        };

        return NextResponse.json({
          success: false,
          error: {
            message: result.error || 'Failed to confirm revocation',
            code: result.code || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString(),
          },
        }, { status: statusCodes[result.code || ''] || 400 });
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

      return NextResponse.json({
        success: true,
        message: 'Public key revoked successfully',
        data: {
          deletedId: result.deletedId,
          channelId: result.channelId,
          deletedAt: new Date().toISOString(),
          deletedBy: apiKey,
        },
      });
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

        return NextResponse.json({
          success: false,
          error: {
            message: 'Invalid admin key',
            code: 'AUTH_FAILED',
            timestamp: new Date().toISOString(),
          },
        }, { status: 401 });
      }

      // 直接删除需要 reason
      const body = await request.json().catch(() => ({}));
      const reasonValidation = validateLength(
        body.reason, 
        KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MIN_LENGTH, 
        KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MAX_LENGTH
      );
      
      if (!body.reason || !reasonValidation) {
        return NextResponse.json({
          success: false,
          error: {
            message: `Reason required for direct deletion (min ${KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MIN_LENGTH} characters)`,
            code: 'INVALID_REASON',
            timestamp: new Date().toISOString(),
          },
        }, { status: 400 });
      }

      // 导入 repository
      const { publicKeyRepository } = await import('@/src/lib/repositories');
      const key = await publicKeyRepository.findById(keyId);
      
      if (!key) {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Key not found',
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        }, { status: 404 });
      }

      // 执行软删除
      const deletedKey = await publicKeyRepository.softDelete(
        keyId,
        'admin_direct',
        body.reason
      );

      if (!deletedKey) {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Failed to delete key',
            code: 'DELETE_FAILED',
            timestamp: new Date().toISOString(),
          },
        }, { status: 500 });
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

      return NextResponse.json({
        success: true,
        message: 'Public key revoked successfully (direct deletion)',
        data: {
          deletedId: deletedKey.id,
          channelId: deletedKey.channelId,
          deletedAt: new Date().toISOString(),
          deletedBy: 'admin_direct',
        },
      });
    }

    // 无效请求
    return NextResponse.json({
      success: false,
      error: {
        message: 'Either provide X-API-Key with confirmationCode, or X-Admin-Key for direct deletion',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString(),
      },
    }, { status: 400 });
  } catch (error) {
    console.error('Error deleting key:', error);
    return NextResponse.json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { CleanupService } from '@/src/lib/services/cleanup.service';
import { cleanupService, auditService } from '@/src/lib/services';
import { getDatabase } from '@/src/db';
import { auditLogs } from '@/src/db/schema';
import { lt } from 'drizzle-orm';
import {
  withErrorHandler,
  extractRequestContext,
  successResponse,
  ErrorCode,
  AuthenticationError,
} from '@/src/lib/utils/error-handler';

const AUDIT_LOG_RETENTION_DAYS = 90;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);

  const validation = CleanupService.validateCronSecret(request);
  if (!validation.valid) {
    await auditService.log({
      action: 'cron_cleanup_keys_failed',
      ip: context.clientIP,
      userAgent: context.userAgent,
      success: false,
      error: validation.error,
    });

    throw new AuthenticationError(validation.error || '无效的 Cron Secret', {
      code: ErrorCode.AUTH_FAILED,
      requestId: context.requestId,
    });
  }

  const startTime = Date.now();
  const db = getDatabase();

  try {
    const [expiredKeysResult, expiredRevocationsResult] = await Promise.all([
      cleanupService.cleanupRevokedKeys(),
      cleanupService.cleanupExpiredRevocations(),
    ]);

    const auditCutoffDate = new Date();
    auditCutoffDate.setDate(auditCutoffDate.getDate() - AUDIT_LOG_RETENTION_DAYS);

    const deletedAuditLogs = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, auditCutoffDate))
      .returning();

    const duration = `${Date.now() - startTime}ms`;

    const result = {
      task: 'all',
      results: {
        expiredKeys: { deleted: expiredKeysResult.count },
        expiredRevocations: { updated: expiredRevocationsResult.count },
        auditLogs: { deleted: deletedAuditLogs.length },
      },
      errors: [...expiredKeysResult.errors, ...expiredRevocationsResult.errors],
      duration,
    };

    await auditService.log({
      action: 'cron_cleanup_keys',
      ip: context.clientIP,
      userAgent: context.userAgent,
      success: true,
      metadata: result,
    });

    return NextResponse.json(successResponse(result));
  } catch (error) {
    await auditService.log({
      action: 'cron_cleanup_keys_failed',
      ip: context.clientIP,
      userAgent: context.userAgent,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
});

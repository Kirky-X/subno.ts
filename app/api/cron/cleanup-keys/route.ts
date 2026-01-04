// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupExpiredKeys,
  cleanupOldAuditLogs,
  cleanupOrphanedRedisKeys,
  cleanupOldMessages,
} from '@/lib/services/cleanup.service';
import {
  createErrorResponse,
  getRateLimitKey,
  getClientIP,
  isCronIPAllowed,
} from '@/lib/utils/cors.util';
import { RateLimiterService } from '@/lib/services/rate-limiter.service';
import { env } from '@/config/env';

const rateLimiter = new RateLimiterService();

/**
 * GET /api/cron/cleanup-keys
 * Cron job to clean up expired keys and old data
 *
 * This endpoint should be called periodically (e.g., every hour) to clean up:
 * 1. Expired public keys from PostgreSQL and Redis cache
 * 2. Old audit logs based on retention policy
 * 3. Orphaned Redis keys (no corresponding channel)
 * 4. Old messages from queues
 */
export async function GET(request: NextRequest) {
  try {
    // Get client IP for IP whitelist validation
    const clientIP = getClientIP(request);

    // Verify IP whitelist for cron endpoint (fail-closed security)
    if (!isCronIPAllowed(clientIP)) {
      console.warn(`Cron endpoint access denied for IP: ${clientIP}`);
      return createErrorResponse(
        request,
        403,
        'Access denied from this IP address',
        'IP_NOT_ALLOWED'
      );
    }

    // Rate limiting for cron endpoint
    const rateLimitKey = getRateLimitKey(request);
    const allowed = await rateLimiter.checkLimit(rateLimitKey, 10, 60);

    if (!allowed) {
      return createErrorResponse(
        request,
        429,
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED'
      );
    }

    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return createErrorResponse(
        request,
        401,
        'Invalid or missing cron secret',
        'UNAUTHORIZED'
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const task = searchParams.get('task') || 'all';

    let result: {
      expiredKeys?: { deleted: number; errors: string[] };
      auditLogs?: { deleted: number; errors: string[] };
      orphanedKeys?: { deleted: number; errors: string[] };
      oldMessages?: { deleted: number; errors: string[] };
    };

    switch (task) {
      case 'expired-keys':
        result = {
          expiredKeys: await cleanupExpiredKeys(),
        };
        break;

      case 'audit-logs':
        result = {
          auditLogs: await cleanupOldAuditLogs(),
        };
        break;

      case 'orphaned-keys':
        result = {
          orphanedKeys: await cleanupOrphanedRedisKeys(),
        };
        break;

      case 'messages':
        result = {
          oldMessages: await cleanupOldMessages(),
        };
        break;

      case 'all':
      default:
        const [expiredKeys, auditLogs, orphanedKeys, oldMessages] =
          await Promise.all([
            cleanupExpiredKeys(),
            cleanupOldAuditLogs(),
            cleanupOrphanedRedisKeys(),
            cleanupOldMessages(),
          ]);

        result = { expiredKeys, auditLogs, orphanedKeys, oldMessages };
        break;
    }

    return NextResponse.json({
      success: true,
      data: {
        task,
        results: result,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return createErrorResponse(
      request,
      500,
      'Cleanup operation failed',
      'INTERNAL_ERROR'
    );
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupExpiredChannels,
  cleanupTempChannels,
} from '@/lib/services/cleanup.service';
import { createErrorResponse, getRateLimitKey } from '@/lib/utils/cors.util';
import { RateLimiterService } from '@/lib/services/rate-limiter.service';
import { env } from '@/config/env';

const rateLimiter = new RateLimiterService();

/**
 * GET /api/cron/cleanup-channels
 * Cron job to clean up expired channels
 *
 * This endpoint should be called periodically (e.g., every 5 minutes) to clean up:
 * 1. Expired persistent channels from PostgreSQL (marks isActive=false)
 * 2. Expired temporary channels from Redis
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results = {
    persistentChannelsMarkedInactive: 0,
    temporaryChannelsDeleted: 0,
    errors: [] as string[],
  };

  try {
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

    // Verify cron secret for authentication
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

    switch (task) {
      case 'persistent':
        const persistentResult = await cleanupExpiredChannels();
        results.persistentChannelsMarkedInactive = persistentResult.deleted;
        results.errors.push(...persistentResult.errors);
        break;

      case 'temporary':
        const tempResult = await cleanupTempChannels();
        results.temporaryChannelsDeleted = tempResult.deleted;
        results.errors.push(...tempResult.errors);
        break;

      case 'all':
      default:
        const [persistent, temp] = await Promise.all([
          cleanupExpiredChannels(),
          cleanupTempChannels(),
        ]);

        results.persistentChannelsMarkedInactive = persistent.deleted;
        results.temporaryChannelsDeleted = temp.deleted;
        results.errors.push(...persistent.errors, ...temp.errors);
        break;
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        task,
        ...results,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Channel cleanup error:', error);
    return createErrorResponse(
      request,
      500,
      'Channel cleanup operation failed',
      'INTERNAL_ERROR'
    );
  }
}
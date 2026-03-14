// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { CleanupService } from '@/src/lib/services/cleanup.service';
import { channelRepository } from '@/src/lib/repositories';
import { auditService } from '@/src/lib/services';
import {
  withErrorHandler,
  extractRequestContext,
  successResponse,
  ErrorCode,
  AuthenticationError,
} from '@/src/lib/utils/error-handler';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);

  const validation = CleanupService.validateCronSecret(request);
  if (!validation.valid) {
    await auditService.log({
      action: 'cron_cleanup_channels_failed',
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

  try {
    const channels = await channelRepository.findActive(1000);
    const now = new Date();

    let persistentChannelsMarkedInactive = 0;
    let temporaryChannelsDeleted = 0;

    for (const channel of channels) {
      if (channel.expiresAt && now > channel.expiresAt) {
        if (channel.type === 'temporary') {
          await channelRepository.softDelete(channel.id);
          temporaryChannelsDeleted++;
        } else {
          await channelRepository.update(channel.id, { isActive: false });
          persistentChannelsMarkedInactive++;
        }
      }
    }

    const duration = `${Date.now() - startTime}ms`;

    await auditService.log({
      action: 'cron_cleanup_channels',
      ip: context.clientIP,
      userAgent: context.userAgent,
      success: true,
      metadata: {
        persistentChannelsMarkedInactive,
        temporaryChannelsDeleted,
        duration,
      },
    });

    return NextResponse.json(successResponse({
      task: 'all',
      persistentChannelsMarkedInactive,
      temporaryChannelsDeleted,
      duration,
    }));
  } catch (error) {
    await auditService.log({
      action: 'cron_cleanup_channels_failed',
      ip: context.clientIP,
      userAgent: context.userAgent,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
});

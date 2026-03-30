// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { subscribeService } from '@/src/lib/services';
import { checkRateLimit } from '@/src/lib/middleware/rate-limit';
import { requireApiKey } from '@/src/lib/middleware/api-key';
import {
  withErrorHandler,
  extractRequestContext,
  Errors,
  ErrorCode,
  ValidationError,
} from '@/src/lib/utils/error-handler';

export const GET = withErrorHandler(async (request: NextRequest) => {
  // 首先验证 API Key 认证
  const authError = await requireApiKey(request);
  if (authError) return authError;

  const context = extractRequestContext(request);
  const searchParams = request.nextUrl.searchParams;

  const channel = searchParams.get('channel');
  const lastEventId = searchParams.get('lastEventId') || undefined;

  if (!channel) {
    throw new ValidationError('请提供 channel 参数', {
      code: ErrorCode.MISSING_PARAMETER,
      requestId: context.requestId,
    });
  }

  const rateLimitResult = await checkRateLimit(request, 'subscribe');
  if (rateLimitResult) {
    return rateLimitResult;
  }

  const validation = await subscribeService.validateChannel(channel);
  if (!validation.valid) {
    if (validation.code === 'CHANNEL_NOT_FOUND') {
      throw Errors.notFound('频道', context.requestId);
    }
    if (validation.code === 'CHANNEL_INACTIVE') {
      throw Errors.forbidden('频道已停用', context.requestId);
    }
    throw Errors.internal(new Error(validation.error), context.requestId);
  }

  const stream = subscribeService.createSSEStream({
    channel,
    lastEventId,
  }, {
    ip: context.clientIP,
    userAgent: context.userAgent,
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { publishService, type MessagePriority } from '@/src/lib/services';
import { checkRateLimit } from '@/src/lib/middleware/rate-limit';
import {
  withErrorHandler,
  extractRequestContext,
  successResponse,
  Errors,
  ErrorCode,
  ValidationError,
  ResourceError,
} from '@/src/lib/utils/error-handler';
import { z } from 'zod';

const publishSchema = z.object({
  channel: z.string().min(1, '频道不能为空'),
  message: z.string().min(1, '消息不能为空'),
  priority: z.enum(['critical', 'high', 'normal', 'low', 'bulk']).optional(),
  sender: z.string().max(255).optional(),
  cache: z.boolean().optional(),
  encrypted: z.boolean().optional(),
  autoCreate: z.boolean().optional(),
  signature: z.string().max(512).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);

  const rateLimitResult = await checkRateLimit(request, 'publish');
  if (rateLimitResult) {
    return rateLimitResult;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('无效的 JSON 格式', {
      code: ErrorCode.INVALID_REQUEST,
      requestId: context.requestId,
    });
  }

  const validationResult = publishSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0]?.message || '参数验证失败', {
      code: ErrorCode.VALIDATION_ERROR,
      details: { errors: validationResult.error.errors },
      requestId: context.requestId,
    });
  }

  const result = await publishService.publish(validationResult.data as {
    channel: string;
    message: string;
    priority?: MessagePriority;
    sender?: string;
    cache?: boolean;
    encrypted?: boolean;
    autoCreate?: boolean;
    signature?: string;
  }, {
    ip: context.clientIP,
    userAgent: context.userAgent,
  });

  if (!result.success) {
    if (result.code === 'MISSING_CHANNEL' || result.code === 'MISSING_MESSAGE') {
      throw new ValidationError(result.error || '缺少必需参数', {
        code: ErrorCode.MISSING_PARAMETER,
        requestId: context.requestId,
      });
    }
    if (result.code === 'MESSAGE_TOO_LARGE') {
      throw new ValidationError(result.error || '消息太大', {
        code: ErrorCode.VALIDATION_ERROR,
        requestId: context.requestId,
      });
    }
    if (result.code === 'CHANNEL_NOT_FOUND') {
      throw Errors.notFound('频道', context.requestId);
    }
    if (result.code === 'CHANNEL_INACTIVE') {
      throw new ResourceError('频道已停用', {
        code: ErrorCode.INVALID_STATE,
        requestId: context.requestId,
      });
    }
    throw Errors.internal(new Error(result.error), context.requestId);
  }

  return NextResponse.json(successResponse({
    messageId: result.messageId,
    channel: result.channel,
    publishedAt: result.publishedAt,
    autoCreated: result.autoCreated,
  }), { status: 201 });
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);
  const searchParams = request.nextUrl.searchParams;

  const channel = searchParams.get('channel');
  const count = searchParams.get('count');

  if (!channel) {
    throw new ValidationError('请提供 channel 参数', {
      code: ErrorCode.MISSING_PARAMETER,
      requestId: context.requestId,
    });
  }

  const result = await publishService.getQueueStatus(
    channel,
    count ? parseInt(count, 10) : 10
  );

  if (!result.success) {
    throw Errors.internal(new Error(result.error), context.requestId);
  }

  return NextResponse.json(successResponse(result.data));
});

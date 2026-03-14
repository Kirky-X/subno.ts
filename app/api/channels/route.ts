// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { channelService } from '@/src/lib/services';
import { checkRateLimit } from '@/src/lib/middleware/rate-limit';
import { requireApiKey } from '@/src/lib/middleware/api-key';
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

const createChannelSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().max(255).optional(),
  description: z.string().optional(),
  type: z.enum(['public', 'encrypted', 'temporary']).optional(),
  creator: z.string().max(255).optional(),
  expiresIn: z.number().int().positive().max(30 * 24 * 60 * 60).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);

  const authError = await requireApiKey(request);
  if (authError) {
    return authError;
  }

  const rateLimitResult = await checkRateLimit(request, 'default');
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

  const validationResult = createChannelSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0]?.message || '参数验证失败', {
      code: ErrorCode.VALIDATION_ERROR,
      details: { errors: validationResult.error.errors },
      requestId: context.requestId,
    });
  }

  const result = await channelService.create(validationResult.data, {
    ip: context.clientIP,
    userAgent: context.userAgent,
  });

  if (!result.success) {
    if (result.code === 'CHANNEL_EXISTS') {
      throw new ResourceError(result.error || '频道已存在', {
        code: ErrorCode.ALREADY_EXISTS,
        requestId: context.requestId,
      });
    }
    if (result.code === 'INVALID_EXPIRATION') {
      throw new ValidationError(result.error || '无效的有效期', {
        code: ErrorCode.VALIDATION_ERROR,
        requestId: context.requestId,
      });
    }
    throw Errors.internal(new Error(result.error), context.requestId);
  }

  return NextResponse.json(successResponse(result.channel), { status: 201 });
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);
  const searchParams = request.nextUrl.searchParams;

  const id = searchParams.get('id');
  const type = searchParams.get('type') || undefined;
  const creator = searchParams.get('creator') || undefined;
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');

  const result = await channelService.query({
    id: id || undefined,
    type,
    creator,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  if (!result.success) {
    if (result.code === 'NOT_FOUND') {
      throw Errors.notFound('频道', context.requestId);
    }
    throw Errors.internal(new Error(result.error), context.requestId);
  }

  const response: Record<string, unknown> = {
    success: true,
    data: result.data,
  };
  if (result.pagination) {
    response.pagination = result.pagination;
  }

  return NextResponse.json(response);
});

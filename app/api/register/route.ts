// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { registerService } from '@/src/lib/services';
import { checkRateLimit } from '@/src/lib/middleware/rate-limit';
import { requireApiKey } from '@/src/lib/middleware';
import {
  withErrorHandler,
  extractRequestContext,
  successResponse,
  Errors,
  ErrorCode,
  ValidationError,
  AuthenticationError,
} from '@/src/lib/utils/error-handler';
import { z } from 'zod';

const registerSchema = z.object({
  publicKey: z.string().min(1, '公钥不能为空'),
  algorithm: z.enum(['RSA-2048', 'RSA-4096', 'ECC-SECP256K1']).optional(),
  expiresIn: z.number().int().positive().max(30 * 24 * 60 * 60).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);

  const authError = await requireApiKey(request);
  if (authError) {
    throw new AuthenticationError('API Key 认证失败', {
      code: ErrorCode.AUTH_FAILED,
      requestId: context.requestId,
    });
  }

  const rateLimitResult = await checkRateLimit(request, 'register');
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

  const validationResult = registerSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0]?.message || '参数验证失败', {
      code: ErrorCode.VALIDATION_ERROR,
      details: { errors: validationResult.error.errors },
      requestId: context.requestId,
    });
  }

  const result = await registerService.register(validationResult.data, {
    ip: context.clientIP,
    userAgent: context.userAgent,
  });

  if (!result.success) {
    if (result.code === 'INVALID_PUBLIC_KEY') {
      throw new ValidationError(result.error || '无效的公钥格式', {
        code: ErrorCode.VALIDATION_ERROR,
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

  const response = NextResponse.json(
    successResponse({
      channelId: result.channelId,
      publicKeyId: result.publicKeyId,
      algorithm: result.algorithm,
      expiresAt: result.expiresAt,
      expiresIn: result.expiresIn,
    }),
    { status: 201 }
  );

  return response;
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const context = extractRequestContext(request);
  const searchParams = request.nextUrl.searchParams;

  const channelId = searchParams.get('channelId');
  const keyId = searchParams.get('keyId');

  if (!channelId && !keyId) {
    throw new ValidationError('请提供 channelId 或 keyId 参数', {
      code: ErrorCode.MISSING_PARAMETER,
      requestId: context.requestId,
    });
  }

  let result;
  if (channelId) {
    result = await registerService.queryByChannelId(channelId);
  } else if (keyId) {
    result = await registerService.queryByKeyId(keyId);
  } else {
    result = { success: false, error: '无效的查询参数', code: 'INVALID_QUERY' };
  }

  if (!result.success) {
    if (result.code === 'NOT_FOUND') {
      throw Errors.notFound('公钥', context.requestId);
    }
    throw Errors.internal(new Error(result.error), context.requestId);
  }

  return NextResponse.json(successResponse(result.data));
});

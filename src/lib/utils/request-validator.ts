// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ValidationError, ErrorCode } from './error-handler';

export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
  requestId: string
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ValidationError('无效的 JSON 格式', {
      code: ErrorCode.INVALID_REQUEST,
      requestId,
    });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new ValidationError(
      firstError?.message || '参数验证失败',
      {
        code: ErrorCode.VALIDATION_ERROR,
        details: { errors: result.error.errors },
        requestId,
      }
    );
  }

  return result.data;
}

export function validateRequiredString(
  value: unknown,
  fieldName: string,
  requestId: string
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} 不能为空`, {
      code: ErrorCode.MISSING_PARAMETER,
      requestId,
    });
  }
  return value.trim();
}

export function validateOptionalString(
  value: unknown,
  maxLength: number = 1000
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return trimmed.substring(0, maxLength);
  }
  return trimmed || undefined;
}

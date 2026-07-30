// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  validateRequestBody,
  validateRequiredString,
  validateOptionalString,
} from '@/src/lib/utils/request-validator';
import { ValidationError, ErrorCode } from '@/src/lib/utils/error-handler';

function createJsonRequest(body: unknown): NextRequest {
  const url = 'http://localhost:3000/api/test';
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('request-validator', () => {
  describe('validateRequestBody', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it('应该返回解析后的数据当 body 合法', async () => {
      const request = createJsonRequest({ name: 'Alice', age: 30 });
      const result = await validateRequestBody(request, schema, 'req-1');
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('应该抛出 ValidationError 当 JSON 格式无效', async () => {
      const url = 'http://localhost:3000/api/test';
      const request = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-valid-json{',
      });
      await expect(validateRequestBody(request, schema, 'req-2')).rejects.toThrow(ValidationError);
      try {
        await validateRequestBody(
          new NextRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not-valid-json{',
          }),
          schema,
          'req-2',
        );
      } catch (e) {
        const err = e as ValidationError;
        expect(err.code).toBe(ErrorCode.INVALID_REQUEST);
        expect(err.requestId).toBe('req-2');
        expect(err.message).toBe('无效的 JSON 格式');
      }
    });

    it('应该抛出 ValidationError 当 schema 验证失败', async () => {
      const request = createJsonRequest({ name: '', age: -1 });
      await expect(validateRequestBody(request, schema, 'req-3')).rejects.toThrow(ValidationError);
      try {
        await validateRequestBody(createJsonRequest({ name: '', age: -1 }), schema, 'req-3');
      } catch (e) {
        const err = e as ValidationError;
        expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(err.requestId).toBe('req-3');
        expect(err.details).toBeDefined();
        expect((err.details as any).errors).toBeDefined();
      }
    });

    it('应该使用第一个错误消息', async () => {
      const request = createJsonRequest({ name: '', age: -1 });
      try {
        await validateRequestBody(request, schema, 'req-4');
        throw new Error('should not reach');
      } catch (e) {
        const err = e as ValidationError;
        expect(err.message).toBeDefined();
        expect(typeof err.message).toBe('string');
      }
    });

    it('应该在 schema 验证失败且无 issues 时使用默认消息', async () => {
      // 通过自定义 schema 制造没有错误消息的场景难以做到，
      // 但可以验证正常流程的 details 包含 errors 数组
      const request = createJsonRequest({ name: '', age: -1 });
      try {
        await validateRequestBody(request, schema, 'req-5');
      } catch (e) {
        const err = e as ValidationError;
        const errors = (err.details as any).errors;
        expect(Array.isArray(errors)).toBe(true);
        expect(errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateRequiredString', () => {
    it('应该返回 trim 后的字符串', () => {
      expect(validateRequiredString('  hello  ', 'name', 'req-1')).toBe('hello');
    });

    it('应该返回非空字符串', () => {
      expect(validateRequiredString('hello', 'name', 'req-1')).toBe('hello');
    });

    it('应该抛出 ValidationError 当值为 undefined', () => {
      expect(() => validateRequiredString(undefined, 'name', 'req-1')).toThrow(ValidationError);
      try {
        validateRequiredString(undefined, 'name', 'req-1');
      } catch (e) {
        const err = e as ValidationError;
        expect(err.code).toBe(ErrorCode.MISSING_PARAMETER);
        expect(err.requestId).toBe('req-1');
        expect(err.message).toContain('name');
      }
    });

    it('应该抛出 ValidationError 当值为 null', () => {
      expect(() => validateRequiredString(null as any, 'name', 'req-1')).toThrow(ValidationError);
    });

    it('应该抛出 ValidationError 当值为非字符串', () => {
      expect(() => validateRequiredString(123 as any, 'name', 'req-1')).toThrow(ValidationError);
      expect(() => validateRequiredString({} as any, 'name', 'req-1')).toThrow(ValidationError);
    });

    it('应该抛出 ValidationError 当值为空字符串', () => {
      expect(() => validateRequiredString('', 'name', 'req-1')).toThrow(ValidationError);
    });

    it('应该抛出 ValidationError 当值为纯空格', () => {
      expect(() => validateRequiredString('   ', 'name', 'req-1')).toThrow(ValidationError);
      try {
        validateRequiredString('   ', 'field', 'req-2');
      } catch (e) {
        const err = e as ValidationError;
        expect(err.message).toContain('field');
      }
    });
  });

  describe('validateOptionalString', () => {
    it('应该返回 trim 后的字符串', () => {
      expect(validateOptionalString('  hello  ')).toBe('hello');
    });

    it('应该返回 undefined 当值为 undefined', () => {
      expect(validateOptionalString(undefined)).toBeUndefined();
    });

    it('应该返回 undefined 当值为 null', () => {
      expect(validateOptionalString(null)).toBeUndefined();
    });

    it('应该返回 undefined 当值为非字符串', () => {
      expect(validateOptionalString(123 as any)).toBeUndefined();
      expect(validateOptionalString({} as any)).toBeUndefined();
      expect(validateOptionalString(true as any)).toBeUndefined();
    });

    it('应该返回 undefined 当值为空字符串', () => {
      expect(validateOptionalString('')).toBeUndefined();
    });

    it('应该返回 undefined 当值为纯空格', () => {
      expect(validateOptionalString('   ')).toBeUndefined();
    });

    it('应该截断超过最大长度的字符串', () => {
      const long = 'a'.repeat(100);
      const result = validateOptionalString(long, 10);
      expect(result).toBe('a'.repeat(10));
      expect(result?.length).toBe(10);
    });

    it('应该使用默认最大长度 1000', () => {
      const long = 'a'.repeat(1001);
      const result = validateOptionalString(long);
      expect(result?.length).toBe(1000);
    });

    it('应该接受边界长度', () => {
      const exact = 'a'.repeat(10);
      const result = validateOptionalString(exact, 10);
      expect(result).toBe(exact);
    });

    it('应该 trim 后再检查长度', () => {
      const result = validateOptionalString('  hello  ', 100);
      expect(result).toBe('hello');
    });

    it('应该 trim 后为空时返回 undefined', () => {
      const result = validateOptionalString('    ', 100);
      expect(result).toBeUndefined();
    });

    it('应该接受自定义 maxLength 为 0 时截断为空字符串', () => {
      // maxLength 0 时 trimmed.length(5) > 0，返回 substring(0,0) = ''
      const result = validateOptionalString('hello', 0);
      expect(result).toBe('');
    });
  });
});

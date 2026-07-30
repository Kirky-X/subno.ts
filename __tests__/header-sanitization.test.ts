// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import {
  SENSITIVE_HEADERS,
  isSensitiveHeader,
  sanitizeHeaderValue,
  sanitizeHeaders,
  sanitizeHeadersForLog,
  sanitizeHeaderForLog,
  headersContainSensitiveInfo,
} from '@/src/lib/utils/header-sanitization';

describe('header-sanitization', () => {
  describe('SENSITIVE_HEADERS', () => {
    it('应该包含所有敏感头名称（小写）', () => {
      expect(SENSITIVE_HEADERS).toContain('authorization');
      expect(SENSITIVE_HEADERS).toContain('x-api-key');
      expect(SENSITIVE_HEADERS).toContain('x-auth-token');
      expect(SENSITIVE_HEADERS).toContain('cookie');
      expect(SENSITIVE_HEADERS).toContain('set-cookie');
      expect(SENSITIVE_HEADERS).toContain('proxy-authorization');
      expect(SENSITIVE_HEADERS).toContain('x-forwarded-for');
      expect(SENSITIVE_HEADERS).toContain('x-real-ip');
    });
  });

  describe('isSensitiveHeader', () => {
    it('应该识别小写的敏感头', () => {
      expect(isSensitiveHeader('authorization')).toBe(true);
      expect(isSensitiveHeader('cookie')).toBe(true);
      expect(isSensitiveHeader('x-api-key')).toBe(true);
    });

    it('应该识别大小写不敏感', () => {
      expect(isSensitiveHeader('Authorization')).toBe(true);
      expect(isSensitiveHeader('AUTHORIZATION')).toBe(true);
      expect(isSensitiveHeader('Cookie')).toBe(true);
      expect(isSensitiveHeader('X-API-KEY')).toBe(true);
    });

    it('应该识别包含敏感头的名称', () => {
      expect(isSensitiveHeader('x-forwarded-for')).toBe(true);
      expect(isSensitiveHeader('X-Forwarded-For')).toBe(true);
    });

    it('应该对非敏感头返回 false', () => {
      expect(isSensitiveHeader('content-type')).toBe(false);
      expect(isSensitiveHeader('accept')).toBe(false);
      expect(isSensitiveHeader('user-agent')).toBe(false);
    });

    it('应该处理空字符串', () => {
      expect(isSensitiveHeader('')).toBe(false);
    });
  });

  describe('sanitizeHeaderValue', () => {
    it('应该对敏感头返回 [REDACTED]', () => {
      expect(sanitizeHeaderValue('authorization', 'Bearer token123')).toBe('[REDACTED]');
      expect(sanitizeHeaderValue('cookie', 'session=abc')).toBe('[REDACTED]');
      expect(sanitizeHeaderValue('x-api-key', 'key123')).toBe('[REDACTED]');
    });

    it('应该对大小写不敏感', () => {
      expect(sanitizeHeaderValue('Authorization', 'Bearer token123')).toBe('[REDACTED]');
      expect(sanitizeHeaderValue('COOKIE', 'session=abc')).toBe('[REDACTED]');
    });

    it('应该保留非敏感头的原始值', () => {
      expect(sanitizeHeaderValue('content-type', 'application/json')).toBe('application/json');
      expect(sanitizeHeaderValue('user-agent', 'Mozilla/5.0')).toBe('Mozilla/5.0');
    });
  });

  describe('sanitizeHeaders', () => {
    it('应该返回新的 Headers 对象并脱敏敏感头', () => {
      const headers = new Headers({
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
        Cookie: 'session=abc',
      });
      const sanitized = sanitizeHeaders(headers);
      expect(sanitized.get('authorization')).toBe('[REDACTED]');
      expect(sanitized.get('content-type')).toBe('application/json');
      expect(sanitized.get('cookie')).toBe('[REDACTED]');
    });

    it('应该不修改原始 Headers', () => {
      const headers = new Headers({ Authorization: 'Bearer token' });
      sanitizeHeaders(headers);
      expect(headers.get('authorization')).toBe('Bearer token');
    });

    it('应该处理空 Headers', () => {
      const sanitized = sanitizeHeaders(new Headers());
      expect(Array.from(sanitized.entries())).toHaveLength(0);
    });

    it('应该返回 Headers 实例', () => {
      const sanitized = sanitizeHeaders(new Headers());
      expect(sanitized).toBeInstanceOf(Headers);
    });
  });

  describe('sanitizeHeadersForLog', () => {
    it('应该返回普通对象并脱敏敏感头', () => {
      const headers = new Headers({
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
        'X-API-Key': 'key123',
      });
      const result = sanitizeHeadersForLog(headers);
      expect(result).toEqual({
        authorization: '[REDACTED]',
        'content-type': 'application/json',
        'x-api-key': '[REDACTED]',
      });
    });

    it('应该处理空 Headers', () => {
      const result = sanitizeHeadersForLog(new Headers());
      expect(result).toEqual({});
    });

    it('应该返回普通对象而非 Headers 实例', () => {
      const result = sanitizeHeadersForLog(new Headers({ 'content-type': 'application/json' }));
      expect(result).not.toBeInstanceOf(Headers);
      expect(typeof result).toBe('object');
    });
  });

  describe('sanitizeHeaderForLog', () => {
    it('应该对敏感头返回 [REDACTED]', () => {
      expect(sanitizeHeaderForLog('authorization', 'Bearer token')).toBe('[REDACTED]');
      expect(sanitizeHeaderForLog('Authorization', 'Bearer token')).toBe('[REDACTED]');
    });

    it('应该保留非敏感头值', () => {
      expect(sanitizeHeaderForLog('content-type', 'application/json')).toBe('application/json');
    });
  });

  describe('headersContainSensitiveInfo', () => {
    it('应该检测到敏感头', () => {
      const headers = new Headers({ Authorization: 'Bearer token' });
      expect(headersContainSensitiveInfo(headers)).toBe(true);
    });

    it('应该检测到 cookie 头', () => {
      const headers = new Headers({ Cookie: 'session=abc' });
      expect(headersContainSensitiveInfo(headers)).toBe(true);
    });

    it('应该对无敏感头返回 false', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      expect(headersContainSensitiveInfo(headers)).toBe(false);
    });

    it('应该对空 Headers 返回 false', () => {
      expect(headersContainSensitiveInfo(new Headers())).toBe(false);
    });

    it('应该对所有 SENSITIVE_HEADERS 进行检测', () => {
      // Headers 对大小写不敏感，使用小写键设置
      const cases = [
        'authorization',
        'x-api-key',
        'x-auth-token',
        'cookie',
        'set-cookie',
        'proxy-authorization',
        'x-forwarded-for',
        'x-real-ip',
      ];
      for (const header of cases) {
        const headers = new Headers();
        headers.set(header, 'value');
        expect(headersContainSensitiveInfo(headers)).toBe(true);
      }
    });
  });
});

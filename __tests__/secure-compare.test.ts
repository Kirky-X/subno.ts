// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import {
  KEY_MANAGEMENT_CONFIG,
  secureCompare,
  validateLength,
  containsInvalidCharacters,
  sanitizeErrorMessage,
} from '@/src/lib/utils/secure-compare';

describe('secure-compare', () => {
  describe('KEY_MANAGEMENT_CONFIG', () => {
    it('应该包含正确的 API key 长度配置', () => {
      expect(KEY_MANAGEMENT_CONFIG.API_KEY_MIN_LENGTH).toBe(32);
      expect(KEY_MANAGEMENT_CONFIG.API_KEY_MAX_LENGTH).toBe(128);
    });

    it('应该包含正确的撤销配置', () => {
      expect(KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MIN_LENGTH).toBe(10);
      expect(KEY_MANAGEMENT_CONFIG.REVOCATION_REASON_MAX_LENGTH).toBe(1000);
      expect(KEY_MANAGEMENT_CONFIG.REVOCATION_MAX_ATTEMPTS).toBe(5);
      expect(KEY_MANAGEMENT_CONFIG.REVOCATION_LOCKOUT_MINUTES).toBe(60);
      expect(KEY_MANAGEMENT_CONFIG.REVOCATION_DEFAULT_EXPIRY_HOURS).toBe(24);
    });

    it('应该包含批处理和清理配置', () => {
      expect(KEY_MANAGEMENT_CONFIG.BATCH_SIZE).toBe(500);
      expect(KEY_MANAGEMENT_CONFIG.DEFAULT_CLEANUP_DAYS).toBe(30);
      expect(KEY_MANAGEMENT_CONFIG.DEFAULT_AUDIT_RETENTION_DAYS).toBe(90);
      expect(KEY_MANAGEMENT_CONFIG.DEFAULT_API_KEY_EXPIRY_DAYS).toBe(365);
    });
  });

  describe('secureCompare', () => {
    it('应该对相同字符串返回 true', () => {
      expect(secureCompare('hello', 'hello')).toBe(true);
    });

    it('应该对不同字符串返回 false', () => {
      expect(secureCompare('hello', 'world')).toBe(false);
    });

    it('应该对长度不同的字符串返回 false', () => {
      expect(secureCompare('short', 'longer-string')).toBe(false);
    });

    it('应该对空字符串返回 true（相同）', () => {
      expect(secureCompare('', '')).toBe(true);
    });

    it('应该对非字符串第一个参数返回 false', () => {
      expect(secureCompare(null as any, 'test')).toBe(false);
      expect(secureCompare(undefined as any, 'test')).toBe(false);
      expect(secureCompare(123 as any, 'test')).toBe(false);
      expect(secureCompare({} as any, 'test')).toBe(false);
    });

    it('应该对非字符串第二个参数返回 false', () => {
      expect(secureCompare('test', null as any)).toBe(false);
      expect(secureCompare('test', undefined as any)).toBe(false);
      expect(secureCompare('test', 123 as any)).toBe(false);
      expect(secureCompare('test', {} as any)).toBe(false);
    });

    it('应该对两个非字符串返回 false', () => {
      expect(secureCompare(null as any, null as any)).toBe(false);
      expect(secureCompare(123 as any, 123 as any)).toBe(false);
    });

    it('应该处理 Unicode 字符串', () => {
      expect(secureCompare('你好世界', '你好世界')).toBe(true);
      expect(secureCompare('你好世界', '你好地球')).toBe(false);
    });

    it('应该处理长字符串', () => {
      const long = 'a'.repeat(10000);
      expect(secureCompare(long, long)).toBe(true);
      expect(secureCompare(long, 'b'.repeat(10000))).toBe(false);
    });

    it('应该处理特殊字符', () => {
      expect(secureCompare('!@#$%^&*()', '!@#$%^&*()')).toBe(true);
      expect(secureCompare('!@#$%^&*()', '!@#$%^&*(')).toBe(false);
    });
  });

  describe('validateLength', () => {
    it('应该返回 true 当长度在范围内', () => {
      expect(validateLength('hello', 1, 10)).toBe(true);
      expect(validateLength('hello', 5, 10)).toBe(true);
      expect(validateLength('hello', 1, 5)).toBe(true);
    });

    it('应该返回 false 当长度小于 min', () => {
      expect(validateLength('hi', 5, 10)).toBe(false);
    });

    it('应该返回 false 当长度大于 max', () => {
      expect(validateLength('hello world', 1, 5)).toBe(false);
    });

    it('应该在边界值返回 true', () => {
      expect(validateLength('hello', 5, 5)).toBe(true);
    });

    it('应该接受空字符串当 min 为 0', () => {
      expect(validateLength('', 0, 10)).toBe(true);
    });

    it('应该拒绝空字符串当 min > 0', () => {
      expect(validateLength('', 1, 10)).toBe(false);
    });

    it('应该对非字符串返回 false', () => {
      expect(validateLength(null as any, 1, 10)).toBe(false);
      expect(validateLength(undefined as any, 1, 10)).toBe(false);
      expect(validateLength(123 as any, 1, 10)).toBe(false);
      expect(validateLength({} as any, 1, 10)).toBe(false);
    });
  });

  describe('containsInvalidCharacters', () => {
    it('应该对正常字符串返回 false', () => {
      expect(containsInvalidCharacters('Hello World')).toBe(false);
      expect(containsInvalidCharacters('正常的字符串')).toBe(false);
    });

    it('应该接受制表符（9）', () => {
      expect(containsInvalidCharacters('hello\tworld')).toBe(false);
    });

    it('应该接受换行符（10）', () => {
      expect(containsInvalidCharacters('hello\nworld')).toBe(false);
    });

    it('应该接受回车符（13）', () => {
      expect(containsInvalidCharacters('hello\rworld')).toBe(false);
    });

    it('应该检测空字节控制字符（0）', () => {
      expect(containsInvalidCharacters('hello\x00world')).toBe(true);
    });

    it('应该检测其他控制字符（如 1-8）', () => {
      expect(containsInvalidCharacters('hello\x01world')).toBe(true);
      expect(containsInvalidCharacters('hello\x02world')).toBe(true);
      expect(containsInvalidCharacters('hello\x08world')).toBe(true);
    });

    it('应该检测控制字符 11（在 0-31 之间，非 9/10/13）', () => {
      expect(containsInvalidCharacters('hello\x0bworld')).toBe(true);
    });

    it('应该检测控制字符 12', () => {
      expect(containsInvalidCharacters('hello\x0cworld')).toBe(true);
    });

    it('应该检测控制字符 14-31', () => {
      expect(containsInvalidCharacters('hello\x0eworld')).toBe(true);
      expect(containsInvalidCharacters('hello\x1fworld')).toBe(true);
    });

    it('应该对空字符串返回 false', () => {
      expect(containsInvalidCharacters('')).toBe(false);
    });

    it('应该对非字符串返回 true', () => {
      expect(containsInvalidCharacters(null as any)).toBe(true);
      expect(containsInvalidCharacters(undefined as any)).toBe(true);
      expect(containsInvalidCharacters(123 as any)).toBe(true);
      expect(containsInvalidCharacters({} as any)).toBe(true);
    });

    it('应该接受 ASCII 32（空格）及以上', () => {
      expect(containsInvalidCharacters(' ')).toBe(false);
      expect(containsInvalidCharacters('!')).toBe(false);
      expect(containsInvalidCharacters('~')).toBe(false);
    });

    it('应该处理 Unicode 字符（非代理项）', () => {
      // BMP 字符 charCode 不会落入 0xd800-0xdfff
      expect(containsInvalidCharacters('你好')).toBe(false);
      // 表情符号可能涉及代理对，charCodeAt 返回代理项码点
      // '🌍' = U+1F30D，UTF-16 表示为代理对 0xD83C 0xDF0D
      expect(containsInvalidCharacters('🌍')).toBe(true);
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('应该在无 id 时返回通用消息', () => {
      const result = sanitizeErrorMessage('fetch');
      expect(result).toBe('Failed to fetch: Operation failed');
    });

    it('应该在 id 为 undefined 时返回通用消息', () => {
      const result = sanitizeErrorMessage('fetch', undefined);
      expect(result).toBe('Failed to fetch: Operation failed');
    });

    it('应该在 id 长度 <= 8 时返回通用消息', () => {
      expect(sanitizeErrorMessage('fetch', 'short')).toBe('Failed to fetch: Operation failed');
      expect(sanitizeErrorMessage('fetch', '12345678')).toBe('Failed to fetch: Operation failed');
    });

    it('应该在 id 长度 > 8 时返回脱敏的消息', () => {
      const result = sanitizeErrorMessage('fetch', '123456789');
      expect(result).toBe('Failed to fetch record 1234...6789: Operation failed');
    });

    it('应该脱敏长 id（显示前 4 和后 4 字符）', () => {
      const result = sanitizeErrorMessage('delete', 'abcdefghij');
      expect(result).toBe('Failed to delete record abcd...ghij: Operation failed');
    });

    it('应该处理非常长的 id', () => {
      const longId = 'a'.repeat(100);
      const result = sanitizeErrorMessage('update', longId);
      expect(result).toBe(`Failed to update record aaaa...aaaa: Operation failed`);
    });

    it('应该处理边界长度（9）', () => {
      const result = sanitizeErrorMessage('fetch', '123456789');
      expect(result).toBe('Failed to fetch record 1234...6789: Operation failed');
    });

    it('应该处理边界长度（8，使用通用消息）', () => {
      const result = sanitizeErrorMessage('fetch', '12345678');
      expect(result).toBe('Failed to fetch: Operation failed');
    });
  });
});

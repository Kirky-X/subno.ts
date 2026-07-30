// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseEnvInt, isValidUUID } from '@/src/lib/utils/env.utils';

describe('env.utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parseEnvInt', () => {
    it('应该返回 env 中设置的值', () => {
      process.env.TEST_INT = '42';
      expect(parseEnvInt('TEST_INT', 10, 0, 100)).toBe(42);
    });

    it('应该返回默认值当 env 未设置', () => {
      delete process.env.TEST_INT;
      expect(parseEnvInt('TEST_INT', 15, 0, 100)).toBe(15);
    });

    it('应该返回默认值当 env 为空字符串（parseInt 走 fallback）', () => {
      process.env.TEST_INT = '';
      // parseInt('' || String(15), 10) => parseInt('15', 10) => 15
      expect(parseEnvInt('TEST_INT', 15, 0, 100)).toBe(15);
    });

    it('应该返回默认值当 env 为 NaN', () => {
      process.env.TEST_INT = 'not-a-number';
      // parseInt('not-a-number', 10) => NaN
      expect(parseEnvInt('TEST_INT', 15, 0, 100)).toBe(15);
    });

    it('应该返回默认值当值小于 min', () => {
      process.env.TEST_INT = '-5';
      expect(parseEnvInt('TEST_INT', 10, 0, 100)).toBe(10);
    });

    it('应该返回默认值当值等于 min 边界外（min 为正但值为 0 且 min>0）', () => {
      process.env.TEST_INT = '0';
      expect(parseEnvInt('TEST_INT', 5, 1, 100)).toBe(5);
    });

    it('应该返回 max 当值超过 max', () => {
      process.env.TEST_INT = '500';
      expect(parseEnvInt('TEST_INT', 10, 0, 100)).toBe(100);
    });

    it('应该接受等于 min 的值', () => {
      process.env.TEST_INT = '0';
      expect(parseEnvInt('TEST_INT', 10, 0, 100)).toBe(0);
    });

    it('应该接受等于 max 的值', () => {
      process.env.TEST_INT = '100';
      expect(parseEnvInt('TEST_INT', 10, 0, 100)).toBe(100);
    });

    it('应该处理负数合法值', () => {
      process.env.TEST_INT = '-50';
      expect(parseEnvInt('TEST_INT', 0, -100, 100)).toBe(-50);
    });

    it('应该处理浮点字符串（取整）', () => {
      process.env.TEST_INT = '42.9';
      // parseInt('42.9', 10) => 42
      expect(parseEnvInt('TEST_INT', 0, 0, 100)).toBe(42);
    });

    it('应该处理带空格的数字字符串', () => {
      process.env.TEST_INT = '  42  ';
      // parseInt 会忽略首尾空格
      expect(parseEnvInt('TEST_INT', 0, 0, 100)).toBe(42);
    });

    it('应该处理十六进制前缀', () => {
      process.env.TEST_INT = '0x10';
      // parseInt('0x10', 10) => 0（因为 10 进制下 0x 不是有效数字前缀，解析到 0）
      expect(parseEnvInt('TEST_INT', 5, 0, 100)).toBe(0);
    });
  });

  describe('isValidUUID', () => {
    it('应该接受合法的 UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('应该接受大写 UUID v4', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('应该拒绝非 v4 UUID', () => {
      expect(isValidUUID('550e8400-e29b-31d4-a716-446655440000')).toBe(false);
    });

    it('应该拒绝格式错误的字符串', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('应该拒绝空字符串', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('应该拒绝非字符串输入', () => {
      expect(isValidUUID(123 as any)).toBe(false);
      expect(isValidUUID(null as any)).toBe(false);
      expect(isValidUUID(undefined as any)).toBe(false);
      expect(isValidUUID({} as any)).toBe(false);
    });
  });
});

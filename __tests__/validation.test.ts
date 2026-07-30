// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import {
  API_KEY_VALIDATION_CONFIG,
  validateApiKeyFormat,
  isValidUUID,
  channelIdSchema,
  messageSchema,
  publicKeyRegistrationSchema,
  channelCreationSchema,
  paginationSchema,
  apiKeyCreationSchema,
  keyRevocationSchema,
  validateData,
} from '@/src/lib/utils/validation';

describe('validation utils', () => {
  describe('API_KEY_VALIDATION_CONFIG', () => {
    it('应该包含正确的配置', () => {
      expect(API_KEY_VALIDATION_CONFIG.minLength).toBe(16);
      expect(API_KEY_VALIDATION_CONFIG.maxLength).toBe(128);
      expect(API_KEY_VALIDATION_CONFIG.validPattern).toBeInstanceOf(RegExp);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('应该接受合法的 API key', () => {
      const result = validateApiKeyFormat('abcdefghijklmnopqrstuvwxyz012345');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.code).toBeUndefined();
    });

    it('应该接受带连字符的 API key', () => {
      const result = validateApiKeyFormat('abc-def-ghi-jkl-mno-pqr-stu-vwx-012');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝过短的 API key', () => {
      const result = validateApiKeyFormat('short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 16 characters');
      expect(result.code).toBe('INVALID_API_KEY');
    });

    it('应该拒绝边界长度（15 < 16）', () => {
      const result = validateApiKeyFormat('a'.repeat(15));
      expect(result.valid).toBe(false);
    });

    it('应该接受边界长度（16）', () => {
      const result = validateApiKeyFormat('a'.repeat(16));
      expect(result.valid).toBe(true);
    });

    it('应该拒绝过长的 API key', () => {
      const result = validateApiKeyFormat('a'.repeat(129));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is too long');
      expect(result.code).toBe('INVALID_API_KEY');
    });

    it('应该接受边界长度（128）', () => {
      const result = validateApiKeyFormat('a'.repeat(128));
      expect(result.valid).toBe(true);
    });

    it('应该拒绝包含非法字符的 API key', () => {
      const result = validateApiKeyFormat('abcdefghijklmnop_0123456789'); // 包含下划线
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key contains invalid characters');
      expect(result.code).toBe('INVALID_API_KEY');
    });

    it('应该拒绝包含空格的 API key', () => {
      const result = validateApiKeyFormat('abcdefgh ijklmnop012345');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝包含特殊字符的 API key', () => {
      const result = validateApiKeyFormat('abcdefghijklmnop!0123456789');
      expect(result.valid).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('应该接受合法的 UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('应该接受大写 UUID v4', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('应该拒绝非 v4 UUID（第三段不以 4 开头）', () => {
      expect(isValidUUID('550e8400-e29b-31d4-a716-446655440000')).toBe(false);
    });

    it('应该拒绝非 v4 UUID（第四段不以 8/9/a/b 开头）', () => {
      expect(isValidUUID('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
    });

    it('应该拒绝格式错误的 UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('应该拒绝空字符串', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('应该拒绝非字符串输入', () => {
      expect(isValidUUID(123 as any)).toBe(false);
      expect(isValidUUID(null as any)).toBe(false);
      expect(isValidUUID(undefined as any)).toBe(false);
    });

    it('应该拒绝长度不正确的 UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
    });
  });

  describe('channelIdSchema', () => {
    it('应该接受合法频道 ID', () => {
      expect(channelIdSchema.safeParse('channel-123').success).toBe(true);
      expect(channelIdSchema.safeParse('channel_123').success).toBe(true);
      expect(channelIdSchema.safeParse('CHANNEL123').success).toBe(true);
    });

    it('应该拒绝空字符串', () => {
      const result = channelIdSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('应该拒绝过长的频道 ID', () => {
      const result = channelIdSchema.safeParse('a'.repeat(101));
      expect(result.success).toBe(false);
    });

    it('应该接受边界长度（100）', () => {
      const result = channelIdSchema.safeParse('a'.repeat(100));
      expect(result.success).toBe(true);
    });

    it('应该拒绝包含非法字符的频道 ID', () => {
      const result = channelIdSchema.safeParse('channel.123');
      expect(result.success).toBe(false);
    });

    it('应该拒绝包含空格的频道 ID', () => {
      const result = channelIdSchema.safeParse('channel 123');
      expect(result.success).toBe(false);
    });

    it('应该拒绝非字符串类型', () => {
      const result = channelIdSchema.safeParse(123);
      expect(result.success).toBe(false);
    });
  });

  describe('messageSchema', () => {
    it('应该接受合法消息（带默认值）', () => {
      const result = messageSchema.safeParse({ content: 'Hello' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Hello');
        expect(result.data.priority).toBe('NORMAL');
        expect(result.data.encrypted).toBe(true);
      }
    });

    it('应该接受所有有效优先级', () => {
      for (const priority of ['CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'BULK']) {
        const result = messageSchema.safeParse({ content: 'msg', priority });
        expect(result.success).toBe(true);
      }
    });

    it('应该拒绝无效优先级', () => {
      const result = messageSchema.safeParse({ content: 'msg', priority: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('应该拒绝空消息内容', () => {
      const result = messageSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过长消息内容（>10000）', () => {
      const result = messageSchema.safeParse({ content: 'a'.repeat(10001) });
      expect(result.success).toBe(false);
    });

    it('应该接受边界长度消息（10000）', () => {
      const result = messageSchema.safeParse({ content: 'a'.repeat(10000) });
      expect(result.success).toBe(true);
    });

    it('应该接受可选 sender', () => {
      const result = messageSchema.safeParse({ content: 'msg', sender: 'user1' });
      expect(result.success).toBe(true);
    });

    it('应该拒绝过长的 sender（>100）', () => {
      const result = messageSchema.safeParse({ content: 'msg', sender: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('应该接受 encrypted 布尔值', () => {
      const result = messageSchema.safeParse({ content: 'msg', encrypted: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encrypted).toBe(false);
      }
    });

    it('应该拒绝非布尔 encrypted', () => {
      const result = messageSchema.safeParse({ content: 'msg', encrypted: 'yes' });
      expect(result.success).toBe(false);
    });

    it('应该拒绝缺少 content', () => {
      const result = messageSchema.safeParse({ sender: 'user' });
      expect(result.success).toBe(false);
    });
  });

  describe('publicKeyRegistrationSchema', () => {
    it('应该接受合法注册数据', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----',
        algorithm: 'RSA-2048',
      });
      expect(result.success).toBe(true);
    });

    it('应该接受所有算法', () => {
      for (const algorithm of ['RSA-2048', 'RSA-4096', 'ECC-SECP256K1']) {
        const result = publicKeyRegistrationSchema.safeParse({
          publicKey: 'key',
          algorithm,
        });
        expect(result.success).toBe(true);
      }
    });

    it('应该拒绝无效算法', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: 'key',
        algorithm: 'RSA-1024',
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝空公钥', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: '',
        algorithm: 'RSA-2048',
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过长公钥（>10000）', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: 'a'.repeat(10001),
        algorithm: 'RSA-2048',
      });
      expect(result.success).toBe(false);
    });

    it('应该接受可选 expiresIn（正数，<=2592000）', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: 'key',
        algorithm: 'RSA-2048',
        expiresIn: 3600,
      });
      expect(result.success).toBe(true);
    });

    it('应该拒绝负数 expiresIn', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: 'key',
        algorithm: 'RSA-2048',
        expiresIn: -1,
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过大 expiresIn（>2592000）', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: 'key',
        algorithm: 'RSA-2048',
        expiresIn: 2592001,
      });
      expect(result.success).toBe(false);
    });

    it('应该接受可选 metadata', () => {
      const result = publicKeyRegistrationSchema.safeParse({
        publicKey: 'key',
        algorithm: 'RSA-2048',
        metadata: { foo: 'bar', count: 42 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('channelCreationSchema', () => {
    it('应该接受合法频道数据（带默认 type）', () => {
      const result = channelCreationSchema.safeParse({ name: 'my-channel' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('encrypted');
      }
    });

    it('应该接受所有频道类型', () => {
      for (const type of ['public', 'encrypted', 'temporary']) {
        const result = channelCreationSchema.safeParse({ name: 'ch', type });
        expect(result.success).toBe(true);
      }
    });

    it('应该拒绝无效频道类型', () => {
      const result = channelCreationSchema.safeParse({ name: 'ch', type: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('应该拒绝空频道名', () => {
      const result = channelCreationSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过长频道名（>100）', () => {
      const result = channelCreationSchema.safeParse({ name: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('应该接受可选描述', () => {
      const result = channelCreationSchema.safeParse({ name: 'ch', description: 'desc' });
      expect(result.success).toBe(true);
    });

    it('应该拒绝过长描述（>500）', () => {
      const result = channelCreationSchema.safeParse({ name: 'ch', description: 'a'.repeat(501) });
      expect(result.success).toBe(false);
    });

    it('应该接受可选 ttl（正数）', () => {
      const result = channelCreationSchema.safeParse({ name: 'ch', ttl: 3600 });
      expect(result.success).toBe(true);
    });

    it('应该拒绝负数 ttl', () => {
      const result = channelCreationSchema.safeParse({ name: 'ch', ttl: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('应该使用默认值', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('应该接受合法分页参数', () => {
      const result = paginationSchema.safeParse({ limit: 10, offset: 20 });
      expect(result.success).toBe(true);
    });

    it('应该拒绝非正数 limit', () => {
      const result = paginationSchema.safeParse({ limit: 0, offset: 0 });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过大 limit（>100）', () => {
      const result = paginationSchema.safeParse({ limit: 101, offset: 0 });
      expect(result.success).toBe(false);
    });

    it('应该接受边界 limit（100）', () => {
      const result = paginationSchema.safeParse({ limit: 100, offset: 0 });
      expect(result.success).toBe(true);
    });

    it('应该拒绝负数 offset', () => {
      const result = paginationSchema.safeParse({ limit: 10, offset: -1 });
      expect(result.success).toBe(false);
    });

    it('应该接受 offset 为 0', () => {
      const result = paginationSchema.safeParse({ limit: 10, offset: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('apiKeyCreationSchema', () => {
    it('应该接受合法 API key 创建数据', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: 'my-key',
        userId: 'user-123',
        permissions: ['read', 'write'],
      });
      expect(result.success).toBe(true);
    });

    it('应该拒绝空 name', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: '',
        userId: 'user-123',
        permissions: ['read'],
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过长 name（>100）', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: 'a'.repeat(101),
        userId: 'user-123',
        permissions: ['read'],
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝空 userId', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: 'key',
        userId: '',
        permissions: ['read'],
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝空 permissions 数组', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: 'key',
        userId: 'user-123',
        permissions: [],
      });
      expect(result.success).toBe(false);
    });

    it('应该接受可选 expiresIn（<=31536000）', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: 'key',
        userId: 'user-123',
        permissions: ['read'],
        expiresIn: 3600,
      });
      expect(result.success).toBe(true);
    });

    it('应该拒绝负数 expiresIn', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: 'key',
        userId: 'user-123',
        permissions: ['read'],
        expiresIn: -1,
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过大 expiresIn（>31536000）', () => {
      const result = apiKeyCreationSchema.safeParse({
        name: 'key',
        userId: 'user-123',
        permissions: ['read'],
        expiresIn: 31536001,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('keyRevocationSchema', () => {
    it('应该接受合法撤销数据（带默认 confirmationTimeoutHours）', () => {
      const result = keyRevocationSchema.safeParse({ reason: 'Key was compromised in incident' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confirmationTimeoutHours).toBe(24);
      }
    });

    it('应该拒绝过短 reason（<10）', () => {
      const result = keyRevocationSchema.safeParse({ reason: 'short' });
      expect(result.success).toBe(false);
    });

    it('应该接受边界长度 reason（10）', () => {
      const result = keyRevocationSchema.safeParse({ reason: 'a'.repeat(10) });
      expect(result.success).toBe(true);
    });

    it('应该拒绝过长 reason（>1000）', () => {
      const result = keyRevocationSchema.safeParse({ reason: 'a'.repeat(1001) });
      expect(result.success).toBe(false);
    });

    it('应该接受合法 confirmationTimeoutHours（<=72）', () => {
      const result = keyRevocationSchema.safeParse({
        reason: 'valid reason here',
        confirmationTimeoutHours: 48,
      });
      expect(result.success).toBe(true);
    });

    it('应该拒绝非正数 confirmationTimeoutHours', () => {
      const result = keyRevocationSchema.safeParse({
        reason: 'valid reason here',
        confirmationTimeoutHours: 0,
      });
      expect(result.success).toBe(false);
    });

    it('应该拒绝过大 confirmationTimeoutHours（>72）', () => {
      const result = keyRevocationSchema.safeParse({
        reason: 'valid reason here',
        confirmationTimeoutHours: 73,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateData', () => {
    it('应该在验证成功时返回 data', () => {
      const result = validateData({ content: 'hello' }, messageSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('hello');
      }
    });

    it('应该在验证失败时返回错误（默认 code）', () => {
      const result = validateData({ content: '' }, messageSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.error).toBeDefined();
      }
    });

    it('应该支持自定义 errorCode', () => {
      const result = validateData({ content: '' }, messageSchema, 'CUSTOM_ERROR');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('CUSTOM_ERROR');
      }
    });

    it('应该返回第一个错误的 message', () => {
      const result = validateData({}, messageSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import {
  hashSHA512,
  hmacSign,
  hmacVerify,
  base64Encode,
  base64Decode,
  base64UrlEncode,
  base64UrlDecode,
} from '@/src/lib/utils/crypto';

describe('crypto utils (附加函数)', () => {
  describe('hashSHA512', () => {
    it('应该生成固定长度（128 hex 字符）的哈希', () => {
      expect(hashSHA512('test').length).toBe(128); // SHA-512 = 64 bytes = 128 hex chars
    });

    it('应该对相同输入产生相同哈希', () => {
      expect(hashSHA512('input')).toBe(hashSHA512('input'));
    });

    it('应该对不同输入产生不同哈希', () => {
      expect(hashSHA512('a')).not.toBe(hashSHA512('b'));
    });

    it('应该处理空字符串', () => {
      const hash = hashSHA512('');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(128);
    });

    it('应该处理长字符串', () => {
      const hash = hashSHA512('a'.repeat(10000));
      expect(hash.length).toBe(128);
    });

    it('应该处理 Unicode 字符', () => {
      const hash = hashSHA512('你好世界🌍');
      expect(hash.length).toBe(128);
    });

    it('应该与已知的 SHA-512 测试向量匹配', () => {
      // 空字符串的 SHA-512
      expect(hashSHA512('')).toBe(
        'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
      );
    });
  });

  describe('hmacSign', () => {
    it('应该生成 HMAC 签名', () => {
      const sig = hmacSign('data', 'secret');
      expect(sig).toBeDefined();
      expect(sig.length).toBe(64); // HMAC-SHA256 = 32 bytes = 64 hex chars
    });

    it('应该对相同输入产生相同签名', () => {
      expect(hmacSign('data', 'secret')).toBe(hmacSign('data', 'secret'));
    });

    it('应该对不同 data 产生不同签名', () => {
      expect(hmacSign('data1', 'secret')).not.toBe(hmacSign('data2', 'secret'));
    });

    it('应该对不同 secret 产生不同签名', () => {
      expect(hmacSign('data', 'secret1')).not.toBe(hmacSign('data', 'secret2'));
    });

    it('应该处理空 data', () => {
      const sig = hmacSign('', 'secret');
      expect(sig.length).toBe(64);
    });

    it('应该处理空 secret', () => {
      const sig = hmacSign('data', '');
      expect(sig.length).toBe(64);
    });

    it('应该只包含十六进制字符', () => {
      const sig = hmacSign('data', 'secret');
      expect(sig).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('hmacVerify', () => {
    it('应该验证正确的签名', () => {
      const signature = hmacSign('data', 'secret');
      expect(hmacVerify('data', 'secret', signature)).toBe(true);
    });

    it('应该拒绝错误的签名', () => {
      const correctSignature = hmacSign('data', 'secret');
      const wrongSignature = correctSignature.slice(0, -2) + '00';
      expect(hmacVerify('data', 'secret', wrongSignature)).toBe(false);
    });

    it('应该拒绝不同 data 的签名', () => {
      const signature = hmacSign('data1', 'secret');
      expect(hmacVerify('data2', 'secret', signature)).toBe(false);
    });

    it('应该拒绝不同 secret 的签名', () => {
      const signature = hmacSign('data', 'secret1');
      expect(hmacVerify('data', 'secret2', signature)).toBe(false);
    });

    it('应该拒绝长度不同的签名（secureCompare 返回 false）', () => {
      const signature = hmacSign('data', 'secret');
      expect(hmacVerify('data', 'secret', signature.substring(0, 10))).toBe(false);
    });

    it('应该处理空 data 和正确签名', () => {
      const signature = hmacSign('', 'secret');
      expect(hmacVerify('', 'secret', signature)).toBe(true);
    });
  });

  describe('base64Encode / base64Decode', () => {
    it('应该编码字符串', () => {
      expect(base64Encode('hello')).toBe('aGVsbG8=');
      expect(base64Encode('Hello, World!')).toBe('SGVsbG8sIFdvcmxkIQ==');
    });

    it('应该编码空字符串', () => {
      expect(base64Encode('')).toBe('');
    });

    it('应该解码字符串', () => {
      expect(base64Decode('aGVsbG8=').toString('utf8')).toBe('hello');
      expect(base64Decode('SGVsbG8sIFdvcmxkIQ==').toString('utf8')).toBe('Hello, World!');
    });

    it('应该解码空字符串', () => {
      expect(base64Decode('').length).toBe(0);
    });

    it('应该支持 Buffer 输入', () => {
      const buf = Buffer.from('hello', 'utf8');
      expect(base64Encode(buf)).toBe('aGVsbG8=');
    });

    it('编码后应该可以解码还原', () => {
      const original = '测试 Base64 编码 123 !@#';
      const encoded = base64Encode(original);
      const decoded = base64Decode(encoded).toString('utf8');
      expect(decoded).toBe(original);
    });

    it('base64Decode 应该返回 Buffer', () => {
      const result = base64Decode('aGVsbG8=');
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('base64UrlEncode / base64UrlDecode', () => {
    it('应该编码为 URL-safe base64（无 +/= 字符）', () => {
      // '?????' 的 base64 包含 + 和 /
      const encoded = base64UrlEncode('??????????');
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('应该编码普通字符串', () => {
      expect(base64UrlEncode('hello')).toBe('aGVsbG8');
    });

    it('应该编码空字符串', () => {
      expect(base64UrlEncode('')).toBe('');
    });

    it('应该解码 URL-safe base64', () => {
      expect(base64UrlDecode('aGVsbG8').toString('utf8')).toBe('hello');
    });

    it('应该解码包含 - 和 _ 的字符串', () => {
      // '??????????' 的 url-safe base64 编码
      const original = '??????????';
      const encoded = base64UrlEncode(original);
      const decoded = base64UrlDecode(encoded).toString('utf8');
      expect(decoded).toBe(original);
    });

    it('应该支持 Buffer 输入', () => {
      const buf = Buffer.from('hello', 'utf8');
      expect(base64UrlEncode(buf)).toBe('aGVsbG8');
    });

    it('编码后应该可以解码还原（含 +/= 的数据）', () => {
      // 使用会产生 + 和 / 的数据
      const original = '\xff\xff\xff\xff';
      const encoded = base64UrlEncode(original);
      const decoded = base64UrlDecode(encoded).toString('utf8');
      expect(decoded).toBe(original);
    });

    it('应该解码需要补齐 padding 的字符串', () => {
      // 'aGVsbG8' 长度 7，需要补 1 个 =
      expect(base64UrlDecode('aGVsbG8').toString('utf8')).toBe('hello');
      // 'YQ' 长度 2，需要补 2 个 =
      expect(base64UrlDecode('YQ').toString('utf8')).toBe('a');
    });

    it('应该解码已经包含 padding 的字符串也能工作', () => {
      // 长度是 4 的倍数时不需要补 padding
      expect(base64UrlDecode('YWJjZA').toString('utf8')).toBe('abcd');
    });
  });

  describe('base64Url 与标准 base64 互操作', () => {
    it('URL-safe 编码后用标准解码（转换字符）应还原', () => {
      const original = 'Hello, World! 你好';
      const urlSafe = base64UrlEncode(original);
      // 将 - 转回 +，_ 转回 /，并补齐 padding
      const padded = urlSafe + '='.repeat((4 - (urlSafe.length % 4)) % 4);
      const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(standard, 'base64').toString('utf8');
      expect(decoded).toBe(original);
    });
  });
});

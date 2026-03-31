// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { describe, it, expect } from 'vitest';
import { 
  generateEncryptionKey, 
  deriveKey, 
  encrypt, 
  decrypt, 
  generateSecureToken,
  hashToken,
  ENCRYPTION_CONFIG 
} from '@/src/lib/utils/crypto';

describe('Crypto Utils', () => {
  describe('ENCRYPTION_CONFIG', () => {
    it('应该包含正确的加密配置', () => {
      expect(ENCRYPTION_CONFIG.algorithm).toBe('aes-256-gcm');
      expect(ENCRYPTION_CONFIG.keyLength).toBe(32); // 256 bits
      expect(ENCRYPTION_CONFIG.ivLength).toBe(16);
      expect(ENCRYPTION_CONFIG.saltLength).toBe(16);
      expect(ENCRYPTION_CONFIG.authTagLength).toBe(16);
    });
  });

  describe('generateEncryptionKey', () => {
    it('应该生成正确长度的密钥', () => {
      const key = generateEncryptionKey();
      
      expect(key.length).toBe(ENCRYPTION_CONFIG.keyLength);
    });

    it('应该每次生成不同的密钥', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('应该返回 Buffer 对象', () => {
      const key = generateEncryptionKey();
      
      expect(Buffer.isBuffer(key)).toBe(true);
    });
  });

  describe('deriveKey', () => {
    it('应该从密码派生出密钥', async () => {
      const salt = Buffer.alloc(16);
      const key = await deriveKey('test-password', salt);
      
      expect(key).toBeDefined();
      expect(key.length).toBe(ENCRYPTION_CONFIG.keyLength);
    });

    it('应该对相同输入产生相同的输出', async () => {
      const salt = Buffer.alloc(16);
      const key1 = await deriveKey('password123', salt);
      const key2 = await deriveKey('password123', salt);
      
      expect(key1.toString('hex')).toBe(key2.toString('hex'));
    });

    it('应该对不同盐值产生不同输出', async () => {
      const salt1 = Buffer.alloc(16);
      const salt2 = Buffer.alloc(16, 1);
      
      const key1 = await deriveKey('password', salt1);
      const key2 = await deriveKey('password', salt2);
      
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('应该对不同密码产生不同输出', async () => {
      const salt = Buffer.alloc(16);
      
      const key1 = await deriveKey('password1', salt);
      const key2 = await deriveKey('password2', salt);
      
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });
  });

  describe('encrypt/decrypt', () => {
    it('应该加密并成功解密数据', async () => {
      const originalData = 'Hello, World!';
      const password = 'test-password';
      
      const encrypted = await encrypt(originalData, password);
      const decrypted = await decrypt(encrypted, password);
      
      expect(decrypted).toBe(originalData);
    });

    it('应该生成唯一的加密数据（即使明文相同）', async () => {
      const data = 'Same message';
      const password = 'password';
      
      const encrypted1 = await encrypt(data, password);
      const encrypted2 = await encrypt(data, password);
      
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('应该处理空字符串', async () => {
      const password = 'password';
      
      const encrypted = await encrypt('', password);
      const decrypted = await decrypt(encrypted, password);
      
      expect(decrypted).toBe('');
    });

    it('应该处理长文本', async () => {
      const longText = 'a'.repeat(10000);
      const password = 'password';
      
      const encrypted = await encrypt(longText, password);
      const decrypted = await decrypt(encrypted, password);
      
      expect(decrypted).toBe(longText);
      expect(decrypted.length).toBe(10000);
    });

    it('应该处理特殊字符和 Unicode', async () => {
      const specialText = '你好，世界！🌍 Special chars: @#$%^&*()_+';
      const password = 'password';
      
      const encrypted = await encrypt(specialText, password);
      const decrypted = await decrypt(encrypted, password);
      
      expect(decrypted).toBe(specialText);
    });

    it('应该处理 JSON 数据', async () => {
      const jsonData = JSON.stringify({ 
        key: 'value', 
        number: 42, 
        nested: { a: 1, b: 2 } 
      });
      const password = 'password';
      
      const encrypted = await encrypt(jsonData, password);
      const decrypted = await decrypt(encrypted, password);
      
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });

    it('应该使用错误的密码解密失败', async () => {
      const data = 'Secret message';
      const correctPassword = 'correct';
      const wrongPassword = 'wrong';
      
      const encrypted = await encrypt(data, correctPassword);
      
      await expect(decrypt(encrypted, wrongPassword))
        .rejects.toThrow();
    });

    it('应该处理被篡改的密文', async () => {
      const data = 'Original data';
      const password = 'password';
      
      const encrypted = await encrypt(data, password);
      
      // 篡改密文
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.substring(0, 10) + 'abcd'
      };
      
      await expect(decrypt(tampered as any, password))
        .rejects.toThrow();
    });

    it('应该返回正确的数据结构', async () => {
      const data = 'test';
      const password = 'password';
      
      const encrypted = await encrypt(data, password);
      
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('authTag');
      
      expect(typeof encrypted.ciphertext).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.salt).toBe('string');
      expect(typeof encrypted.authTag).toBe('string');
    });
  });

  describe('generateSecureToken', () => {
    it('应该生成默认长度（32）的 token', () => {
      const token = generateSecureToken();
      
      expect(token.length).toBe(64); // hex string is 2x byte length
    });

    it('应该生成指定长度的 token', () => {
      const token = generateSecureToken(16);
      
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('应该每次生成不同的 token', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });

    it('应该只包含十六进制字符', () => {
      const token = generateSecureToken(64);
      
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('应该处理非常长的长度', () => {
      const token = generateSecureToken(1000);
      
      expect(token.length).toBe(2000); // 1000 bytes = 2000 hex chars
    });
  });

  describe('hashToken', () => {
    it('应该生成固定长度的哈希', () => {
      const hash = hashToken('test-token');
      
      expect(hash.length).toBe(64); // SHA256 produces 64 hex chars
    });

    it('应该对相同输入产生相同哈希', () => {
      const hash1 = hashToken('same-input');
      const hash2 = hashToken('same-input');
      
      expect(hash1).toBe(hash2);
    });

    it('应该对不同输入产生不同哈希', () => {
      const hash1 = hashToken('input1');
      const hash2 = hashToken('input2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('应该处理空字符串', () => {
      const hash = hashToken('');
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('应该处理长字符串', () => {
      const longString = 'a'.repeat(10000);
      const hash = hashToken(longString);
      
      expect(hash.length).toBe(64);
    });

    it('应该处理 Unicode 字符', () => {
      const unicodeString = '你好世界🌍';
      const hash = hashToken(unicodeString);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('边界条件', () => {
    it('应该处理单字符加密', async () => {
      const data = 'a';
      const password = 'password';
      
      const encrypted = await encrypt(data, password);
      const decrypted = await decrypt(encrypted, password);
      
      expect(decrypted).toBe('a');
    });

    it('应该处理很长的密码', async () => {
      const data = 'test data';
      const longPassword = 'p'.repeat(1000);
      
      const encrypted = await encrypt(data, longPassword);
      const decrypted = await decrypt(encrypted, longPassword);
      
      expect(decrypted).toBe(data);
    });

    it('应该处理二进制数据编码', async () => {
      const binaryLike = '\x00\x01\x02\x03';
      const password = 'password';
      
      const encrypted = await encrypt(binaryLike, password);
      const decrypted = await decrypt(encrypted, password);
      
      expect(decrypted).toBe(binaryLike);
    });
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';

/**
 * Encryption algorithm configuration
 */
export const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,
  saltLength: 16,
  authTagLength: 16,
} as const;

/**
 * Generate a random encryption key
 */
export function generateEncryptionKey(): Buffer {
  return randomBytes(ENCRYPTION_CONFIG.keyLength);
}

/**
 * Derive a key from a password using scrypt
 */
export function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, ENCRYPTION_CONFIG.keyLength, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

/**
 * Encrypt data using AES-256-GCM
 */
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  authTag: string;
}

export async function encrypt(data: string, password: string): Promise<EncryptedData> {
  const salt = randomBytes(ENCRYPTION_CONFIG.saltLength);
  const key = await deriveKey(password, salt);
  const iv = randomBytes(ENCRYPTION_CONFIG.ivLength);
  
  const cipher = createCipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv,
    { authTagLength: ENCRYPTION_CONFIG.authTagLength }
  );
  
  let ciphertext = cipher.update(data, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    ciphertext,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag,
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(encrypted: EncryptedData, password: string): Promise<string> {
  const salt = Buffer.from(encrypted.salt, 'hex');
  const iv = Buffer.from(encrypted.iv, 'hex');
  const authTag = Buffer.from(encrypted.authTag, 'hex');
  const ciphertext = encrypted.ciphertext;
  
  const key = await deriveKey(password, salt);
  
  const decipher = createDecipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv,
    { authTagLength: ENCRYPTION_CONFIG.authTagLength }
  );
  
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash data using SHA-256
 */
export function hashSHA256(data: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash data using SHA-512
 */
export function hashSHA512(data: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha512').update(data).digest('hex');
}

/**
 * HMAC signature
 */
export function hmacSign(data: string, secret: string): string {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature
 */
export function hmacVerify(data: string, secret: string, signature: string): boolean {
  const expectedSignature = hmacSign(data, secret);
  return secureCompare(expectedSignature, signature);
}

/**
 * Secure constant-time comparison
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Base64 encode
 */
export function base64Encode(data: string | Buffer): string {
  return Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64');
}

/**
 * Base64 decode
 */
export function base64Decode(data: string): Buffer {
  return Buffer.from(data, 'base64');
}

/**
 * URL-safe Base64 encode
 */
export function base64UrlEncode(data: string | Buffer): string {
  return base64Encode(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * URL-safe Base64 decode
 */
export function base64UrlDecode(data: string): Buffer {
  // Add padding if necessary
  const padded = data + '='.repeat((4 - data.length % 4) % 4);
  return base64Decode(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

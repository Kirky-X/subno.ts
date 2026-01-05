// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import crypto from 'crypto';
import { env } from '@/config/env';

/**
 * AES Service - Handles AES-256-GCM symmetric encryption
 */
export class AesService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = env.AES_IV_LENGTH; // 128 bits (configurable)
  // private readonly authTagLength = env.AES_AUTH_TAG_LENGTH; // 128 bits (configurable) - Used by crypto internally
  private readonly keyLength = env.AES_KEY_LENGTH; // 256 bits (configurable)

  /**
   * Generate a new AES key
   * @returns Object containing key and initialization vector
   */
  generateKey(): { key: string; iv: string } {
    const key = crypto.randomBytes(this.keyLength); // 256 bits (configurable)
    const iv = crypto.randomBytes(this.ivLength);
    return {
      key: key.toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * @param plaintext - Text to encrypt
   * @param key - Base64-encoded key
   * @param iv - Base64-encoded initialization vector
   * @returns Object containing base64-encoded ciphertext and auth tag
   */
  encrypt(plaintext: string, key: string, iv: string): { ciphertext: string; authTag: string } {
    try {
      const keyBuffer = Buffer.from(key, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');

      const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, ivBuffer);

      let encrypted = cipher.update(plaintext, 'utf-8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const authTag = cipher.getAuthTag();

      return {
        ciphertext: encrypted.toString('base64'),
        authTag: authTag.toString('base64'),
      };
    } catch (error) {
      throw new AesError('Failed to encrypt message', 'ENCRYPTION_FAILED', error as Error);
    }
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   * @param ciphertext - Base64-encoded ciphertext
   * @param key - Base64-encoded key
   * @param iv - Base64-encoded initialization vector
   * @param authTag - Base64-encoded authentication tag
   * @returns Decrypted plaintext
   */
  decrypt(ciphertext: string, key: string, iv: string, authTag: string): string {
    try {
      const keyBuffer = Buffer.from(key, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      let decrypted = decipher.update(ciphertext, 'base64');
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf-8');
    } catch (error) {
      throw new AesError('Failed to decrypt message', 'DECRYPTION_FAILED', error as Error);
    }
  }
}

/**
 * AES Service error class
 */
export class AesError extends Error {
  code: string;
  originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = 'AesError';
    this.code = code;
    this.originalError = originalError;
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

// Singleton instance
let aesServiceInstance: AesService | null = null;

export function getAesService(): AesService {
  if (!aesServiceInstance) {
    aesServiceInstance = new AesService();
  }
  return aesServiceInstance;
}
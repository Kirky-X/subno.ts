// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import crypto from 'crypto';
import { env } from '@/config/env';

/**
 * RSA Service - Handles RSA key generation, encryption, decryption, signing, and verification
 */
export class RsaService {
  private readonly defaultKeySize = env.RSA_DEFAULT_KEY_SIZE; // 2048 bits (configurable)
  private readonly hashAlgorithm = env.RSA_HASH_ALGORITHM; // sha256 (configurable)

  /**
   * Generate a new RSA key pair
   * @param keySize - Key size in bits (default: 2048)
   * @returns Object containing public and private keys in PEM format
   */
  generateKeyPair(keySize?: number): { publicKey: string; privateKey: string } {
    const size = keySize || this.defaultKeySize;

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: size,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Encrypt a message using RSA with OAEP padding
   * @param message - Message to encrypt (will be converted to UTF-8 bytes)
   * @param publicKeyPEM - Public key in PEM format
   * @returns Base64-encoded encrypted message
   */
  encrypt(message: string, publicKeyPEM: string): string {
    try {
      const publicKey = crypto.createPublicKey(publicKeyPEM);
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: this.hashAlgorithm,
        },
        Buffer.from(message, 'utf-8')
      );
      return encrypted.toString('base64');
    } catch (error) {
      throw new RsaError('Failed to encrypt message', 'ENCRYPTION_FAILED', error as Error);
    }
  }

  /**
   * Decrypt a message using RSA with OAEP padding
   * @param encryptedMessage - Base64-encoded encrypted message
   * @param privateKeyPEM - Private key in PEM format
   * @returns Decrypted message string
   */
  decrypt(encryptedMessage: string, privateKeyPEM: string): string {
    try {
      const privateKey = crypto.createPrivateKey(privateKeyPEM);
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: this.hashAlgorithm,
        },
        Buffer.from(encryptedMessage, 'base64')
      );
      return decrypted.toString('utf-8');
    } catch (error) {
      throw new RsaError('Failed to decrypt message', 'DECRYPTION_FAILED', error as Error);
    }
  }

  /**
   * Sign a message using RSA-SHA256
   * @param message - Message to sign
   * @param privateKeyPEM - Private key in PEM format
   * @returns Base64-encoded signature
   */
  sign(message: string, privateKeyPEM: string): string {
    try {
      const privateKey = crypto.createPrivateKey(privateKeyPEM);
      const sign = crypto.createSign(this.hashAlgorithm);
      sign.update(message);
      sign.end();
      const signature = sign.sign(privateKey);
      return signature.toString('base64');
    } catch (error) {
      throw new RsaError('Failed to sign message', 'SIGN_FAILED', error as Error);
    }
  }

  /**
   * Verify a signature using RSA-SHA256
   * @param message - Original message
   * @param signature - Base64-encoded signature to verify
   * @param publicKeyPEM - Public key in PEM format
   * @returns true if signature is valid
   */
  verify(message: string, signature: string, publicKeyPEM: string): boolean {
    try {
      const publicKey = crypto.createPublicKey(publicKeyPEM);
      const sign = crypto.createVerify(this.hashAlgorithm);
      sign.update(message);
      sign.end();
      return sign.verify(publicKey, Buffer.from(signature, 'base64'));
    } catch (error) {
      throw new RsaError('Failed to verify signature', 'VERIFY_FAILED', error as Error);
    }
  }

  /**
   * Validate public key format
   * @param publicKey - Public key in PEM format
   * @returns true if format is valid
   */
  isValidPublicKey(publicKey: string): boolean {
    try {
      crypto.createPublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate private key format
   * @param privateKey - Private key in PEM format
   * @returns true if format is valid
   */
  isValidPrivateKey(privateKey: string): boolean {
    try {
      crypto.createPrivateKey(privateKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert PEM to DER format
   * @param pem - PEM encoded key
   * @returns DER encoded buffer
   */
  pemToDer(pem: string): Buffer {
    // Remove PEM headers and newlines
    const base64 = pem
      .replace(/-----BEGIN (PUBLIC|PRIVATE) KEY-----/, '')
      .replace(/-----END (PUBLIC|PRIVATE) KEY-----/, '')
      .replace(/\s/g, '');
    return Buffer.from(base64, 'base64');
  }

  /**
   * Convert DER to PEM format
   * @param der - DER encoded buffer
   * @param type - Key type (PUBLIC KEY or PRIVATE KEY)
   * @returns PEM encoded key
   */
  derToPem(der: Buffer, type: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
    const base64 = der.toString('base64');
    const lines = base64.match(/.{1,64}/g) || [];
    const wrapped = lines.join('\n');
    return `-----BEGIN ${type}-----\n${wrapped}\n-----END ${type}-----`;
  }
}

/**
 * RSA Service error class
 */
export class RsaError extends Error {
  code: string;
  originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = 'RsaError';
    this.code = code;
    this.originalError = originalError;
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

// Singleton instance
let rsaServiceInstance: RsaService | null = null;

export function getRsaService(): RsaService {
  if (!rsaServiceInstance) {
    rsaServiceInstance = new RsaService();
  }
  return rsaServiceInstance;
}
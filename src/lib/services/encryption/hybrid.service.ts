// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { getRsaService, RsaService } from './rsa.service';
import { getAesService, AesService } from './aes.service';

/**
 * Hybrid encryption package
 */
export interface HybridPackage {
  encryptedKey: string; // RSA-encrypted AES key (base64)
  iv: string; // AES IV (base64)
  authTag: string; // AES auth tag (base64)
  ciphertext: string; // AES-encrypted message (base64)
}

/**
 * Hybrid Service - Combines RSA and AES encryption for large data
 * 
 * Uses RSA to encrypt a randomly generated AES key, then uses AES
 * to encrypt the actual message. This allows efficient encryption
 * of large messages with RSA public keys.
 */
export class HybridService {
  private readonly rsaService: RsaService;
  private readonly aesService: AesService;

  constructor() {
    this.rsaService = getRsaService();
    this.aesService = getAesService();
  }

  /**
   * Encrypt a message using hybrid encryption
   * @param message - Message to encrypt
   * @param publicKeyPEM - Recipient's RSA public key
   * @returns Hybrid package containing encrypted key and ciphertext
   */
  encrypt(message: string, publicKeyPEM: string): HybridPackage {
    // Generate a one-time AES key
    const { key, iv } = this.aesService.generateKey();

    // Encrypt the message with AES
    const { ciphertext, authTag } = this.aesService.encrypt(message, key, iv);

    // Encrypt the AES key with RSA
    const encryptedKey = this.rsaService.encrypt(key, publicKeyPEM);

    return {
      encryptedKey,
      iv,
      authTag,
      ciphertext,
    };
  }

  /**
   * Decrypt a message using hybrid decryption
   * @param pkg - Hybrid package
   * @param privateKeyPEM - Recipient's RSA private key
   * @returns Decrypted message
   */
  decrypt(pkg: HybridPackage, privateKeyPEM: string): string {
    // Decrypt the AES key with RSA
    const key = this.rsaService.decrypt(pkg.encryptedKey, privateKeyPEM);

    // Decrypt the message with AES
    return this.aesService.decrypt(pkg.ciphertext, key, pkg.iv, pkg.authTag);
  }

  /**
   * Encrypt a message for multiple recipients
   * @param message - Message to encrypt
   * @param publicKeys - Array of RSA public keys
   * @returns Object with key prefix as property names and encrypted packages as values
   */
  encryptForRecipients(message: string, publicKeys: string[]): Record<string, HybridPackage> {
    const packages: Record<string, HybridPackage> = {};

    // Generate a single AES key for all recipients
    const { key, iv } = this.aesService.generateKey();
    const { ciphertext, authTag } = this.aesService.encrypt(message, key, iv);

    for (let i = 0; i < publicKeys.length; i++) {
      const publicKey = publicKeys[i];
      const encryptedKey = this.rsaService.encrypt(key, publicKey);
      const keyPrefix = `recipient_${i}`;

      packages[keyPrefix] = {
        encryptedKey,
        iv,
        authTag,
        ciphertext,
      };
    }

    return packages;
  }
}

// Singleton instance
let hybridServiceInstance: HybridService | null = null;

export function getHybridService(): HybridService {
  if (!hybridServiceInstance) {
    hybridServiceInstance = new HybridService();
  }
  return hybridServiceInstance;
}
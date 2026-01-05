// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

/**
 * Encryption Service - Main export for backward compatibility
 * 
 * This module now re-exports individual services for better modularity:
 * - RsaService: RSA key generation, encryption, decryption, signing, verification
 * - AesService: AES-256-GCM symmetric encryption
 * - HybridService: Combined RSA + AES for large data encryption
 * - KeyCacheService: Public key caching with cache-aside pattern
 * 
 * @example
 * import { RsaService, AesService, HybridService, KeyCacheService } from '@/lib/services/encryption';
 */

// Re-export all services for backward compatibility
export type {
  // RSA Service
  RsaService,
  RsaError,

  // AES Service
  AesService,

  // Hybrid Service
  HybridService,
  HybridPackage,

  // Key Cache Service
  KeyCacheService,
  PublicKeyInfo,
  PUBLIC_KEY_CACHE_TTL,
} from './encryption';

export { getRsaService } from './encryption/rsa.service';
export { getAesService } from './encryption/aes.service';
export { getHybridService } from './encryption/hybrid.service';
export { getKeyCacheService } from './encryption/key-cache.service';

// Legacy EncryptionService class for backward compatibility
// Uses the new modular services internally
import { getRsaService } from './encryption/rsa.service';
import { getAesService } from './encryption/aes.service';
import { getHybridService, HybridPackage } from './encryption/hybrid.service';
import { getKeyCacheService, PUBLIC_KEY_CACHE_TTL } from './encryption/key-cache.service';

/**
 * @deprecated Use individual services (RsaService, AesService, HybridService) instead
 */
export class EncryptionService {
  // Delegate to individual services
  private rsaService = getRsaService();
  private aesService = getAesService();
  private hybridService = getHybridService();
  private keyCacheService = getKeyCacheService();

  // RSA methods
  generateKeyPair(keySize?: number) {
    return this.rsaService.generateKeyPair(keySize);
  }

  encrypt(message: string, publicKeyPEM: string) {
    return this.rsaService.encrypt(message, publicKeyPEM);
  }

  decrypt(encryptedMessage: string, privateKeyPEM: string) {
    return this.rsaService.decrypt(encryptedMessage, privateKeyPEM);
  }

  sign(message: string, privateKeyPEM: string) {
    return this.rsaService.sign(message, privateKeyPEM);
  }

  verify(message: string, signature: string, publicKeyPEM: string) {
    return this.rsaService.verify(message, signature, publicKeyPEM);
  }

  isValidPublicKeyFormat(publicKey: string) {
    return this.rsaService.isValidPublicKey(publicKey);
  }

  isValidPrivateKeyFormat(privateKey: string) {
    return this.rsaService.isValidPrivateKey(privateKey);
  }

  pemToDer(pem: string) {
    return this.rsaService.pemToDer(pem);
  }

  derToPem(der: Buffer, type: 'PUBLIC KEY' | 'PRIVATE KEY') {
    return this.rsaService.derToPem(der, type);
  }

  // AES methods
  generateSymmetricKey() {
    const { key, iv } = this.aesService.generateKey();
    return { key, iv, authTag: '' };
  }

  encryptAesGcm(plaintext: string, key: string, iv: string) {
    return this.aesService.encrypt(plaintext, key, iv);
  }

  decryptAesGcm(ciphertext: string, key: string, iv: string, authTag: string) {
    return this.aesService.decrypt(ciphertext, key, iv, authTag);
  }

  // Hybrid methods
  hybridEncrypt(message: string, publicKeyPEM: string): HybridPackage {
    return this.hybridService.encrypt(message, publicKeyPEM);
  }

  hybridDecrypt(pkg: HybridPackage, privateKeyPEM: string): string {
    return this.hybridService.decrypt(pkg, privateKeyPEM);
  }

  encryptForRecipients(message: string, publicKeys: string[]): Record<string, HybridPackage> {
    return this.hybridService.encryptForRecipients(message, publicKeys);
  }

  // Key cache methods
  async getPublicKey(channelId: string) {
    return this.keyCacheService.getPublicKey(channelId);
  }

  async registerPublicKey(channelId: string, publicKey: string, options?: {
    algorithm?: string;
    expiresIn?: number;
    metadata?: Record<string, unknown>;
  }) {
    const algorithm = options?.algorithm || 'RSA-2048';
    const expiresIn = options?.expiresIn || 604800;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return this.keyCacheService.registerPublicKey(
      channelId,
      publicKey,
      algorithm,
      expiresAt,
      options?.metadata
    );
  }

  async revokePublicKey(channelId: string) {
    return this.keyCacheService.revokePublicKey(channelId);
  }

  async hasValidPublicKey(channelId: string) {
    return this.keyCacheService.hasValidPublicKey(channelId);
  }

  static readonly PUBLIC_KEY_CACHE_TTL = PUBLIC_KEY_CACHE_TTL;
}

/**
 * @deprecated Use RsaError instead
 */
export { RsaError as EncryptionError } from './encryption/rsa.service';
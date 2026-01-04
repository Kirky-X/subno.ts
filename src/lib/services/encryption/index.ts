// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

/**
 * Encryption Module - Modular encryption services
 * 
 * This module provides:
 * - RSA key generation, encryption, decryption, signing, verification
 * - AES-256-GCM symmetric encryption
 * - Hybrid encryption (RSA + AES) for large data
 * - Public key caching with cache-aside pattern
 */

// Re-export all services
export type { RsaService, RsaError, getRsaService } from './rsa.service';
export type { AesService, AesError, getAesService } from './aes.service';
export type { HybridService, HybridPackage, getHybridService } from './hybrid.service';
export type { KeyCacheService, KeyCacheError, PublicKeyInfo, PUBLIC_KEY_CACHE_TTL, getKeyCacheService } from './key-cache.service';
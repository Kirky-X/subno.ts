// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService, EncryptionError } from '@/lib/services/encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('generateKeyPair', () => {
    it('should generate valid RSA key pair', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      expect(publicKey).toContain('BEGIN PUBLIC KEY');
      expect(privateKey).toContain('PRIVATE KEY');
    });

    it('should generate different keys on each call', () => {
      const keys1 = encryptionService.generateKeyPair();
      const keys2 = encryptionService.generateKeyPair();

      expect(keys1.publicKey).not.toBe(keys2.publicKey);
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt message successfully', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();
      const originalMessage = 'Hello, World!';

      const encrypted = encryptionService.encrypt(originalMessage, publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe(originalMessage);
    });

    it('should handle empty string', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();

      const encrypted = encryptionService.encrypt('', publicKey);
      const decrypted = encryptionService.decrypt(encrypted, privateKey);

      expect(decrypted).toBe('');
    });

    // RSA has a message length limit (~190 bytes for RSA-2048 OAEP).
    // Long messages should use hybrid encryption (tested below).
    it('should throw error for long messages with direct RSA', () => {
      const { publicKey } = encryptionService.generateKeyPair();
      const longMessage = 'A'.repeat(10000);

      expect(() => {
        encryptionService.encrypt(longMessage, publicKey);
      }).toThrow();
    });

    it('should throw error with wrong private key', () => {
      const { publicKey } = encryptionService.generateKeyPair();
      const { privateKey: wrongKey } = encryptionService.generateKeyPair();
      const message = 'Test message';

      const encrypted = encryptionService.encrypt(message, publicKey);

      expect(() => {
        encryptionService.decrypt(encrypted, wrongKey);
      }).toThrow(EncryptionError);
    });

    it('should throw error with invalid key', () => {
      expect(() => {
        encryptionService.encrypt('Test', 'invalid-key');
      }).toThrow(EncryptionError);
    });
  });

  describe('sign and verify', () => {
    it('should sign and verify message successfully', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();
      const message = 'Message to sign';

      const signature = encryptionService.sign(message, privateKey);
      const isValid = encryptionService.verify(message, signature, publicKey);

      expect(isValid).toBe(true);
    });

    it('should fail verification for modified message', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();
      const message = 'Original message';
      const modifiedMessage = 'Modified message';

      const signature = encryptionService.sign(message, privateKey);
      const isValid = encryptionService.verify(modifiedMessage, signature, publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification with wrong public key', () => {
      const { privateKey } = encryptionService.generateKeyPair();
      const { publicKey: wrongPublicKey } = encryptionService.generateKeyPair();
      const message = 'Test message';

      const signature = encryptionService.sign(message, privateKey);
      const isValid = encryptionService.verify(message, signature, wrongPublicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('symmetric encryption (AES-GCM)', () => {
    it('should generate symmetric key', () => {
      const symmetricKey = encryptionService.generateSymmetricKey();

      expect(symmetricKey.key).toBeDefined();
      expect(symmetricKey.iv).toBeDefined();
      expect(symmetricKey.authTag).toBe('');
    });

    it('should encrypt and decrypt with AES-GCM', () => {
      const symmetricKey = encryptionService.generateSymmetricKey();
      const plaintext = 'Secret message';

      const { ciphertext, authTag } = encryptionService.encryptAesGcm(
        plaintext,
        symmetricKey.key,
        symmetricKey.iv
      );

      expect(ciphertext).not.toBe(plaintext);
      expect(authTag).toBeDefined();

      const decrypted = encryptionService.decryptAesGcm(
        ciphertext,
        symmetricKey.key,
        symmetricKey.iv,
        authTag
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error with wrong key', () => {
      const symmetricKey = encryptionService.generateSymmetricKey();
      const wrongKey = encryptionService.generateSymmetricKey();
      const plaintext = 'Test';

      const { ciphertext, authTag } = encryptionService.encryptAesGcm(
        plaintext,
        symmetricKey.key,
        symmetricKey.iv
      );

      expect(() => {
        encryptionService.decryptAesGcm(
          ciphertext,
          wrongKey.key,
          symmetricKey.iv,
          authTag
        );
      }).toThrow();
    });
  });

  describe('hybrid encryption', () => {
    it('should encrypt and decrypt using hybrid encryption', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();
      const message = 'Hybrid encrypted message';

      const pkg = encryptionService.hybridEncrypt(message, publicKey);
      const decrypted = encryptionService.hybridDecrypt(pkg, privateKey);

      expect(decrypted).toBe(message);
      expect(pkg.encryptedKey).toBeDefined();
      expect(pkg.ciphertext).toBeDefined();
      expect(pkg.iv).toBeDefined();
      expect(pkg.authTag).toBeDefined();
    });

    it('should handle large messages with hybrid encryption', () => {
      const { publicKey, privateKey } = encryptionService.generateKeyPair();
      const largeMessage = 'X'.repeat(50000);

      const pkg = encryptionService.hybridEncrypt(largeMessage, publicKey);
      const decrypted = encryptionService.hybridDecrypt(pkg, privateKey);

      expect(decrypted).toBe(largeMessage);
    });
  });

  describe('encryptForRecipients', () => {
    it('should encrypt message for multiple recipients', () => {
      const keys = [
        encryptionService.generateKeyPair(),
        encryptionService.generateKeyPair(),
        encryptionService.generateKeyPair(),
      ];
      const publicKeys = keys.map((k) => k.publicKey);
      const privateKeys = keys.map((k) => k.privateKey);
      const message = 'Broadcast message';

      const encryptedMessages = encryptionService.encryptForRecipients(message, publicKeys);

      expect(Object.keys(encryptedMessages)).toHaveLength(3);

      // Verify each recipient can decrypt
      privateKeys.forEach((privateKey, index) => {
        const decrypted = encryptionService.hybridDecrypt(
          encryptedMessages[`recipient_${index}`],
          privateKey
        );
        expect(decrypted).toBe(message);
      });
    });
  });

  describe('key format conversion', () => {
    it('should convert PEM to DER and back', () => {
      const { publicKey } = encryptionService.generateKeyPair();

      const der = encryptionService.pemToDer(publicKey);
      const pem = encryptionService.derToPem(der, 'PUBLIC KEY');

      expect(pem).toContain('BEGIN PUBLIC KEY');
    });
  });
});

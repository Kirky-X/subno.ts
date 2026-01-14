// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { publicKeyRepository, apiKeyRepository, revocationConfirmationRepository } from '../repositories';
import type { PublicKey } from '../../db/schema';
import { 
  validateLength, 
  containsInvalidCharacters, 
  SECURITY_CONFIG 
} from '../utils/secure-compare';

export interface RevokeKeyRequest {
  keyId: string;
  apiKeyId: string;
  reason: string;
  confirmationHours?: number;
}

export interface RevokeKeyResult {
  success: boolean;
  revocationId?: string;
  confirmationCode?: string;
  expiresAt?: string;
  error?: string;
  code?: string;
}

export interface ConfirmRevokeResult {
  success: boolean;
  deletedId?: string;
  channelId?: string;
  error?: string;
  code?: string;
}

export interface RevocationStatusResult {
  success: boolean;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'not_found';
  keyId?: string;
  channelId?: string;
  revokedAt?: string;
  revokedBy?: string;
  expiresAt?: string;
  error?: string;
  code?: string;
}

export class KeyRevocationService {
  /**
   * Validate the revocation request reason for security.
   * Returns null if valid, or an error object if invalid.
   */
  private validateReason(reason: string): { error: string; code: string } | null {
    if (typeof reason !== 'string') {
      return { error: 'Reason must be a string', code: 'INVALID_INPUT' };
    }

    if (!validateLength(reason, SECURITY_CONFIG.REVOCATION_REASON_MIN_LENGTH, SECURITY_CONFIG.REVOCATION_REASON_MAX_LENGTH)) {
      if (reason.length < SECURITY_CONFIG.REVOCATION_REASON_MIN_LENGTH) {
        return { 
          error: `Reason must be at least ${SECURITY_CONFIG.REVOCATION_REASON_MIN_LENGTH} characters`, 
          code: 'INVALID_REASON' 
        };
      }
      return { 
        error: `Reason must not exceed ${SECURITY_CONFIG.REVOCATION_REASON_MAX_LENGTH} characters`, 
        code: 'INVALID_REASON' 
      };
    }

    if (containsInvalidCharacters(reason)) {
      return { error: 'Reason contains invalid characters', code: 'INVALID_INPUT' };
    }

    return null;
  }

  /**
   * Validate that the API key has permission to revoke keys.
   */
  private async validateApiKeyPermission(apiKeyId: string): Promise<{ valid: boolean; error?: string; code?: string }> {
    const hasPermission = await apiKeyRepository.validatePermission(apiKeyId, 'key_revoke');
    
    if (!hasPermission) {
      return { 
        valid: false, 
        error: 'Insufficient permissions for key revocation', 
        code: 'FORBIDDEN' 
      };
    }

    return { valid: true };
  }

  async requestRevocation(request: RevokeKeyRequest): Promise<RevokeKeyResult> {
    // Validate API key has permission
    const permissionCheck = await this.validateApiKeyPermission(request.apiKeyId);
    if (!permissionCheck.valid) {
      return { 
        success: false, 
        error: permissionCheck.error, 
        code: permissionCheck.code 
      };
    }

    const key = await publicKeyRepository.findById(request.keyId);
    
    if (!key) {
      return { success: false, error: 'Key not found', code: 'NOT_FOUND' };
    }

    if (key.isDeleted) {
      return { success: false, error: 'Key already revoked', code: 'ALREADY_REVOKED' };
    }

    // Validate reason with enhanced checks
    const reasonValidation = this.validateReason(request.reason);
    if (reasonValidation) {
      return { 
        success: false, 
        error: reasonValidation.error, 
        code: reasonValidation.code 
      };
    }

    // Check for existing pending revocation
    const existingConfirmation = await revocationConfirmationRepository.findByKeyId(request.keyId);
    if (existingConfirmation && existingConfirmation.status === 'pending') {
      return {
        success: false,
        error: 'Revocation already pending',
        code: 'REVOCATION_PENDING',
        revocationId: existingConfirmation.id,
        expiresAt: existingConfirmation.expiresAt.toISOString(),
      };
    }

    const { confirmation, confirmationCode } = await revocationConfirmationRepository.create({
      keyId: request.keyId,
      apiKeyId: request.apiKeyId,
      reason: request.reason,
      expiresInHours: request.confirmationHours,
    });

    return {
      success: true,
      revocationId: confirmation.id,
      confirmationCode,
      expiresAt: confirmation.expiresAt.toISOString(),
    };
  }

  async confirmRevocation(
    revocationId: string,
    confirmationCode: string,
    confirmedBy: string
  ): Promise<ConfirmRevokeResult> {
    const verification = await revocationConfirmationRepository.verifyConfirmationCode(
      revocationId,
      confirmationCode
    );

    if (verification.isLocked) {
      return { success: false, error: 'Too many failed attempts. Please try again later.', code: 'LOCKED' };
    }

    if (!verification.valid) {
      if (!verification.confirmation) {
        return { success: false, error: 'Revocation not found or expired', code: 'NOT_FOUND' };
      }
      return { success: false, error: 'Invalid confirmation code', code: 'INVALID_CODE' };
    }

    const confirmation = verification.confirmation!;
    const key = await publicKeyRepository.findById(confirmation.keyId);

    if (!key) {
      return { success: false, error: 'Key not found', code: 'NOT_FOUND' };
    }

    // Perform soft delete
    const deletedKey = await publicKeyRepository.softDelete(
      confirmation.keyId,
      confirmedBy,
      confirmation.reason
    );

    if (!deletedKey) {
      return { success: false, error: 'Failed to delete key', code: 'DELETE_FAILED' };
    }

    // Update confirmation status
    await revocationConfirmationRepository.updateStatus(revocationId, 'confirmed', confirmedBy);

    return {
      success: true,
      deletedId: deletedKey.id,
      channelId: deletedKey.channelId,
    };
  }

  async cancelRevocation(revocationId: string, confirmedBy: string): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }> {
    const confirmation = await revocationConfirmationRepository.findById(revocationId);

    if (!confirmation) {
      return { success: false, error: 'Revocation not found', code: 'NOT_FOUND' };
    }

    if (confirmation.status !== 'pending') {
      return { success: false, error: 'Revocation is not in pending state', code: 'INVALID_STATE' };
    }

    await revocationConfirmationRepository.updateStatus(revocationId, 'cancelled', confirmedBy);

    return { success: true };
  }

  async getRevocationStatus(revocationId: string): Promise<RevocationStatusResult> {
    const confirmation = await revocationConfirmationRepository.findById(revocationId);

    if (!confirmation) {
      // Check if key exists but no pending revocation
      return { success: false, error: 'Revocation not found', code: 'NOT_FOUND' };
    }

    const key = await publicKeyRepository.findById(confirmation.keyId);

    return {
      success: true,
      status: confirmation.status as 'pending' | 'confirmed' | 'cancelled' | 'expired',
      keyId: confirmation.keyId,
      channelId: key?.channelId,
      revokedAt: key?.revokedAt?.toISOString(),
      revokedBy: key?.revokedBy || undefined,
      expiresAt: confirmation.expiresAt.toISOString(),
    };
  }

  async getPendingRevocationByKeyId(keyId: string): Promise<RevocationStatusResult> {
    const confirmation = await revocationConfirmationRepository.findByKeyId(keyId);

    if (!confirmation) {
      return { success: false, error: 'No pending revocation', code: 'NOT_FOUND', status: 'not_found' };
    }

    return this.getRevocationStatus(confirmation.id);
  }
}

export const keyRevocationService = new KeyRevocationService();

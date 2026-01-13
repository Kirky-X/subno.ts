// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { publicKeyRepository, revocationConfirmationRepository } from '../repositories';
import type { PublicKey } from '../../db/schema';

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
  async requestRevocation(request: RevokeKeyRequest): Promise<RevokeKeyResult> {
    const key = await publicKeyRepository.findById(request.keyId);
    
    if (!key) {
      return { success: false, error: 'Key not found', code: 'NOT_FOUND' };
    }

    if (key.isDeleted) {
      return { success: false, error: 'Key already revoked', code: 'ALREADY_REVOKED' };
    }

    if (request.reason.length < 10) {
      return { success: false, error: 'Reason must be at least 10 characters', code: 'INVALID_REASON' };
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

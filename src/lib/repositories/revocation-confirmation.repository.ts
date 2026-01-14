// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { revocationConfirmations, type RevocationConfirmation } from '../../db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import crypto, { randomBytes, timingSafeEqual } from 'crypto';
import { SECURITY_CONFIG } from '../config/security.config';

export interface CreateRevocationConfirmation {
  keyId: string;
  apiKeyId?: string;
  reason: string;
  expiresInHours?: number;
}

export interface RevocationConfirmationWithKey extends RevocationConfirmation {
  publicKey?: {
    id: string;
    channelId: string;
  };
}

export class RevocationConfirmationRepository {
  private db = getDatabase();

  private async hashConfirmationCode(code: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        code,
        salt,
        SECURITY_CONFIG.pbkdf2Iterations,
        SECURITY_CONFIG.hashLength,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          resolve(salt + ':' + derivedKey.toString('hex'));
        }
      );
    });
  }

  private async verifyConfirmationCodeHash(code: string, hashedCode: string): Promise<boolean> {
    const [salt] = hashedCode.split(':');
    const newHash = await this.hashConfirmationCode(code, salt);
    const codeBuffer = Buffer.from(newHash, 'utf8');
    const hashedBuffer = Buffer.from(hashedCode, 'utf8');
    return timingSafeEqual(codeBuffer, hashedBuffer);
  }

  private generateSalt(): string {
    return crypto.randomBytes(SECURITY_CONFIG.saltLength).toString('hex');
  }

  private generateConfirmationCode(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private isLocked(confirmation: RevocationConfirmation): boolean {
    return !!(confirmation.lockedUntil && new Date() < confirmation.lockedUntil);
  }

  private isExpired(confirmation: RevocationConfirmation): boolean {
    return new Date() > confirmation.expiresAt;
  }

  private calculateLockUntil(): Date {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + SECURITY_CONFIG.lockoutDurationMinutes);
    return lockedUntil;
  }

  private calculateExpiryDate(expiresInHours?: number): Date {
    const minHours = 1;  // Minimum 1 hour
    const maxHours = 24 * 365;  // Maximum 1 year
    const validatedHours = Math.min(
      Math.max(expiresInHours || 24, minHours),
      maxHours
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + validatedHours);
    return expiresAt;
  }

  private async updateLockout(id: string, attemptCount: number): Promise<boolean> {
    const updates: { attemptCount: number; lockedUntil?: Date } = { attemptCount };
    const isLocked = attemptCount >= SECURITY_CONFIG.maxAttempts;
    if (isLocked) {
      updates.lockedUntil = this.calculateLockUntil();
    }
    await this.db
      .update(revocationConfirmations)
      .set(updates)
      .where(eq(revocationConfirmations.id, id));
    return isLocked;
  }

  async create(data: CreateRevocationConfirmation): Promise<{
    confirmation: RevocationConfirmation;
    confirmationCode: string;
  }> {
    const confirmationCode = this.generateConfirmationCode();
    const salt = this.generateSalt();
    const codeHash = await this.hashConfirmationCode(confirmationCode, salt);
    const expiresAt = this.calculateExpiryDate(data.expiresInHours);

    const result = await this.db
      .insert(revocationConfirmations)
      .values({
        keyId: data.keyId,
        apiKeyId: data.apiKeyId,
        confirmationCodeHash: codeHash,
        reason: data.reason,
        expiresAt,
        status: 'pending',
      })
      .returning();

    return {
      confirmation: result[0],
      confirmationCode,
    };
  }

  async findById(id: string): Promise<RevocationConfirmation | null> {
    const result = await this.db
      .select()
      .from(revocationConfirmations)
      .where(eq(revocationConfirmations.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findByKeyId(keyId: string): Promise<RevocationConfirmation | null> {
    const result = await this.db
      .select()
      .from(revocationConfirmations)
      .where(and(
        eq(revocationConfirmations.keyId, keyId),
        eq(revocationConfirmations.status, 'pending')
      ))
      .orderBy(desc(revocationConfirmations.createdAt))
      .limit(1);
    return result[0] ?? null;
  }

  async verifyConfirmationCode(
    id: string,
    code: string
  ): Promise<{ valid: boolean; confirmation: RevocationConfirmation | null; isLocked: boolean }> {
    const confirmation = await this.findById(id);
    if (!confirmation) {
      return { valid: false, confirmation: null, isLocked: false };
    }

    if (this.isLocked(confirmation)) {
      return { valid: false, confirmation, isLocked: true };
    }

    if (this.isExpired(confirmation)) {
      await this.updateStatus(id, 'expired');
      return { valid: false, confirmation: null, isLocked: false };
    }

    if (confirmation.status !== 'pending') {
      return { valid: false, confirmation, isLocked: false };
    }

    const valid = await this.verifyConfirmationCodeHash(code, confirmation.confirmationCodeHash);

    if (!valid) {
      const newAttemptCount = confirmation.attemptCount + 1;
      const isNowLocked = await this.updateLockout(id, newAttemptCount);
      return {
        valid: false,
        confirmation: { ...confirmation, attemptCount: newAttemptCount },
        isLocked: isNowLocked,
      };
    }

    return { valid: true, confirmation, isLocked: false };
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'confirmed' | 'cancelled' | 'expired',
    confirmedBy?: string
  ): Promise<RevocationConfirmation | null> {
    const updates: Record<string, unknown> = { status };

    if (status === 'confirmed') {
      updates.confirmedAt = new Date();
      updates.confirmedBy = confirmedBy;
    }

    const result = await this.db
      .update(revocationConfirmations)
      .set(updates)
      .where(eq(revocationConfirmations.id, id))
      .returning();
    return result[0] ?? null;
  }

  async getExpiredConfirmations(): Promise<RevocationConfirmation[]> {
    const result = await this.db
      .select()
      .from(revocationConfirmations)
      .where(and(
        eq(revocationConfirmations.status, 'pending'),
        lt(revocationConfirmations.expiresAt, new Date())
      ));
    return result;
  }

  async getPendingConfirmations(limit: number = 1000): Promise<RevocationConfirmation[]> {
    const result = await this.db
      .select()
      .from(revocationConfirmations)
      .where(eq(revocationConfirmations.status, 'pending'))
      .limit(limit);
    return result;
  }
}

export const revocationConfirmationRepository = new RevocationConfirmationRepository();

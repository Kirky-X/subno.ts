// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { revocationConfirmations, type RevocationConfirmation } from '../../db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import crypto, { createHash, randomBytes, timingSafeEqual } from 'crypto';

const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH = 64; // SHA-256 produces 32 bytes, hex encoded = 64 chars
const SALT_LENGTH = 32;

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
      crypto.pbkdf2(code, salt, PBKDF2_ITERATIONS, HASH_LENGTH, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  private async verifyConfirmationCodeHash(code: string, hashedCode: string): Promise<boolean> {
    const [salt] = hashedCode.split(':');
    const newHash = await this.hashConfirmationCode(code, salt);
    // Use timing-safe comparison to prevent timing attacks
    const codeBuffer = Buffer.from(newHash, 'utf8');
    const hashedBuffer = Buffer.from(hashedCode, 'utf8');
    return timingSafeEqual(codeBuffer, hashedBuffer);
  }

  private generateSalt(): string {
    return crypto.randomBytes(SALT_LENGTH).toString('hex');
  }

  private generateConfirmationCode(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async create(data: CreateRevocationConfirmation): Promise<{
    confirmation: RevocationConfirmation;
    confirmationCode: string;
  }> {
    const confirmationCode = this.generateConfirmationCode();
    const salt = this.generateSalt();
    const codeHash = await this.hashConfirmationCode(confirmationCode, salt);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours || 24));

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
    return result[0] || null;
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
    return result[0] || null;
  }

  async verifyConfirmationCode(
    id: string,
    code: string
  ): Promise<{ valid: boolean; confirmation: RevocationConfirmation | null; isLocked: boolean }> {
    const confirmation = await this.findById(id);
    if (!confirmation) {
      return { valid: false, confirmation: null, isLocked: false };
    }

    if (confirmation.lockedUntil && new Date() < confirmation.lockedUntil) {
      return { valid: false, confirmation, isLocked: true };
    }

    if (new Date() > confirmation.expiresAt) {
      await this.updateStatus(id, 'expired');
      return { valid: false, confirmation: null, isLocked: false };
    }

    if (confirmation.status !== 'pending') {
      return { valid: false, confirmation, isLocked: false };
    }

    const valid = await this.verifyConfirmationCodeHash(code, confirmation.confirmationCodeHash);
    
    if (!valid) {
      const newAttemptCount = confirmation.attemptCount + 1;
      const updates: { attemptCount: number; lockedUntil?: Date } = {
        attemptCount: newAttemptCount,
      };

      if (newAttemptCount >= 5) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + 60);
        updates.lockedUntil = lockedUntil;
      }

      await this.db
        .update(revocationConfirmations)
        .set(updates)
        .where(eq(revocationConfirmations.id, id));

      return { valid: false, confirmation: { ...confirmation, ...updates }, isLocked: newAttemptCount >= 5 };
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
    return result[0] || null;
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

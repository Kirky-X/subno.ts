// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { publicKeys, type NewPublicKey } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { auditService } from './audit.service';
import { channelRepository } from '../repositories/channel.repository';
import crypto from 'crypto';

export interface RegisterRequest {
  publicKey: string;
  algorithm?: 'RSA-2048' | 'RSA-4096' | 'ECC-SECP256K1';
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

export interface RegisterResult {
  success: boolean;
  channelId?: string;
  publicKeyId?: string;
  algorithm?: string;
  expiresAt?: string;
  expiresIn?: number;
  error?: string;
  code?: string;
}

export interface QueryResult {
  success: boolean;
  data?: {
    id: string;
    channelId: string;
    algorithm: string;
    publicKey?: string;
    createdAt: string;
    expiresAt?: string;
    lastUsedAt?: string;
    isExpired: boolean;
  };
  error?: string;
  code?: string;
}

const ALGORITHM_REGEX_MAP: Record<string, RegExp> = {
  'RSA-2048': /-----BEGIN PUBLIC KEY-----[\s\S]*-----END PUBLIC KEY-----/,
  'RSA-4096': /-----BEGIN PUBLIC KEY-----[\s\S]*-----END PUBLIC KEY-----/,
  'ECC-SECP256K1': /-----BEGIN PUBLIC KEY-----[\s\S]*-----END PUBLIC KEY-----/,
};

const MAX_EXPIRATION_SECONDS = 30 * 24 * 60 * 60;

export class RegisterService {
  private db = getDatabase();

  validatePublicKey(publicKey: string, algorithm: string): boolean {
    if (!publicKey || typeof publicKey !== 'string') {
      return false;
    }

    const trimmedKey = publicKey.trim();
    if (!trimmedKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
      return false;
    }
    if (!trimmedKey.endsWith('-----END PUBLIC KEY-----')) {
      return false;
    }

    const pattern = ALGORITHM_REGEX_MAP[algorithm];
    if (!pattern) {
      return false;
    }

    return pattern.test(trimmedKey);
  }

  generateChannelId(): string {
    const randomBytes = crypto.randomBytes(8);
    return `enc_${randomBytes.toString('hex')}`;
  }

  async register(
    request: RegisterRequest,
    context?: {
      ip?: string;
      userAgent?: string;
    },
  ): Promise<RegisterResult> {
    const algorithm = request.algorithm || 'RSA-2048';

    if (!this.validatePublicKey(request.publicKey, algorithm)) {
      return {
        success: false,
        error: '无效的公钥格式',
        code: 'INVALID_PUBLIC_KEY',
      };
    }

    let expiresAt: Date | undefined;
    let expiresIn: number | undefined;

    if (request.expiresIn) {
      if (request.expiresIn > MAX_EXPIRATION_SECONDS) {
        return {
          success: false,
          error: `有效期不能超过 ${MAX_EXPIRATION_SECONDS} 秒（30天）`,
          code: 'INVALID_EXPIRATION',
        };
      }
      expiresAt = new Date(Date.now() + request.expiresIn * 1000);
      expiresIn = request.expiresIn;
    }

    const channelId = this.generateChannelId();

    try {
      await channelRepository.create({
        id: channelId,
        name: `Encrypted Channel ${channelId}`,
        type: 'encrypted',
        metadata: { algorithm },
        expiresAt,
      });

      const newKey: NewPublicKey = {
        channelId,
        publicKey: request.publicKey.trim(),
        algorithm,
        metadata: request.metadata || {},
        expiresAt,
      };

      const result = await this.db.insert(publicKeys).values(newKey).returning();

      const createdKey = result[0];

      await auditService.log({
        action: 'public_key_registered',
        channelId,
        keyId: createdKey.id,
        ip: context?.ip,
        userAgent: context?.userAgent,
        success: true,
        metadata: {
          algorithm,
          expiresIn,
        },
      });

      return {
        success: true,
        channelId,
        publicKeyId: createdKey.id,
        algorithm,
        expiresAt: expiresAt?.toISOString(),
        expiresIn,
      };
    } catch (error) {
      await auditService.log({
        action: 'public_key_registration_failed',
        channelId,
        ip: context?.ip,
        userAgent: context?.userAgent,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: '注册失败，请稍后重试',
        code: 'REGISTRATION_FAILED',
      };
    }
  }

  async queryByChannelId(channelId: string): Promise<QueryResult> {
    try {
      const result = await this.db
        .select()
        .from(publicKeys)
        .where(and(eq(publicKeys.channelId, channelId), eq(publicKeys.isDeleted, false)))
        .limit(1);

      if (result.length === 0) {
        return {
          success: false,
          error: '公钥不存在',
          code: 'NOT_FOUND',
        };
      }

      const key = result[0];
      const isExpired = key.expiresAt ? new Date() > key.expiresAt : false;

      return {
        success: true,
        data: {
          id: key.id,
          channelId: key.channelId,
          algorithm: key.algorithm,
          createdAt: key.createdAt.toISOString(),
          expiresAt: key.expiresAt?.toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString(),
          isExpired,
        },
      };
    } catch {
      return {
        success: false,
        error: '查询失败',
        code: 'QUERY_FAILED',
      };
    }
  }

  async queryByKeyId(keyId: string): Promise<QueryResult> {
    try {
      const result = await this.db
        .select()
        .from(publicKeys)
        .where(and(eq(publicKeys.id, keyId), eq(publicKeys.isDeleted, false)))
        .limit(1);

      if (result.length === 0) {
        return {
          success: false,
          error: '公钥不存在',
          code: 'NOT_FOUND',
        };
      }

      const key = result[0];
      const isExpired = key.expiresAt ? new Date() > key.expiresAt : false;

      return {
        success: true,
        data: {
          id: key.id,
          channelId: key.channelId,
          algorithm: key.algorithm,
          createdAt: key.createdAt.toISOString(),
          expiresAt: key.expiresAt?.toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString(),
          isExpired,
        },
      };
    } catch {
      return {
        success: false,
        error: '查询失败',
        code: 'QUERY_FAILED',
      };
    }
  }

  async updateLastUsed(channelId: string): Promise<void> {
    try {
      await this.db
        .update(publicKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(publicKeys.channelId, channelId));
    } catch {
      // Silently fail - lastUsedAt is not critical
    }
  }
}

export const registerService = new RegisterService();

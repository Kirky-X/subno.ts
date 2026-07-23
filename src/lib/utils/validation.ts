// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Input validation schemas using Zod
 */

import { z } from 'zod';

export const API_KEY_VALIDATION_CONFIG = {
  minLength: 16,
  /** Maximum API key length to prevent DoS */
  maxLength: 128,
  /** Valid character pattern (alphanumeric and hyphens) */
  validPattern: /^[a-zA-Z0-9-]+$/,
};

export function validateApiKeyFormat(apiKey: string): {
  valid: boolean;
  error?: string;
  code?: string;
} {
  if (apiKey.length < API_KEY_VALIDATION_CONFIG.minLength) {
    return {
      valid: false,
      error: `API key must be at least ${API_KEY_VALIDATION_CONFIG.minLength} characters`,
      code: 'INVALID_API_KEY',
    };
  }

  if (apiKey.length > API_KEY_VALIDATION_CONFIG.maxLength) {
    return {
      valid: false,
      error: 'API key is too long',
      code: 'INVALID_API_KEY',
    };
  }

  if (!API_KEY_VALIDATION_CONFIG.validPattern.test(apiKey)) {
    return {
      valid: false,
      error: 'API key contains invalid characters',
      code: 'INVALID_API_KEY',
    };
  }

  return { valid: true };
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return typeof value === 'string' && UUID_V4_REGEX.test(value);
}

export const channelIdSchema = z
  .string()
  .min(1, 'Channel ID cannot be empty')
  .max(100, 'Channel ID is too long')
  .regex(
    /^[a-zA-Z0-9-_]+$/,
    'Channel ID can only contain alphanumeric characters, hyphens, and underscores',
  );

export const messageSchema = z.object({
  /** Message content */
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message is too long (max 10000 characters)'),
  /** Optional sender identifier */
  sender: z.string().max(100).optional(),
  /** Message priority */
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'BULK']).default('NORMAL'),
  /** Whether to encrypt the message */
  encrypted: z.boolean().default(true),
});

export const publicKeyRegistrationSchema = z.object({
  /** PEM formatted public key */
  publicKey: z.string().min(1, 'Public key cannot be empty').max(10000, 'Public key is too long'),
  /** Encryption algorithm */
  algorithm: z.enum(['RSA-2048', 'RSA-4096', 'ECC-SECP256K1']),
  /** Optional expiry in seconds */
  expiresIn: z.number().positive().max(2592000).optional(), // Max 30 days
  /** Optional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export const channelCreationSchema = z.object({
  /** Channel name */
  name: z.string().min(1, 'Channel name cannot be empty').max(100, 'Channel name is too long'),
  /** Channel description */
  description: z.string().max(500).optional(),
  /** Channel type */
  type: z.enum(['public', 'encrypted', 'temporary']).default('encrypted'),
  /** Optional TTL in seconds for temporary channels */
  ttl: z.number().positive().optional(),
});

export const paginationSchema = z.object({
  /** Maximum number of items to return */
  limit: z.number().positive().max(100).default(50),
  /** Number of items to skip */
  offset: z.number().nonnegative().default(0),
});

export const apiKeyCreationSchema = z.object({
  /** Name for the API key */
  name: z.string().min(1, 'Name cannot be empty').max(100, 'Name is too long'),
  /** User ID associated with the key */
  userId: z.string().min(1, 'User ID cannot be empty'),
  /** Permission list */
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  /** Optional expiry in seconds */
  expiresIn: z.number().positive().max(31536000).optional(), // Max 1 year
});

export const keyRevocationSchema = z.object({
  /** Reason for revocation */
  reason: z
    .string()
    .min(10, 'Revocation reason must be at least 10 characters')
    .max(1000, 'Revocation reason is too long'),
  /** Confirmation timeout in hours */
  confirmationTimeoutHours: z.number().positive().max(72).default(24),
});

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      code: string;
    };

export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  errorCode: string = 'VALIDATION_ERROR',
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const firstError = result.error.errors[0];
  return {
    success: false,
    error: firstError?.message || 'Validation failed',
    code: errorCode,
  };
}

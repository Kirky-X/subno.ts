// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { z } from 'zod';
import crypto from 'crypto';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // Message Configuration
  PUBLIC_MESSAGE_TTL: z.coerce.number().default(43200),
  PRIVATE_MESSAGE_TTL: z.coerce.number().default(86400),
  PUBLIC_MESSAGE_MAX_COUNT: z.coerce.number().default(1000),
  PRIVATE_MESSAGE_MAX_COUNT: z.coerce.number().default(100),

  // Channel Configuration
  TEMPORARY_CHANNEL_TTL: z.coerce.number().default(1800), // 30 minutes for auto-created channels
  PERSISTENT_CHANNEL_DEFAULT_TTL: z.coerce.number().default(86400), // 24 hours default for manual channels
  PERSISTENT_CHANNEL_MAX_TTL: z.coerce.number().default(604800), // 7 days max for manual channels
  CHANNEL_CLEANUP_INTERVAL: z.coerce.number().default(300), // 5 minutes cleanup interval
  AUTO_CREATE_CHANNELS_ENABLED: z.coerce.boolean().default(true), // Allow auto-create on publish
  MAX_CHANNEL_METADATA_SIZE: z.coerce.number().default(2048), // 2KB max metadata

  // Security Configuration
  MAX_MESSAGE_SIZE: z.coerce.number().default(4718592),
  RATE_LIMIT_PUBLISH: z.coerce.number().default(10),
  RATE_LIMIT_REGISTER: z.coerce.number().default(5),
  RATE_LIMIT_SUBSCRIBE: z.coerce.number().default(5),
  MAX_PUBLIC_KEY_SIZE: z.coerce.number().default(4096), // 4KB max public key

  // Key Configuration
  KEY_EXPIRY_DEFAULT: z.coerce.number().default(604800),
  KEY_EXPIRY_MAX: z.coerce.number().default(2592000),

  // Admin Configuration
  ADMIN_MASTER_KEY: z.string().optional(),

  // Cleanup Configuration
  CLEANUP_BATCH_SIZE: z.coerce.number().default(1000),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().default(90),
  MESSAGE_CLEANUP_MAX_AGE_HOURS: z.coerce.number().default(12),

  // Monitoring Configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_AUDIT_LOG: z.coerce.boolean().default(true),

  // CORS Configuration
  CORS_ORIGINS: z.string().default(''),

  // Cron Configuration
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Generate a secure random key
 */
function generateSecureKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Parse and validate environment variables with auto-generation for missing keys
 */
function parseEnv(): Env {
  const parsed = envSchema.parse(process.env);

  // Auto-generate ADMIN_MASTER_KEY if not set
  if (!parsed.ADMIN_MASTER_KEY) {
    const generatedKey = generateSecureKey();
    parsed.ADMIN_MASTER_KEY = generatedKey;

    // Log warning with the generated key
    console.warn('');
    console.warn('⚠️  WARNING: ADMIN_MASTER_KEY not configured!');
    console.warn('⚠️  Auto-generated master key for development:');
    console.warn('');
    console.warn(`   ${generatedKey}`);
    console.warn('');
    console.warn('⚠️  IMPORTANT: Add this to your .env file:');
    console.warn('   ADMIN_MASTER_KEY=' + generatedKey);
    console.warn('');
    console.warn('⚠️  In production, always set a secure ADMIN_MASTER_KEY!');
    console.warn('');
  }

  // Auto-generate CRON_SECRET if not set
  if (!parsed.CRON_SECRET) {
    const generatedSecret = generateSecureKey();
    parsed.CRON_SECRET = generatedSecret;

    console.warn('');
    console.warn('⚠️  WARNING: CRON_SECRET not configured!');
    console.warn('⚠️  Auto-generated cron secret for development:');
    console.warn('');
    console.warn(`   ${generatedSecret}`);
    console.warn('');
    console.warn('⚠️  IMPORTANT: Add this to your .env file:');
    console.warn('   CRON_SECRET=' + generatedSecret);
    console.warn('');
  }

  return parsed;
}

export const env = parseEnv();

// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { z } from 'zod';

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

export const env = envSchema.parse(process.env);

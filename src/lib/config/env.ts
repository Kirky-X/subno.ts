// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Environment Configuration using @t3-oss/env-nextjs
 * Provides type-safe environment variable validation with Zod
 */

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Type declaration to work around inference issues
type ServerSchema = typeof serverSchema;
type ClientSchema = typeof clientSchema;

/**
 * Server-side environment variables schema
 */
const serverSchema = z.object({
  // Database configuration
  DATABASE_URL: z.string().url().describe('PostgreSQL connection URL'),
  
  // Redis configuration
  REDIS_URL: z.string().url().describe('Redis connection URL'),
  
  // API configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  
  // Security configuration
  ADMIN_MASTER_KEY: z.string().min(32).describe('Master key for admin operations (min 32 chars)'),
  CRON_SECRET: z.string().min(32).describe('Secret token for cron jobs (min 32 chars)'),
  
  // Message configuration
  PUBLIC_MESSAGE_TTL: z.string().transform(Number).default('43200'),
  PRIVATE_MESSAGE_TTL: z.string().transform(Number).default('86400'),
  
  // Channel configuration
  TEMPORARY_CHANNEL_TTL: z.string().transform(Number).default('1800'),
  PERSISTENT_CHANNEL_DEFAULT_TTL: z.string().transform(Number).default('86400'),
  
  // Rate limiting configuration
  RATE_LIMIT_WINDOW_SECONDS: z.string().transform(Number).default('60'),
  RATE_LIMIT_DEFAULT: z.string().transform(Number).default('100'),
  RATE_LIMIT_PUBLISH: z.string().transform(Number).default('10'),
  RATE_LIMIT_SUBSCRIBE: z.string().transform(Number).default('5'),
  RATE_LIMIT_REGISTER: z.string().transform(Number).default('5'),
  RATE_LIMIT_REVOKE: z.string().transform(Number).default('20'),
  
  // Key revocation configuration
  REVOCATION_CONFIRMATION_HOURS: z.string().transform(Number).default('24'),
  REVOKED_KEY_CLEANUP_DAYS: z.string().transform(Number).default('30'),
  CONFIRMATION_MAX_ATTEMPTS: z.string().transform(Number).default('5'),
  CONFIRMATION_LOCKOUT_MINUTES: z.string().transform(Number).default('60'),
  
  // CORS configuration
  CORS_ORIGINS: z.string().optional().describe('Comma-separated list of allowed origins'),
  
  // Database connection pool configuration
  DB_POOL_SIZE: z.string().transform(Number).default('20'),
  DB_IDLE_TIMEOUT: z.string().transform(Number).default('30000'),
  DB_CONNECT_TIMEOUT: z.string().transform(Number).default('2000'),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/**
 * Client-side environment variables schema
 * These are exposed to the browser via process.env.NEXT_PUBLIC_*
 */
const clientSchema = z.object({
  // Add client-side env vars here if needed
  // Example: NEXT_PUBLIC_API_URL: z.string().url(),
});

/**
 * Runtime environment for server-side rendering
 * Note: Using type assertion to work around @t3-oss/env-nextjs type inference issues
 */
export const env = createEnv({
  server: serverSchema as any,
  client: clientSchema as any,
  runtimeEnv: {
    // Server-side
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    ADMIN_MASTER_KEY: process.env.ADMIN_MASTER_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    PUBLIC_MESSAGE_TTL: process.env.PUBLIC_MESSAGE_TTL,
    PRIVATE_MESSAGE_TTL: process.env.PRIVATE_MESSAGE_TTL,
    TEMPORARY_CHANNEL_TTL: process.env.TEMPORARY_CHANNEL_TTL,
    PERSISTENT_CHANNEL_DEFAULT_TTL: process.env.PERSISTENT_CHANNEL_DEFAULT_TTL,
    RATE_LIMIT_WINDOW_SECONDS: process.env.RATE_LIMIT_WINDOW_SECONDS,
    RATE_LIMIT_DEFAULT: process.env.RATE_LIMIT_DEFAULT,
    RATE_LIMIT_PUBLISH: process.env.RATE_LIMIT_PUBLISH,
    RATE_LIMIT_SUBSCRIBE: process.env.RATE_LIMIT_SUBSCRIBE,
    RATE_LIMIT_REGISTER: process.env.RATE_LIMIT_REGISTER,
    RATE_LIMIT_REVOKE: process.env.RATE_LIMIT_REVOKE,
    REVOCATION_CONFIRMATION_HOURS: process.env.REVOCATION_CONFIRMATION_HOURS,
    REVOKED_KEY_CLEANUP_DAYS: process.env.REVOKED_KEY_CLEANUP_DAYS,
    CONFIRMATION_MAX_ATTEMPTS: process.env.CONFIRMATION_MAX_ATTEMPTS,
    CONFIRMATION_LOCKOUT_MINUTES: process.env.CONFIRMATION_LOCKOUT_MINUTES,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    DB_POOL_SIZE: process.env.DB_POOL_SIZE,
    DB_IDLE_TIMEOUT: process.env.DB_IDLE_TIMEOUT,
    DB_CONNECT_TIMEOUT: process.env.DB_CONNECT_TIMEOUT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    
    // Client-side
    // NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

/**
 * Type-safe accessor for environment variables
 * Provides validated and transformed values
 */
export function getEnv() {
  return env;
}

/**
 * Get database configuration
 */
export function getDatabaseConfig() {
  const e = env as unknown as {
    DATABASE_URL: string;
    DB_POOL_SIZE: number;
    DB_IDLE_TIMEOUT: number;
    DB_CONNECT_TIMEOUT: number;
  };
  
  return {
    url: e.DATABASE_URL,
    poolSize: e.DB_POOL_SIZE,
    idleTimeout: e.DB_IDLE_TIMEOUT,
    connectTimeout: e.DB_CONNECT_TIMEOUT,
  };
}

/**
 * Get Redis configuration
 */
export function getRedisConfig() {
  const e = env as unknown as { REDIS_URL: string };
  return {
    url: e.REDIS_URL,
  };
}

/**
 * Get rate limit configuration
 */
export function getRateLimitConfig() {
  const e = env as unknown as {
    RATE_LIMIT_WINDOW_SECONDS: number;
    RATE_LIMIT_DEFAULT: number;
    RATE_LIMIT_PUBLISH: number;
    RATE_LIMIT_SUBSCRIBE: number;
    RATE_LIMIT_REGISTER: number;
    RATE_LIMIT_REVOKE: number;
  };
  return {
    windowSeconds: e.RATE_LIMIT_WINDOW_SECONDS,
    default: e.RATE_LIMIT_DEFAULT,
    publish: e.RATE_LIMIT_PUBLISH,
    subscribe: e.RATE_LIMIT_SUBSCRIBE,
    register: e.RATE_LIMIT_REGISTER,
    revoke: e.RATE_LIMIT_REVOKE,
  };
}

/**
 * Get message TTL configuration
 */
export function getMessageTTLConfig() {
  const e = env as unknown as {
    PUBLIC_MESSAGE_TTL: number;
    PRIVATE_MESSAGE_TTL: number;
  };
  return {
    public: e.PUBLIC_MESSAGE_TTL,
    private: e.PRIVATE_MESSAGE_TTL,
  };
}

/**
 * Get channel configuration
 */
export function getChannelConfig() {
  const e = env as unknown as {
    TEMPORARY_CHANNEL_TTL: number;
    PERSISTENT_CHANNEL_DEFAULT_TTL: number;
  };
  return {
    temporaryTTL: e.TEMPORARY_CHANNEL_TTL,
    persistentDefaultTTL: e.PERSISTENT_CHANNEL_DEFAULT_TTL,
  };
}

/**
 * Get key revocation configuration
 */
export function getKeyRevocationConfig() {
  const e = env as unknown as {
    REVOCATION_CONFIRMATION_HOURS: number;
    REVOKED_KEY_CLEANUP_DAYS: number;
    CONFIRMATION_MAX_ATTEMPTS: number;
    CONFIRMATION_LOCKOUT_MINUTES: number;
  };
  return {
    confirmationHours: e.REVOCATION_CONFIRMATION_HOURS,
    cleanupDays: e.REVOKED_KEY_CLEANUP_DAYS,
    maxAttempts: e.CONFIRMATION_MAX_ATTEMPTS,
    lockoutMinutes: e.CONFIRMATION_LOCKOUT_MINUTES,
  };
}

/**
 * Validate that ADMIN_MASTER_KEY is properly configured in production
 */
export function validateProductionSecurity(): void {
  const e = env as unknown as {
    NODE_ENV: 'development' | 'production' | 'test';
    ADMIN_MASTER_KEY: string;
    CRON_SECRET: string;
  };
  
  if (e.NODE_ENV === 'production') {
    if (e.ADMIN_MASTER_KEY.includes('REPLACE_WITH') || 
        e.ADMIN_MASTER_KEY.includes('dev-') ||
        e.ADMIN_MASTER_KEY.length < 32) {
      throw new Error(
        'ADMIN_MASTER_KEY must be a strong random key (min 32 characters) in production'
      );
    }
    
    if (e.CRON_SECRET.includes('REPLACE_WITH') || 
        e.CRON_SECRET.includes('dev-') ||
        e.CRON_SECRET.length < 32) {
      throw new Error(
        'CRON_SECRET must be a strong random token (min 32 characters) in production'
      );
    }
  }
}

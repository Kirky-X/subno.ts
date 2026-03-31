// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Configuration Constants
 *
 * Centralized configuration constants for the application
 * Replaces magic numbers and string literals with type-safe enums
 */

/**
 * Channel type enumeration
 */
export enum ChannelType {
  /** Public channel - anyone can subscribe */
  PUBLIC = 'public',

  /** Encrypted channel - requires encryption key */
  ENCRYPTED = 'encrypted',

  /** Temporary channel - auto-expires after TTL */
  TEMPORARY = 'temporary',
}

/**
 * Encryption algorithm enumeration
 */
export enum Algorithm {
  /** RSA 2048-bit key */
  RSA_2048 = 'RSA-2048',

  /** RSA 4096-bit key */
  RSA_4096 = 'RSA-4096',

  /** EdDSA using Curve25519 */
  ED25519 = 'ED25519',
}

/**
 * Message priority levels
 */
export enum MessagePriorityLevel {
  /** Critical priority - highest importance */
  CRITICAL = 100,

  /** High priority */
  HIGH = 75,

  /** Normal priority - default */
  NORMAL = 50,

  /** Low priority */
  LOW = 25,

  /** Bulk priority - lowest importance */
  BULK = 0,
}

/**
 * API Key permission types (already defined in permissions.ts, re-exported here)
 */
export { Permission } from './permissions';

/**
 * System configuration constants
 */
export const ConfigConstants = {
  /** Maximum message size in bytes (1MB) */
  MAX_MESSAGE_SIZE: 1024 * 1024,

  /** Maximum connections per channel */
  MAX_CONNECTIONS_PER_CHANNEL: 1000,

  /** Maximum total connections across all channels */
  MAX_TOTAL_CONNECTIONS: 10000,

  /** Connection timeout in milliseconds (30 minutes) */
  CONNECTION_TIMEOUT_MS: 30 * 60 * 1000,

  /** Keepalive interval in milliseconds (30 seconds) */
  KEEPALIVE_INTERVAL: 30000,

  /** Default rate limit window in seconds (1 minute) */
  RATE_LIMIT_WINDOW_SECONDS: 60,

  /** Default rate limit requests per window */
  RATE_LIMIT_DEFAULT: 100,

  /** Publish rate limit requests per window */
  RATE_LIMIT_PUBLISH: 10,

  /** Subscribe rate limit requests per window */
  RATE_LIMIT_SUBSCRIBE: 5,

  /** Register rate limit requests per window */
  RATE_LIMIT_REGISTER: 5,

  /** Revoke operation rate limit requests per window */
  RATE_LIMIT_REVOKE: 20,

  /** Public message TTL in seconds (12 hours) */
  PUBLIC_MESSAGE_TTL: 43200,

  /** Private message TTL in seconds (24 hours) */
  PRIVATE_MESSAGE_TTL: 86400,

  /** Temporary channel TTL in seconds (30 minutes) */
  TEMPORARY_CHANNEL_TTL: 1800,

  /** Persistent channel default TTL in seconds (24 hours) */
  PERSISTENT_CHANNEL_DEFAULT_TTL: 86400,

  /** Revocation confirmation validity period in hours (24 hours) */
  REVOCATION_CONFIRMATION_HOURS: 24,

  /** Revoked key cleanup delay in days (30 days) */
  REVOKED_KEY_CLEANUP_DAYS: 30,

  /** Maximum confirmation code attempts before lockout */
  CONFIRMATION_MAX_ATTEMPTS: 5,

  /** Confirmation lockout duration in minutes (60 minutes) */
  CONFIRMATION_LOCKOUT_MINUTES: 60,

  /** Database connection pool size */
  DB_POOL_SIZE: 20,

  /** Database idle timeout in milliseconds (30 seconds) */
  DB_IDLE_TIMEOUT: 30000,

  /** Database connection timeout in milliseconds (2 seconds) */
  DB_CONNECT_TIMEOUT: 2000,

  /** Redis reconnect strategy multiplier in ms */
  REDIS_RECONNECT_STRATEGY_MS: 50,

  /** Redis maximum reconnect delay in ms */
  REDIS_MAX_RECONNECT_DELAY_MS: 5000,

  /** Redis connection timeout in ms */
  REDIS_CONNECT_TIMEOUT_MS: 10000,

  /** CORS preflight cache max age in seconds (24 hours) */
  CORS_MAX_AGE: 86400,
} as const;

/**
 * Type for config constants
 */
export type ConfigConstantsType = typeof ConfigConstants;

/**
 * Get human-readable label for channel type
 * @param type - Channel type
 * @returns Human-readable label
 */
export function getChannelTypeLabel(type: ChannelType): string {
  const labels: Record<ChannelType, string> = {
    [ChannelType.PUBLIC]: '公开频道',
    [ChannelType.ENCRYPTED]: '加密频道',
    [ChannelType.TEMPORARY]: '临时频道',
  };
  return labels[type] || '未知';
}

/**
 * Get human-readable label for algorithm
 * @param algorithm - Algorithm
 * @returns Human-readable label
 */
export function getAlgorithmLabel(algorithm: Algorithm): string {
  const labels: Record<Algorithm, string> = {
    [Algorithm.RSA_2048]: 'RSA 2048 位',
    [Algorithm.RSA_4096]: 'RSA 4096 位',
    [Algorithm.ED25519]: 'Ed25519',
  };
  return labels[algorithm] || '未知';
}

/**
 * Get human-readable label for message priority
 * @param level - Priority level
 * @returns Human-readable label
 */
export function getMessagePriorityLabel(level: MessagePriorityLevel): string {
  const labels: Record<MessagePriorityLevel, string> = {
    [MessagePriorityLevel.CRITICAL]: '紧急',
    [MessagePriorityLevel.HIGH]: '高',
    [MessagePriorityLevel.NORMAL]: '普通',
    [MessagePriorityLevel.LOW]: '低',
    [MessagePriorityLevel.BULK]: '批量',
  };
  return labels[level] || '未知';
}

/**
 * Validate channel type string
 * @param type - Type string to validate
 * @returns True if the type is valid
 */
export function isValidChannelType(type: string): type is ChannelType {
  return Object.values(ChannelType).includes(type as ChannelType);
}

/**
 * Validate algorithm string
 * @param algorithm - Algorithm string to validate
 * @returns True if the algorithm is valid
 */
export function isValidAlgorithm(algorithm: string): algorithm is Algorithm {
  return Object.values(Algorithm).includes(algorithm as Algorithm);
}

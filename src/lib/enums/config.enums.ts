// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * 配置键名枚举
 * 提供类型安全的环境变量访问
 */
export enum ConfigKey {
  // 数据库配置
  DATABASE_URL = 'DATABASE_URL',

  // Redis 配置
  REDIS_URL = 'REDIS_URL',

  // 运行环境
  NODE_ENV = 'NODE_ENV',
  PORT = 'PORT',

  // 安全配置
  ADMIN_MASTER_KEY = 'ADMIN_MASTER_KEY',
  CRON_SECRET = 'CRON_SECRET',

  // 消息配置
  PUBLIC_MESSAGE_TTL = 'PUBLIC_MESSAGE_TTL',
  PRIVATE_MESSAGE_TTL = 'PRIVATE_MESSAGE_TTL',

  // 频道配置
  TEMPORARY_CHANNEL_TTL = 'TEMPORARY_CHANNEL_TTL',
  PERSISTENT_CHANNEL_DEFAULT_TTL = 'PERSISTENT_CHANNEL_DEFAULT_TTL',

  // 速率限制配置
  RATE_LIMIT_WINDOW_SECONDS = 'RATE_LIMIT_WINDOW_SECONDS',
  RATE_LIMIT_DEFAULT = 'RATE_LIMIT_DEFAULT',
  RATE_LIMIT_PUBLISH = 'RATE_LIMIT_PUBLISH',
  RATE_LIMIT_SUBSCRIBE = 'RATE_LIMIT_SUBSCRIBE',
  RATE_LIMIT_REGISTER = 'RATE_LIMIT_REGISTER',
  RATE_LIMIT_REVOKE = 'RATE_LIMIT_REVOKE',

  // 撤销配置
  REVOCATION_CONFIRMATION_HOURS = 'REVOCATION_CONFIRMATION_HOURS',
  REVOKED_KEY_CLEANUP_DAYS = 'REVOKED_KEY_CLEANUP_DAYS',
  CONFIRMATION_MAX_ATTEMPTS = 'CONFIRMATION_MAX_ATTEMPTS',
  CONFIRMATION_LOCKOUT_MINUTES = 'CONFIRMATION_LOCKOUT_MINUTES',

  // CORS 配置
  CORS_ORIGINS = 'CORS_ORIGINS',

  // 数据库连接池配置
  DB_POOL_SIZE = 'DB_POOL_SIZE',
  DB_IDLE_TIMEOUT = 'DB_IDLE_TIMEOUT',
  DB_CONNECT_TIMEOUT = 'DB_CONNECT_TIMEOUT',

  // 日志配置
  LOG_LEVEL = 'LOG_LEVEL',
}

/**
 * 配置键类别
 */
export enum ConfigCategory {
  DATABASE = 'database',
  REDIS = 'redis',
  SECURITY = 'security',
  MESSAGE = 'message',
  CHANNEL = 'channel',
  RATE_LIMIT = 'rate_limit',
  REVOCATION = 'revocation',
  NETWORK = 'network',
  LOGGING = 'logging',
}

/**
 * 配置键分类映射
 */
export const CONFIG_CATEGORIES: Record<ConfigKey, ConfigCategory> = {
  [ConfigKey.DATABASE_URL]: ConfigCategory.DATABASE,
  [ConfigKey.REDIS_URL]: ConfigCategory.REDIS,
  [ConfigKey.NODE_ENV]: ConfigCategory.SECURITY,
  [ConfigKey.PORT]: ConfigCategory.SECURITY,
  [ConfigKey.ADMIN_MASTER_KEY]: ConfigCategory.SECURITY,
  [ConfigKey.CRON_SECRET]: ConfigCategory.SECURITY,
  [ConfigKey.PUBLIC_MESSAGE_TTL]: ConfigCategory.MESSAGE,
  [ConfigKey.PRIVATE_MESSAGE_TTL]: ConfigCategory.MESSAGE,
  [ConfigKey.TEMPORARY_CHANNEL_TTL]: ConfigCategory.CHANNEL,
  [ConfigKey.PERSISTENT_CHANNEL_DEFAULT_TTL]: ConfigCategory.CHANNEL,
  [ConfigKey.RATE_LIMIT_WINDOW_SECONDS]: ConfigCategory.RATE_LIMIT,
  [ConfigKey.RATE_LIMIT_DEFAULT]: ConfigCategory.RATE_LIMIT,
  [ConfigKey.RATE_LIMIT_PUBLISH]: ConfigCategory.RATE_LIMIT,
  [ConfigKey.RATE_LIMIT_SUBSCRIBE]: ConfigCategory.RATE_LIMIT,
  [ConfigKey.RATE_LIMIT_REGISTER]: ConfigCategory.RATE_LIMIT,
  [ConfigKey.RATE_LIMIT_REVOKE]: ConfigCategory.RATE_LIMIT,
  [ConfigKey.REVOCATION_CONFIRMATION_HOURS]: ConfigCategory.REVOCATION,
  [ConfigKey.REVOKED_KEY_CLEANUP_DAYS]: ConfigCategory.REVOCATION,
  [ConfigKey.CONFIRMATION_MAX_ATTEMPTS]: ConfigCategory.REVOCATION,
  [ConfigKey.CONFIRMATION_LOCKOUT_MINUTES]: ConfigCategory.REVOCATION,
  [ConfigKey.CORS_ORIGINS]: ConfigCategory.NETWORK,
  [ConfigKey.DB_POOL_SIZE]: ConfigCategory.DATABASE,
  [ConfigKey.DB_IDLE_TIMEOUT]: ConfigCategory.DATABASE,
  [ConfigKey.DB_CONNECT_TIMEOUT]: ConfigCategory.DATABASE,
  [ConfigKey.LOG_LEVEL]: ConfigCategory.LOGGING,
};

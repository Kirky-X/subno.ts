// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Public keys table - stores public keys for encrypted channels
 */
export const publicKeys = pgTable(
  'public_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: varchar('channel_id', { length: 255 })
      .notNull()
      .unique(),
    publicKey: text('public_key').notNull(),
    algorithm: varchar('algorithm', { length: 50 })
      .notNull()
      .default('RSA-2048'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_public_keys_expires_at').on(table.expiresAt),
    index('idx_public_keys_channel_id').on(table.channelId),
  ]
);

/**
 * Channels table - stores channel metadata
 */
export const channels = pgTable(
  'channels',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    type: varchar('type', { length: 20 }).notNull().default('public'),
    creator: varchar('creator', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 过期时间 (null 表示永不过期)
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    // 是否激活 (用于软删除)
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_channels_type').on(table.type),
    index('idx_channels_expires_at').on(table.expiresAt),
    index('idx_channels_is_active').on(table.isActive),
  ]
);

/**
 * Audit logs table - stores operation audit logs
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    action: varchar('action', { length: 50 }).notNull(),
    channelId: varchar('channel_id', { length: 255 }),
    keyId: varchar('key_id', { length: 255 }),
    messageId: varchar('message_id', { length: 255 }),
    userId: varchar('user_id', { length: 255 }),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    success: boolean('success').notNull().default(true),
    error: text('error'),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_audit_logs_created_at').on(table.createdAt),
    index('idx_audit_logs_channel_id').on(table.channelId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_key_id').on(table.keyId),
  ]
);

/**
 * Messages table - stores message persistence
 */
export const messages = pgTable(
  'messages',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    channel: varchar('channel', { length: 255 }).notNull(),
    message: text('message').notNull(),
    encrypted: boolean('encrypted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_messages_channel').on(table.channel),
    index('idx_messages_created_at').on(table.createdAt),
  ]
);

/**
 * API Keys table - stores API keys for authentication
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
    keyPrefix: varchar('key_prefix', { length: 8 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    permissions: jsonb('permissions').notNull().default(['read']),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_api_keys_user_id').on(table.userId),
    index('idx_api_keys_key_prefix').on(table.keyPrefix),
    index('idx_api_keys_is_active').on(table.isActive),
  ]
);

/**
 * Type exports for use in services
 */
export type PublicKey = typeof publicKeys.$inferSelect;
export type NewPublicKey = typeof publicKeys.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { pgTable, varchar, text, boolean, timestamp, uuid, jsonb, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ============================================================================
// Public Keys Table - stores user public keys
// ============================================================================
export const publicKeys = pgTable('public_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar('channel_id', { length: 64 }).notNull().unique(),
  publicKey: text('public_key').notNull(),
  algorithm: varchar('algorithm', { length: 50 }).notNull().default('RSA-2048'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  // Soft delete fields
  isDeleted: boolean('is_deleted').notNull().default(false),
  revokedAt: timestamp('revoked_at'),
  revokedBy: varchar('revoked_by', { length: 255 }),
  revocationReason: text('revocation_reason'),
});

// Relations
export const publicKeysRelations = relations(publicKeys, ({ many }) => ({
  revocationConfirmations: many(revocationConfirmations),
  notificationHistory: many(notificationHistory),
}));

// ============================================================================
// API Keys Table - stores API access keys
// ============================================================================
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull().default('API Key'),
  permissions: jsonb('permissions').notNull().default(['read', 'write']),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  // Soft delete fields (for API key revocation)
  isDeleted: boolean('is_deleted').notNull().default(false),
  revokedAt: timestamp('revoked_at'),
  revokedBy: varchar('revoked_by', { length: 255 }),
  revocationReason: text('revocation_reason'),
});

// Relations
export const apiKeysRelations = relations(apiKeys, ({ many }) => ({
  revocationConfirmations: many(revocationConfirmations),
}));

// ============================================================================
// Channels Table - stores channel information
// ============================================================================
export const channels = pgTable('channels', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull().default('public'), // public, encrypted, temporary
  creator: varchar('creator', { length: 255 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
});

// ============================================================================
// Messages Table - stores message records
// ============================================================================
export const messages = pgTable('messages', {
  id: varchar('id', { length: 128 }).primaryKey(),
  channelId: varchar('channel_id', { length: 64 }).notNull(),
  content: text('content').notNull(),
  priority: integer('priority').notNull().default(50),
  sender: varchar('sender', { length: 255 }),
  encrypted: boolean('encrypted').notNull().default(false),
  cached: boolean('cached').notNull().default(true),
  signature: varchar('signature', { length: 512 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});

// ============================================================================
// Revocation Confirmations Table - stores revocation confirmation codes
// ============================================================================
export const revocationConfirmations = pgTable('revocation_confirmations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  keyId: uuid('key_id').notNull().references(() => publicKeys.id, { onDelete: 'cascade' }),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'cascade' }),
  confirmationCodeHash: varchar('confirmation_code_hash', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, confirmed, cancelled, expired
  reason: text('reason').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  attemptCount: integer('attempt_count').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
  confirmedBy: varchar('confirmed_by', { length: 255 }),
});

// Relations
export const revocationConfirmationsRelations = relations(revocationConfirmations, ({ one }) => ({
  publicKey: one(publicKeys, {
    fields: [revocationConfirmations.keyId],
    references: [publicKeys.id],
  }),
  apiKey: one(apiKeys, {
    fields: [revocationConfirmations.apiKeyId],
    references: [apiKeys.id],
  }),
}));

// ============================================================================
// Notification History Table - stores notification history
// ============================================================================
export const notificationHistory = pgTable('notification_history', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  keyId: uuid('key_id').notNull().references(() => publicKeys.id, { onDelete: 'cascade' }),
  channelId: varchar('channel_id', { length: 64 }),
  notificationType: varchar('notification_type', { length: 50 }).notNull(),
  recipientCount: integer('recipient_count').notNull().default(0),
  deliveryStatus: varchar('delivery_status', { length: 20 }), // sent, failed, partial
  errorDetails: jsonb('error_details'),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
});

// Relations
export const notificationHistoryRelations = relations(notificationHistory, ({ one }) => ({
  publicKey: one(publicKeys, {
    fields: [notificationHistory.keyId],
    references: [publicKeys.id],
  }),
}));

// ============================================================================
// Audit Logs Table - stores audit logs
// ============================================================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  action: varchar('action', { length: 100 }).notNull(),
  channelId: varchar('channel_id', { length: 64 }),
  keyId: uuid('key_id'),
  apiKeyId: uuid('api_key_id'),
  messageId: varchar('message_id', { length: 128 }),
  userId: varchar('user_id', { length: 255 }),
  ip: varchar('ip', { length: 45 }),
  userAgent: varchar('user_agent', { length: 512 }),
  success: boolean('success').notNull().default(true),
  error: text('error'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================================================
// Indexes for Performance
// ============================================================================
/*
-- Performance indexes for status queries
CREATE INDEX IF NOT EXISTS idx_revocations_status ON revocation_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_revocations_expires ON revocation_confirmations(expires_at);
CREATE INDEX IF NOT EXISTS idx_revocations_key_id ON revocation_confirmations(key_id);

-- Performance indexes for cleanup queries
CREATE INDEX IF NOT EXISTS idx_public_keys_deleted ON public_keys(is_deleted, revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_deleted ON api_keys(is_deleted, revoked_at);

-- Performance indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_key_id ON audit_logs(key_id);
*/

// ============================================================================
// Type Exports
// ============================================================================
export type PublicKey = typeof publicKeys.$inferSelect;
export type NewPublicKey = typeof publicKeys.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type RevocationConfirmation = typeof revocationConfirmations.$inferSelect;
export type NotificationHistory = typeof notificationHistory.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

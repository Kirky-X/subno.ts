// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { z } from 'zod';
import { MessagePriority } from '@/lib/types/message.types';

/**
 * Publish message schema
 * Validates message publishing requests
 */
export const PublishMessageSchema = z.object({
  channel: z
    .string()
    .min(1, 'Channel ID is required')
    .max(255, 'Channel ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid channel ID format'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(4718592, 'Message too large (max 4.5MB)'),
  priority: z
    .enum(['critical', 'high', 'normal', 'low', 'bulk'])
    .optional(),
  sender: z
    .string()
    .max(255, 'Sender name too long')
    .optional(),
  cache: z.boolean().optional().default(true),
  encrypted: z.boolean().optional().default(false),
  // 自动创建临时 channel (默认 true)
  autoCreate: z.boolean().optional().default(true),
});

export type PublishMessageInput = z.infer<typeof PublishMessageSchema>;

/**
 * Register public key schema
 * Validates public key registration requests
 */
export const RegisterKeySchema = z.object({
  publicKey: z
    .string()
    .min(1, 'Public key is required')
    .includes('BEGIN PUBLIC KEY', { message: 'Invalid public key format' }),
  expiresIn: z
    .number()
    .int()
    .positive('Expiry time must be positive')
    .max(2592000, 'Maximum expiry is 30 days (2592000 seconds)')
    .optional()
    .default(604800), // 7 days default
  metadata: z
    .object({
      deviceName: z.string().optional(),
      appVersion: z.string().optional(),
    })
    .optional(),
});

export type RegisterKeyInput = z.infer<typeof RegisterKeySchema>;

/**
 * Create channel schema
 * Validates channel creation requests
 */
export const CreateChannelSchema = z.object({
  id: z
    .string()
    .min(1, 'Channel ID is required')
    .max(255, 'Channel ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid channel ID format')
    .optional(),
  name: z
    .string()
    .min(1, 'Channel name is required')
    .max(255, 'Channel name too long')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description too long')
    .optional(),
  type: z
    .enum(['public', 'encrypted'])
    .default('public'),
  creator: z
    .string()
    .optional(),
  // Channel 过期时间 (ISO 8601 格式)
  expiresAt: z
    .string()
    .datetime()
    .optional(),
  // 过期时长（秒），与 expiresAt 二选一
  expiresIn: z
    .number()
    .int()
    .positive()
    .optional(),
  // 永不过期 (默认 false)
  neverExpire: z.boolean().optional().default(false),
  metadata: z
    .unknown()
    .optional(),
});

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;

/**
 * Subscribe query schema
 * Validates SSE subscription query parameters
 */
export const SubscribeQuerySchema = z.object({
  channel: z
    .string()
    .min(1, 'Channel ID is required')
    .max(255, 'Channel ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid channel ID format'),
  lastEventId: z
    .string()
    .optional(),
});

export type SubscribeQueryInput = z.infer<typeof SubscribeQuerySchema>;

/**
 * Convert priority string to enum
 */
export function parsePriority(priority?: string): MessagePriority {
  if (!priority) return MessagePriority.NORMAL;

  switch (priority.toLowerCase()) {
    case 'critical':
      return MessagePriority.CRITICAL;
    case 'high':
      return MessagePriority.HIGH;
    case 'normal':
      return MessagePriority.NORMAL;
    case 'low':
      return MessagePriority.LOW;
    case 'bulk':
      return MessagePriority.BULK;
    default:
      return MessagePriority.NORMAL;
  }
}

/**
 * Validate and parse message input
 */
export function validatePublishMessage(data: unknown): PublishMessageInput {
  const result = PublishMessageSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Invalid message data', errors);
  }
  return result.data;
}

/**
 * Validate and parse register key input
 */
export function validateRegisterKey(data: unknown): RegisterKeyInput {
  const result = RegisterKeySchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError('Invalid key registration data', errors);
  }
  return result.data;
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  public errors: { field: string; message: string }[];

  constructor(message: string, errors: { field: string; message: string }[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// @ts-nocheck
// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { describe, it, expect } from 'vitest';
import {
  PublishMessageSchema,
  RegisterKeySchema,
  CreateChannelSchema,
  SubscribeQuerySchema,
  validatePublishMessage,
  validateRegisterKey,
  parsePriority,
  ValidationError,
} from '@/lib/utils/validation.util';
import { MessagePriority } from '@/lib/types/message.types';

describe('Validation Utilities', () => {
  describe('PublishMessageSchema', () => {
    it('should validate valid publish message', () => {
      const validData = {
        channel: 'test-channel',
        message: 'Hello World',
        priority: 'high',
        sender: 'user1',
        cache: true,
        encrypted: false,
      };

      const result = PublishMessageSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('test-channel');
        expect(result.data.message).toBe('Hello World');
        expect(result.data.priority).toBe('high');
      }
    });

    it('should require channel', () => {
      const invalidData = { message: 'No channel' };

      const result = PublishMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require message', () => {
      const invalidData = { channel: 'test' };

      const result = PublishMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate channel ID format', () => {
      const invalidData = {
        channel: 'invalid channel!',
        message: 'Test',
      };

      const result = PublishMessageSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid channel ID formats', () => {
      const validChannels = ['test-channel', 'channel123', 'channel_123', 'CHANNEL'];

      validChannels.forEach((channel) => {
        const result = PublishMessageSchema.safeParse({
          channel,
          message: 'Test',
        });
        expect(result.success).toBe(true);
      });
    });

    it('should default cache and encrypted to true', () => {
      const result = PublishMessageSchema.safeParse({
        channel: 'test',
        message: 'Test',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cache).toBe(true);
        expect(result.data.encrypted).toBe(false);
      }
    });

    it('should reject message over 4.5MB', () => {
      const largeMessage = 'x'.repeat(4718593);

      const result = PublishMessageSchema.safeParse({
        channel: 'test',
        message: largeMessage,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('RegisterKeySchema', () => {
    it('should validate valid public key', () => {
      const validData = {
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        algorithm: 'RSA-2048',
        expiresIn: 604800,
        metadata: { deviceName: 'Test Device' },
      };

      const result = RegisterKeySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require BEGIN PUBLIC KEY', () => {
      const invalidData = {
        publicKey: 'not-a-valid-key',
        algorithm: 'RSA-2048',
      };

      const result = RegisterKeySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should default expiresIn to 7 days', () => {
      const result = RegisterKeySchema.safeParse({
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        algorithm: 'RSA-2048',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresIn).toBe(604800);
      }
    });

    it('should reject expiresIn over 30 days', () => {
      const invalidData = {
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        algorithm: 'RSA-2048',
        expiresIn: 2592001, // 30 days + 1 second
      };

      const result = RegisterKeySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateChannelSchema', () => {
    it('should validate valid channel creation', () => {
      const validData = {
        id: 'my-channel',
        name: 'My Channel',
        description: 'Test channel',
        type: 'public',
        creator: 'user@example.com',
      };

      const result = CreateChannelSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should generate ID if not provided', () => {
      const result = CreateChannelSchema.safeParse({
        name: 'My Channel',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeUndefined();
      }
    });

    it('should validate channel ID format', () => {
      const invalidData = {
        id: 'invalid id!',
        name: 'Test',
      };

      const result = CreateChannelSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should default type to public', () => {
      const result = CreateChannelSchema.safeParse({
        name: 'Test',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('public');
      }
    });
  });

  describe('SubscribeQuerySchema', () => {
    it('should validate valid subscription query', () => {
      const validData = {
        channel: 'test-channel',
        lastEventId: '123',
      };

      const result = SubscribeQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require channel', () => {
      const result = SubscribeQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should make lastEventId optional', () => {
      const result = SubscribeQuerySchema.safeParse({
        channel: 'test',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('parsePriority', () => {
    it('should parse priority strings to enum values', () => {
      expect(parsePriority('critical')).toBe(MessagePriority.CRITICAL);
      expect(parsePriority('high')).toBe(MessagePriority.HIGH);
      expect(parsePriority('normal')).toBe(MessagePriority.NORMAL);
      expect(parsePriority('low')).toBe(MessagePriority.LOW);
      expect(parsePriority('bulk')).toBe(MessagePriority.BULK);
    });

    it('should handle case insensitive input', () => {
      expect(parsePriority('CRITICAL')).toBe(MessagePriority.CRITICAL);
      expect(parsePriority('High')).toBe(MessagePriority.HIGH);
    });

    it('should default to NORMAL for unknown values', () => {
      expect(parsePriority('unknown')).toBe(MessagePriority.NORMAL);
      expect(parsePriority(undefined)).toBe(MessagePriority.NORMAL);
      expect(parsePriority('')).toBe(MessagePriority.NORMAL);
    });
  });

  describe('validatePublishMessage', () => {
    it('should return parsed data on success', () => {
      const data = {
        channel: 'test',
        message: 'Hello',
      };

      const result = validatePublishMessage(data);

      expect(result.channel).toBe('test');
      expect(result.message).toBe('Hello');
    });

    it('should throw ValidationError on failure', () => {
      const data = { message: 'No channel' };

      expect(() => {
        validatePublishMessage(data);
      }).toThrow(ValidationError);
    });

    it('should include error details in ValidationError', () => {
      const data = { message: 'No channel' };

      try {
        validatePublishMessage(data);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.errors).toHaveLength(1);
          expect(error.errors[0].field).toBe('channel');
        }
      }
    });
  });

  describe('validateRegisterKey', () => {
    it('should return parsed data on success', () => {
      const data = {
        publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        algorithm: 'RSA-2048',
      };

      const result = validateRegisterKey(data);

      expect(result.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(result.algorithm).toBe('RSA-2048');
    });

    it('should throw ValidationError on failure', () => {
      const data = { publicKey: 'invalid', algorithm: 'RSA-2048' };

      expect(() => {
        validateRegisterKey(data);
      }).toThrow(ValidationError);
    });
  });

  describe('ValidationError', () => {
    it('should store error details', () => {
      const errors = [
        { field: 'channel', message: 'Required' },
        { field: 'message', message: 'Required' },
      ];

      const error = new ValidationError('Validation failed', errors);

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toHaveLength(2);
    });

    it('should work without errors array', () => {
      const error = new ValidationError('Simple error');

      expect(error.errors).toHaveLength(0);
    });
  });
});
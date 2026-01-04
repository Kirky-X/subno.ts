// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { describe, it, expect } from 'vitest';
import { parsePriority } from '@/lib/utils/validation.util';
import { MessagePriority } from '@/lib/types/message.types';

describe('Validation Utilities (Simplified)', () => {
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

  describe('MessagePriority enum', () => {
    it('should have correct values', () => {
      expect(MessagePriority.CRITICAL).toBe(100);
      expect(MessagePriority.HIGH).toBe(75);
      expect(MessagePriority.NORMAL).toBe(50);
      expect(MessagePriority.LOW).toBe(25);
      expect(MessagePriority.BULK).toBe(0);
    });
  });
});
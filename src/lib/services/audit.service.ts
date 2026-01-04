// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { db } from '@/lib/db';
import { auditLogs } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/config/env';
import type { SQL } from 'drizzle-orm';

/**
 * Audit log entry types
 */
export enum AuditAction {
  // Channel actions
  CHANNEL_CREATED = 'channel:created',
  CHANNEL_DELETED = 'channel:deleted',

  // Message actions
  MESSAGE_PUBLISHED = 'message:published',
  MESSAGE_DELIVERED = 'message:delivered',

  // Key actions
  KEY_REGISTERED = 'key:registered',
  KEY_REVOKED = 'key:revoked',
  KEY_ACCESSED = 'key:accessed',

  // Subscription actions
  SUBSCRIPTION_STARTED = 'subscription:started',
  SUBSCRIPTION_ENDED = 'subscription:ended',

  // Security actions
  RATE_LIMIT_EXCEEDED = 'security:rate_limit',
  UNAUTHORIZED_ACCESS = 'security:unauthorized',
}

interface AuditLogDetails {
  channelId?: string;
  keyId?: string;
  messageId?: string;
  userId?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
  error?: string | null;
}

interface QueryFilters {
  action?: AuditAction;
  channelId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit log service
 * Records all important system actions for compliance and debugging
 */
export class AuditService {
  /**
   * Create an audit log entry
   * @returns true if log was successfully written, false otherwise
   */
  async log(
    action: AuditAction,
    details: AuditLogDetails
  ): Promise<boolean> {
    if (!env.ENABLE_AUDIT_LOG) {
      return true;
    }

    try {
      await db.insert(auditLogs).values({
        id: uuidv4(),
        action,
        channelId: details.channelId ?? undefined,
        keyId: details.keyId ?? undefined,
        messageId: details.messageId ?? undefined,
        userId: details.userId ?? undefined,
        ip: details.ip ?? undefined,
        userAgent: details.userAgent ?? undefined,
        metadata: details.metadata ?? undefined,
        success: details.success ?? true,
        error: details.error ?? undefined,
      });
      return true;
    } catch (error) {
      console.error('Failed to write audit log:', {
        action,
        channelId: details.channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Log channel creation
   */
  async logChannelCreated(
    channelId: string,
    creator: string | null,
    ip: string | null
  ): Promise<boolean> {
    return this.log(AuditAction.CHANNEL_CREATED, {
      channelId,
      userId: creator ?? undefined,
      ip,
    });
  }

  /**
   * Log message published
   */
  async logMessagePublished(
    channelId: string,
    messageId: string,
    sender: string | null,
    ip: string | null
  ): Promise<boolean> {
    return this.log(AuditAction.MESSAGE_PUBLISHED, {
      channelId,
      messageId,
      userId: sender ?? undefined,
      ip,
    });
  }

  /**
   * Log key registration
   */
  async logKeyRegistered(
    keyId: string,
    channelId: string,
    ip: string | null
  ): Promise<boolean> {
    return this.log(AuditAction.KEY_REGISTERED, {
      keyId,
      channelId,
      ip,
    });
  }

  /**
   * Log key access
   */
  async logKeyAccessed(
    keyId: string,
    channelId: string,
    ip: string | null
  ): Promise<boolean> {
    return this.log(AuditAction.KEY_ACCESSED, {
      keyId,
      channelId,
      ip,
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    action: string,
    ip: string | null
  ): Promise<boolean> {
    return this.log(AuditAction.RATE_LIMIT_EXCEEDED, {
      ip,
      metadata: { attemptedAction: action },
      success: false,
    });
  }

  /**
   * Query audit logs
   */
  async query(filters: QueryFilters) {
    const conditions: SQL[] = [];

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.channelId) {
      conditions.push(eq(auditLogs.channelId, filters.channelId));
    }
    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate));
    }

    const query = db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(filters.limit || 100)
      .offset(filters.offset || 0)
      .orderBy(auditLogs.createdAt);

    return query;
  }
}

// Singleton instance
let auditServiceInstance: AuditService | null = null;

export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new AuditService();
  }
  return auditServiceInstance;
}

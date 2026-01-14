// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { getDatabase } from '../../db';
import { auditLogs, type AuditLog } from '../../db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export type AuditAction =
  | 'key_register'
  | 'key_revoke_request'
  | 'key_revoke_confirmed'
  | 'key_revoke_cancelled'
  | 'key_revoke_expired'
  | 'message_publish'
  | 'channel_create'
  | 'channel_delete'
  | 'api_key_create'
  | 'api_key_revoke'
  | 'auth_failure'
  | 'cleanup_executed';

export interface CreateAuditLog {
  action: AuditAction;
  channelId?: string;
  keyId?: string;
  apiKeyId?: string;
  messageId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  action?: AuditAction;
  channelId?: string;
  keyId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditService {
  private db = getDatabase();

  async log(data: CreateAuditLog): Promise<AuditLog> {
    const result = await this.db
      .insert(auditLogs)
      .values({
        action: data.action,
        channelId: data.channelId,
        keyId: data.keyId,
        apiKeyId: data.apiKeyId,
        messageId: data.messageId,
        userId: data.userId,
        ip: data.ip,
        userAgent: data.userAgent,
        success: data.success,
        error: data.error,
        metadata: data.metadata || {},
      })
      .returning();
    return result[0];
  }

  async logKeyRevokeRequest(
    keyId: string,
    channelId: string | undefined,
    userId: string,
    ip: string | undefined,
    userAgent: string | undefined,
    reason: string
  ): Promise<AuditLog> {
    return this.log({
      action: 'key_revoke_request',
      keyId,
      channelId,
      userId,
      ip,
      userAgent,
      success: true,
      metadata: { reasonLength: reason.length },
    });
  }

  async logKeyRevokeConfirmed(
    keyId: string,
    channelId: string | undefined,
    userId: string,
    ip: string | undefined,
    snapshot: Record<string, unknown>
  ): Promise<AuditLog> {
    return this.log({
      action: 'key_revoke_confirmed',
      keyId,
      channelId,
      userId,
      ip,
      success: true,
      metadata: { keySnapshot: snapshot },
    });
  }

  async logKeyRevokeCancelled(
    keyId: string,
    userId: string,
    ip: string | undefined
  ): Promise<AuditLog> {
    return this.log({
      action: 'key_revoke_cancelled',
      keyId,
      userId,
      ip,
      success: true,
    });
  }

  async logAuthFailure(
    action: string,
    ip: string | undefined,
    userAgent: string | undefined,
    keyId?: string
  ): Promise<AuditLog> {
    return this.log({
      action: 'auth_failure',
      keyId,
      ip,
      userAgent,
      success: false,
      metadata: { attemptedAction: action },
    });
  }

  async findById(id: string): Promise<AuditLog | null> {
    const result = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1);
    return result[0] || null;
  }

  async find(query: AuditLogQuery): Promise<AuditLog[]> {
    const conditions = [];
    
    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }
    if (query.channelId) {
      conditions.push(eq(auditLogs.channelId, query.channelId));
    }
    if (query.keyId) {
      conditions.push(eq(auditLogs.keyId, query.keyId));
    }
    if (query.userId) {
      conditions.push(eq(auditLogs.userId, query.userId));
    }
    if (query.startDate) {
      conditions.push(gte(auditLogs.createdAt, query.startDate));
    }
    if (query.endDate) {
      conditions.push(sql`${auditLogs.createdAt} <= ${query.endDate}`);
    }

    const result = await this.db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit || 100)
      .offset(query.offset || 0);

    return result;
  }

  async getKeyRevocationHistory(keyId: string): Promise<AuditLog[]> {
    return this.find({
      keyId,
      action: undefined, // Get all actions for this key
      limit: 50,
    });
  }

  async cleanup(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(auditLogs)
      .where(and(
        eq(auditLogs.success, true),
        sql`${auditLogs.action} NOT IN ('key_revoke_confirmed', 'auth_failure')`,
        gte(auditLogs.createdAt, cutoffDate)
      ));

    // Drizzle delete returns { rowCount: number | null }
    const rowCount = (result as { rowCount?: number | null }).rowCount ?? 0;
    return rowCount;
  }
}

export const auditService = new AuditService();

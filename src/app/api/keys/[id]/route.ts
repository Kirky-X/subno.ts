// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  withCors,
  createErrorResponse,
  withSecurityHeaders
} from '@/lib/utils/cors.util';
import { getAuditService, AuditAction } from '@/lib/services/audit.service';
import { getApiKeyService } from '@/lib/services/api-key.service';

const auditService = getAuditService();
const apiKeyService = getApiKeyService();

/**
 * Authenticate request using API key service
 */
async function authenticateRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  userId?: string;
  error?: NextResponse;
}> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return {
      authenticated: false, error: withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        401,
        'API key required in X-API-Key header',
        'AUTH_REQUIRED'
      )))
    };
  }

  const result = await apiKeyService.validateKey(apiKey);

  if (!result.authenticated || !result.apiKeyInfo) {
    return {
      authenticated: false, error: withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        401,
        result.error || 'Authentication failed',
        'AUTH_FAILED'
      )))
    };
  }

  return { authenticated: true, userId: result.apiKeyInfo.userId };
}

/**
 * GET /api/keys/[id]
 * Retrieve a public key by channel ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientIP = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Validate channel ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid channel ID format',
        'INVALID_CHANNEL_FORMAT'
      )));
    }

    // Query the public key
    const result = await db
      .select({
        id: schema.publicKeys.id,
        channelId: schema.publicKeys.channelId,
        publicKey: schema.publicKeys.publicKey,
        algorithm: schema.publicKeys.algorithm,
        createdAt: schema.publicKeys.createdAt,
        expiresAt: schema.publicKeys.expiresAt,
        lastUsedAt: schema.publicKeys.lastUsedAt,
        metadata: schema.publicKeys.metadata,
      })
      .from(schema.publicKeys)
      .where(eq(schema.publicKeys.channelId, id))
      .limit(1);

    if (result.length === 0) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        404,
        `No public key found for channel: ${id}`,
        'NOT_FOUND'
      )));
    }

    const key = result[0];

    // Check if expired
    const now = new Date();
    if (new Date(key.expiresAt) < now) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        410,
        'This public key has expired',
        'KEY_EXPIRED'
      )));
    }

    // Update last used timestamp
    await db
      .update(schema.publicKeys)
      .set({ lastUsedAt: now })
      .where(eq(schema.publicKeys.id, key.id));

    // Log key access
    await auditService.logKeyAccessed(key.id, id, clientIP);

    const response = NextResponse.json({
      success: true,
      data: {
        id: key.id,
        channelId: key.channelId,
        publicKey: key.publicKey,
        algorithm: key.algorithm,
        createdAt: key.createdAt.toISOString(),
        expiresAt: key.expiresAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() || null,
        metadata: key.metadata,
      },
      meta: {
        requestID: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Get public key error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to retrieve public key',
      'INTERNAL_ERROR'
    )));
  }
}

/**
 * DELETE /api/keys/[id]
 * Revoke a public key by channel ID (requires authentication)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return auth.error!;
    }

    const { id } = await params;
    const clientIP = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Validate channel ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid channel ID format',
        'INVALID_CHANNEL_FORMAT'
      )));
    }

    // Delete the public key
    const result = await db
      .delete(schema.publicKeys)
      .where(eq(schema.publicKeys.channelId, id))
      .returning({ deletedId: schema.publicKeys.id });

    if (result.length === 0) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        404,
        `No public key found for channel: ${id}`,
        'NOT_FOUND'
      )));
    }

    // Log key revocation
    await auditService.log(AuditAction.KEY_REVOKED, {
      keyId: result[0].deletedId,
      channelId: id,
      userId: auth.userId,
      ip: clientIP,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Public key revoked successfully',
      data: {
        deletedId: result[0].deletedId,
        channelId: id,
      },
    });

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Delete public key error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to revoke public key',
      'INTERNAL_ERROR'
    )));
  }
}

/**
 * POST /api/keys
 * Create a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, permissions, expiresAt } = body;

    // Validate required fields
    if (!userId) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'userId is required',
        'VALIDATION_ERROR'
      )));
    }

    // Validate permissions if provided
    if (permissions && !Array.isArray(permissions)) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'permissions must be an array',
        'VALIDATION_ERROR'
      )));
    }

    // Validate expiresAt if provided
    let expiresAtDate: Date | undefined;
    if (expiresAt) {
      expiresAtDate = new Date(expiresAt);
      if (isNaN(expiresAtDate.getTime())) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          400,
          'Invalid expiresAt format',
          'VALIDATION_ERROR'
        )));
      }
    }

    // Create the API key
    const { key, info } = await apiKeyService.createApiKey({
      userId,
      name,
      permissions: permissions as ('read' | 'write' | 'admin')[],
      expiresAt: expiresAtDate,
    });

    const response = NextResponse.json({
      success: true,
      message: 'API key created successfully. Store this key securely - it cannot be retrieved again.',
      data: {
        key, // Only returned once!
        info: {
          id: info.id,
          keyPrefix: info.keyPrefix,
          userId: info.userId,
          name: info.name,
          permissions: info.permissions,
          isActive: info.isActive,
          createdAt: info.createdAt.toISOString(),
          expiresAt: info.expiresAt?.toISOString() || null,
        },
      },
      meta: {
        requestID: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Create API key error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to create API key',
      'INTERNAL_ERROR'
    )));
  }
}
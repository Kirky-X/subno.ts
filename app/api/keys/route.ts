// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, withCors, withSecurityHeaders } from '@/lib/utils/cors.util';
import { db, schema } from '@/lib/db';
import { getApiKeyService } from '@/lib/services/api-key.service';
import { env } from '@/config/env';

/**
 * POST /api/keys
 * Create a new API key for a user (requires admin authentication)
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate the request using the provided API key
    const apiKey = request.headers.get('x-api-key');
    const adminKey = request.headers.get('x-admin-key');

    // Allow either a valid admin API key or the master admin key from env
    if (!apiKey && !adminKey) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        401,
        'Authentication required. Provide either x-api-key (with admin permission) or x-admin-key (master key)',
        'AUTH_REQUIRED'
      )));
    }

    // Check master admin key from environment (for initial setup)
    if (adminKey) {
      const masterKey = env.ADMIN_MASTER_KEY;
      if (!masterKey || adminKey !== masterKey) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          401,
          'Invalid or missing master admin key',
          'AUTH_FAILED'
        )));
      }
    } else {
      // Validate the API key and check if it has admin permission
      const apiKeyService = getApiKeyService();
      const authResult = await apiKeyService.validateKey(apiKey!);

      if (!authResult.authenticated || !authResult.apiKeyInfo) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          401,
          authResult.error || 'Authentication failed',
          'AUTH_FAILED'
        )));
      }

      // Check if the API key has admin permission
      if (!authResult.apiKeyInfo.permissions.includes('admin')) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          403,
          'Admin permission required to create API keys',
          'FORBIDDEN'
        )));
      }
    }

    // Step 2: Parse and validate request body
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

      // Check if expiresAt is in the past
      if (expiresAtDate < new Date()) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          400,
          'expiresAt must be in the future',
          'VALIDATION_ERROR'
        )));
      }
    }

    // Step 3: Generate API key using service
    const apiKeyService = getApiKeyService();
    const { key: newApiKey, info } = await apiKeyService.createApiKey({
      userId,
      name: name || 'API Key',
      permissions: permissions || ['read', 'write'],
      expiresAt: expiresAtDate,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: info.id,
        userId: info.userId,
        name: info.name,
        permissions: info.permissions,
        apiKey: newApiKey,
        createdAt: info.createdAt,
        expiresAt: info.expiresAt,
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

/**
 * GET /api/keys
 * List API keys for a user (requires authentication)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const apiKey = request.headers.get('x-api-key');
    const adminKey = request.headers.get('x-admin-key');

    // Allow either a valid admin API key or the master admin key from env
    if (!apiKey && !adminKey) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        401,
        'Authentication required. Provide either x-api-key (with admin permission) or x-admin-key (master key)',
        'AUTH_REQUIRED'
      )));
    }

    // Check master admin key from environment
    if (adminKey) {
      const masterKey = env.ADMIN_MASTER_KEY;
      if (!masterKey || adminKey !== masterKey) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          401,
          'Invalid or missing master admin key',
          'AUTH_FAILED'
        )));
      }
    } else {
      // Validate the API key and check if it has admin permission
      const apiKeyService = getApiKeyService();
      const authResult = await apiKeyService.validateKey(apiKey!);

      if (!authResult.authenticated || !authResult.apiKeyInfo) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          401,
          authResult.error || 'Authentication failed',
          'AUTH_FAILED'
        )));
      }

      // Check if the API key has admin permission
      if (!authResult.apiKeyInfo.permissions.includes('admin')) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          403,
          'Admin permission required to list API keys',
          'FORBIDDEN'
        )));
      }
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'userId query parameter is required',
        'VALIDATION_ERROR'
      )));
    }

    // Get API keys for the user
    const keys = await db.query.apiKeys.findMany({
      where: (apiKeys, { eq }) => eq(apiKeys.userId, userId),
      orderBy: (apiKeys, { desc }) => desc(apiKeys.createdAt),
    });

    const response = NextResponse.json({
      success: true,
      data: {
        keys: keys.map(key => ({
          id: key.id,
          userId: key.userId,
          name: key.name,
          permissions: key.permissions,
          createdAt: key.createdAt,
          expiresAt: key.expiresAt,
          isActive: key.isActive,
          lastUsedAt: key.lastUsedAt,
        })),
      },
      meta: {
        requestID: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

    return withSecurityHeaders(withCors(request, response));

  } catch (error) {
    console.error('List API keys error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to list API keys',
      'INTERNAL_ERROR'
    )));
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, withCors, withSecurityHeaders } from '@/lib/utils/cors.util';
import { db, schema } from '@/lib/db';
import { getApiKeyService } from '@/lib/services/api-key.service';

/**
 * POST /api/keys
 * Create a new API key for a user
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

        // Generate API key using service
        const apiKeyService = getApiKeyService();
        const { key: apiKey, info } = await apiKeyService.createApiKey({
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
            apiKey: apiKey,
            createdAt: info.createdAt,
            expiresAt: info.expiresAt,
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
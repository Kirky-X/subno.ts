// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterService } from '@/lib/services/rate-limiter.service';
import { validateRegisterKey, ValidationError } from '@/lib/utils/validation.util';
import { env } from '@/config/env';
import { db, schema } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import {
  withCors,
  createErrorResponse,
  getRateLimitKey,
  withSecurityHeaders
} from '@/lib/utils/cors.util';
import { getAuditService, AuditAction } from '@/lib/services/audit.service';

const rateLimiterService = new RateLimiterService();
const auditService = getAuditService();

// Maximum public key size from config (4KB default)
const MAX_PUBLIC_KEY_SIZE = env.MAX_PUBLIC_KEY_SIZE || 4 * 1024;

/**
 * POST /api/register
 * Register a public key for encrypted channel communication
 */
export async function POST(request: NextRequest) {
  try {
    // Get client identifier for rate limiting (with proper IP validation)
    const identifier = getRateLimitKey(request);
    const clientIP = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Check rate limit
    const allowed = await rateLimiterService.checkRegisterLimit(identifier);
    if (!allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message: 'Too many registration requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(env.RATE_LIMIT_REGISTER),
          },
        }
      );
      return withSecurityHeaders(withCors(request, response));
    }

    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PUBLIC_KEY_SIZE) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        413,
        `Public key too large. Maximum size is ${MAX_PUBLIC_KEY_SIZE} bytes`,
        'KEY_TOO_LARGE'
      )));
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = validateRegisterKey(body);

    // Additional public key size validation
    if (validatedData.publicKey.length > MAX_PUBLIC_KEY_SIZE) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        413,
        `Public key too large. Maximum size is ${MAX_PUBLIC_KEY_SIZE} bytes`,
        'KEY_TOO_LARGE'
      )));
    }

    // Generate channel ID if not provided
    const channelId = `enc_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + validatedData.expiresIn * 1000);

    // Store in database with client-specified algorithm
    const result = await db.insert(schema.publicKeys).values({
      id: uuidv4(),
      channelId,
      publicKey: validatedData.publicKey,
      algorithm: validatedData.algorithm,
      expiresAt,
      metadata: validatedData.metadata || null,
    }).returning();

    const insertedKey = result[0];

    // Log key registration
    await auditService.logKeyRegistered(insertedKey.id, channelId, clientIP);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          channelId,
          publicKeyId: insertedKey.id,
          algorithm: validatedData.algorithm,
          expiresAt: insertedKey.expiresAt.toISOString(),
          expiresIn: validatedData.expiresIn,
        },
      },
      {
        status: 201,
        headers: {
          'X-Request-ID': crypto.randomUUID(),
        },
      }
    );

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Key registration error:', error);

    if (error instanceof SyntaxError) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid JSON in request body',
        'INVALID_JSON'
      )));
    }

    if (error instanceof ValidationError) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors,
          },
        },
        { status: 400 }
      );
      return withSecurityHeaders(withCors(request, response));
    }

    // Handle duplicate key error
    if (error instanceof Error) {
      const postgresError = error as { code?: string; message?: string };
      if (postgresError.code === '23505' || // PostgreSQL unique violation
        (postgresError.message && postgresError.message.includes('duplicate key'))) {
        const response = NextResponse.json(
          {
            success: false,
            error: {
              message: 'A key for this channel already exists',
              code: 'DUPLICATE_KEY',
            },
          },
          { status: 409 }
        );
        return withSecurityHeaders(withCors(request, response));
      }
    }

    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to register key',
      'INTERNAL_ERROR'
    )));
  }
}

/**
 * GET /api/register
 * Check registration status or get registration info
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const keyId = searchParams.get('keyId');

    if (!channelId && !keyId) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Either channelId or keyId is required',
        'MISSING_PARAMETER'
      )));
    }

    let result;
    if (channelId) {
      result = await db
        .select({
          id: schema.publicKeys.id,
          channelId: schema.publicKeys.channelId,
          algorithm: schema.publicKeys.algorithm,
          createdAt: schema.publicKeys.createdAt,
          expiresAt: schema.publicKeys.expiresAt,
        })
        .from(schema.publicKeys)
        .where(eq(schema.publicKeys.channelId, channelId))
        .limit(1);
    } else {
      result = await db
        .select({
          id: schema.publicKeys.id,
          channelId: schema.publicKeys.channelId,
          algorithm: schema.publicKeys.algorithm,
          createdAt: schema.publicKeys.createdAt,
          expiresAt: schema.publicKeys.expiresAt,
        })
        .from(schema.publicKeys)
        .where(eq(schema.publicKeys.id, keyId!))
        .limit(1);
    }

    if (result.length === 0) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        404,
        'Registration not found',
        'NOT_FOUND'
      )));
    }

    const keyInfo = result[0];
    const isExpired = new Date(keyInfo.expiresAt) < new Date();

    const response = NextResponse.json({
      success: true,
      data: {
        ...keyInfo,
        createdAt: keyInfo.createdAt.toISOString(),
        expiresAt: keyInfo.expiresAt.toISOString(),
        isExpired,
      },
      meta: {
        requestID: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Get registration error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to query registration',
      'INTERNAL_ERROR'
    )));
  }
}
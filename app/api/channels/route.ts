// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { NextRequest, NextResponse } from 'next/server';
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
import { CreateChannelSchema, ValidationError } from '@/lib/utils/validation.util';
import { env } from '@/config/env';

const auditService = getAuditService();

// Maximum metadata size from config
const MAX_METADATA_SIZE = env.MAX_CHANNEL_METADATA_SIZE;
const CHANNEL_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * POST /api/channels
 * Create a new channel
 */
export async function POST(request: NextRequest) {
  try {
    const clientIP = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    getRateLimitKey(request);

    const body = await request.json();

    // Validate request body
    const validationResult = CreateChannelSchema.safeParse(body);
    if (!validationResult.success) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      );
      return withSecurityHeaders(withCors(request, response));
    }

    const validatedData = validationResult.data;

    // Generate channel ID if not provided
    const channelId = validatedData.id || `pub_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Validate channel ID format
    if (!CHANNEL_ID_PATTERN.test(channelId)) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid channel ID format. Must be 1-64 alphanumeric characters, hyphens, or underscores.',
        'INVALID_CHANNEL_FORMAT'
      )));
    }

    // Check metadata size
    if (validatedData.metadata) {
      const metadataSize = Buffer.byteLength(JSON.stringify(validatedData.metadata), 'utf8');
      if (metadataSize > MAX_METADATA_SIZE) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          413,
          `Channel metadata too large. Maximum size is ${MAX_METADATA_SIZE} bytes`,
          'METADATA_TOO_LARGE'
        )));
      }
    }

    // Check if channel already exists
    const existing = await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(eq(schema.channels.id, channelId))
      .limit(1);

    if (existing.length > 0) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message: `Channel '${channelId}' already exists`,
            code: 'CHANNEL_EXISTS',
          },
        },
        { status: 409 }
      );
      return withSecurityHeaders(withCors(request, response));
    }

    // Calculate expiresAt based on user input or use default
    let expiresAt: Date;
    if (validatedData.expiresIn !== undefined && validatedData.expiresIn !== null) {
      // User specified duration (in seconds)
      const maxExpiry = env.PERSISTENT_CHANNEL_MAX_TTL;
      const expirySeconds = Math.min(validatedData.expiresIn, maxExpiry);
      expiresAt = new Date(Date.now() + expirySeconds * 1000);
    } else {
      // Use default TTL from config
      expiresAt = new Date(Date.now() + env.PERSISTENT_CHANNEL_DEFAULT_TTL * 1000);
    }

    // Create channel
    const result = await db.insert(schema.channels).values({
      id: channelId,
      name: validatedData.name || channelId,
      description: validatedData.description || null,
      type: validatedData.type || 'public',
      creator: validatedData.creator || null,
      expiresAt,
      metadata: validatedData.metadata || null,
    }).returning();

    const channel = result[0];

    // Log channel creation
    await auditService.log(AuditAction.CHANNEL_CREATED, {
      channelId,
      userId: validatedData.creator || undefined,
      ip: clientIP,
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: channel.id,
          name: channel.name,
          description: channel.description,
          type: channel.type,
          creator: channel.creator,
          createdAt: channel.createdAt.toISOString(),
          expiresAt: channel.expiresAt?.toISOString() || null,
          isActive: channel.isActive,
          metadata: channel.metadata,
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
    console.error('Create channel error:', error);

    if (error instanceof SyntaxError) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid JSON in request body',
        'INVALID_JSON'
      )));
    }

    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to create channel',
      'INTERNAL_ERROR'
    )));
  }
}

/**
 * GET /api/channels
 * List all channels or get specific channel
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('id');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (channelId) {
      // Validate channel ID format
      if (!CHANNEL_ID_PATTERN.test(channelId)) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          400,
          'Invalid channel ID format',
          'INVALID_CHANNEL_FORMAT'
        )));
      }

      // Get specific channel
      const result = await db
        .select({
          id: schema.channels.id,
          name: schema.channels.name,
          description: schema.channels.description,
          type: schema.channels.type,
          creator: schema.channels.creator,
          createdAt: schema.channels.createdAt,
          expiresAt: schema.channels.expiresAt,
          isActive: schema.channels.isActive,
          metadata: schema.channels.metadata,
        })
        .from(schema.channels)
        .where(eq(schema.channels.id, channelId))
        .limit(1);

      if (result.length === 0) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          404,
          `Channel '${channelId}' not found`,
          'NOT_FOUND'
        )));
      }

      const channel = result[0];
      const response = NextResponse.json({
        success: true,
        data: {
          ...channel,
          createdAt: channel.createdAt.toISOString(),
        },
        meta: {
          requestID: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });

      return withSecurityHeaders(withCors(request, response));
    }

    // List all channels with pagination
    const offsetNum = Math.max(0, offset);
    const limitNum = Math.min(Math.max(1, limit), 100);

    const baseQuery = db
      .select({
        id: schema.channels.id,
        name: schema.channels.name,
        type: schema.channels.type,
        creator: schema.channels.creator,
        createdAt: schema.channels.createdAt,
        expiresAt: schema.channels.expiresAt,
        isActive: schema.channels.isActive,
      })
      .from(schema.channels);

    let result;
    if (type) {
      // Validate type
      if (!['public', 'private', 'encrypted'].includes(type)) {
        return withSecurityHeaders(withCors(request, createErrorResponse(
          request,
          400,
          'Invalid channel type. Must be: public, private, or encrypted.',
          'INVALID_TYPE'
        )));
      }

      result = await baseQuery
        .where(eq(schema.channels.type, type))
        .orderBy(schema.channels.createdAt)
        .limit(limitNum)
        .offset(offsetNum);
    } else {
      result = await baseQuery
        .orderBy(schema.channels.createdAt)
        .limit(limitNum)
        .offset(offsetNum);
    }

    // Get total count
    const countResult = await db
      .select({ count: schema.channels.id })
      .from(schema.channels);

    const total = Number(countResult[0]?.count ?? 0);

    const response = NextResponse.json({
      success: true,
      data: result.map((ch) => ({
        ...ch,
        createdAt: ch.createdAt.toISOString(),
        expiresAt: ch.expiresAt?.toISOString() || null,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + result.length < total,
      },
      meta: {
        requestID: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('List channels error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to query channels',
      'INTERNAL_ERROR'
    )));
  }
}
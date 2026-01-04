// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { NextRequest, NextResponse } from 'next/server';
import { MessageService } from '@/lib/services/message.service';
import { RateLimiterService } from '@/lib/services/rate-limiter.service';
import { validatePublishMessage, parsePriority, ValidationError } from '@/lib/utils/validation.util';
import { env } from '@/config/env';
import {
  withCors,
  createErrorResponse,
  getRateLimitKey,
  withSecurityHeaders
} from '@/lib/utils/cors.util';

const messageService = new MessageService();
const rateLimiter = new RateLimiterService();

// Maximum message size from config (4.5MB default)
const MAX_MESSAGE_SIZE = env.MAX_MESSAGE_SIZE;

/**
 * POST /api/publish
 * Publish a message to a channel
 */
export async function POST(request: NextRequest) {
  try {
    // Get client identifier for rate limiting (with proper IP validation)
    const identifier = getRateLimitKey(request);

    // Check rate limit
    const allowed = await rateLimiter.checkPublishLimit(identifier);
    if (!allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message: 'Rate limit exceeded. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 1,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': '1',
            'X-RateLimit-Limit': String(env.RATE_LIMIT_PUBLISH),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
      return withSecurityHeaders(withCors(request, response));
    }

    // Check content length for large requests
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_MESSAGE_SIZE) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        413,
        `Message too large. Maximum size is ${MAX_MESSAGE_SIZE / 1024 / 1024}MB`,
        'MESSAGE_TOO_LARGE'
      )));
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = validatePublishMessage(body);

    // Additional message size validation
    const messageSize = Buffer.byteLength(JSON.stringify(body.message), 'utf8');
    if (messageSize > MAX_MESSAGE_SIZE) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        413,
        `Message too large. Maximum size is ${MAX_MESSAGE_SIZE / 1024 / 1024}MB`,
        'MESSAGE_TOO_LARGE'
      )));
    }

    // Publish message
    const result = await messageService.publish({
      channel: validatedData.channel,
      message: validatedData.message,
      priority: parsePriority(validatedData.priority),
      sender: validatedData.sender,
      cache: validatedData.cache,
      encrypted: validatedData.encrypted,
      autoCreate: validatedData.autoCreate,
    });

    // Get remaining rate limit
    const remaining = await rateLimiter.getRemainingRequests(
      `publish:${identifier}`,
      env.RATE_LIMIT_PUBLISH,
      60
    );

    const response = NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': String(env.RATE_LIMIT_PUBLISH),
          'X-RateLimit-Remaining': String(remaining),
          'X-Request-ID': crypto.randomUUID(),
        },
      }
    );

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Publish error:', error);

    if (error instanceof SyntaxError) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid JSON in request body',
        'INVALID_JSON'
      )));
    }

    if (error instanceof ValidationError) {
      return withSecurityHeaders(withCors(request, NextResponse.json(
        {
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors,
          },
        },
        { status: 400 }
      )));
    }

    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to publish message',
      'INTERNAL_ERROR'
    )));
  }
}

/**
 * GET /api/publish
 * Get channel queue status and recent messages
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');
    const count = Math.min(parseInt(searchParams.get('count') || '10', 10), 100);

    if (!channel) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Channel ID is required',
        'MISSING_CHANNEL'
      )));
    }

    // Validate channel ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(channel)) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid channel ID format. Only alphanumeric characters, hyphens, and underscores are allowed.',
        'INVALID_CHANNEL_FORMAT'
      )));
    }

    // Get messages
    const messages = await messageService.getMessages(channel, count);
    const queueLength = await messageService.getQueueLength(channel);

    const response = NextResponse.json({
      success: true,
      data: {
        channel,
        messages,
        queueLength,
      },
      meta: {
        requestID: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Get messages error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to get messages',
      'INTERNAL_ERROR'
    )));
  }
}
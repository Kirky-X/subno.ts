// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterService } from '@/lib/services/rate-limiter.service';
import { MessageService } from '@/lib/services/message.service';
import { SubscribeQuerySchema } from '@/lib/utils/validation.util';
import { env } from '@/config/env';
import {
  withCors,
  createErrorResponse,
  getRateLimitKey,
  withSecurityHeaders
} from '@/lib/utils/cors.util';

const rateLimiter = new RateLimiterService();
const messageService = new MessageService();

/**
 * GET /api/subscribe
 * Server-Sent Events subscription to a channel
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const validationResult = SubscribeQuerySchema.safeParse({
      channel: searchParams.get('channel'),
      lastEventId: searchParams.get('lastEventId'),
    });

    if (!validationResult.success) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid query parameters',
            code: 'VALIDATION_ERROR',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      );
      return withSecurityHeaders(withCors(request, response));
    }

    const { channel, lastEventId } = validationResult.data;

    // Validate channel ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(channel)) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        400,
        'Invalid channel ID format',
        'INVALID_CHANNEL_FORMAT'
      )));
    }

    // Get client identifier for rate limiting (with proper IP validation)
    const identifier = getRateLimitKey(request);

    // Check rate limit for subscriptions
    const allowed = await rateLimiter.checkSubscribeLimit(identifier);
    if (!allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            message: 'Too many subscription requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 60,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(env.RATE_LIMIT_SUBSCRIBE),
          },
        }
      );
      return withSecurityHeaders(withCors(request, response));
    }

    // Check if channel exists (persistent or temporary)
    const channelInfo = await messageService.channelExists(channel);
    if (!channelInfo.exists) {
      return withSecurityHeaders(withCors(request, createErrorResponse(
        request,
        404,
        `Channel '${channel}' not found. Use autoCreate=true in publish to create a temporary channel.`,
        'CHANNEL_NOT_FOUND'
      )));
    }

    // Create SSE response stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Send connection metadata as comment
        const requestID = crypto.randomUUID();
        const metaEvent = `: channel=${channel} requestID=${requestID}\n\n`;
        controller.enqueue(encoder.encode(metaEvent));

        // Send initial connection message
        const connectEvent = `event: connected\ndata: ${JSON.stringify({
          channel,
          type: channelInfo.type,
          timestamp: Date.now(),
          message: 'Connected to channel',
          lastEventId,
          expiresAt: channelInfo.expiresAt?.toISOString() || null,
        })}\n\n`;
        controller.enqueue(encoder.encode(connectEvent));

        // Keep-alive interval
        const keepAliveInterval = setInterval(() => {
          const pingEvent = `: keepalive\n\n`;
          try {
            controller.enqueue(encoder.encode(pingEvent));
          } catch {
            clearInterval(keepAliveInterval);
          }
        }, 30000); // 30 seconds keep-alive

        let isConnected = true;

        // Handle client disconnect
        const cleanup = () => {
          if (!isConnected) return;
          isConnected = false;
          clearInterval(keepAliveInterval);
          try {
            controller.close();
          } catch {
            // Stream already closed
          }
        };

        request.signal.addEventListener('abort', cleanup);

        // Send welcome message
        const welcomeEvent = `event: message\nid: system_${Date.now()}\ndata: ${JSON.stringify({
          id: `system_${Date.now()}`,
          channel,
          message: 'Subscription active. Waiting for messages...',
          timestamp: Date.now(),
          system: true,
        })}\n\n`;
        controller.enqueue(encoder.encode(welcomeEvent));
      },
    });

    const response = new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Request-ID': crypto.randomUUID(),
      },
    });

    return withSecurityHeaders(withCors(request, response));
  } catch (error) {
    console.error('Subscribe error:', error);
    return withSecurityHeaders(withCors(request, createErrorResponse(
      request,
      500,
      'Failed to establish subscription',
      'INTERNAL_ERROR'
    )));
  }
}

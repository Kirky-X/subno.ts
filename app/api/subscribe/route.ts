// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterService } from '@/lib/services/rate-limiter.service';
import { MessageService } from '@/lib/services/message.service';
import { RedisRepository } from '@/lib/repositories/redis.repository';
import { SubscribeQuerySchema } from '@/lib/utils/validation.util';
import { env } from '@/config/env';
import {
  withCors,
  createErrorResponse,
  getRateLimitKey,
  withSecurityHeaders
} from '@/lib/utils/cors.util';
import crypto from 'crypto';

const rateLimiter = new RateLimiterService();
const messageService = new MessageService();

/**
 * GET /api/subscribe
 * Server-Sent Events subscription to a channel with real-time message delivery
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const validationResult = SubscribeQuerySchema.safeParse({
      channel: searchParams.get('channel'),
      lastEventId: searchParams.get('lastEventId') || undefined,
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

    // Create SSE response stream with Redis pub/sub subscription
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const redis = new RedisRepository();
        let unsubscribe: (() => Promise<void>) | null = null;
        let keepAliveInterval: NodeJS.Timeout | null = null;
        let isConnected = true;

        // Send connection metadata as comment
        const requestID = crypto.randomUUID();
        const metaEvent = `: channel="${channel}" requestID="${requestID}"\n\n`;
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

        // Send missed messages if lastEventId is provided
        if (lastEventId) {
          try {
            const messages = await messageService.getMessages(channel, 50);
            const missedMessages = messages.filter(msg => msg.timestamp > parseInt(lastEventId.replace('msg_', '')));

            for (const msg of missedMessages) {
              const messageEvent = `event: message\nid: ${msg.id}\ndata: ${JSON.stringify(msg)}\n\n`;
              controller.enqueue(encoder.encode(messageEvent));
            }

            if (missedMessages.length > 0) {
              const catchupEvent = `event: info\ndata: ${JSON.stringify({
                message: `Caught up with ${missedMessages.length} missed message(s)`,
                count: missedMessages.length,
              })}\n\n`;
              controller.enqueue(encoder.encode(catchupEvent));
            }
          } catch (error) {
            console.error('Error fetching missed messages:', error);
          }
        }

        // Send welcome message
        const welcomeEvent = `event: message\nid: system_${Date.now()}\ndata: ${JSON.stringify({
          id: `system_${Date.now()}`,
          channel,
          message: 'Subscription active. Waiting for messages...',
          timestamp: Date.now(),
          system: true,
        })}\n\n`;
        controller.enqueue(encoder.encode(welcomeEvent));

        // Subscribe to Redis pub/sub for real-time messages
        try {
          unsubscribe = await redis.subscribe(`channel:${channel}:events`, (messageData) => {
            if (!isConnected) return;

            try {
              const message = JSON.parse(messageData);

              // Send message to client via SSE
              const messageEvent = `event: message\nid: ${message.id}\ndata: ${JSON.stringify(message)}\n\n`;
              controller.enqueue(encoder.encode(messageEvent));
            } catch (parseError) {
              console.error('Error parsing pub/sub message:', parseError);

              // Send error event to client
              const errorEvent = `event: error\ndata: ${JSON.stringify({
                message: 'Failed to process message',
                error: 'PARSE_ERROR',
              })}\n\n`;
              controller.enqueue(encoder.encode(errorEvent));
            }
          });

          console.log(`[SSE] Client ${requestID} subscribed to channel: ${channel}`);
        } catch (subscribeError) {
          console.error('Failed to subscribe to Redis pub/sub:', subscribeError);

          const errorEvent = `event: error\ndata: ${JSON.stringify({
            message: 'Failed to establish real-time subscription',
            error: 'SUBSCRIBE_FAILED',
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
        }

        // Keep-alive interval (30 seconds)
        keepAliveInterval = setInterval(() => {
          if (!isConnected) {
            if (keepAliveInterval) clearInterval(keepAliveInterval);
            return;
          }

          try {
            const pingEvent = `: keepalive\n\n`;
            controller.enqueue(encoder.encode(pingEvent));
          } catch (error) {
            console.error('Error sending keepalive:', error);
            isConnected = false;
            cleanup();
          }
        }, 30000);

        // Handle client disconnect
        const cleanup = async () => {
          if (!isConnected) return;
          isConnected = false;

          console.log(`[SSE] Client ${requestID} disconnecting from channel: ${channel}`);

          // Clear keepalive interval
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }

          // Unsubscribe from Redis pub/sub
          if (unsubscribe) {
            try {
              await unsubscribe();
              console.log(`[SSE] Client ${requestID} unsubscribed from channel: ${channel}`);
            } catch (error) {
              console.error('Error unsubscribing from Redis:', error);
            }
          }

          // Close stream
          try {
            controller.close();
          } catch (error) {
            // Stream already closed
          }
        };

        // Listen for client abort
        request.signal.addEventListener('abort', cleanup);
      },

      cancel() {
        // This is called when the stream is cancelled
        console.log('[SSE] Stream cancelled');
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

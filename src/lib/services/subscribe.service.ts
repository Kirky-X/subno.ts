// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { channelRepository } from '../repositories/channel.repository';
import { auditService } from './audit.service';

export interface SubscribeOptions {
  channel: string;
  lastEventId?: string;
}

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
}

const KEEPALIVE_INTERVAL = 30000; // 30 seconds

export class SubscribeService {
  private redisClient: unknown = null;
  private activeConnections = new Map<string, Set<ReadableStreamDefaultController>>();

  async validateChannel(channelId: string): Promise<{
    valid: boolean;
    error?: string;
    code?: string;
  }> {
    const channel = await channelRepository.findById(channelId);

    if (!channel) {
      return {
        valid: false,
        error: '频道不存在',
        code: 'CHANNEL_NOT_FOUND',
      };
    }

    if (!channel.isActive) {
      return {
        valid: false,
        error: '频道已停用',
        code: 'CHANNEL_INACTIVE',
      };
    }

    return { valid: true };
  }

  createSSEStream(options: SubscribeOptions, context?: {
    ip?: string;
    userAgent?: string;
  }): ReadableStream<Uint8Array> {
    const { channel } = options;
    const encoder = new TextEncoder();
    let keepaliveInterval: NodeJS.Timeout | null = null;
    let redisSubscriber: unknown = null;
    let streamController: ReadableStreamDefaultController | null = null;

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        streamController = controller;
        this.addConnection(channel, controller);

        await auditService.log({
          action: 'subscribe_started',
          channelId: channel,
          ip: context?.ip,
          userAgent: context?.userAgent,
          success: true,
        });

        const connectMessage: SSEMessage = {
          event: 'connected',
          data: JSON.stringify({
            channel,
            type: 'channel',
            timestamp: Date.now(),
          }),
        };
        controller.enqueue(encoder.encode(this.formatSSEMessage(connectMessage)));

        keepaliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            if (keepaliveInterval) {
              clearInterval(keepaliveInterval);
            }
          }
        }, KEEPALIVE_INTERVAL);

        redisSubscriber = await this.subscribeToRedis(channel, (message) => {
          try {
            const sseMessage: SSEMessage = {
              id: (message as { id?: string })?.id,
              event: 'message',
              data: JSON.stringify(message),
            };
            controller.enqueue(encoder.encode(this.formatSSEMessage(sseMessage)));
          } catch {
            // Connection closed
          }
        });
      },

      cancel: async () => {
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
        }

        if (streamController) {
          this.removeConnection(channel, streamController);
        }

        if (redisSubscriber) {
          await this.unsubscribeFromRedis(channel, redisSubscriber);
        }

        await auditService.log({
          action: 'subscribe_ended',
          channelId: channel,
          ip: context?.ip,
          userAgent: context?.userAgent,
          success: true,
        });
      },
    });
  }

  private addConnection(channel: string, controller: ReadableStreamDefaultController): void {
    if (!this.activeConnections.has(channel)) {
      this.activeConnections.set(channel, new Set());
    }
    this.activeConnections.get(channel)!.add(controller);
  }

  private removeConnection(channel: string, controller: ReadableStreamDefaultController): void {
    const connections = this.activeConnections.get(channel);
    if (connections) {
      connections.delete(controller);
      if (connections.size === 0) {
        this.activeConnections.delete(channel);
      }
    }
  }

  private formatSSEMessage(message: SSEMessage): string {
    let output = '';

    if (message.id) {
      output += `id: ${message.id}\n`;
    }

    if (message.event) {
      output += `event: ${message.event}\n`;
    }

    output += `data: ${message.data}\n\n`;

    return output;
  }

  private async subscribeToRedis(
    channel: string,
    callback: (message: unknown) => void
  ): Promise<unknown> {
    try {
      const redis = await this.getRedisClient();
      if (!redis) {
        return null;
      }

      const redisClient = redis as {
        subscribe: (channel: string, callback: (message: string) => void) => Promise<void>;
      };

      await redisClient.subscribe(`channel:${channel}`, (message: string) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch {
          callback({ raw: message });
        }
      });

      return redis;
    } catch {
      return null;
    }
  }

  private async unsubscribeFromRedis(channel: string, subscriber: unknown): Promise<void> {
    try {
      if (subscriber) {
        const redisClient = subscriber as {
          unsubscribe: (channel: string) => Promise<void>;
        };
        await redisClient.unsubscribe(`channel:${channel}`);
      }
    } catch {
      // Ignore unsubscribe errors
    }
  }

  private async getRedisClient(): Promise<unknown> {
    if (this.redisClient) {
      return this.redisClient;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return null;
    }

    try {
      const redisModule = await import('redis').catch(() => null);
      if (!redisModule || !redisModule.createClient) {
        return null;
      }

      const client = redisModule.createClient({ url: redisUrl });
      await client.connect();
      this.redisClient = client;
      return client;
    } catch {
      return null;
    }
  }

  getActiveConnectionCount(channel?: string): number {
    if (channel) {
      return this.activeConnections.get(channel)?.size || 0;
    }

    let total = 0;
    for (const connections of this.activeConnections.values()) {
      total += connections.size;
    }
    return total;
  }
}

export const subscribeService = new SubscribeService();

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { channelRepository } from '../repositories/channel.repository';
import { auditService } from './audit.service';
import { getRedisSubscriber } from '../utils/redis-client';
import type { RedisClientType } from 'redis';

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
const MAX_CONNECTIONS_PER_CHANNEL = 1000;
const MAX_TOTAL_CONNECTIONS = 10000;
const CONNECTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

interface ConnectionInfo {
  controller: ReadableStreamDefaultController;
  connectedAt: number;
}

export class SubscribeService {
  private activeConnections = new Map<string, Set<ConnectionInfo>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

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

    const totalConnections = this.getTotalConnectionCount();
    if (totalConnections >= MAX_TOTAL_CONNECTIONS) {
      throw new Error('Maximum total connections reached');
    }

    const channelConnections = this.activeConnections.get(channel)?.size || 0;
    if (channelConnections >= MAX_CONNECTIONS_PER_CHANNEL) {
      throw new Error('Maximum connections for this channel reached');
    }

    const encoder = new TextEncoder();
    let keepaliveInterval: NodeJS.Timeout | null = null;
    let redisSubscriber: unknown = null;
    let streamController: ReadableStreamDefaultController | null = null;

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        streamController = controller;
        this.addConnection(channel, controller);
        this.startCleanupTimer();

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
    this.activeConnections.get(channel)!.add({
      controller,
      connectedAt: Date.now(),
    });
  }

  private removeConnection(channel: string, controller: ReadableStreamDefaultController): void {
    const connections = this.activeConnections.get(channel);
    if (connections) {
      for (const info of connections) {
        if (info.controller === controller) {
          connections.delete(info);
          break;
        }
      }
      if (connections.size === 0) {
        this.activeConnections.delete(channel);
      }
    }
  }

  private getTotalConnectionCount(): number {
    let total = 0;
    for (const connections of this.activeConnections.values()) {
      total += connections.size;
    }
    return total;
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) {
      return;
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, CLEANUP_INTERVAL_MS);
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    for (const [channel, connections] of this.activeConnections.entries()) {
      for (const info of connections) {
        if (now - info.connectedAt > CONNECTION_TIMEOUT_MS) {
          try {
            info.controller.close();
          } catch {
            // Controller already closed
          }
          connections.delete(info);
        }
      }
      if (connections.size === 0) {
        this.activeConnections.delete(channel);
      }
    }
    if (this.activeConnections.size === 0 && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
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
      const redis = await getRedisSubscriber();
      if (!redis) {
        return null;
      }

      await redis.subscribe(`channel:${channel}`, (message: string) => {
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
        const redisClient = subscriber as RedisClientType;
        await redisClient.unsubscribe(`channel:${channel}`);
      }
    } catch {
      // Ignore unsubscribe errors
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

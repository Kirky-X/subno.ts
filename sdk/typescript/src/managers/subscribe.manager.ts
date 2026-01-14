// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type {
  SseMessageEvent,
  SseConnectedEvent,
  ClientOptions,
} from "../types/api.js";
import {
  SseConnection,
  SseConnectionManager,
  SseEvent,
  SseEventHandler,
  SseEventType,
} from "../utils/connection.js";
import { SecureNotifyError } from "../types/errors.js";

/**
 * Message handler callback type
 */
export type MessageHandler = (event: SseMessageEvent) => void;

/**
 * Connection handler callback type
 */
export type ConnectionHandler = (event: SseConnectedEvent) => void;

/**
 * Error handler callback type
 */
export type SubscribeErrorHandler = (error: { code: string; message: string; reconnectable: boolean }) => void;

/**
 * Subscription info
 */
export interface SubscriptionInfo {
  channel: string;
  isConnected: boolean;
  messageCount: number;
  lastMessageAt?: number;
}

/**
 * Subscribe manager for handling SSE subscriptions
 */
export class SubscribeManager {
  private readonly connectionManager: SseConnectionManager;
  private readonly messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private readonly connectionHandlers: Map<string, Set<ConnectionHandler>> = new Map();
  private readonly errorHandlers: Map<string, Set<SubscribeErrorHandler>> = new Map();
  private readonly messageCounts: Map<string, number> = new Map();
  private readonly lastMessageTimes: Map<string, number> = new Map();

  /**
   * Create a new subscribe manager
   */
  constructor(clientOptions?: ClientOptions) {
    this.connectionManager = new SseConnectionManager(clientOptions);
  }

  /**
   * Subscribe to a channel
   *
   * @param channel - The channel ID to subscribe to
   * @param handler - Message handler callback
   * @returns Unsubscribe function
   */
  async subscribe(channel: string, handler: MessageHandler): Promise<() => Promise<void>> {
    if (!channel) {
      throw SecureNotifyError.validation("channel is required");
    }

    if (!handler) {
      throw SecureNotifyError.validation("handler is required");
    }

    // Add the message handler
    let handlers = this.messageHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.messageHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    // Get or create the connection
    const connection = this.connectionManager.getConnection(channel);

    // Set up event handlers if this is the first subscription for this channel
    if (handlers.size === 1) {
      this.setupChannelHandlers(channel, connection);
    }

    // Connect if not already connected
    if (!connection.isConnected()) {
      try {
        await connection.connect();
      } catch (error) {
        // Remove the handler if connection fails
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(channel);
        }
        throw error;
      }
    }

    // Return unsubscribe function
    return async () => {
      await this.unsubscribe(channel, handler);
    };
  }

  /**
   * Set up internal handlers for a channel
   */
  private setupChannelHandlers(channel: string, connection: SseConnection): void {
    // Message handler
    connection.on("message", (event: SseEvent) => {
      const messageCount = this.messageCounts.get(channel) ?? 0;
      this.messageCounts.set(channel, messageCount + 1);
      this.lastMessageTimes.set(channel, Date.now());

      const handlers = this.messageHandlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(event.data as SseMessageEvent);
          } catch {
            // Handler error, continue with other handlers
          }
        }
      }
    });

    // Connection handler
    connection.on("connected", (event: SseEvent) => {
      const handlers = this.connectionHandlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(event.data as SseConnectedEvent);
          } catch {
            // Handler error, continue with other handlers
          }
        }
      }
    });

    // Error handler
    connection.on("error", (event: SseEvent) => {
      const handlers = this.errorHandlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(event.data as { code: string; message: string; reconnectable: boolean });
          } catch {
            // Handler error, continue with other handlers
          }
        }
      }
    });

    // Retry handler
    connection.on("retry", () => {
      // Can be used for logging or notifications
    });

    // Close handler
    connection.on("close", () => {
      this.messageCounts.delete(channel);
      this.lastMessageTimes.delete(channel);
    });
  }

  /**
   * Unsubscribe from a channel
   *
   * @param channel - The channel ID
   * @param handler - Optional specific handler to remove
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    if (!channel) {
      throw SecureNotifyError.validation("channel is required");
    }

    if (handler) {
      // Remove specific handler
      const handlers = this.messageHandlers.get(channel);
      if (handlers) {
        handlers.delete(handler);

        // If no more handlers, disconnect
        if (handlers.size === 0) {
          this.messageHandlers.delete(channel);
          await this.connectionManager.disconnect(channel);
        }
      }
    } else {
      // Remove all handlers for this channel
      this.messageHandlers.delete(channel);
      this.connectionHandlers.delete(channel);
      this.errorHandlers.delete(channel);
      await this.connectionManager.disconnect(channel);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
    this.errorHandlers.clear();
    this.messageCounts.clear();
    this.lastMessageTimes.clear();
    await this.connectionManager.disconnectAll();
  }

  /**
   * Subscribe to connection events
   *
   * @param channel - The channel ID
   * @param handler - Connection handler callback
   */
  onConnected(channel: string, handler: ConnectionHandler): () => void {
    if (!channel) {
      throw SecureNotifyError.validation("channel is required");
    }

    let handlers = this.connectionHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.connectionHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
    };
  }

  /**
   * Subscribe to error events
   *
   * @param channel - The channel ID
   * @param handler - Error handler callback
   */
  onError(channel: string, handler: SubscribeErrorHandler): () => void {
    if (!channel) {
      throw SecureNotifyError.validation("channel is required");
    }

    let handlers = this.errorHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.errorHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
    };
  }

  /**
   * Check if subscribed to a channel
   *
   * @param channel - The channel ID
   * @returns Whether subscribed
   */
  isSubscribed(channel: string): boolean {
    return this.messageHandlers.has(channel);
  }

  /**
   * Get subscription info for a channel
   *
   * @param channel - The channel ID
   * @returns Subscription info or undefined if not subscribed
   */
  getSubscriptionInfo(channel: string): SubscriptionInfo | undefined {
    const handlers = this.messageHandlers.get(channel);
    if (!handlers) return undefined;

    const connection = this.connectionManager.getConnection(channel);

    return {
      channel,
      isConnected: connection.isConnected(),
      messageCount: this.messageCounts.get(channel) ?? 0,
      lastMessageAt: this.lastMessageTimes.get(channel),
    };
  }

  /**
   * Get all subscribed channels
   *
   * @returns Array of subscription info
   */
  getSubscribedChannels(): SubscriptionInfo[] {
    const channels: SubscriptionInfo[] = [];

    for (const channel of this.messageHandlers.keys()) {
      const info = this.getSubscriptionInfo(channel);
      if (info) {
        channels.push(info);
      }
    }

    return channels;
  }

  /**
   * Get the number of subscribed channels
   */
  getSubscriptionCount(): number {
    return this.messageHandlers.size;
  }

  /**
   * Wait for the next message on a channel
   *
   * @param channel - The channel ID
   * @param timeout - Maximum wait time in milliseconds
   * @returns The message event or undefined if timeout
   */
  async nextMessage(channel: string, timeout: number = 30000): Promise<SseMessageEvent | undefined> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        resolve(undefined);
      }, timeout);

      const unsubscribe = this.subscribe(channel, (event) => {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(event);
      });

      // Handle errors
      const unsubscribeError = this.onError(channel, () => {
        clearTimeout(timeoutId);
        unsubscribe();
        reject(new Error("Connection error"));
      });
    });
  }
}

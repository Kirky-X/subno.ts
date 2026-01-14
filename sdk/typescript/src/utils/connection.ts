// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type {
  SseConnectedEvent,
  SseMessageEvent,
  SseHeartbeatEvent,
  SseErrorEvent,
  MessagePriority,
  ClientOptions,
} from "../types/api.js";
import { SecureNotifyError } from "../types/errors.js";

/**
 * SSE heartbeat interval in milliseconds
 */
const HEARTBEAT_INTERVAL = 30000;

/**
 * Default connection options
 */
const DEFAULT_CONNECTION_OPTIONS: Required<ConnectionOptions> = {
  heartbeatInterval: HEARTBEAT_INTERVAL,
  heartbeatTimeout: HEARTBEAT_INTERVAL * 2,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  maxReconnectDelay: 30000,
  reconnectBackoffMultiplier: 2,
  addReconnectJitter: true,
};

/**
 * Connection options interface
 */
export interface ConnectionOptions {
  /** Interval for heartbeat messages in milliseconds */
  heartbeatInterval?: number;
  /** Timeout for heartbeat in milliseconds */
  heartbeatTimeout?: number;
  /** Initial delay before reconnecting in milliseconds */
  reconnectDelay?: number;
  /** Maximum number of reconnect attempts */
  maxReconnectAttempts?: number;
  /** Maximum delay between reconnects in milliseconds */
  maxReconnectDelay?: number;
  /** Multiplier for exponential backoff */
  reconnectBackoffMultiplier?: number;
  /** Whether to add jitter to reconnect delay */
  addReconnectJitter?: boolean;
}

/**
 * SSE event types
 */
export type SseEventType = "connected" | "message" | "heartbeat" | "error" | "retry" | "close";

/**
 * SSE event handler
 */
export type SseEventHandler = (event: SseEvent) => void;

/**
 * SSE event data
 */
export interface SseEvent {
  type: SseEventType;
  data?: unknown;
  timestamp: number;
  channel?: string;
}

/**
 * Connection state
 */
export type SseConnectionState = "connecting" | "connected" | "disconnecting" | "disconnected" | "reconnecting";

/**
 * SSE connection class
 */
export class SseConnection {
  private baseUrl: string;
  private channel: string;
  private options: Required<ConnectionOptions>;

  private eventSource: EventSource | null = null;
  private state: SseConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private handlers: Map<SseEventType, Set<SseEventHandler>> = new Map();
  private lastMessageId: string | null = null;
  private userAgent: string | undefined;
  private apiKey: string | undefined;

  /**
   * Create a new SSE connection
   */
  constructor(
    channel: string,
    clientOptions?: ClientOptions,
    connectionOptions?: ConnectionOptions
  ) {
    this.channel = channel;
    this.baseUrl = clientOptions?.baseUrl ?? "http://localhost:3000/api";
    this.userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "SecureNotify-SDK";
    this.apiKey = clientOptions?.apiKey;

    this.options = {
      heartbeatInterval: connectionOptions?.heartbeatInterval ?? DEFAULT_CONNECTION_OPTIONS.heartbeatInterval,
      heartbeatTimeout: connectionOptions?.heartbeatTimeout ?? DEFAULT_CONNECTION_OPTIONS.heartbeatTimeout,
      reconnectDelay: connectionOptions?.reconnectDelay ?? DEFAULT_CONNECTION_OPTIONS.reconnectDelay,
      maxReconnectAttempts: connectionOptions?.maxReconnectAttempts ?? DEFAULT_CONNECTION_OPTIONS.maxReconnectAttempts,
      maxReconnectDelay: connectionOptions?.maxReconnectDelay ?? DEFAULT_CONNECTION_OPTIONS.maxReconnectDelay,
      reconnectBackoffMultiplier: connectionOptions?.reconnectBackoffMultiplier ?? DEFAULT_CONNECTION_OPTIONS.reconnectBackoffMultiplier,
      addReconnectJitter: connectionOptions?.addReconnectJitter ?? DEFAULT_CONNECTION_OPTIONS.addReconnectJitter,
    };

    // Initialize handler sets for each event type
    for (const type of ["connected", "message", "heartbeat", "error", "retry", "close"]) {
      this.handlers.set(type as SseEventType, new Set());
    }
  }

  /**
   * Get the current connection state
   */
  getState(): SseConnectionState {
    return this.state;
  }

  /**
   * Get the channel name
   */
  getChannel(): string {
    return this.channel;
  }

  /**
   * Build the SSE URL with parameters
   */
  private buildUrl(): string {
    const url = new URL(`${this.baseUrl}/subscribe`);
    url.searchParams.set("channel", this.channel);

    if (this.lastMessageId) {
      url.searchParams.set("lastEventId", this.lastMessageId);
    }

    return url.toString();
  }

  /**
   * Build headers for the SSE connection
   */
  private buildHeaders(): HeadersInit | undefined {
    if (!this.apiKey) {
      return undefined;
    }

    return {
      "X-API-Key": this.apiKey,
      "User-Agent": this.userAgent ?? "SecureNotify-SDK/1.0",
    };
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== "disconnected") {
        reject(new Error(`Cannot connect from state: ${this.state}`));
        return;
      }

      this.state = "connecting";
      this.emit("connecting", { channel: this.channel });

      const url = this.buildUrl();
      const headers = this.buildHeaders();

      // Create EventSource with headers if needed
      if (headers) {
        // EventSource doesn't support custom headers directly
        // We need to pass the API key in the URL query parameter
        const urlWithAuth = new URL(url);
        urlWithAuth.searchParams.set("apiKey", this.apiKey!);
        this.eventSource = new EventSource(urlWithAuth.toString());
      } else {
        this.eventSource = new EventSource(url);
      }

      this.eventSource.onopen = () => {
        this.state = "connected";
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit("connected", {
          channel: this.channel,
          type: "channel",
          timestamp: Date.now(),
        } as SseConnectedEvent);
        resolve();
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.eventSource.onerror = (error) => {
        this.handleError(error);
      };

      // Handle specific event types
      this.eventSource.addEventListener("connected", (event: MessageEvent) => {
        this.emit("connected", JSON.parse(event.data));
      });

      this.eventSource.addEventListener("message", (event: MessageEvent) => {
        const data = JSON.parse(event.data) as SseMessageEvent;
        this.lastMessageId = event.lastEventId || data.id;
        this.emit("message", data);
      });

      this.eventSource.addEventListener("heartbeat", (event: MessageEvent) => {
        this.resetHeartbeatTimeout();
        this.emit("heartbeat", JSON.parse(event.data));
      });

      this.eventSource.addEventListener("error", (event: MessageEvent) => {
        this.emit("error", JSON.parse(event.data));
      });
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: MessageEvent): void {
    // Reset heartbeat timeout on any message
    this.resetHeartbeatTimeout();

    // Store the last message ID
    if (event.lastEventId) {
      this.lastMessageId = event.lastEventId;
    }

    // Try to parse as message event
    try {
      const data = JSON.parse(event.data);
      if (data.channel && data.message) {
        this.emit("message", data);
      }
    } catch {
      // Not JSON, ignore
    }
  }

  /**
   * Handle connection error
   */
  private handleError(error: Event): void {
    if (this.state === "disconnecting") {
      return;
    }

    if (this.state === "connecting") {
      this.state = "disconnected";
      this.emit("error", {
        code: "CONNECTION_FAILED",
        message: "Failed to establish SSE connection",
        reconnectable: true,
      } as SseErrorEvent);
      return;
    }

    // Connection was lost, try to reconnect
    this.state = "reconnecting";
    this.stopHeartbeat();

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.state = "disconnected";
      this.eventSource?.close();
      this.eventSource = null;
      this.emit("error", {
        code: "MAX_RECONNECT_ATTEMPTS",
        message: `Maximum reconnect attempts (${this.options.maxReconnectAttempts}) exceeded`,
        reconnectable: false,
      } as SseErrorEvent);
      return;
    }

    const delay = this.calculateReconnectDelay();
    this.emit("retry", { timestamp: Date.now() + delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Error already handled in onerror
      });
    }, delay);
  }

  /**
   * Calculate reconnect delay with exponential backoff and jitter
   */
  private calculateReconnectDelay(): number {
    const baseDelay = this.options.reconnectDelay * Math.pow(this.options.reconnectBackoffMultiplier, this.reconnectAttempts);
    const delay = Math.min(baseDelay, this.options.maxReconnectDelay);

    if (this.options.addReconnectJitter) {
      const jitter = Math.random() * delay * 0.3;
      return Math.floor(delay + jitter);
    }

    return Math.floor(delay);
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      // Heartbeat is sent by the server, we just monitor for it
      // If we don't receive a heartbeat within the timeout, consider connection dead
      this.resetHeartbeatTimeout();
    }, this.options.heartbeatInterval);
  }

  /**
   * Reset the heartbeat timeout
   */
  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
    }

    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.handleHeartbeatTimeout();
    }, this.options.heartbeatTimeout);
  }

  /**
   * Handle heartbeat timeout
   */
  private handleHeartbeatTimeout(): void {
    this.stopHeartbeat();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.state = "disconnected";

    const error = SecureNotifyError.sseHeartbeatTimeout(
      `No heartbeat received within ${this.options.heartbeatTimeout}ms`
    );

    this.emit("error", {
      code: "HEARTBEAT_TIMEOUT",
      message: error.message,
      reconnectable: true,
    } as SseErrorEvent);

    // Try to reconnect
    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.handleError(new Event("heartbeat-timeout"));
    }
  }

  /**
   * Stop heartbeat timer and timeout
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.state === "disconnected" || this.state === "disconnecting") {
        resolve();
        return;
      }

      this.state = "disconnecting";

      // Clear all timers
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.stopHeartbeat();

      // Close the connection
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      this.state = "disconnected";
      this.reconnectAttempts = 0;

      this.emit("close", { channel: this.channel });
      resolve();
    });
  }

  /**
   * Subscribe to an event type
   */
  on(type: SseEventType, handler: SseEventHandler): () => void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.add(handler);
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * Subscribe to an event type once
   */
  once(type: SseEventType, handler: SseEventHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const wrapper = (event: SseEvent) => {
        handler(event);
        handlers.delete(wrapper);
      };
      handlers.add(wrapper);
    }
  }

  /**
   * Emit an event to all handlers
   */
  private emit(type: SseEventType, data?: unknown): void {
    const handlers = this.handlers.get(type);
    if (!handlers) return;

    const event: SseEvent = {
      type,
      data,
      timestamp: Date.now(),
      channel: this.channel,
    };

    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // Handler error, continue with other handlers
      }
    }
  }

  /**
   * Check if the connection is active
   */
  isConnected(): boolean {
    return this.state === "connected";
  }

  /**
   * Get the number of reconnect attempts
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get the last received message ID
   */
  getLastMessageId(): string | null {
    return this.lastMessageId;
  }
}

/**
 * SSE connection manager for handling multiple connections
 */
export class SseConnectionManager {
  private connections: Map<string, SseConnection> = new Map();
  private clientOptions?: ClientOptions;
  private defaultConnectionOptions?: ConnectionOptions;

  /**
   * Create a new connection manager
   */
  constructor(clientOptions?: ClientOptions, connectionOptions?: ConnectionOptions) {
    this.clientOptions = clientOptions;
    this.defaultConnectionOptions = connectionOptions;
  }

  /**
   * Create or get an existing connection for a channel
   */
  getConnection(channel: string): SseConnection {
    let connection = this.connections.get(channel);
    if (!connection) {
      connection = new SseConnection(channel, this.clientOptions, this.defaultConnectionOptions);
      this.connections.set(channel, connection);
    }
    return connection;
  }

  /**
   * Connect to a channel
   */
  async connect(channel: string): Promise<SseConnection> {
    const connection = this.getConnection(channel);
    await connection.connect();
    return connection;
  }

  /**
   * Disconnect from a channel
   */
  async disconnect(channel: string): Promise<void> {
    const connection = this.connections.get(channel);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(channel);
    }
  }

  /**
   * Disconnect from all channels
   */
  async disconnectAll(): Promise<void> {
    const channels = Array.from(this.connections.keys());
    await Promise.all(channels.map((channel) => this.disconnect(channel)));
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): SseConnection[] {
    return Array.from(this.connections.values()).filter((c) => c.isConnected());
  }

  /**
   * Get the number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}

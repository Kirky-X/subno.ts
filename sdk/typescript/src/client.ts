// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type { ClientOptions, ConnectionState } from "./types/api.js";
import { HttpClient } from "./utils/http.js";
import { withRetry, RetryConfig } from "./utils/retry.js";
import { SseConnectionManager } from "./utils/connection.js";
import { KeyManager } from "./managers/key.manager.js";
import { ChannelManager } from "./managers/channel.manager.js";
import { PublishManager } from "./managers/publish.manager.js";
import { SubscribeManager } from "./managers/subscribe.manager.js";
import { ApiKeyManager } from "./managers/apikey.manager.js";
import { SecureNotifyError } from "./types/errors.js";

/**
 * Builder for creating SecureNotifyClient with options
 */
export class SecureNotifyClientBuilder {
  private options: ClientOptions = {};
  private retryConfig?: RetryConfig;

  /**
   * Set the base URL
   */
  baseUrl(baseUrl: string): this {
    this.options.baseUrl = baseUrl;
    return this;
  }

  /**
   * Set the API key
   */
  apiKey(apiKey: string): this {
    this.options.apiKey = apiKey;
    return this;
  }

  /**
   * Set the API key ID
   */
  apiKeyId(apiKeyId: string): this {
    this.options.apiKeyId = apiKeyId;
    return this;
  }

  /**
   * Set the request timeout
   */
  timeout(timeout: number): this {
    this.options.timeout = timeout;
    return this;
  }

  /**
   * Configure retry options
   */
  retry(config: RetryConfig): this {
    this.retryConfig = config;
    return this;
  }

  /**
   * Build the client
   */
  build(): SecureNotifyClient {
    return new SecureNotifyClient(this.options, this.retryConfig);
  }
}

/**
 * SecureNotify client for interacting with the SecureNotify API
 */
export class SecureNotifyClient {
  private readonly http: HttpClient;
  private readonly sseManager: SseConnectionManager;
  private readonly _keys: KeyManager;
  private readonly _channels: ChannelManager;
  private readonly _publish: PublishManager;
  private readonly _subscribe: SubscribeManager;
  private readonly _apiKeys: ApiKeyManager;
  private _state: ConnectionState = "disconnected";
  private _closed = false;

  /**
   * Create a new SecureNotify client
   */
  constructor(options?: ClientOptions, retryConfig?: RetryConfig) {
    this.http = new HttpClient(options);
    this.sseManager = new SseConnectionManager(options);

    // Initialize managers
    this._keys = new KeyManager(this.http);
    this._channels = new ChannelManager(this.http);
    this._publish = new PublishManager(this.http);
    this._subscribe = new SubscribeManager(options);
    this._apiKeys = new ApiKeyManager(this.http);
  }

  /**
   * Get the keys manager
   */
  get keys(): KeyManager {
    this.throwIfClosed();
    return this._keys;
  }

  /**
   * Get the channels manager
   */
  get channels(): ChannelManager {
    this.throwIfClosed();
    return this._channels;
  }

  /**
   * Get the publish manager
   */
  get publish(): PublishManager {
    this.throwIfClosed();
    return this._publish;
  }

  /**
   * Get the subscribe manager
   */
  get subscribe(): SubscribeManager {
    this.throwIfClosed();
    return this._subscribe;
  }

  /**
   * Get the API keys manager
   */
  get apiKeys(): ApiKeyManager {
    this.throwIfClosed();
    return this._apiKeys;
  }

  /**
   * Get the current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Check if the client is closed
   */
  isClosed(): boolean {
    return this._closed;
  }

  /**
   * Check if the client is connected (has active SSE connections)
   */
  isConnected(): boolean {
    return this._subscribe.getSubscriptionCount() > 0;
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.http.getBaseUrl();
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return this.http.hasApiKey();
  }

  /**
   * Throw an error if the client is closed
   */
  private throwIfClosed(): void {
    if (this._closed) {
      throw SecureNotifyError.invalidOptions("Client is closed");
    }
  }

  /**
   * Execute a request with retry logic
   */
  async request<T>(
    fn: () => Promise<T>,
    retryOptions?: RetryConfig
  ): Promise<T> {
    this.throwIfClosed();
    return withRetry(fn, retryOptions).then((result) => {
      if (!result.success) {
        throw result.error;
      }
      return result.data!;
    });
  }

  /**
   * Connect to a channel for real-time updates
   *
   * @param channel - The channel ID
   * @param handler - Message handler
   * @returns Unsubscribe function
   */
  async connect(
    channel: string,
    handler: (message: {
      id: string;
      channel: string;
      message: string;
      sender?: string;
      timestamp: number;
      priority: string;
    }) => void
  ): Promise<() => Promise<void>> {
    this.throwIfClosed();
    this._state = "connecting";
    return this._subscribe.subscribe(channel, handler);
  }

  /**
   * Disconnect from all channels
   */
  async disconnect(): Promise<void> {
    this.throwIfClosed();
    this._state = "disconnecting";
    await this._subscribe.unsubscribeAll();
    this._state = "disconnected";
  }

  /**
   * Close the client and clean up resources
   */
  async close(): Promise<void> {
    if (this._closed) {
      return;
    }

    this._closed = true;
    this._state = "disconnecting";

    // Disconnect from all channels
    await this._subscribe.unsubscribeAll();

    this._state = "disconnected";
  }

  /**
   * Dispose of the client (alias for close)
   */
  async dispose(): Promise<void> {
    await this.close();
  }

  /**
   * Create a builder for configuring the client
   */
  static builder(): SecureNotifyClientBuilder {
    return new SecureNotifyClientBuilder();
  }

  /**
   * Create a client with the specified API key
   */
  static create(baseUrl: string, apiKey: string): SecureNotifyClient {
    return new SecureNotifyClient({ baseUrl, apiKey });
  }

  /**
   * Get all subscribed channels
   */
  getSubscribedChannels(): ReturnType<SubscribeManager["getSubscribedChannels"]> {
    this.throwIfClosed();
    return this._subscribe.getSubscribedChannels();
  }

  /**
   * Get the number of subscribed channels
   */
  getSubscriptionCount(): number {
    this.throwIfClosed();
    return this._subscribe.getSubscriptionCount();
  }
}

// Re-export types for convenience
export type {
  ClientOptions,
  RetryConfig,
  ConnectionState,
} from "./types/api.js";

export {
  SecureNotifyError,
  isSecureNotifyError,
} from "./types/errors.js";

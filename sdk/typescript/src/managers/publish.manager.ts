// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type {
  MessagePublishRequest,
  MessagePublishResponse,
  MessagePriority,
  MessageInfo,
  QueueStatusResponse,
  SuccessResponse,
} from "../types/api.js";
import type { HttpClient } from "../utils/http.js";
import { SecureNotifyError } from "../types/errors.js";

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /** The channel to send to */
  channel: string;
  /** The message content */
  message: string;
  /** Message priority level */
  priority?: MessagePriority;
  /** Optional sender identifier */
  sender?: string;
  /** Whether to cache the message */
  cache?: boolean;
  /** Whether to encrypt the message */
  encrypted?: boolean;
  /** Whether to auto-create the channel */
  autoCreate?: boolean;
  /** Message signature */
  signature?: string;
}

/**
 * Queue status information
 */
export interface QueueStatus {
  channel: string;
  messages: MessageInfo[];
  queueLength: number;
}

/**
 * Publish result
 */
export interface PublishResult extends MessagePublishResponse {}

/**
 * Publish manager for handling message publishing operations
 */
export class PublishManager {
  private readonly http: HttpClient;
  private readonly basePath = "/api/publish";

  /**
   * Create a new publish manager
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Send a message to a channel
   *
   * @param options - Message sending options
   * @returns The publish result with message ID
   */
  async send(options: SendMessageOptions): Promise<PublishResult> {
    if (!options.channel) {
      throw SecureNotifyError.validation("channel is required");
    }

    if (!options.message) {
      throw SecureNotifyError.validation("message is required");
    }

    const request: MessagePublishRequest = {
      channel: options.channel,
      message: options.message,
      priority: options.priority ?? "normal",
      sender: options.sender,
      cache: options.cache ?? true,
      encrypted: options.encrypted ?? false,
      autoCreate: options.autoCreate ?? true,
      signature: options.signature,
    };

    const response = await this.http.post<SuccessResponse<MessagePublishResponse>>(
      this.basePath,
      request
    );

    return response.data.data;
  }

  /**
   * Send a message to multiple channels with batching optimization
   *
   * @param channels - Array of channel IDs
   * @param message - The message content
   * @param options - Additional options (priority, sender, etc.)
   * @returns Array of publish results
   */
  async sendToChannels(
    channels: string[],
    message: string,
    options?: Omit<SendMessageOptions, "channel" | "message">
  ): Promise<PublishResult[]> {
    if (!channels || channels.length === 0) {
      throw SecureNotifyError.validation("channels array is required");
    }

    if (!message) {
      throw SecureNotifyError.validation("message is required");
    }

    // Process in batches of 10 to optimize performance (PERFORMANCE FIX)
    const batchSize = 10;
    const results: PublishResult[] = [];

    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((channel) =>
          this.send({
            channel,
            message,
            ...options,
          })
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**

     * Get queue status for a channel

     *

     * @param channel - The channel ID

     * @param count - Number of messages to retrieve

     * @returns The queue status

     */

    async getQueueStatus(channel: string, count: number = 10): Promise<QueueStatus> {

      if (!channel) {

        throw SecureNotifyError.validation("channel is required");

      }

  

      const response = await this.http.get<SuccessResponse<QueueStatusResponse>>(

        this.basePath,

        { channel, count }

      );

  

      return response.data.data;

    }

  

    /**

     * Send a priority message

     *

     * @param priority - The message priority level

     * @param channel - The channel ID

     * @param message - The message content

     * @param sender - Optional sender identifier

     * @returns The publish result

     */

    async sendPriority(

      priority: MessagePriority,

      channel: string,

      message: string,

      sender?: string

    ): Promise<PublishResult> {

      return this.send({

        channel,

        message,

        priority,

        sender,

      });

    }

  

    /**

     * Send a critical priority message

     *

     * @param channel - The channel ID

     * @param message - The message content

     * @param sender - Optional sender identifier

     * @returns The publish result

     */

    async sendCritical(

      channel: string,

      message: string,

      sender?: string

    ): Promise<PublishResult> {

      return this.sendPriority("critical", channel, message, sender);

    }

  

    /**

     * Send a high priority message

     *

     * @param channel - The channel ID

     * @param message - The message content

     * @param sender - Optional sender identifier

     * @returns The publish result

     */

    async sendHigh(

      channel: string,

      message: string,

      sender?: string

    ): Promise<PublishResult> {

      return this.sendPriority("high", channel, message, sender);

    }

  

    /**

     * Send a normal priority message

     *

     * @param channel - The channel ID

     * @param message - The message content

     * @param sender - Optional sender identifier

     * @returns The publish result

     */

    async sendNormal(

      channel: string,

      message: string,

      sender?: string

    ): Promise<PublishResult> {

      return this.sendPriority("normal", channel, message, sender);

    }

  

    /**

     * Send a low priority message

     *

     * @param channel - The channel ID

     * @param message - The message content

     * @param sender - Optional sender identifier

     * @returns The publish result

     */

    async sendLow(

      channel: string,

      message: string,

      sender?: string

    ): Promise<PublishResult> {

      return this.sendPriority("low", channel, message, sender);

    }

  

    /**

     * Send a bulk priority message

     *

     * @param channel - The channel ID

     * @param message - The message content

     * @param sender - Optional sender identifier

     * @returns The publish result

     */

    async sendBulk(

      channel: string,

      message: string,

      sender?: string

    ): Promise<PublishResult> {

      return this.sendPriority("bulk", channel, message, sender);

        }

      

        /**

         * Broadcast a message to multiple channels

         *

         * @param channels - Array of channel IDs

         * @param message - The message content

         * @param options - Additional options

         * @returns Array of publish results or errors

         */

        async broadcast(

          channels: string[],

          message: string,

          options?: Omit<SendMessageOptions, "channel" | "message">

        ): Promise<{ channel: string; result?: PublishResult; error?: Error }[]> {

          const results = await Promise.allSettled(

            channels.map((channel) => this.send({ channel, message, ...options }))

          );

      

          return channels.map((channel, index) => {

            const result = results[index];

            if (result.status === "fulfilled") {

              return { channel, result: result.value };

            } else {

              return { channel, error: result.reason as Error };

            }

          });

        }

      }

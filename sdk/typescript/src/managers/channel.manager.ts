// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type {
  ChannelCreateOptions,
  ChannelCreateResponse,
  ChannelInfo,
  ChannelType,
  PaginationOptions,
  SuccessResponse,
  PaginationResult,
} from "../types/api.js";
import type { HttpClient } from "../utils/http.js";
import { SecureNotifyError } from "../types/errors.js";

/**
 * Channel list response
 */
export interface ChannelListResult {
  channels: ChannelInfo[];
  pagination: PaginationResult;
}

/**
 * Options for listing channels
 */
export interface ListChannelsOptions extends PaginationOptions {
  type?: ChannelType;
  creator?: string;
  isActive?: boolean;
}

/**
 * Channel manager for handling channel operations
 */
export class ChannelManager {
  private readonly http: HttpClient;
  private readonly basePath = "/api/channels";

  /**
   * Create a new channel manager
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new channel
   *
   * @param options - Channel creation options
   * @returns The created channel information
   */
  async create(options: ChannelCreateOptions): Promise<ChannelCreateResponse> {
    const request = {
      id: options.id,
      name: options.name,
      description: options.description,
      type: options.type ?? "public",
      creator: options.creator,
      expiresIn: options.expiresIn,
      metadata: options.metadata,
    };

    const response = await this.http.post<SuccessResponse<ChannelCreateResponse>>(
      this.basePath,
      request
    );

    return response.data.data;
  }

  /**
   * Get a channel by ID
   *
   * @param id - The channel ID
   * @returns The channel information
   */
  async get(id: string): Promise<ChannelInfo> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    const response = await this.http.get<SuccessResponse<ChannelInfo>>(
      this.basePath,
      { id }
    );

    return response.data.data;
  }

  /**
   * List channels with optional filtering and pagination
   *
   * @param options - Listing options
   * @returns The list of channels with pagination info
   */
  async list(options?: ListChannelsOptions): Promise<ChannelListResult> {
    const query: Record<string, string | number | boolean | undefined> = {};

    if (options?.limit !== undefined) {
      query['limit'] = options.limit;
    }
    if (options?.offset !== undefined) {
      query['offset'] = options.offset;
    }
    if (options?.type !== undefined) {
      query['type'] = options.type;
    }
    if (options?.creator !== undefined) {
      query['creator'] = options.creator;
    }
    if (options?.isActive !== undefined) {
      query['isActive'] = options.isActive;
    }

    const response = await this.http.get<SuccessResponse<ChannelInfo[]> & { pagination: PaginationResult }>(
      this.basePath,
      query
    );

    return {
      channels: response.data.data,
      pagination: response.data.pagination,
    };
  }

  /**
   * Create a public channel (shorthand)
   *
   * @param id - The channel ID
   * @param name - Optional channel name
   * @param expiresIn - Optional expiration in seconds
   * @returns The created channel information
   */
  async createPublic(
    id: string,
    name?: string,
    expiresIn?: number
  ): Promise<ChannelCreateResponse> {
    return this.create({
      id,
      name,
      type: "public",
      expiresIn,
    });
  }

  /**
   * Create an encrypted channel (shorthand)
   *
   * @param id - The channel ID
   * @param name - Optional channel name
   * @param creator - Optional creator identifier
   * @param expiresIn - Optional expiration in seconds
   * @returns The created channel information
   */
  async createEncrypted(
    id: string,
    name?: string,
    creator?: string,
    expiresIn?: number
  ): Promise<ChannelCreateResponse> {
    return this.create({
      id,
      name,
      type: "encrypted",
      creator,
      expiresIn,
    });
  }

  /**
   * Check if a channel exists
   *
   * @param id - The channel ID
   * @returns Whether the channel exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.get(id);
      return true;
    } catch (error) {
      if (error instanceof SecureNotifyError && error.code === "NOT_FOUND") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get or create a channel (idempotent)
   *
   * @param options - Channel creation options
   * @returns The channel information
   */
  async getOrCreate(options: ChannelCreateOptions): Promise<ChannelCreateResponse> {
    if (!options.id) {
      throw SecureNotifyError.validation("id is required for getOrCreate");
    }

    try {
      const channel = await this.get(options.id);
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        creator: channel.creator,
        createdAt: channel.createdAt,
        expiresAt: channel.expiresAt,
        isActive: channel.isActive,
        metadata: channel.metadata,
      };
    } catch (error) {
      if (error instanceof SecureNotifyError && error.code === "NOT_FOUND") {
        return this.create(options);
      }
      throw error;
    }
  }
}

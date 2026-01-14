// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type {
  ApiKeyCreateOptions,
  ApiKeyCreateResponse,
  ApiKeyInfo,
  ApiKeyPermission,
  PaginationOptions,
  SuccessResponse,
  PaginationResult,
} from "../types/api.js";
import type { HttpClient } from "../utils/http.js";
import { SecureNotifyError } from "../types/errors.js";

/**
 * API key list result
 */
export interface ApiKeyListResult {
  keys: ApiKeyInfo[];
  pagination: PaginationResult;
}

/**
 * Options for listing API keys
 */
export interface ListApiKeysOptions extends PaginationOptions {
  userId?: string;
  isActive?: boolean;
}

/**
 * Revoke result
 */
export interface RevokeResult {
  success: boolean;
  deletedId: string;
  channelId?: string;
  deletedAt: string;
}

/**
 * API key manager for handling API key operations
 */
export class ApiKeyManager {
  private readonly http: HttpClient;
  private readonly basePath = "/api/keys";

  /**
   * Create a new API key manager
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new API key
   *
   * @param options - API key creation options
   * @returns The created API key information (including the key)
   */
  async create(options: ApiKeyCreateOptions): Promise<ApiKeyCreateResponse> {
    if (!options.name) {
      throw SecureNotifyError.validation("name is required");
    }

    if (!options.userId) {
      throw SecureNotifyError.validation("userId is required");
    }

    if (!options.permissions || options.permissions.length === 0) {
      throw SecureNotifyError.validation("permissions are required");
    }

    const response = await this.http.post<SuccessResponse<ApiKeyCreateResponse>>(
      this.basePath,
      options
    );

    return response.data.data;
  }

  /**
   * Get API key information by ID
   *
   * @param id - The API key ID
   * @returns The API key information
   */
  async get(id: string): Promise<ApiKeyInfo> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    const response = await this.http.get<SuccessResponse<ApiKeyInfo>>(
      `${this.basePath}/${encodeURIComponent(id)}`
    );

    return response.data.data;
  }

  /**
   * List API keys with optional filtering and pagination
   *
   * @param options - Listing options
   * @returns The list of API keys with pagination info
   */
  async list(options?: ListApiKeysOptions): Promise<ApiKeyListResult> {
    const query: Record<string, string | number | boolean | undefined> = {};

    if (options?.limit !== undefined) {
      query['limit'] = options.limit;
    }
    if (options?.offset !== undefined) {
      query['offset'] = options.offset;
    }
    if (options?.userId !== undefined) {
      query['userId'] = options.userId;
    }
    if (options?.isActive !== undefined) {
      query['isActive'] = options.isActive;
    }

    const response = await this.http.get<SuccessResponse<ApiKeyInfo[]> & { pagination: PaginationResult }>(
      this.basePath,
      query
    );

    return {
      keys: response.data.data,
      pagination: response.data.pagination,
    };
  }

  /**
   * Revoke an API key
   *
   * @param id - The API key ID
   * @returns The revocation result
   */
  async revoke(id: string): Promise<RevokeResult> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    const response = await this.http.delete<SuccessResponse<RevokeResult>>(
      `${this.basePath}/${encodeURIComponent(id)}`
    );

    return response.data.data;
  }

  /**
   * Check if an API key is active
   *
   * @param id - The API key ID
   * @returns Whether the key is active
   */
  async isActive(id: string): Promise<boolean> {
    try {
      const key = await this.get(id);
      return key.isActive;
    } catch (error) {
      if (error instanceof SecureNotifyError && error.code === "NOT_FOUND") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get the permissions for an API key
   *
   * @param id - The API key ID
   * @returns The permissions array
   */
  async getPermissions(id: string): Promise<ApiKeyPermission[]> {
    const key = await this.get(id);
    return key.permissions;
  }

  /**
   * Check if an API key has a specific permission
   *
   * @param id - The API key ID
   * @param permission - The permission to check
   * @returns Whether the key has the permission
   */
  async hasPermission(id: string, permission: ApiKeyPermission): Promise<boolean> {
    const permissions = await this.getPermissions(id);
    return permissions.includes(permission);
  }
}

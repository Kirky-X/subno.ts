// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import type {
  RegisterPublicKeyRequest,
  RegisterPublicKeyResponse,
  PublicKeyInfo,
  Algorithm,
  SuccessResponse,
} from "../types/api.js";
import type { HttpClient } from "../utils/http.js";
import { SecureNotifyError } from "../types/errors.js";

/**
 * Options for registering a public key
 */
export interface RegisterKeyOptions {
  /** PEM formatted public key */
  publicKey: string;
  /** Encryption algorithm */
  algorithm?: Algorithm;
  /** Time in seconds until the key expires (max 30 days) */
  expiresIn?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Key information returned from the API
 */
export interface KeyInfo extends PublicKeyInfo {}

/**
 * Result from revoking a key
 */
export interface RevokeKeyResult {
  revocationId: string;
  keyId: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  expiresAt: string;
  confirmationCodeSent: boolean;
}

/**
 * Result from confirming key revocation
 */
export interface ConfirmRevokeResult {
  deletedId: string;
  channelId: string;
  deletedAt: string;
}

/**
 * Key manager for handling public key operations
 */
export class KeyManager {
  private readonly http: HttpClient;
  private readonly basePath = "/api/register";

  /**
   * Create a new key manager
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Register a new public key
   *
   * @param options - Key registration options
   * @returns The registration response with channel ID and key ID
   */
  async register(options: RegisterKeyOptions): Promise<RegisterPublicKeyResponse> {
    if (!options.publicKey) {
      throw SecureNotifyError.validation("publicKey is required");
    }

    const request: RegisterPublicKeyRequest = {
      publicKey: options.publicKey,
      algorithm: options.algorithm ?? "RSA-4096",
      expiresIn: options.expiresIn,
      metadata: options.metadata,
    };

    const response = await this.http.post<SuccessResponse<RegisterPublicKeyResponse>>(
      this.basePath,
      request
    );

    return response.data.data;
  }

  /**
   * Get public key information by channel ID or key ID
   *
   * @param id - The channel ID or key ID
   * @returns The public key information
   */
  async get(id: string): Promise<PublicKeyInfo> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    const response = await this.http.get<SuccessResponse<PublicKeyInfo>>(
      this.basePath,
      { channelId: id }
    );

    return response.data.data;
  }

  /**
   * List all registered public keys
   *
   * @param options - Pagination options
   * @returns Array of public key information
   */
  async list(options?: { limit?: number; offset?: number }): Promise<PublicKeyInfo[]> {
    const query: Record<string, string | number | boolean | undefined> = {};

    if (options?.limit !== undefined) {
      query.limit = options.limit;
    }
    if (options?.offset !== undefined) {
      query.offset = options.offset;
    }

    const response = await this.http.get<SuccessResponse<PublicKeyInfo[]>>(
      this.basePath,
      query
    );

    return response.data.data;
  }

  /**
   * Get detailed key information including the public key
   *
   * @param id - The channel ID or key ID
   * @returns Detailed key information with the public key
   */
  async getDetails(id: string): Promise<PublicKeyInfo & { publicKey: string }> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    // Use the /api/keys/[id] endpoint for detailed information
    const response = await this.http.get<SuccessResponse<PublicKeyInfo & { publicKey: string }>>(
      `/api/keys/${encodeURIComponent(id)}`
    );

    return response.data.data;
  }

  /**
   * Initiate key revocation (two-phase process)
   *
   * @param id - The channel ID or key ID
   * @param reason - The reason for revocation
   * @param confirmationHours - Hours to wait for confirmation (default: 24)
   * @returns The revocation result
   */
  async revoke(
    id: string,
    reason: string,
    confirmationHours?: number
  ): Promise<RevokeKeyResult> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    if (!reason) {
      throw SecureNotifyError.validation("reason is required");
    }

    if (!this.http.hasApiKey()) {
      throw SecureNotifyError.missingApiKey();
    }

    const response = await this.http.post<SuccessResponse<RevokeKeyResult>>(
      `/api/keys/${encodeURIComponent(id)}/revoke`,
      {
        reason,
        confirmationHours: confirmationHours ?? 24,
      }
    );

    return response.data.data;
  }

  /**
   * Confirm key revocation (second phase)
   *
   * @param id - The channel ID or key ID
   * @param confirmationCode - The confirmation code received
   * @returns The confirmation result
   */
  async confirmRevocation(id: string, confirmationCode: string): Promise<ConfirmRevokeResult> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    if (!confirmationCode) {
      throw SecureNotifyError.validation("confirmationCode is required");
    }

    if (!this.http.hasApiKey()) {
      throw SecureNotifyError.missingApiKey();
    }

    const response = await this.http.delete<SuccessResponse<ConfirmRevokeResult>>(
      `/api/keys/${encodeURIComponent(id)}?confirmationCode=${encodeURIComponent(confirmationCode)}`
    );

    return response.data.data;
  }

  /**
   * Cancel a pending key revocation
   *
   * @param id - The channel ID or key ID
   */
  async cancelRevocation(id: string): Promise<void> {
    if (!id) {
      throw SecureNotifyError.validation("id is required");
    }

    if (!this.http.hasApiKey()) {
      throw SecureNotifyError.missingApiKey();
    }

    await this.http.post<SuccessResponse<{ message: string }>>(
      `/api/keys/${encodeURIComponent(id)}/revoke/cancel`
    );
  }
}

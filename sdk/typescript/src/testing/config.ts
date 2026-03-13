// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Test configuration for integration tests
 * Provides mock data and test utilities
 */

import type {
  Algorithm,
  MessagePriority,
  ChannelType,
  ApiKeyPermission,
} from "../types/api.js";

/**
 * Test configuration constants
 */
export const TEST_CONFIG = {
  baseUrl: "http://localhost:3002/api",
  apiKey: "test-api-key-12345",
  apiKeyId: "test-api-key-id-001",
  timeout: 5000,
  defaultChannelId: "test-channel-001",
  defaultKeyId: "test-key-001",
} as const;

/**
 * Test data factory for generating mock data
 */
export class TestDataFactory {
  private static counter = 0;

  /**
   * Generate a unique ID
   */
  static generateId(prefix: string = "id"): string {
    this.counter++;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }

  /**
   * Generate a test public key
   */
  static generatePublicKey(): string {
    return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA_test_key_${Date.now()}
-----END PUBLIC KEY-----`;
  }

  /**
   * Generate a test channel ID
   */
  static generateChannelId(): string {
    return `channel-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate a test message ID
   */
  static generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate a test API key
   */
  static generateApiKey(): string {
    return `sk_test_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate a test API key ID
   */
  static generateApiKeyId(): string {
    return `keyid_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Reset the counter (useful for test isolation)
   */
  static reset(): void {
    this.counter = 0;
  }
}

/**
 * Mock response data generators
 */
export class MockResponses {
  /**
   * Create a successful API response
   */
  static success<T>(data: T): { success: true; data: T } {
    return {
      success: true,
      data,
    };
  }

  /**
   * Create an error API response
   */
  static error(message: string, code: string = "UNKNOWN_ERROR"): { success: false; error: { message: string; code: string; timestamp: string } } {
    return {
      success: false,
      error: {
        message,
        code,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Mock health check response
   */
  static healthCheck(): { status: string; timestamp: string } {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mock API key creation response
   */
  static createApiKey(options?: {
    name?: string;
    permissions?: ApiKeyPermission[];
  }): {
    id: string;
    keyPrefix: string;
    name: string;
    userId: string;
    permissions: ApiKeyPermission[];
    createdAt: string;
    expiresAt: string;
  } {
    const key = TestDataFactory.generateApiKey();
    return {
      id: TestDataFactory.generateApiKeyId(),
      keyPrefix: key.substring(0, 10),
      name: options?.name ?? "test-api-key",
      userId: "test-user-001",
      permissions: options?.permissions ?? ["publish", "subscribe"],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Mock API key list response
   */
  static listApiKeys(count: number = 3): { keys: Array<{
    id: string;
    keyPrefix: string;
    name: string;
    userId: string;
    permissions: ApiKeyPermission[];
    isActive: boolean;
    createdAt: string;
    expiresAt: string;
  }>; pagination: { total: number; limit: number; offset: number; hasMore: boolean } } {
    const keys = Array.from({ length: count }, (_, i) => ({
      id: TestDataFactory.generateApiKeyId(),
      keyPrefix: `sk_test_${i}`,
      name: `test-key-${i}`,
      userId: "test-user-001",
      permissions: ["publish", "subscribe"] as ApiKeyPermission[],
      isActive: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    return {
      keys,
      pagination: {
        total: count,
        limit: 10,
        offset: 0,
        hasMore: false,
      },
    };
  }

  /**
   * Mock key registration response
   */
  static registerKey(options?: {
    algorithm?: Algorithm;
  }): {
    channelId: string;
    publicKeyId: string;
    algorithm: Algorithm;
    expiresAt: string;
    expiresIn: number;
  } {
    return {
      channelId: TestDataFactory.generateChannelId(),
      publicKeyId: TestDataFactory.generateId("key"),
      algorithm: options?.algorithm ?? "RSA-4096",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      expiresIn: 30 * 24 * 60 * 60,
    };
  }

  /**
   * Mock key list response
   */
  static listKeys(count: number = 3): Array<{
    id: string;
    channelId: string;
    publicKey: string;
    algorithm: Algorithm;
    createdAt: string;
    expiresAt: string;
    isExpired: boolean;
  }> {
    return Array.from({ length: count }, () => ({
      id: TestDataFactory.generateId("key"),
      channelId: TestDataFactory.generateChannelId(),
      publicKey: TestDataFactory.generatePublicKey(),
      algorithm: "RSA-4096" as Algorithm,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isExpired: false,
    }));
  }

  /**
   * Mock channel creation response
   */
  static createChannel(options?: {
    id?: string;
    name?: string;
    type?: ChannelType;
  }): {
    id: string;
    name: string;
    type: ChannelType;
    creator: string;
    createdAt: string;
    expiresAt: string;
    isActive: boolean;
  } {
    return {
      id: options?.id ?? TestDataFactory.generateChannelId(),
      name: options?.name ?? "test-channel",
      type: options?.type ?? "public",
      creator: "test-user-001",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    };
  }

  /**
   * Mock channel list response
   */
  static listChannels(count: number = 3): {
    channels: Array<{
      id: string;
      name: string;
      type: ChannelType;
      creator: string;
      createdAt: string;
      expiresAt: string;
      isActive: boolean;
    }>;
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  } {
    const channels = Array.from({ length: count }, () => ({
      id: TestDataFactory.generateChannelId(),
      name: `test-channel-${Date.now()}`,
      type: "public" as ChannelType,
      creator: "test-user-001",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    }));

    return {
      channels,
      pagination: {
        total: count,
        limit: 10,
        offset: 0,
        hasMore: false,
      },
    };
  }

  /**
   * Mock message publish response
   */
  static publishMessage(options?: {
    channel?: string;
  }): {
    messageId: string;
    channel: string;
    publishedAt: string;
    autoCreated?: boolean;
  } {
    return {
      messageId: TestDataFactory.generateMessageId(),
      channel: options?.channel ?? TestDataFactory.generateChannelId(),
      publishedAt: new Date().toISOString(),
      autoCreated: false,
    };
  }

  /**
   * Mock queue status response
   */
  static queueStatus(channel: string): {
    channel: string;
    messages: Array<{
      id: string;
      channel: string;
      message: string;
      timestamp: number;
      priority: MessagePriority;
    }>;
    queueLength: number;
  } {
    return {
      channel,
      messages: [
        {
          id: TestDataFactory.generateMessageId(),
          channel,
          message: "Test message 1",
          timestamp: Date.now(),
          priority: "normal" as MessagePriority,
        },
        {
          id: TestDataFactory.generateMessageId(),
          channel,
          message: "Test message 2",
          timestamp: Date.now(),
          priority: "high" as MessagePriority,
        },
      ],
      queueLength: 2,
    };
  }

  /**
   * Mock key revocation response
   */
  static revokeKey(): {
    revocationId: string;
    keyId: string;
    status: "pending" | "confirmed" | "cancelled" | "expired";
    expiresAt: string;
    confirmationCodeSent: boolean;
  } {
    return {
      revocationId: TestDataFactory.generateId("rev"),
      keyId: TestDataFactory.generateId("key"),
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      confirmationCodeSent: true,
    };
  }

  /**
   * Mock confirm revocation response
   */
  static confirmRevoke(): {
    deletedId: string;
    channelId: string;
    deletedAt: string;
  } {
    return {
      deletedId: TestDataFactory.generateId("key"),
      channelId: TestDataFactory.generateChannelId(),
      deletedAt: new Date().toISOString(),
    };
  }
}

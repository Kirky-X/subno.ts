// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * SecureNotify API type definitions
 */

/**
 * Supported encryption algorithms for public keys
 */
export type Algorithm = "RSA-2048" | "RSA-4096" | "ECC-SECP256K1";

/**
 * Message priority levels
 */
export type MessagePriority = "critical" | "high" | "normal" | "low" | "bulk";

/**
 * Channel types
 */
export type ChannelType = "public" | "encrypted";

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Pagination result
 */
export interface PaginationResult {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// Public Key Types
// ============================================================================

/**
 * Request to register a public key
 */
export interface RegisterPublicKeyRequest {
  publicKey: string;
  algorithm?: Algorithm;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Response from registering a public key
 */
export interface RegisterPublicKeyResponse {
  channelId: string;
  publicKeyId: string;
  algorithm: Algorithm;
  expiresAt: string;
  expiresIn: number;
}

/**
 * Public key information
 */
export interface PublicKeyInfo {
  id: string;
  channelId: string;
  publicKey: string;
  algorithm: Algorithm;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  metadata?: Record<string, unknown>;
  isExpired: boolean;
}

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Options for creating a channel
 */
export interface ChannelCreateOptions {
  id?: string;
  name?: string;
  description?: string;
  type?: ChannelType;
  creator?: string;
  expiresIn?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Response from creating a channel
 */
export interface ChannelCreateResponse {
  id: string;
  name?: string;
  type: ChannelType;
  creator?: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Channel information
 */
export interface ChannelInfo {
  id: string;
  name?: string;
  type: ChannelType;
  creator?: string;
  description?: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Channel list response
 */
export interface ChannelListResponse {
  channels: ChannelInfo[];
  pagination: PaginationResult;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Options for publishing a message
 */
export interface PublishMessageOptions {
  priority?: MessagePriority;
  sender?: string;
  cache?: boolean;
  encrypted?: boolean;
  autoCreate?: boolean;
  signature?: string;
}

/**
 * Request to publish a message
 */
export interface MessagePublishRequest {
  channel: string;
  message: string;
  priority?: MessagePriority;
  sender?: string;
  cache?: boolean;
  encrypted?: boolean;
  autoCreate?: boolean;
  signature?: string;
}

/**
 * Response from publishing a message
 */
export interface MessagePublishResponse {
  messageId: string;
  channel: string;
  publishedAt: string;
  autoCreated?: boolean;
}

/**
 * Message information
 */
export interface MessageInfo {
  id: string;
  channel: string;
  message: string;
  sender?: string;
  timestamp: number;
  priority: MessagePriority;
}

/**
 * Queue status response
 */
export interface QueueStatusResponse {
  channel: string;
  messages: MessageInfo[];
  queueLength: number;
}

// ============================================================================
// API Key Types
// ============================================================================

/**
 * Permissions for an API key
 */
export type ApiKeyPermission = "publish" | "subscribe" | "keys" | "channels" | "admin";

/**
 * Options for creating an API key
 */
export interface ApiKeyCreateOptions {
  name: string;
  userId: string;
  permissions: ApiKeyPermission[];
  expiresIn?: number;
}

/**
 * Response from creating an API key
 */
export interface ApiKeyCreateResponse {
  id: string;
  keyPrefix: string;
  name: string;
  userId: string;
  permissions: ApiKeyPermission[];
  createdAt: string;
  expiresAt: string;
}

/**
 * API key information (without the full key)
 */
export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  name: string;
  userId: string;
  permissions: ApiKeyPermission[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
}

/**
 * API key list response
 */
export interface ApiKeyListResponse {
  keys: ApiKeyInfo[];
  pagination: PaginationResult;
}

// ============================================================================
// Key Revocation Types
// ============================================================================

/**
 * Options for revoking a key
 */
export interface KeyRevokeOptions {
  reason: string;
  confirmationHours?: number;
}

/**
 * Response from revoking a key
 */
export interface KeyRevokeResponse {
  revocationId: string;
  keyId: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  expiresAt: string;
  confirmationCodeSent: boolean;
}

/**
 * Result from confirming key revocation
 */
export interface KeyRevokeConfirmResponse {
  deletedId: string;
  channelId: string;
  deletedAt: string;
}

// ============================================================================
// Generic Response Types
// ============================================================================

/**
 * Success response wrapper
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Error response details
 */
export interface ErrorDetails {
  message: string;
  code: string;
  timestamp: string;
}

/**
 * Error response wrapper
 */
export interface ErrorResponse {
  success: false;
  error: ErrorDetails;
}

// ============================================================================
// SSE Event Types
// ============================================================================

/**
 * SSE connected event data
 */
export interface SseConnectedEvent {
  channel: string;
  type: "channel" | "user";
  timestamp: number;
}

/**
 * SSE message event data
 */
export interface SseMessageEvent {
  id: string;
  channel: string;
  message: string;
  sender?: string;
  timestamp: number;
  priority: MessagePriority;
}

/**
 * SSE heartbeat event data
 */
export interface SseHeartbeatEvent {
  timestamp: number;
}

/**
 * SSE error event data
 */
export interface SseErrorEvent {
  code: string;
  message: string;
  reconnectable: boolean;
}

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * Client configuration options
 */
export interface ClientOptions {
  baseUrl?: string;
  apiKey?: string;
  apiKeyId?: string;
  timeout?: number;
  retry?: RetryOptions;
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
}

/**
 * Connection state
 */
export type ConnectionState = "connecting" | "connected" | "disconnecting" | "disconnected" | "reconnecting";

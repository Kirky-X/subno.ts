// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * SecureNotify SDK
 *
 * A TypeScript SDK for the SecureNotify encrypted push notification service.
 */

// Main exports
export { SecureNotifyClient, SecureNotifyClientBuilder } from "./client.js";
export { HttpClient } from "./utils/http.js";
export { withRetry, createRetryableFunction } from "./utils/retry.js";
export type { RetryConfig } from "./utils/retry.js";
export { SseConnection, SseConnectionManager, ConnectionOptions } from "./utils/connection.js";

// Manager exports
export { KeyManager } from "./managers/key.manager.js";
export { ChannelManager } from "./managers/channel.manager.js";
export { PublishManager } from "./managers/publish.manager.js";
export { SubscribeManager } from "./managers/subscribe.manager.js";
export { ApiKeyManager } from "./managers/apikey.manager.js";

// Type exports
export type * from "./types/api.js";

// Error exports
export {
  SecureNotifyError,
  isSecureNotifyError,
  type ErrorCodeType,
} from "./types/errors.js";

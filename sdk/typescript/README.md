# SecureNotify TypeScript SDK

[![npm version](https://img.shields.io/npm/v/securenotify-sdk.svg)](https://www.npmjs.com/package/securenotify-sdk)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

SecureNotify TypeScript SDK for encrypted push notification services. This SDK provides a type-safe interface to interact with the SecureNotify API, supporting Node.js 18+ and modern browsers.

## Features

- **Full API Coverage**: Complete support for all SecureNotify API endpoints
- **Type Safety**: Written in TypeScript with comprehensive type definitions
- **Real-time Updates**: Built-in SSE support with auto-reconnect and heartbeat detection
- **Retry Logic**: Exponential backoff with jitter for robust error handling
- **Manager Pattern**: Clean, organized API with dedicated managers for each resource type

## Installation

```bash
# npm
npm install securenotify-sdk

# yarn
yarn add securenotify-sdk

# pnpm
pnpm add securenotify-sdk
```

## Quick Start

```typescript
import { SecureNotifyClient } from "securenotify-sdk";

// Create a client
const client = SecureNotifyClient.create(
  "https://your-domain.com/api",
  "your-api-key"
);

// Register a public key
const registerResult = await client.keys.register({
  publicKey: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
  algorithm: "RSA-4096",
  expiresIn: 86400, // 24 hours
});

console.log("Channel ID:", registerResult.channelId);
console.log("Public Key ID:", registerResult.publicKeyId);

// Create a channel
const channel = await client.channels.create({
  id: "my-channel",
  name: "My Channel",
  type: "public",
});

// Publish a message
const publishResult = await client.publish.send({
  channel: "my-channel",
  message: "Hello, World!",
  priority: "high",
});

console.log("Message ID:", publishResult.messageId);

// Subscribe to real-time messages
const unsubscribe = await client.connect("my-channel", (message) => {
  console.log("Received:", message.message);
});

// Clean up
await client.close();
```

## API Reference

### Client Configuration

#### Using Builder Pattern

```typescript
import { SecureNotifyClient } from "securenotify-sdk";

const client = SecureNotifyClient.builder()
  .baseUrl("https://your-domain.com/api")
  .apiKey("your-api-key")
  .timeout(30000)
  .retry({
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  })
  .build();
```

#### Using Factory Method

```typescript
const client = SecureNotifyClient.create(
  "https://your-domain.com/api",
  "your-api-key"
);
```

### Key Management

#### Register a Public Key

```typescript
const result = await client.keys.register({
  publicKey: "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  algorithm: "RSA-4096", // Optional: RSA-2048, RSA-4096, ECC-SECP256K1
  expiresIn: 604800, // Optional: seconds until expiry (max 30 days)
  metadata: {
    deviceName: "My Device",
  },
});

console.log(result.channelId); // "enc_3b6bf5d599c844e3"
console.log(result.publicKeyId); // "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

#### Get Key Information

```typescript
const keyInfo = await client.keys.get("enc_channel_id");
console.log(keyInfo.algorithm);
console.log(keyInfo.expiresAt);
```

#### List All Keys

```typescript
const keys = await client.keys.list({
  limit: 10,
  offset: 0,
});
```

#### Revoke a Key (Two-Phase Process)

```typescript
// Phase 1: Initiate revocation
const revokeResult = await client.keys.revoke(
  "enc_channel_id",
  "Key rotation required",
  24 // confirmation hours
);
console.log(revokeResult.revocationId);
console.log(revokeResult.status); // "pending"

// Phase 2: Confirm revocation (after receiving confirmation code)
const confirmResult = await client.keys.confirmRevocation(
  "enc_channel_id",
  "confirmation-code"
);
```

### Channel Management

#### Create a Channel

```typescript
const channel = await client.channels.create({
  id: "my-channel",
  name: "My Channel",
  description: "A description",
  type: "public", // or "encrypted"
  creator: "user-123",
  expiresIn: 86400,
});
```

#### Get a Channel

```typescript
const channel = await client.channels.get("my-channel");
```

#### List Channels

```typescript
const { channels, pagination } = await client.channels.list({
  limit: 20,
  offset: 0,
  type: "public",
});
```

### Message Publishing

#### Send a Message

```typescript
const result = await client.publish.send({
  channel: "my-channel",
  message: "Hello, World!",
  priority: "normal", // critical, high, normal, low, bulk
  sender: "Server",
  cache: true,
  encrypted: false,
});
```

#### Send Priority Messages

```typescript
// Critical priority (100)
await client.publish.sendCritical("my-channel", "URGENT: System alert!");

// High priority (75)
await client.publish.sendHigh("my-channel", "Important notification");

// Normal priority (50)
await client.publish.sendNormal("my-channel", "Regular message");

// Low priority (25)
await client.publish.sendLow("my-channel", "Background update");

// Bulk priority (0)
await client.publish.sendBulk("my-channel", "Newsletter content");
```

#### Get Queue Status

```typescript
const status = await client.publish.getQueueStatus("my-channel", 10);
console.log(status.queueLength);
console.log(status.messages);
```

#### Broadcast to Multiple Channels

```typescript
const results = await client.publish.broadcast(
  ["channel-1", "channel-2", "channel-3"],
  "Hello everyone!",
  { priority: "high" }
);

for (const { channel, result, error } of results) {
  if (error) {
    console.error(`Failed for ${channel}:`, error);
  } else {
    console.log(`Sent to ${channel}:`, result?.messageId);
  }
}
```

### Real-time Subscriptions

#### Subscribe to a Channel

```typescript
const unsubscribe = await client.subscribe.subscribe("my-channel", (event) => {
  console.log("Message:", event.message);
  console.log("Sender:", event.sender);
  console.log("Priority:", event.priority);
});

// Handle connection events
client.subscribe.onConnected("my-channel", (event) => {
  console.log("Connected to channel:", event.channel);
});

// Handle errors
client.subscribe.onError("my-channel", (error) => {
  console.error("Subscription error:", error);
});

// Unsubscribe when done
await unsubscribe();
```

#### Subscribe Using Client.connect()

```typescript
// Shorthand for subscribing
const unsubscribe = await client.connect("my-channel", (message) => {
  console.log("Received:", message.message);
});
```

#### Unsubscribe

```typescript
// Unsubscribe from a specific channel
await client.subscribe.unsubscribe("my-channel");

// Unsubscribe from all channels
await client.subscribe.unsubscribeAll();
```

#### Check Subscription Status

```typescript
const isSubscribed = client.subscribe.isSubscribed("my-channel");
const subscriptions = client.subscribe.getSubscribedChannels();
const count = client.subscribe.getSubscriptionCount();
```

### API Key Management

#### Create an API Key

```typescript
const result = await client.apiKeys.create({
  name: "My API Key",
  userId: "user-123",
  permissions: ["publish", "subscribe", "keys"],
  expiresIn: 2592000, // 30 days
});

console.log(result.id);
console.log(result.keyPrefix); // First 8 characters of the key
// IMPORTANT: Save the full key (returned only once)
```

#### List API Keys

```typescript
const { keys, pagination } = await client.apiKeys.list({
  limit: 10,
  offset: 0,
  userId: "user-123",
});
```

#### Revoke an API Key

```typescript
await client.apiKeys.revoke("api-key-id");
```

## Error Handling

### Using try-catch

```typescript
import { SecureNotifyError } from "securenotify-sdk";

try {
  await client.publish.send({
    channel: "my-channel",
    message: "Hello!",
  });
} catch (error) {
  if (error instanceof SecureNotifyError) {
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Status:", error.status);
    console.error("Retryable:", error.retryable);

    if (error.code === "RATE_LIMIT_EXCEEDED") {
      // Handle rate limiting
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description | Retryable |
|------|-------------|-------------|-----------|
| `VALIDATION_ERROR` | 400 | Request validation failed | No |
| `AUTH_REQUIRED` | 401 | API key required | No |
| `AUTH_FAILED` | 401 | Invalid API key | No |
| `FORBIDDEN` | 403 | Permission denied | No |
| `NOT_FOUND` | 404 | Resource not found | No |
| `CHANNEL_EXISTS` | 409 | Channel already exists | No |
| `KEY_EXPIRED` | 410 | Key has expired | No |
| `MESSAGE_TOO_LARGE` | 413 | Message exceeds size limit | No |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Yes |
| `INTERNAL_ERROR` | 500 | Server error | Yes |
| `BAD_GATEWAY` | 502 | Bad gateway | Yes |
| `SERVICE_UNAVAILABLE` | 503 | Service unavailable | Yes |
| `GATEWAY_TIMEOUT` | 504 | Gateway timeout | Yes |

### Creating Custom Errors

```typescript
throw SecureNotifyError.validation("channel is required");
throw SecureNotifyError.authFailed("Invalid API key");
throw SecureNotifyError.rateLimitExceeded("Too many requests");
```

## Retry Mechanism

The SDK automatically retries failed requests with exponential backoff:

```typescript
const client = SecureNotifyClient.builder()
  .retry({
    maxRetries: 3,           // Maximum retry attempts
    initialDelay: 1000,      // Initial delay in ms
    maxDelay: 30000,         // Maximum delay in ms
    backoffMultiplier: 2,    // Exponential multiplier
    jitter: true,            // Add random jitter
  })
  .build();
```

Retry logic:
- Non-retryable errors (4xx) are thrown immediately
- Retryable errors (5xx, network errors) are retried with exponential backoff
- Jitter is added to prevent thundering herd on retries

## SSE Connection Management

The SDK handles SSE connections with:

- **Auto-reconnect**: Automatically reconnects on connection loss
- **Heartbeat detection**: Monitors for heartbeat every 30 seconds
- **Exponential backoff**: Increases reconnect delay on repeated failures
- **Connection state tracking**: Track connection state and subscriptions

```typescript
const client = new SecureNotifyClient({
  baseUrl: "https://your-domain.com/api",
});

// Subscribe with custom connection options
const connection = client.subscribe.subscribe("my-channel", (event) => {
  console.log(event.message);
});

// Check connection state
console.log(connection.isConnected());

// Disconnect when done
await connection.disconnect();
```

## Browser Usage

The SDK works in browsers with some considerations:

```typescript
// Browser-compatible import
import { SecureNotifyClient } from "securenotify-sdk";

// Create client
const client = new SecureNotifyClient({
  baseUrl: "https://your-domain.com/api",
  apiKey: "your-browser-api-key",
});

// SSE connections work in browsers (uses native EventSource)
// Note: Some server-side features (cron endpoints) are not available
```

## Node.js Usage

Full feature support in Node.js:

```typescript
import { SecureNotifyClient } from "securenotify-sdk";

const client = new SecureNotifyClient({
  baseUrl: process.env.SECURENOTIFY_API_URL,
  apiKey: process.env.SECURENOTIFY_API_KEY,
  timeout: 30000,
});

// All features supported
await client.keys.register({ ... });
await client.publish.send({ ... });
await client.subscribe.subscribe("channel", (msg) => { ... });
```

## Type Definitions

The SDK includes full TypeScript type definitions:

```typescript
import type {
  RegisterPublicKeyRequest,
  ChannelCreateOptions,
  PublishMessageOptions,
  MessagePriority,
  ApiKeyPermission,
} from "securenotify-sdk";
```

## Contributing

See [CONTRIBUTING.md](https://github.com/your-org/subno.ts/blob/main/docs/CONTRIBUTING.md) for contribution guidelines.

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

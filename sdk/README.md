# SecureNotify SDK

Official multi-language SDKs for SecureNotify API.

## Overview

SecureNotify is an encrypted push notification service. These SDKs provide easy integration with the SecureNotify API for developers using different programming languages.

## SDK Languages

| Language | Location | Status | Package Manager |
|----------|----------|--------|-----------------|
| **TypeScript** | [`sdk/typescript/`](typescript/) | ✅ Stable | [npm](https://npmjs.com) |
| **Python** | [`sdk/python/`](python/) | ✅ Stable | [PyPI](https://pypi.org) |
| **Rust** | [`sdk/rust/`](rust/) | ✅ Stable | [crates.io](https://crates.io) |
| **Java** | [`sdk/java/`](java/) | ✅ Stable | [Maven](https://mvnrepository.com) |
| **C/C++** | [`sdk/c/`](c/) | ✅ Stable | Pre-built binaries |

## Features

All SDKs provide the following functionality:

### Key Management
- Register public keys with algorithm selection (RSA-2048, RSA-4096, ECC-SECP256K1)
- Query key information and status
- List all keys for a user
- Revoke keys with two-phase confirmation

### Channel Management
- Create public, encrypted, or temporary channels
- Query channel information
- List available channels
- Delete channels

### Message Publishing
- Publish messages to channels
- Priority levels (CRITICAL, HIGH, NORMAL, LOW, BULK)
- End-to-end encryption support
- Message queue status

### Real-time Subscription
- Server-Sent Events (SSE) for real-time updates
- Automatic reconnection with exponential backoff
- Heartbeat detection
- Multiple channel subscriptions

### API Key Management
- Create API keys with custom permissions
- Query API key information
- List all API keys
- Revoke API keys

## Installation

### TypeScript

```bash
npm install securenotify-sdk
# or
yarn add securenotify-sdk
# or
pnpm add securenotify-sdk
```

```typescript
import { SecureNotifyClient } from 'securenotify-sdk';

const client = new SecureNotifyClient({
  baseUrl: 'https://api.securenotify.dev',
  apiKey: 'your-api-key'
});
```

### Python

```bash
pip install securenotify-sdk
```

```python
from securenotify import SecureNotifyClient

client = SecureNotifyClient(
    base_url="https://api.securenotify.dev",
    api_key="your-api-key"
)
await client.keys.register(public_key, "RSA-4096")
```

### Rust

```toml
[dependencies]
securenotify-sdk = "0.1.0"
```

```rust
use securenotify_sdk::SecureNotifyClient;

let client = SecureNotifyClient::builder()
    .base_url("https://api.securenotify.dev")
    .api_key("your-api-key")
    .build()
    .await?;
```

### Java

```xml
<dependency>
    <groupId>dev.securenotify</groupId>
    <artifactId>securenotify-sdk</artifactId>
    <version>0.1.0</version>
</dependency>
```

```java
import dev.securenotify.SecureNotifyClient;

try (SecureNotifyClient client = SecureNotifyClient.create("api-key")) {
    client.keys().register(publicKey, "RSA-4096");
}
```

### C/C++

```bash
# Download pre-built library
wget https://github.com/Kirky-X/subno.ts/releases/download/v0.1.0/libsecurenotify.so

# Compile
gcc -o myapp myapp.c -L. -lsecurenotify -lcurl
```

```c
#include <securenotify.h>

securenotify_client_t* client = securenotify_client_new(
    "https://api.securenotify.dev",
    "your-api-key"
);
```

## Quick Start

### 1. Register a Public Key

**TypeScript:**
```typescript
const publicKey = await client.keys.register(
  `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`,
  "RSA-4096",
  604800 // expires in 7 days
);
```

**Python:**
```python
public_key = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""

await client.keys.register(public_key, "RSA-4096", expires_in=604800)
```

**Rust:**
```rust
let public_key = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----";

client.keys().register(public_key, "RSA-4096", Some(604800)).await?;
```

**Java:**
```java
PublicKeyInfo key = client.keys().register(
    "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
    "RSA-4096",
    604800
);
```

**C:**
```c
securenotify_public_key_t* key = securenotify_keys_register(
    client,
    "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----",
    "RSA-4096",
    604800,
    error
);
```

### 2. Publish a Message

**TypeScript:**
```typescript
const result = await client.publish.send({
  channel: 'my-channel',
  message: 'Hello, World!',
  priority: 'HIGH'
});
```

**Python:**
```python
result = await client.publish.send(
    channel="my-channel",
    message="Hello, World!",
    priority="HIGH"
)
```

**Rust:**
```rust
let result = client.publish().send(
    "my-channel",
    "Hello, World!",
    Some(PublishOptions {
        priority: Some("HIGH".to_string()),
        ..Default::default()
    })
).await?;
```

**Java:**
```java
MessageResult result = client.publish().send(
    "my-channel",
    "Hello, World!",
    MessagePriority.HIGH
);
```

**C:**
```c
securenotify_message_result_t* result = securenotify_publish_send(
    client,
    "my-channel",
    "Hello, World!",
    "HIGH",
    false,
    error
);
```

### 3. Subscribe to Real-time Messages

**TypeScript:**
```typescript
await client.subscribe.subscribe('my-channel', (event) => {
  console.log('Received:', event.data.message);
});
```

**Python:**
```python
async with client.subscribe.subscribe("my-channel") as subscription:
    async for event in subscription:
        print(f"Received: {event.message}")
```

**Rust:**
```rust
let mut subscription = client.subscribe().subscribe("my-channel").await?;
while let Some(event) = subscription.next().await {
    println!("Received: {}", event.message);
}
```

**Java:**
```java
client.connect("my-channel", event -> {
    System.out.println("Received: " + event.getMessage());
});
```

**C:**
```c
securenotify_subscription_t* subscription = securenotify_subscribe(
    client,
    "my-channel",
    on_message_callback,
    on_connected_callback,
    on_error_callback,
    user_data,
    error
);
```

## API Reference

### Client Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `baseUrl` | string | Yes | API base URL |
| `apiKey` | string | Yes | API key for authentication |

### Message Priority Levels

| Priority | Value | Description |
|----------|-------|-------------|
| `CRITICAL` | 100 | Highest priority, immediate delivery |
| `HIGH` | 75 | High priority messages |
| `NORMAL` | 50 | Default priority |
| `LOW` | 25 | Low priority messages |
| `BULK` | 0 | Bulk messages, lowest priority |

### Error Handling

All SDKs throw exceptions or return errors for failed operations:

| Error Code | HTTP Status | Retryable | Description |
|------------|-------------|-----------|-------------|
| `VALIDATION_ERROR` | 400 | No | Request validation failed |
| `AUTH_REQUIRED` | 401 | No | API key required |
| `AUTH_FAILED` | 401 | No | Invalid API key |
| `FORBIDDEN` | 403 | No | Permission denied |
| `NOT_FOUND` | 404 | No | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Yes | Too many requests |
| `INTERNAL_ERROR` | 500 | Yes | Server internal error |
| `NETWORK_ERROR` | - | Yes | Network connectivity issue |

## Connection Management

All SDKs provide automatic reconnection with exponential backoff:

- **Initial delay**: 1 second
- **Maximum delay**: 30 seconds
- **Backoff multiplier**: 2x
- **Jitter**: Random 0-1s added to delay
- **Maximum retries**: 3

### Heartbeat Detection

SSE connections include heartbeat detection:
- **Heartbeat interval**: 30 seconds
- **Connection timeout**: 60 seconds
- **Automatic reconnection**: On heartbeat timeout

## Thread Safety

| SDK | Thread Safety |
|-----|---------------|
| TypeScript | Thread-safe (single-threaded by nature) |
| Python | Thread-safe for async operations |
| Rust | Thread-safe (Send + Sync) |
| Java | Thread-safe |
| C | Not thread-safe (user must synchronize) |

## Contributing

See the [main contributing guide](../../docs/CONTRIBUTING.md) for details.

### Adding a New SDK

1. Create a new directory under `sdk/<language>/`
2. Implement the core functionality:
   - HTTP client with retry mechanism
   - SSE connection management
   - API managers (Key, Channel, Publish, Subscribe, ApiKey)
3. Add comprehensive tests
4. Write documentation with examples
5. Configure CI/CD pipeline
6. Update this README with installation instructions

## License

Apache License 2.0

## Support

- **GitHub Issues**: https://github.com/Kirky-X/subno.ts/issues
- **Documentation**: [API Reference](../../docs/API_REFERENCE.md)
- **User Guide**: [User Guide](../../docs/USER_GUIDE.md)

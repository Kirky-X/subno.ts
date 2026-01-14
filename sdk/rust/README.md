# SecureNotify Rust SDK

[![Crates.io](https://img.shields.io/crates/v/securenotify-sdk)](https://crates.io/crates/securenotify-sdk)
[![Documentation](https://docs.rs/securenotify-sdk/badge.svg)](https://docs.rs/securenotify-sdk)
[![License](https://img.shields.io/crates/l/securenotify-sdk)](Apache-2.0)

SecureNotify Rust SDK with C FFI support via UniFFI for native interop.

## Features

- **Full API Coverage**: Key management, channel management, message publishing, and subscriptions
- **Async Runtime**: Built on tokio for high-performance async operations
- **Retry Logic**: Exponential backoff with jitter for resilient network operations
- **SSE Support**: Real-time message streaming via Server-Sent Events
- **C FFI**: Export to C/C++ using UniFFI for cross-language support

## Installation

### Cargo

Add to your `Cargo.toml`:

```toml
[dependencies]
securenotify-sdk = "0.1"
```

### From Source

```bash
git clone https://github.com/securenotify/sdk-rust.git
cd sdk-rust
cargo build --release
```

## Quick Start

```rust
use securenotify_sdk::{SecureNotifyClient, MessagePriority};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create client with builder pattern
    let client = SecureNotifyClient::builder()
        .base_url("https://api.securenotify.dev")
        .api_key("your-api-key")
        .timeout(std::time::Duration::from_secs(30))
        .max_retries(3)
        .build()?;

    // Register a public key
    let response = client.register_public_key(
        "my-channel",
        "-----BEGIN PUBLIC KEY-----...",
        "RSA-4096",
        None,
    ).await?;

    println!("Key registered for channel: {}", response.channel_id);
    Ok(())
}
```

## API Usage

### Key Management

```rust
// Register a public key
let response = client
    .register_public_key("channel-id", public_key, "RSA-4096", None)
    .await?;

// Get public key info
let key_info = client.get_public_key("channel-id").await?;

// List all public keys
let keys = client.list_public_keys(Some(100), Some(0)).await?;

// Revoke a public key
client.revoke_public_key("channel-id").await?;
```

### Channel Management

```rust
// Create a channel
let channel = client
    .create_channel("my-channel", "encrypted", Some("Description"), None)
    .await?;

// Get channel info
let info = client.get_channel("channel-id").await?;

// List channels
let channels = client.list_channels(Some("encrypted"), None, None).await?;

// Delete a channel
client.delete_channel("channel-id").await?;
```

### Message Publishing

```rust
// Publish a message
let response = client
    .publish_message(
        "channel-id",
        "Hello, World!",
        Some(MessagePriority::High),
        Some("sender-id"),
        Some(true),
        Some(false),
        None,
    )
    .await?;

// Get queue status
let status = client.get_queue_status("channel-id").await?;
```

### Real-time Subscriptions

```rust
// Subscribe to a channel
let mut receiver = client.subscribe("channel-id").await?;

// Process messages
while let Some(message) = receiver.recv().await {
    match message {
        SseMessage::Event(event) => {
            println!("Received: {}", event.data);
        }
        SseMessage::Heartbeat => {
            println!("Heartbeat received");
        }
        SseMessage::Error(e) => {
            eprintln!("Error: {:?}", e);
        }
        _ => {}
    }
}
```

### API Key Management

```rust
// Create an API key
let key_response = client
    .create_api_key("my-key", None, Some(vec!["read", "write"]), None)
    .await?;

println!("API Key: {}", key_response.api_key);

// List API keys
let keys = client.list_api_keys(None, None).await?;

// Revoke an API key
client.revoke_api_key("key-id").await?;
```

## C FFI Usage

### Building the C Library

```bash
cargo build --release --features native-tls
```

This produces:
- `target/release/libsecurenotify_sdk.rlib` (static library)
- `target/release/libsecurenotify_sdk.so` (dynamic library on Linux)
- `target/release/libsecurenotify_sdk.dylib` (dynamic library on macOS)
- `target/release/securenotify_sdk.dll` (dynamic library on Windows)

### C Integration Example

```c
#include "securenotify.h"
#include <stdio.h>
#include <stdlib.h>

int main() {
    // Create client
    SecureNotifyClient* client = create_client(
        "https://api.securenotify.dev",
        "your-api-key"
    );

    if (client == NULL) {
        fprintf(stderr, "Failed to create client\n");
        return 1;
    }

    // Publish a message
    SecureNotifyError* error = NULL;
    MessagePublishResponse* response = secure_notify_client_publish_message(
        client,
        "channel-id",
        "Hello from C!",
        PRIORITY_NORMAL,
        NULL,   // sender
        true,   // cache
        false,  // encrypted
        NULL,   // signature
        &error
    );

    if (response != NULL) {
        printf("Message published: %s\n", response->message_id);
        message_publish_response_free(response);
    } else {
        fprintf(stderr, "Error: %s\n", secure_notify_error_message(error));
        secure_notify_error_free(error);
    }

    secure_notify_client_free(client);
    return 0;
}
```

### Compilation

```bash
clang -o example example.c -I./include -L./target/release -lsecurenotify_sdk -lpthread
```

## Configuration

### ClientBuilder Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `base_url` | String | `https://api.securenotify.dev` | API base URL |
| `api_key` | String | - | API authentication key |
| `timeout` | Duration | 30s | Request timeout |
| `max_retries` | u32 | 3 | Maximum retry attempts |
| `initial_delay_ms` | u64 | 1000 | Initial retry delay (ms) |
| `max_delay_ms` | u64 | 30000 | Maximum retry delay (ms) |
| `backoff_multiplier` | f64 | 2.0 | Exponential backoff factor |

## Error Handling

```rust
match client.register_public_key("channel", key, "RSA-4096", None).await {
    Ok(response) => println!("Success: {}", response.channel_id),
    Err(SecureNotifyError::ApiError { code, message, status }) => {
        eprintln!("API Error {} ({}): {}", code, status, message);
    }
    Err(SecureNotifyError::NetworkError(msg)) => {
        eprintln!("Network Error: {}", msg);
    }
    Err(SecureNotifyError::TimeoutError(msg)) => {
        eprintln!("Timeout: {}", msg);
    }
    Err(e) => {
        eprintln!("Other Error: {}", e);
    }
}
```

## TLS Configuration

The SDK supports both native-tls and rustls-tls backends:

```toml
# Default (native-tls)
[dependencies]
securenotify-sdk = "0.1"

# Or use rustls-tls
[dependencies.securenotify-sdk]
version = "0.1"
features = ["rustls-tls"]
```

## Testing

```bash
# Run all tests
cargo test

# Run tests with coverage
cargo tarpaulin --out Html

# Run specific test
cargo test test_publish_message
```

## Benchmark

```bash
cargo bench
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and lints
5. Submit a pull request

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

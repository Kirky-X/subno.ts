# SecureNotify Java SDK

Official Java SDK for [SecureNotify](https://github.com/securenotify/subno.ts) - Encrypted push notification service.

## Features

- **Secure Communication** - End-to-end encrypted message delivery
- **Real-time Subscriptions** - Server-Sent Events (SSE) for instant notifications
- **Key Management** - Register, retrieve, and revoke public keys
- **Channel Management** - Create and manage notification channels
- **API Key Management** - Create and manage API keys with granular permissions
- **Retry Logic** - Exponential backoff with jitter for reliable communication
- **Full Async Support** - Non-blocking HTTP client and SSE connections

## Requirements

- Java 11 or higher
- Maven 3.6+

## Installation

### Maven

Add the following dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>dev.securenotify</groupId>
    <artifactId>securenotify-sdk</artifactId>
    <version>0.1.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'dev.securenotify:securenotify-sdk:0.1.0'
```

## Quick Start

### Basic Usage

```java
import dev.securenotify.SecureNotifyClient;
import dev.securenotify.managers.*;

public class Example {
    public static void main(String[] args) {
        // Create client with API key
        try (SecureNotifyClient client = SecureNotifyClient.create(
                "https://api.securenotify.dev", 
                "your-api-key"
        )) {
            
            // Register a public key
            PublicKeyInfo key = client.keys().register(
                "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
                "RSA-4096"
            );
            System.out.println("Key registered: " + key.getId());
            
            // Create a channel
            ChannelInfo channel = client.channels().createEncrypted();
            System.out.println("Channel created: " + channel.getId());
            
            // Publish a message
            MessageInfo.MessagePublishResponse response = client.publish().send(
                channel.getId(), 
                "Hello, SecureNotify!"
            );
            System.out.println("Message sent: " + response.getMessageId());
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### Real-time Subscriptions

```java
import dev.securenotify.SecureNotifyClient;
import securenotify.types.SseEvent;

public class SubscriptionExample {
    public static void main(String[] args) {
        try (SecureNotifyClient client = SecureNotifyClient.create("your-api-key")) {
            
            // Subscribe to a channel
            ConnectionManager.Subscription subscription = client.connect(
                "channel-id",
                message -> {
                    System.out.println("Received: " + message.getMessage());
                    System.out.println("From: " + message.getSender());
                    System.out.println("Priority: " + message.getPriority());
                },
                error -> {
                    System.err.println("Error: " + error.getMessage());
                }
            );
            
            System.out.println("Subscribed to channel. Press Enter to exit.");
            System.console().readLine();
            
            // Disconnect
            client.disconnect();
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### Using the Builder Pattern

```java
SecureNotifyClient client = SecureNotifyClient.builder()
    .baseUrl("https://api.securenotify.dev")
    .apiKey("your-api-key")
    .apiKeyId("optional-key-id")
    .timeout(60000)
    .build();

try {
    // Use the client...
} finally {
    client.close();
}
```

## API Reference

### Client Creation

| Method | Description |
|--------|-------------|
| `SecureNotifyClient.create(apiKey)` | Create client with default URL |
| `SecureNotifyClient.create(baseUrl, apiKey)` | Create client with custom URL |
| `SecureNotifyClient.builder()` | Create client with builder pattern |

### Managers

| Manager | Description |
|---------|-------------|
| `client.keys()` | Public key management |
| `client.channels()` | Channel management |
| `client.publish()` | Message publishing |
| `client.subscribe()` | Real-time subscriptions |
| `client.apiKeys()` | API key management |

### Key Operations

```java
// Register a public key
PublicKeyInfo key = client.keys().register(publicKey, algorithm, expiresIn, metadata);

// Get key by ID
PublicKeyInfo key = client.keys().get(keyId);

// Revoke a key
client.keys().revoke(keyId, reason);
```

### Channel Operations

```java
// Create encrypted channel
ChannelInfo channel = client.channels().createEncrypted();

// Create public channel
ChannelInfo channel = client.channels().createPublic();

// Create channel with options
ChannelInfo channel = client.channels().create(id, name, description, type, creator, expiresIn, metadata);

// List channels
ChannelManager.ChannelListResponse response = client.channels().list(50, 0);

// Delete channel
client.channels().delete(channelId);
```

### Message Operations

```java
// Send message
MessageInfo.MessagePublishResponse response = client.publish().send(
    channelId, message, priority, sender, cache, encrypted, autoCreate, signature
);

// Send critical message
client.publish().sendCritical(channelId, "Urgent!");

// Get queue status
MessageInfo.QueueStatusResponse status = client.publish().getQueueStatus(channelId);
```

### API Key Operations

```java
// Create API key
ApiKeyInfo.ApiKeyCreateResponse key = client.apiKeys().create(
    name, userId, permissions, expiresIn
);

// List API keys
ApiKeyManager.ApiKeyListResponse response = client.apiKeys().list(50, 0);

// Revoke API key
client.apiKeys().revoke(keyId, reason);
```

## Error Handling

The SDK provides specific exception types:

```java
import securenotify.exceptions.*;

try {
    // SDK operations
} catch (SecureNotifyException e) {
    System.err.println("SDK Error: " + e.getMessage());
    System.err.println("Error Code: " + e.getErrorCode());
} catch (ApiException e) {
    System.err.println("API Error: " + e.getMessage());
    System.err.println("Status: " + e.getStatusCode());
    if (e.isRetryable()) {
        System.err.println("This error is retryable");
    }
} catch (NetworkException e) {
    System.err.println("Network Error: " + e.getMessage());
    if (e.isRetryable()) {
        System.err.println("This error is retryable");
    }
} catch (AuthenticationException e) {
    System.err.println("Authentication Failed: " + e.getMessage());
} catch (RateLimitException e) {
    System.err.println("Rate Limited. Retry after: " + e.getRetryAfterSeconds() + " seconds");
}
```

## Configuration

### Default Configuration

| Setting | Default Value |
|---------|---------------|
| Base URL | `https://api.securenotify.dev` |
| Timeout | 30,000 ms |
| Max Retries | 3 |
| Initial Delay | 1,000 ms |
| Max Delay | 30,000 ms |
| Backoff Multiplier | 2.0 |
| Jitter | Enabled |

### Custom Retry Configuration

```java
RetryHandler customRetry = new RetryHandler.Builder()
    .maxRetries(5)
    .initialDelayMs(500)
    .maxDelayMs(10000)
    .backoffMultiplier(1.5)
    .jitter(true)
    .build();

SecureNotifyClient client = new SecureNotifyClient(
    "https://api.securenotify.dev",
    "your-api-key"
);
```

## Thread Safety

The `SecureNotifyClient` is thread-safe. You can share a single instance across multiple threads. However, each manager's operations should be used within the context of the client's lifecycle.

## Connection Management

For real-time subscriptions, use try-with-resources or manually call `close()`:

```java
try (SecureNotifyClient client = SecureNotifyClient.create("api-key")) {
    // Subscribe
    ConnectionManager.Subscription sub = client.connect("channel", handler);
    
    // ... your code ...
    
} // Automatically closed
```

## Logging

The SDK uses SLF4J for logging. Add a logging implementation to your project:

```xml
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-simple</artifactId>
    <version>2.0.9</version>
</dependency>
```

## Building

```bash
# Build the SDK
mvn clean package

# Run tests
mvn test

# Generate javadoc
mvn javadoc:javadoc

# Install to local Maven repository
mvn install
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

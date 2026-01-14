// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify;

import org.junit.jupiter.api.Test;
import securenotify.managers.ApiKeyManager;
import securenotify.managers.ChannelManager;
import securenotify.managers.KeyManager;
import securenotify.managers.PublishManager;
import securenotify.managers.SubscribeManager;
import securenotify.types.SseEvent;
import securenotify.utils.ConnectionManager;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for SecureNotifyClient.
 */
class SecureNotifyClientTest {

    @Test
    void testCreateWithApiKey() {
        // Act
        SecureNotifyClient client = SecureNotifyClient.create("test-api-key");

        // Assert
        assertNotNull(client);
        assertTrue(client.hasApiKey());
        assertFalse(client.isClosed());
        assertFalse(client.isConnected());

        // Cleanup
        client.close();
    }

    @Test
    void testCreateWithBaseUrl() {
        // Act
        SecureNotifyClient client = SecureNotifyClient.create("https://api.example.com", "test-key");

        // Assert
        assertNotNull(client);
        assertEquals("https://api.example.com", client.getBaseUrl());
        assertTrue(client.hasApiKey());

        // Cleanup
        client.close();
    }

    @Test
    void testBuilder() {
        // Act
        SecureNotifyClient client = SecureNotifyClient.builder()
                .baseUrl("https://api.example.com")
                .apiKey("test-key")
                .apiKeyId("key-id")
                .timeout(60000)
                .build();

        // Assert
        assertNotNull(client);
        assertEquals("https://api.example.com", client.getBaseUrl());

        // Cleanup
        client.close();
    }

    @Test
    void testBuilderWithMissingApiKey() {
        // Act & Assert
        assertThrows(IllegalArgumentException.class, () ->
                SecureNotifyClient.builder()
                        .baseUrl("https://api.example.com")
                        .build()
        );
    }

    @Test
    void testManagersAccess() throws Exception {
        // Arrange
        SecureNotifyClient client = SecureNotifyClient.create("test-key");

        // Act & Assert
        assertNotNull(client.keys());
        assertNotNull(client.channels());
        assertNotNull(client.publish());
        assertNotNull(client.subscribe());
        assertNotNull(client.apiKeys());

        assertTrue(client.keys() instanceof KeyManager);
        assertTrue(client.channels() instanceof ChannelManager);
        assertTrue(client.publish() instanceof PublishManager);
        assertTrue(client.subscribe() instanceof SubscribeManager);
        assertTrue(client.apiKeys() instanceof ApiKeyManager);

        // Cleanup
        client.close();
    }

    @Test
    void testCloseIdempotent() {
        // Arrange
        SecureNotifyClient client = SecureNotifyClient.create("test-key");

        // Act
        client.close();
        client.close();

        // Assert
        assertTrue(client.isClosed());
    }

    @Test
    void testGetSubscriptionCount() throws Exception {
        // Arrange
        SecureNotifyClient client = SecureNotifyClient.create("test-key");

        // Act
        int count = client.getSubscriptionCount();

        // Assert
        assertEquals(0, count);

        // Cleanup
        client.close();
    }

    @Test
    void testConnectReturnsSubscription() throws Exception {
        // Arrange
        SecureNotifyClient client = SecureNotifyClient.create("test-key");
        AtomicBoolean messageReceived = new AtomicBoolean(false);
        AtomicReference<SseEvent.SseMessageEvent> receivedEvent = new AtomicReference<>();

        // Note: This tests the subscription flow without an actual server
        // The subscription will fail to connect, but we can verify the subscription object
        ConnectionManager.Subscription subscription = client.connect("test-channel", event -> {
            messageReceived.set(true);
            receivedEvent.set(event);
        });

        // Assert - subscription object is created even if connection fails
        assertNotNull(subscription);
        assertEquals("test-channel", subscription.getChannelId());

        // Cleanup
        client.close();
    }

    @Test
    void testDisconnect() throws Exception {
        // Arrange
        SecureNotifyClient client = SecureNotifyClient.create("test-key");

        // Act
        client.disconnect();

        // Assert - no exceptions means success
        assertFalse(client.isConnected());

        // Cleanup
        client.close();
    }

    @Test
    void testCloseCleansUpResources() throws Exception {
        // Arrange
        SecureNotifyClient client = SecureNotifyClient.create("test-key");

        // Act
        client.close();

        // Assert
        assertTrue(client.isClosed());

        // Verify managers throw on access after close
        assertThrows(IllegalStateException.class, () -> client.keys());
        assertThrows(IllegalStateException.class, () -> client.channels());
        assertThrows(IllegalStateException.class, () -> client.publish());
    }

    @Test
    void testDefaultBaseUrl() {
        // Act
        SecureNotifyClient client = new SecureNotifyClient("test-key");

        // Assert
        assertEquals("https://api.securenotify.dev", client.getBaseUrl());

        // Cleanup
        client.close();
    }

    @Test
    void testTryWithResources() {
        // Act & Assert
        try (SecureNotifyClient client = SecureNotifyClient.create("test-key")) {
            assertNotNull(client);
            assertFalse(client.isClosed());
        }

        // After try block, client should be closed
        SecureNotifyClient client = SecureNotifyClient.create("test-key");
        assertFalse(client.isClosed());
        client.close();
        assertTrue(client.isClosed());
    }
}

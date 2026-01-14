// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import securenotify.managers.ApiKeyManager;
import securenotify.managers.ChannelManager;
import securenotify.managers.KeyManager;
import securenotify.managers.PublishManager;
import securenotify.managers.SubscribeManager;
import securenotify.types.SseEvent;
import securenotify.utils.ConnectionManager;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.function.Consumer;

/**
 * Main client for SecureNotify API.
 * Provides access to all managers and handles connection lifecycle.
 */
public class SecureNotifyClient implements AutoCloseable {

    private static final Logger logger = LoggerFactory.getLogger(SecureNotifyClient.class);
    private static final String DEFAULT_BASE_URL = "https://api.securenotify.dev";

    private final String baseUrl;
    private final HttpClient httpClient;
    private final ConnectionManager connectionManager;
    private final RetryHandler retryHandler;

    private final KeyManager keys;
    private final ChannelManager channels;
    private final PublishManager publish;
    private final SubscribeManager subscribe;
    private final ApiKeyManager apiKeys;

    private boolean closed = false;

    /**
     * Create a client with minimal configuration.
     *
     * @param apiKey The API key for authentication
     */
    public SecureNotifyClient(String apiKey) {
        this(DEFAULT_BASE_URL, apiKey);
    }

    /**
     * Create a client with base URL and API key.
     *
     * @param baseUrl The base URL of the API
     * @param apiKey  The API key for authentication
     */
    public SecureNotifyClient(String baseUrl, String apiKey) {
        this(baseUrl, apiKey, null, 30000);
    }

    /**
     * Create a client with full configuration.
     *
     * @param baseUrl  The base URL of the API
     * @param apiKey   The API key for authentication
     * @param apiKeyId Optional API key ID header
     * @param timeout  Request timeout in milliseconds
     */
    public SecureNotifyClient(String baseUrl, String apiKey, String apiKeyId, int timeout) {
        this.baseUrl = baseUrl != null && !baseUrl.isEmpty() ? baseUrl : DEFAULT_BASE_URL;
        this.httpClient = new HttpClient(this.baseUrl, apiKey, apiKeyId, timeout);
        this.connectionManager = new ConnectionManager(this.baseUrl, apiKey, apiKeyId, timeout);
        this.retryHandler = RetryHandler.DEFAULT;

        // Initialize managers
        this.keys = new KeyManager(httpClient, retryHandler);
        this.channels = new ChannelManager(httpClient, retryHandler);
        this.publish = new PublishManager(httpClient, retryHandler);
        this.subscribe = new SubscribeManager(this.baseUrl, apiKey, apiKeyId, timeout);
        this.apiKeys = new ApiKeyManager(httpClient, retryHandler);

        logger.info("SecureNotifyClient initialized with baseUrl: {}", this.baseUrl);
    }

    /**
     * Get the keys manager.
     *
     * @return The keys manager
     */
    public KeyManager keys() {
        checkClosed();
        return keys;
    }

    /**
     * Get the channels manager.
     *
     * @return The channels manager
     */
    public ChannelManager channels() {
        checkClosed();
        return channels;
    }

    /**
     * Get the publish manager.
     *
     * @return The publish manager
     */
    public PublishManager publish() {
        checkClosed();
        return publish;
    }

    /**
     * Get the subscribe manager.
     *
     * @return The subscribe manager
     */
    public SubscribeManager subscribe() {
        checkClosed();
        return subscribe;
    }

    /**
     * Get the API keys manager.
     *
     * @return The API keys manager
     */
    public ApiKeyManager apiKeys() {
        checkClosed();
        return apiKeys;
    }

    /**
     * Subscribe to a channel for real-time messages.
     *
     * @param channelId The channel ID to subscribe to
     * @param handler   The message handler callback
     * @return A subscription object for managing the subscription
     */
    public ConnectionManager.Subscription connect(String channelId,
                                                   Consumer<SseEvent.SseMessageEvent> handler) {
        checkClosed();
        return subscribe().subscribe(channelId, handler);
    }

    /**
     * Subscribe to a channel with error handling.
     *
     * @param channelId    The channel ID to subscribe to
     * @param handler      The message handler callback
     * @param errorHandler The error handler callback
     * @return A subscription object for managing the subscription
     */
    public ConnectionManager.Subscription connect(String channelId,
                                                   Consumer<SseEvent.SseMessageEvent> handler,
                                                   Consumer<SseEvent.SseErrorEvent> errorHandler) {
        checkClosed();
        return subscribe().subscribe(channelId, handler, errorHandler);
    }

    /**
     * Disconnect from all channels.
     */
    public void disconnect() {
        checkClosed();
        subscribe().unsubscribeAll();
    }

    /**
     * Get the base URL.
     *
     * @return The base URL
     */
    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Check if API key is configured.
     *
     * @return true if API key is set
     */
    public boolean hasApiKey() {
        return httpClient.hasApiKey();
    }

    /**
     * Check if connected to any channel.
     *
     * @return true if connected
     */
    public boolean isConnected() {
        return subscribe().isConnected();
    }

    /**
     * Check if the client is closed.
     *
     * @return true if closed
     */
    public boolean isClosed() {
        return closed;
    }

    /**
     * Get the number of subscribed channels.
     *
     * @return The count
     */
    public int getSubscriptionCount() {
        return subscribe().getSubscriptionCount();
    }

    private void checkClosed() {
        if (closed) {
            throw new IllegalStateException("SecureNotifyClient is closed");
        }
    }

    /**
     * Close the client and release all resources.
     */
    @Override
    public void close() {
        if (closed) {
            return;
        }

        closed = true;
        logger.info("Closing SecureNotifyClient");

        try {
            disconnect();
        } catch (Exception e) {
            logger.warn("Error during disconnect: {}", e.getMessage());
        }

        try {
            subscribe().close();
        } catch (Exception e) {
            logger.warn("Error closing subscribe manager: {}", e.getMessage());
        }

        try {
            httpClient.close();
        } catch (Exception e) {
            logger.warn("Error closing HTTP client: {}", e.getMessage());
        }

        logger.info("SecureNotifyClient closed");
    }

    /**
     * Create a builder for configuring the client.
     *
     * @return A new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for SecureNotifyClient.
     */
    public static class Builder {
        private String baseUrl = DEFAULT_BASE_URL;
        private String apiKey;
        private String apiKeyId;
        private int timeout = 30000;
        private RetryHandler retryHandler = RetryHandler.DEFAULT;

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public Builder apiKeyId(String apiKeyId) {
            this.apiKeyId = apiKeyId;
            return this;
        }

        public Builder timeout(int timeout) {
            this.timeout = timeout;
            return this;
        }

        public Builder retryHandler(RetryHandler retryHandler) {
            this.retryHandler = retryHandler;
            return this;
        }

        public SecureNotifyClient build() {
            if (apiKey == null || apiKey.isEmpty()) {
                throw new IllegalArgumentException("API key is required");
            }
            return new SecureNotifyClient(baseUrl, apiKey, apiKeyId, timeout);
        }
    }

    /**
     * Create a client with the specified API key.
     *
     * @param apiKey The API key
     * @return A new client instance
     */
    public static SecureNotifyClient create(String apiKey) {
        return new SecureNotifyClient(apiKey);
    }

    /**
     * Create a client with base URL and API key.
     *
     * @param baseUrl The base URL
     * @param apiKey  The API key
     * @return A new client instance
     */
    public static SecureNotifyClient create(String baseUrl, String apiKey) {
        return new SecureNotifyClient(baseUrl, apiKey);
    }
}

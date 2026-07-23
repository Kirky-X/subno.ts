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

    public SecureNotifyClient(String apiKey) {
        this(DEFAULT_BASE_URL, apiKey);
    }

    public SecureNotifyClient(String baseUrl, String apiKey) {
        this(baseUrl, apiKey, null, 30000);
    }

    /**
     * @param timeout Request timeout in milliseconds
     */
    public SecureNotifyClient(String baseUrl, String apiKey, String apiKeyId, int timeout) {
        this.baseUrl = baseUrl != null && !baseUrl.isEmpty() ? baseUrl : DEFAULT_BASE_URL;
        this.httpClient = new HttpClient(this.baseUrl, apiKey, apiKeyId, timeout);
        this.connectionManager = new ConnectionManager(this.baseUrl, apiKey, apiKeyId, timeout);
        this.retryHandler = RetryHandler.DEFAULT;

        this.keys = new KeyManager(httpClient, retryHandler);
        this.channels = new ChannelManager(httpClient, retryHandler);
        this.publish = new PublishManager(httpClient, retryHandler);
        this.subscribe = new SubscribeManager(this.baseUrl, apiKey, apiKeyId, timeout);
        this.apiKeys = new ApiKeyManager(httpClient, retryHandler);

        logger.info("SecureNotifyClient initialized with baseUrl: {}", this.baseUrl);
    }

    public KeyManager keys() {
        checkClosed();
        return keys;
    }

    public ChannelManager channels() {
        checkClosed();
        return channels;
    }

    public PublishManager publish() {
        checkClosed();
        return publish;
    }

    public SubscribeManager subscribe() {
        checkClosed();
        return subscribe;
    }

    public ApiKeyManager apiKeys() {
        checkClosed();
        return apiKeys;
    }

    public ConnectionManager.Subscription connect(String channelId,
                                                   Consumer<SseEvent.SseMessageEvent> handler) {
        checkClosed();
        return subscribe().subscribe(channelId, handler);
    }

    public ConnectionManager.Subscription connect(String channelId,
                                                   Consumer<SseEvent.SseMessageEvent> handler,
                                                   Consumer<SseEvent.SseErrorEvent> errorHandler) {
        checkClosed();
        return subscribe().subscribe(channelId, handler, errorHandler);
    }

    public void disconnect() {
        checkClosed();
        subscribe().unsubscribeAll();
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public boolean hasApiKey() {
        return httpClient.hasApiKey();
    }

    public boolean isConnected() {
        return subscribe().isConnected();
    }

    public boolean isClosed() {
        return closed;
    }

    public int getSubscriptionCount() {
        return subscribe().getSubscriptionCount();
    }

    private void checkClosed() {
        if (closed) {
            throw new IllegalStateException("SecureNotifyClient is closed");
        }
    }

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

    public static Builder builder() {
        return new Builder();
    }

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

    public static SecureNotifyClient create(String apiKey) {
        return new SecureNotifyClient(apiKey);
    }

    public static SecureNotifyClient create(String baseUrl, String apiKey) {
        return new SecureNotifyClient(baseUrl, apiKey);
    }
}

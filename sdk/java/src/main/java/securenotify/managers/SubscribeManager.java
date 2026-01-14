// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.managers;

import securenotify.types.SseEvent;
import securenotify.utils.ConnectionManager;
import securenotify.utils.HttpClient;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

/**
 * Manager for real-time subscription operations.
 */
public class SubscribeManager {

    private final ConnectionManager connectionManager;
    private final Set<String> subscribedChannels;
    private final Map<String, ConnectionManager.Subscription> subscriptions;

    public SubscribeManager(String baseUrl, String apiKey) {
        this.connectionManager = new ConnectionManager(baseUrl, apiKey);
        this.subscribedChannels = new CopyOnWriteArraySet<>();
        this.subscriptions = new ConcurrentHashMap<>();
    }

    public SubscribeManager(String baseUrl, String apiKey, String apiKeyId, int timeoutMs) {
        this.connectionManager = new ConnectionManager(baseUrl, apiKey, apiKeyId, timeoutMs);
        this.subscribedChannels = new CopyOnWriteArraySet<>();
        this.subscriptions = new ConcurrentHashMap<>();
    }

    /**
     * Subscribe to a channel for real-time messages.
     *
     * @param channelId The channel ID to subscribe to
     * @param handler   The message handler callback
     * @return A subscription object for managing the subscription
     */
    public ConnectionManager.Subscription subscribe(String channelId,
                                                     Consumer<SseEvent.SseMessageEvent> handler) {
        return subscribe(channelId, handler, null);
    }

    /**
     * Subscribe to a channel with error handling.
     *
     * @param channelId    The channel ID to subscribe to
     * @param handler      The message handler callback
     * @param errorHandler The error handler callback
     * @return A subscription object for managing the subscription
     */
    public ConnectionManager.Subscription subscribe(String channelId,
                                                     Consumer<SseEvent.SseMessageEvent> handler,
                                                     Consumer<SseEvent.SseErrorEvent> errorHandler) {
        ConnectionManager.Subscription subscription = connectionManager.subscribe(channelId, handler, errorHandler);
        subscribedChannels.add(channelId);
        subscriptions.put(channelId, subscription);
        return subscription;
    }

    /**
     * Unsubscribe from a channel.
     *
     * @param channelId The channel ID to unsubscribe from
     */
    public void unsubscribe(String channelId) {
        connectionManager.unsubscribe(channelId);
        subscribedChannels.remove(channelId);
        subscriptions.remove(channelId);
    }

    /**
     * Unsubscribe from all channels.
     */
    public void unsubscribeAll() {
        connectionManager.unsubscribeAll();
        subscribedChannels.clear();
        subscriptions.clear();
    }

    /**
     * Check if subscribed to a channel.
     *
     * @param channelId The channel ID
     * @return true if subscribed
     */
    public boolean isSubscribed(String channelId) {
        return subscribedChannels.contains(channelId);
    }

    /**
     * Get all subscribed channel IDs.
     *
     * @return Set of channel IDs
     */
    public Set<String> getSubscribedChannels() {
        return Set.copyOf(subscribedChannels);
    }

    /**
     * Get the number of subscribed channels.
     *
     * @return The count
     */
    public int getSubscriptionCount() {
        return subscribedChannels.size();
    }

    /**
     * Check if the manager has active connections.
     *
     * @return true if connected
     */
    public boolean isConnected() {
        return connectionManager.isConnected();
    }

    /**
     * Get the connection manager for advanced operations.
     *
     * @return The connection manager
     */
    public ConnectionManager getConnectionManager() {
        return connectionManager;
    }

    /**
     * Close the subscription manager.
     */
    public void close() {
        unsubscribeAll();
        connectionManager.close();
    }
}

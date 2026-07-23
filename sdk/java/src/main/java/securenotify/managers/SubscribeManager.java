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

    public ConnectionManager.Subscription subscribe(String channelId,
                                                     Consumer<SseEvent.SseMessageEvent> handler) {
        return subscribe(channelId, handler, null);
    }

    public ConnectionManager.Subscription subscribe(String channelId,
                                                     Consumer<SseEvent.SseMessageEvent> handler,
                                                     Consumer<SseEvent.SseErrorEvent> errorHandler) {
        ConnectionManager.Subscription subscription = connectionManager.subscribe(channelId, handler, errorHandler);
        subscribedChannels.add(channelId);
        subscriptions.put(channelId, subscription);
        return subscription;
    }

    public void unsubscribe(String channelId) {
        connectionManager.unsubscribe(channelId);
        subscribedChannels.remove(channelId);
        subscriptions.remove(channelId);
    }

    public void unsubscribeAll() {
        connectionManager.unsubscribeAll();
        subscribedChannels.clear();
        subscriptions.clear();
    }

    public boolean isSubscribed(String channelId) {
        return subscribedChannels.contains(channelId);
    }

    public Set<String> getSubscribedChannels() {
        return Set.copyOf(subscribedChannels);
    }

    public int getSubscriptionCount() {
        return subscribedChannels.size();
    }

    public boolean isConnected() {
        return connectionManager.isConnected();
    }

    public ConnectionManager getConnectionManager() {
        return connectionManager;
    }

    public void close() {
        unsubscribeAll();
        connectionManager.close();
    }
}

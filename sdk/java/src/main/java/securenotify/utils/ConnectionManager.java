// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import securenotify.types.SseEvent;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * Manages SSE (Server-Sent Events) connections for real-time message delivery.
 * Uses HttpURLConnection for SSE streaming with automatic reconnection.
 */
public class ConnectionManager implements AutoCloseable {

    private static final Logger logger = LoggerFactory.getLogger(ConnectionManager.class);

    private static final String EVENT_TYPE_CONNECTED = "connected";
    private static final String EVENT_TYPE_MESSAGE = "message";
    private static final String EVENT_TYPE_HEARTBEAT = "heartbeat";
    private static final String EVENT_TYPE_ERROR = "error";
    private static final long DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
    private static final long DEFAULT_RECONNECT_DELAY_MS = 1000;
    private static final long MAX_RECONNECT_DELAY_MS = 30000;

    private final String baseUrl;
    private final String apiKey;
    private final String apiKeyId;
    private final int timeoutMs;
    private final ScheduledExecutorService scheduler;
    private final ConcurrentMap<String, Subscription> subscriptions;
    private final AtomicInteger activeConnections;
    private final AtomicBoolean closed;

    public ConnectionManager(String baseUrl, String apiKey) {
        this(baseUrl, apiKey, null, 30000);
    }

    public ConnectionManager(String baseUrl, String apiKey, String apiKeyId, int timeoutMs) {
        this.baseUrl = UrlHelper.getDefaultBaseUrl(baseUrl);
        this.apiKey = apiKey != null ? apiKey : "";
        this.apiKeyId = apiKeyId;
        this.timeoutMs = timeoutMs;
        this.scheduler = Executors.newScheduledThreadPool(2);
        this.subscriptions = new ConcurrentHashMap<>();
        this.activeConnections = new AtomicInteger(0);
        this.closed = new AtomicBoolean(false);

        logger.info("ConnectionManager initialized with baseUrl: {}", this.baseUrl);
    }

    /**
     * Subscribe to a channel for real-time messages.
     *
     * @param channelId The channel ID to subscribe to
     * @param handler   The message handler callback
     * @return A Subscription object for managing the subscription
     */
    public Subscription subscribe(String channelId, Consumer<SseEvent.SseMessageEvent> handler) {
        return subscribe(channelId, handler, null);
    }

    /**
     * Subscribe to a channel with error handling.
     *
     * @param channelId    The channel ID to subscribe to
     * @param handler      The message handler callback
     * @param errorHandler The error handler callback
     * @return A Subscription object for managing the subscription
     */
    public Subscription subscribe(String channelId,
                                   Consumer<SseEvent.SseMessageEvent> handler,
                                   Consumer<SseEvent.SseErrorEvent> errorHandler) {
        if (closed.get()) {
            throw new IllegalStateException("ConnectionManager is closed");
        }

        String subscriptionId = UUID.randomUUID().toString();
        Subscription subscription = new Subscription(subscriptionId, channelId, handler, errorHandler);

        // Check if already subscribed
        if (subscriptions.containsKey(channelId)) {
            logger.warn("Already subscribed to channel: {}", channelId);
            return subscriptions.get(channelId);
        }

        subscriptions.put(channelId, subscription);
        startConnection(channelId);

        logger.info("Subscribed to channel: {} (id={})", channelId, subscriptionId);
        return subscription;
    }

    /**
     * Start an SSE connection for a channel.
     */
    private void startConnection(String channelId) {
        Subscription subscription = subscriptions.get(channelId);
        if (subscription == null || subscription.isCancelled()) {
            return;
        }

        activeConnections.incrementAndGet();

        // Start the SSE reader in a separate thread
        CompletableFuture.runAsync(() -> {
            try {
                readSseStream(subscription);
            } catch (Exception e) {
                logger.error("SSE connection error for channel {}: {}", channelId, e.getMessage());
            } finally {
                activeConnections.decrementAndGet();
            }
        }, scheduler);

        // Start heartbeat monitor
        startHeartbeatMonitor(channelId);
    }

    /**
     * Read the SSE stream for a subscription.
     */
    private void readSseStream(Subscription subscription) {
        String channelId = subscription.getChannelId();
        int reconnectDelay = (int) DEFAULT_RECONNECT_DELAY_MS;

        while (!subscription.isCancelled() && !closed.get()) {
            HttpURLConnection connection = null;
            BufferedReader reader = null;

            try {
                URL url = new URL(buildSseUrl(channelId));
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(timeoutMs);
                connection.setReadTimeout(timeoutMs);
                connection.setRequestProperty("Accept", "text/event-stream");
                connection.setRequestProperty("Cache-Control", "no-cache");

                if (apiKey != null && !apiKey.isEmpty()) {
                    connection.setRequestProperty("X-API-Key", apiKey);
                }
                if (apiKeyId != null && !apiKeyId.isEmpty()) {
                    connection.setRequestProperty("X-API-Key-ID", apiKeyId);
                }

                connection.connect();

                int responseCode = connection.getResponseCode();
                if (responseCode != 200) {
                    logger.error("SSE connection failed with status: {}", responseCode);
                    subscription.notifyError("HTTP_" + responseCode,
                            "Connection failed with status: " + responseCode, true);
                    Thread.sleep(reconnectDelay);
                    reconnectDelay = Math.min((int) (reconnectDelay * 1.5), (int) MAX_RECONNECT_DELAY_MS);
                    continue;
                }

                // Reset reconnect delay on successful connection
                reconnectDelay = (int) DEFAULT_RECONNECT_DELAY_MS;

                reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));

                String line;
                long lastHeartbeat = System.currentTimeMillis();

                while (!subscription.isCancelled() && (line = reader.readLine()) != null) {
                    // Parse SSE line
                    if (line.startsWith("event:")) {
                        subscription.setCurrentEventType(line.substring(6).trim());
                    } else if (line.startsWith("data:")) {
                        String data = line.substring(5).trim();
                        subscription.processData(data);
                    } else if (line.isEmpty()) {
                        // Empty line signals end of event
                        subscription.processEvent();
                    }

                    // Check heartbeat
                    if (System.currentTimeMillis() - lastHeartbeat > DEFAULT_HEARTBEAT_INTERVAL_MS) {
                        lastHeartbeat = System.currentTimeMillis();
                        // Send heartbeat event
                        SseEvent.SseHeartbeatEvent heartbeat = new SseEvent.SseHeartbeatEvent();
                        heartbeat.setTimestamp(lastHeartbeat);
                        subscription.notifyHeartbeat(heartbeat);
                    }
                }

            } catch (java.net.ConnectException e) {
                logger.warn("Connection refused for channel {}: {}", channelId, e.getMessage());
                subscription.notifyError("CONNECTION_REFUSED",
                        "Connection refused: " + e.getMessage(), true);
                sleepQuietly(reconnectDelay);
                reconnectDelay = Math.min((int) (reconnectDelay * 1.5), (int) MAX_RECONNECT_DELAY_MS);

            } catch (java.net.SocketTimeoutException e) {
                logger.warn("Read timeout for channel {}", channelId);
                subscription.notifyError("TIMEOUT", "Read timeout", true);
                sleepQuietly(reconnectDelay);

            } catch (IOException e) {
                if (!subscription.isCancelled()) {
                    logger.error("IO error for channel {}: {}", channelId, e.getMessage());
                    subscription.notifyError("IO_ERROR", e.getMessage(), true);
                    sleepQuietly(reconnectDelay);
                    reconnectDelay = Math.min((int) (reconnectDelay * 1.5), (int) MAX_RECONNECT_DELAY_MS);
                }

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;

            } finally {
                closeQuietly(reader);
                closeQuietly(connection);
            }
        }

        // Cleanup on exit
        if (!subscription.isCancelled()) {
            logger.info("SSE stream closed for channel: {}", channelId);
        }
    }

    /**
     * Start heartbeat monitor for a channel.
     */
    private void startHeartbeatMonitor(String channelId) {
        scheduler.scheduleAtFixedRate(() -> {
            Subscription subscription = subscriptions.get(channelId);
            if (subscription != null && !subscription.isCancelled()) {
                subscription.checkHeartbeat();
            }
        }, DEFAULT_HEARTBEAT_INTERVAL_MS, DEFAULT_HEARTBEAT_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    /**
     * Build SSE URL for a channel.
     */
    private String buildSseUrl(String channelId) {
        String base = UrlHelper.buildUrl(baseUrl, "/api/subscribe");
        return base + "?channel=" + channelId;
    }

    /**
     * Unsubscribe from a channel.
     */
    public void unsubscribe(String channelId) {
        Subscription subscription = subscriptions.remove(channelId);
        if (subscription != null) {
            subscription.cancel();
            logger.info("Unsubscribed from channel: {}", channelId);
        }
    }

    /**
     * Unsubscribe from all channels.
     */
    public void unsubscribeAll() {
        subscriptions.keySet().forEach(this::unsubscribe);
        logger.info("Unsubscribed from all channels");
    }

    /**
     * Get the number of active subscriptions.
     */
    public int getSubscriptionCount() {
        return subscriptions.size();
    }

    /**
     * Get the number of active connections.
     */
    public int getActiveConnectionCount() {
        return activeConnections.get();
    }

    /**
     * Check if connected to any channel.
     */
    public boolean isConnected() {
        return activeConnections.get() > 0;
    }

    private void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void closeQuietly(AutoCloseable closeable) {
        if (closeable != null) {
            try {
                closeable.close();
            } catch (Exception e) {
                // Ignore
            }
        }
    }

    /**
     * Close the connection manager.
     */
    @Override
    public void close() {
        if (closed.compareAndSet(false, true)) {
            unsubscribeAll();
            scheduler.shutdown();
            try {
                if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                    scheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduler.shutdownNow();
                Thread.currentThread().interrupt();
            }
            logger.info("ConnectionManager closed");
        }
    }

    /**
     * Subscription object for managing SSE subscriptions.
     */
    public static class Subscription {
        private final String id;
        private final String channelId;
        private final Consumer<SseEvent.SseMessageEvent> messageHandler;
        private final Consumer<SseEvent.SseErrorEvent> errorHandler;
        private final AtomicBoolean cancelled;
        private String currentEventType;
        private StringBuilder currentData;
        private long lastHeartbeat;

        public Subscription(String id, String channelId,
                           Consumer<SseEvent.SseMessageEvent> messageHandler,
                           Consumer<SseEvent.SseErrorEvent> errorHandler) {
            this.id = id;
            this.channelId = channelId;
            this.messageHandler = messageHandler;
            this.errorHandler = errorHandler;
            this.cancelled = new AtomicBoolean(false);
            this.currentData = new StringBuilder();
            this.lastHeartbeat = System.currentTimeMillis();
        }

        public String getId() {
            return id;
        }

        public String getChannelId() {
            return channelId;
        }

        public boolean isCancelled() {
            return cancelled.get();
        }

        public void cancel() {
            cancelled.set(true);
        }

        public void setCurrentEventType(String type) {
            this.currentEventType = type;
        }

        public void processData(String data) {
            if (currentData.length() > 0) {
                currentData.append("\n");
            }
            currentData.append(data);
        }

        public void processEvent() {
            String data = currentData.toString();
            currentData = new StringBuilder();

            if (data.isEmpty()) {
                return;
            }

            try {
                switch (currentEventType) {
                    case EVENT_TYPE_MESSAGE:
                        processMessage(data);
                        break;
                    case EVENT_TYPE_HEARTBEAT:
                        processHeartbeat();
                        break;
                    case EVENT_TYPE_ERROR:
                        processError(data);
                        break;
                    case EVENT_TYPE_CONNECTED:
                        processConnected(data);
                        break;
                    default:
                        // Unknown event type
                        logger.debug("Unknown SSE event type: {}", currentEventType);
                }
            } catch (Exception e) {
                logger.error("Error processing SSE event: {}", e.getMessage());
            }
        }

        private void processMessage(String data) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                SseEvent.SseMessageEvent event = mapper.readValue(data, SseEvent.SseMessageEvent.class);
                lastHeartbeat = System.currentTimeMillis();
                if (messageHandler != null) {
                    messageHandler.accept(event);
                }
            } catch (Exception e) {
                logger.error("Failed to parse SSE message: {}", e.getMessage());
            }
        }

        private void processHeartbeat() {
            lastHeartbeat = System.currentTimeMillis();
        }

        private void processError(String data) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                SseEvent.SseErrorEvent event = mapper.readValue(data, SseEvent.SseErrorEvent.class);
                if (errorHandler != null) {
                    errorHandler.accept(event);
                }
            } catch (Exception e) {
                logger.error("Failed to parse SSE error: {}", e.getMessage());
            }
        }

        private void processConnected(String data) {
            logger.info("Connected to channel: {}", channelId);
            lastHeartbeat = System.currentTimeMillis();
        }

        private void notifyError(String code, String message, boolean reconnectable) {
            if (errorHandler != null) {
                SseEvent.SseErrorEvent event = new SseEvent.SseErrorEvent();
                event.setCode(code);
                event.setMessage(message);
                event.setReconnectable(reconnectable);
                errorHandler.accept(event);
            }
        }

        private void notifyHeartbeat(SseEvent.SseHeartbeatEvent event) {
            // Heartbeat can be used for monitoring
        }

        private void checkHeartbeat() {
            long now = System.currentTimeMillis();
            if (now - lastHeartbeat > DEFAULT_HEARTBEAT_INTERVAL_MS * 2) {
                // Heartbeat timeout - connection may be dead
                logger.warn("Heartbeat timeout for channel: {}", channelId);
            }
        }
    }
}

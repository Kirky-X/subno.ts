// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.managers;

import securenotify.types.ApiRequest;
import securenotify.types.ApiResponse;
import securenotify.types.MessageInfo;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.Map;

/**
 * Manager for message publishing operations.
 */
public class PublishManager {

    private final HttpClient httpClient;
    private final RetryHandler retryHandler;

    public PublishManager(HttpClient httpClient) {
        this(httpClient, RetryHandler.DEFAULT);
    }

    public PublishManager(HttpClient httpClient, RetryHandler retryHandler) {
        this.httpClient = httpClient;
        this.retryHandler = retryHandler;
    }

    /**
     * @param priority  Message priority (critical, high, normal, low, bulk)
     */
    public MessageInfo.MessagePublishResponse send(String channel, String message, String priority,
                                                    String sender, Boolean cache, Boolean encrypted,
                                                    Boolean autoCreate, String signature) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .channel(channel)
                .message(message)
                .priority(priority)
                .sender(sender)
                .cache(cache != null ? cache : true)
                .encrypted(encrypted)
                .autoCreate(autoCreate != null ? autoCreate : true)
                .signature(signature)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.post("api/publish", request, MessageInfo.MessagePublishResponse.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    public MessageInfo.MessagePublishResponse send(String channel, String message) throws Exception {
        return send(channel, message, "normal", null, true, false, true, null);
    }

    public MessageInfo.MessagePublishResponse sendCritical(String channel, String message) throws Exception {
        return send(channel, message, "critical", null, true, false, true, null);
    }

    public MessageInfo.MessagePublishResponse send(String channel, String message, String sender) throws Exception {
        return send(channel, message, "normal", sender, true, false, true, null);
    }

    public MessageInfo.QueueStatusResponse getQueueStatus(String channel) throws Exception {
        return retryHandler.execute(() -> {
            try {
                return httpClient.get("api/publish", Map.of("channel", channel), MessageInfo.QueueStatusResponse.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    public MessageInfo getMessage(String messageId) throws Exception {
        return retryHandler.execute(() -> {
            try {
                return httpClient.get("api/publish/" + messageId, null, MessageInfo.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }
}

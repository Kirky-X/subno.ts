// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Represents a message in SecureNotify.
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageInfo {

    @JsonProperty("id")
    private String id;

    @JsonProperty("channel")
    private String channel;

    @JsonProperty("message")
    private String message;

    @JsonProperty("sender")
    private String sender;

    @JsonProperty("timestamp")
    private long timestamp;

    @JsonProperty("priority")
    private String priority;

    /**
     * Response from publishing a message.
     */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MessagePublishResponse {

        @JsonProperty("messageId")
        private String messageId;

        @JsonProperty("channel")
        private String channel;

        @JsonProperty("publishedAt")
        private String publishedAt;

        @JsonProperty("autoCreated")
        private boolean autoCreated;
    }

    /**
     * Queue status response.
     */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QueueStatusResponse {

        @JsonProperty("channel")
        private String channel;

        @JsonProperty("messages")
        private MessageInfo[] messages;

        @JsonProperty("queueLength")
        private int queueLength;
    }
}

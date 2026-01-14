// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a message in SecureNotify.
 */
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

    public MessageInfo() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    /**
     * Response from publishing a message.
     */
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

        public String getMessageId() {
            return messageId;
        }

        public void setMessageId(String messageId) {
            this.messageId = messageId;
        }

        public String getChannel() {
            return channel;
        }

        public void setChannel(String channel) {
            this.channel = channel;
        }

        public String getPublishedAt() {
            return publishedAt;
        }

        public void setPublishedAt(String publishedAt) {
            this.publishedAt = publishedAt;
        }

        public boolean isAutoCreated() {
            return autoCreated;
        }

        public void setAutoCreated(boolean autoCreated) {
            this.autoCreated = autoCreated;
        }
    }

    /**
     * Queue status response.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QueueStatusResponse {

        @JsonProperty("channel")
        private String channel;

        @JsonProperty("messages")
        private MessageInfo[] messages;

        @JsonProperty("queueLength")
        private int queueLength;

        public String getChannel() {
            return channel;
        }

        public void setChannel(String channel) {
            this.channel = channel;
        }

        public MessageInfo[] getMessages() {
            return messages;
        }

        public void setMessages(MessageInfo[] messages) {
            this.messages = messages;
        }

        public int getQueueLength() {
            return queueLength;
        }

        public void setQueueLength(int queueLength) {
            this.queueLength = queueLength;
        }
    }
}

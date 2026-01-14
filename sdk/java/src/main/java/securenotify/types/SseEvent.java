// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * SSE event types for real-time subscriptions.
 */
public class SseEvent {

    /**
     * SSE connected event.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SseConnectedEvent {
        @JsonProperty("channel")
        private String channel;

        @JsonProperty("type")
        private String type;

        @JsonProperty("timestamp")
        private long timestamp;

        public String getChannel() {
            return channel;
        }

        public void setChannel(String channel) {
            this.channel = channel;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public long getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(long timestamp) {
            this.timestamp = timestamp;
        }
    }

    /**
     * SSE message event.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SseMessageEvent {
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
    }

    /**
     * SSE heartbeat event.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SseHeartbeatEvent {
        @JsonProperty("timestamp")
        private long timestamp;

        public long getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(long timestamp) {
            this.timestamp = timestamp;
        }
    }

    /**
     * SSE error event.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SseErrorEvent {
        @JsonProperty("code")
        private String code;

        @JsonProperty("message")
        private String message;

        @JsonProperty("reconnectable")
        private boolean reconnectable;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public boolean isReconnectable() {
            return reconnectable;
        }

        public void setReconnectable(boolean reconnectable) {
            this.reconnectable = reconnectable;
        }
    }
}

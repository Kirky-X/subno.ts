// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * SSE event types for real-time subscriptions.
 */
public class SseEvent {

    /**
     * SSE connected event.
     */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SseConnectedEvent {
        @JsonProperty("channel")
        private String channel;

        @JsonProperty("type")
        private String type;

        @JsonProperty("timestamp")
        private long timestamp;
    }

    /**
     * SSE message event.
     */
    @Data
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
    }

    /**
     * SSE heartbeat event.
     */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SseHeartbeatEvent {
        @JsonProperty("timestamp")
        private long timestamp;
    }

    /**
     * SSE error event.
     */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SseErrorEvent {
        @JsonProperty("code")
        private String code;

        @JsonProperty("message")
        private String message;

        @JsonProperty("reconnectable")
        private boolean reconnectable;
    }
}

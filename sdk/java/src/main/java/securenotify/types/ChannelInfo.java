// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Represents a channel in SecureNotify.
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChannelInfo {

    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    @JsonProperty("type")
    private String type;

    @JsonProperty("creator")
    private String creator;

    @JsonProperty("description")
    private String description;

    @JsonProperty("createdAt")
    private String createdAt;

    @JsonProperty("expiresAt")
    private String expiresAt;

    @JsonProperty("isActive")
    private boolean isActive;

    @JsonProperty("metadata")
    private Object metadata;

    /**
     * Response from channel creation.
     */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChannelCreateResponse extends ChannelInfo {

        @JsonProperty("autoCreated")
        private boolean autoCreated;
    }
}

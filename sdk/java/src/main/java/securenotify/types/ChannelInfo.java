// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a channel in SecureNotify.
 */
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

    public ChannelInfo() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        this.creator = creator;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(String expiresAt) {
        this.expiresAt = expiresAt;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public Object getMetadata() {
        return metadata;
    }

    public void setMetadata(Object metadata) {
        this.metadata = metadata;
    }

    /**
     * Response from channel creation.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChannelCreateResponse extends ChannelInfo {

        @JsonProperty("id")
        private String id;

        @JsonProperty("name")
        private String name;

        @JsonProperty("type")
        private String type;

        @JsonProperty("creator")
        private String creator;

        @JsonProperty("createdAt")
        private String createdAt;

        @JsonProperty("expiresAt")
        private String expiresAt;

        @JsonProperty("isActive")
        private boolean isActive;

        @JsonProperty("metadata")
        private Object metadata;

        @JsonProperty("autoCreated")
        private boolean autoCreated;

        public boolean isAutoCreated() {
            return autoCreated;
        }

        public void setAutoCreated(boolean autoCreated) {
            this.autoCreated = autoCreated;
        }
    }
}

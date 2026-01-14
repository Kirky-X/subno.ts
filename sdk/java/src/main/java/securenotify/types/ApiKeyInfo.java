// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents an API key in SecureNotify.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiKeyInfo {

    @JsonProperty("id")
    private String id;

    @JsonProperty("keyPrefix")
    private String keyPrefix;

    @JsonProperty("name")
    private String name;

    @JsonProperty("userId")
    private String userId;

    @JsonProperty("permissions")
    private String[] permissions;

    @JsonProperty("isActive")
    private boolean isActive;

    @JsonProperty("createdAt")
    private String createdAt;

    @JsonProperty("lastUsedAt")
    private String lastUsedAt;

    @JsonProperty("expiresAt")
    private String expiresAt;

    public ApiKeyInfo() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getKeyPrefix() {
        return keyPrefix;
    }

    public void setKeyPrefix(String keyPrefix) {
        this.keyPrefix = keyPrefix;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String[] getPermissions() {
        return permissions;
    }

    public void setPermissions(String[] permissions) {
        this.permissions = permissions;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(String lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public String getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(String expiresAt) {
        this.expiresAt = expiresAt;
    }

    /**
     * Response from creating an API key.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ApiKeyCreateResponse extends ApiKeyInfo {

        @JsonProperty("key")
        private String key;

        public String getKey() {
            return key;
        }

        public void setKey(String key) {
            this.key = key;
        }
    }
}

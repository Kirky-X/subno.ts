// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Represents an API key in SecureNotify.
 */
@Data
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

    /**
     * Response from creating an API key.
     */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ApiKeyCreateResponse extends ApiKeyInfo {

        @JsonProperty("key")
        private String key;
    }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Represents a public key registered with SecureNotify.
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PublicKeyInfo {

    @JsonProperty("id")
    private String id;

    @JsonProperty("channelId")
    private String channelId;

    @JsonProperty("publicKey")
    private String publicKey;

    @JsonProperty("algorithm")
    private String algorithm;

    @JsonProperty("createdAt")
    private String createdAt;

    @JsonProperty("expiresAt")
    private String expiresAt;

    @JsonProperty("lastUsedAt")
    private String lastUsedAt;

    @JsonProperty("metadata")
    private Object metadata;

    @JsonProperty("isExpired")
    private boolean isExpired;
}

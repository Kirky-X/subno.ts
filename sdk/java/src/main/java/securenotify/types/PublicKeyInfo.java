// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a public key registered with SecureNotify.
 */
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

    public PublicKeyInfo() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getChannelId() {
        return channelId;
    }

    public void setChannelId(String channelId) {
        this.channelId = channelId;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void setPublicKey(String publicKey) {
        this.publicKey = publicKey;
    }

    public String getAlgorithm() {
        return algorithm;
    }

    public void setAlgorithm(String algorithm) {
        this.algorithm = algorithm;
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

    public String getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(String lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public Object getMetadata() {
        return metadata;
    }

    public void setMetadata(Object metadata) {
        this.metadata = metadata;
    }

    public boolean isExpired() {
        return isExpired;
    }

    public void setExpired(boolean expired) {
        isExpired = expired;
    }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

/**
 * Generic API request wrapper.
 *
 * @param <T> The type of the request body
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiRequest<T> {

    @JsonProperty("channel")
    private String channel;

    @JsonProperty("message")
    private String message;

    @JsonProperty("publicKey")
    private String publicKey;

    @JsonProperty("algorithm")
    private String algorithm;

    @JsonProperty("expiresIn")
    private Integer expiresIn;

    @JsonProperty("metadata")
    private Object metadata;

    @JsonProperty("name")
    private String name;

    @JsonProperty("userId")
    private String userId;

    @JsonProperty("permissions")
    private String[] permissions;

    @JsonProperty("priority")
    private String priority;

    @JsonProperty("sender")
    private String sender;

    @JsonProperty("cache")
    private Boolean cache;

    @JsonProperty("encrypted")
    private Boolean encrypted;

    @JsonProperty("autoCreate")
    private Boolean autoCreate;

    @JsonProperty("signature")
    private String signature;

    @JsonProperty("type")
    private String type;

    @JsonProperty("description")
    private String description;

    @JsonProperty("creator")
    private String creator;

    @JsonProperty("limit")
    private Integer limit;

    @JsonProperty("offset")
    private Integer offset;

    @JsonProperty("id")
    private String id;

    @JsonProperty("reason")
    private String reason;

    @JsonProperty("confirmationHours")
    private Integer confirmationHours;

    private T data;

    public ApiRequest() {
    }

    // Getters and Setters
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

    public Integer getExpiresIn() {
        return expiresIn;
    }

    public void setExpiresIn(Integer expiresIn) {
        this.expiresIn = expiresIn;
    }

    public Object getMetadata() {
        return metadata;
    }

    public void setMetadata(Object metadata) {
        this.metadata = metadata;
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

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public Boolean getCache() {
        return cache;
    }

    public void setCache(Boolean cache) {
        this.cache = cache;
    }

    public Boolean getEncrypted() {
        return encrypted;
    }

    public void setEncrypted(Boolean encrypted) {
        this.encrypted = encrypted;
    }

    public Boolean getAutoCreate() {
        return autoCreate;
    }

    public void setAutoCreate(Boolean autoCreate) {
        this.autoCreate = autoCreate;
    }

    public String getSignature() {
        return signature;
    }

    public void setSignature(String signature) {
        this.signature = signature;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        this.creator = creator;
    }

    public Integer getLimit() {
        return limit;
    }

    public void setLimit(Integer limit) {
        this.limit = limit;
    }

    public Integer getOffset() {
        return offset;
    }

    public void setOffset(Integer offset) {
        this.offset = offset;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Integer getConfirmationHours() {
        return confirmationHours;
    }

    public void setConfirmationHours(Integer confirmationHours) {
        this.confirmationHours = confirmationHours;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    // Builder pattern
    public static <T> Builder<T> builder() {
        return new Builder<>();
    }

    public static class Builder<T> {
        private final ApiRequest<T> request = new ApiRequest<>();

        public Builder<T> channel(String channel) {
            request.setChannel(channel);
            return this;
        }

        public Builder<T> message(String message) {
            request.setMessage(message);
            return this;
        }

        public Builder<T> publicKey(String publicKey) {
            request.setPublicKey(publicKey);
            return this;
        }

        public Builder<T> algorithm(String algorithm) {
            request.setAlgorithm(algorithm);
            return this;
        }

        public Builder<T> expiresIn(Integer expiresIn) {
            request.setExpiresIn(expiresIn);
            return this;
        }

        public Builder<T> metadata(Object metadata) {
            request.setMetadata(metadata);
            return this;
        }

        public Builder<T> name(String name) {
            request.setName(name);
            return this;
        }

        public Builder<T> userId(String userId) {
            request.setUserId(userId);
            return this;
        }

        public Builder<T> permissions(String[] permissions) {
            request.setPermissions(permissions);
            return this;
        }

        public Builder<T> priority(String priority) {
            request.setPriority(priority);
            return this;
        }

        public Builder<T> sender(String sender) {
            request.setSender(sender);
            return this;
        }

        public Builder<T> cache(Boolean cache) {
            request.setCache(cache);
            return this;
        }

        public Builder<T> encrypted(Boolean encrypted) {
            request.setEncrypted(encrypted);
            return this;
        }

        public Builder<T> autoCreate(Boolean autoCreate) {
            request.setAutoCreate(autoCreate);
            return this;
        }

        public Builder<T> signature(String signature) {
            request.setSignature(signature);
            return this;
        }

        public Builder<T> type(String type) {
            request.setType(type);
            return this;
        }

        public Builder<T> description(String description) {
            request.setDescription(description);
            return this;
        }

        public Builder<T> creator(String creator) {
            request.setCreator(creator);
            return this;
        }

        public Builder<T> limit(Integer limit) {
            request.setLimit(limit);
            return this;
        }

        public Builder<T> offset(Integer offset) {
            request.setOffset(offset);
            return this;
        }

        public Builder<T> id(String id) {
            request.setId(id);
            return this;
        }

        public Builder<T> reason(String reason) {
            request.setReason(reason);
            return this;
        }

        public Builder<T> confirmationHours(Integer confirmationHours) {
            request.setConfirmationHours(confirmationHours);
            return this;
        }

        public Builder<T> data(T data) {
            request.setData(data);
            return this;
        }

        public ApiRequest<T> build() {
            return request;
        }
    }
}

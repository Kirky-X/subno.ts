// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

/**
 * Generic API request wrapper.
 *
 * @param <T> The type of the request body
 */
@Data
@Builder
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
}

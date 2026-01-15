// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.managers;

import securenotify.types.ApiKeyInfo;
import securenotify.types.ApiRequest;
import securenotify.types.ApiResponse;
import securenotify.types.PaginationResult;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.Map;

/**
 * Manager for API key operations.
 */
public class ApiKeyManager {

    private final HttpClient httpClient;
    private final RetryHandler retryHandler;

    public ApiKeyManager(HttpClient httpClient) {
        this(httpClient, RetryHandler.DEFAULT);
    }

    public ApiKeyManager(HttpClient httpClient, RetryHandler retryHandler) {
        this.httpClient = httpClient;
        this.retryHandler = retryHandler;
    }

    /**
     * Create a new API key.
     *
     * @param name        The key name
     * @param userId      The user ID
     * @param permissions The permissions array
     * @param expiresIn   Optional expiration time in seconds
     * @return The created API key (including the full key)
     */
    public ApiKeyInfo.ApiKeyCreateResponse create(String name, String userId, String[] permissions, Integer expiresIn) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .name(name)
                .userId(userId)
                .permissions(permissions)
                .expiresIn(expiresIn)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.post("api/keys", request, ApiKeyInfo.ApiKeyCreateResponse.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    /**
     * Create an API key with default expiration.
     *
     * @param name        The key name
     * @param userId      The user ID
     * @param permissions The permissions array
     * @return The created API key
     */
    public ApiKeyInfo.ApiKeyCreateResponse create(String name, String userId, String[] permissions) throws Exception {
        return create(name, userId, permissions, 604800); // 7 days default
    }

    /**
     * Get API key info by ID.
     *
     * @param keyId The key ID
     * @return The API key info (without the full key)
     */
    public ApiKeyInfo get(String keyId) throws Exception {
        return retryHandler.execute(() -> {
            try {
                return httpClient.get("api/keys/" + keyId, null, ApiKeyInfo.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    /**
     * List all API keys for a user.
     *
     * @param limit  Maximum number of keys to return
     * @param offset Offset for pagination
     * @return The list response with pagination
     */
    public ApiKeyListResponse list(Integer limit, Integer offset) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .limit(limit)
                .offset(offset)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.post("api/keys", request, ApiKeyListResponse.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    /**
     * List API keys with default pagination.
     *
     * @return The list response with pagination
     */
    public ApiKeyListResponse list() throws Exception {
        return list(50, 0);
    }

    /**
     * Revoke an API key.
     *
     * @param keyId  The key ID
     * @param reason The revocation reason
     * @return The revocation result
     */
    public ApiResponse<?> revoke(String keyId, String reason) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .reason(reason)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.delete("api/keys/" + keyId, request, Map.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    /**
     * Response wrapper for API key list.
     */
    public static class ApiKeyListResponse {
        private ApiKeyInfo[] keys;
        private PaginationResult pagination;

        public ApiKeyInfo[] getKeys() {
            return keys;
        }

        public void setKeys(ApiKeyInfo[] keys) {
            this.keys = keys;
        }

        public PaginationResult getPagination() {
            return pagination;
        }

        public void setPagination(PaginationResult pagination) {
            this.pagination = pagination;
        }
    }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.managers;

import securenotify.types.ApiRequest;
import securenotify.types.ApiResponse;
import securenotify.types.PublicKeyInfo;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.Map;

/**
 * Manager for public key operations.
 */
public class KeyManager {

    private final HttpClient httpClient;
    private final RetryHandler retryHandler;

    public KeyManager(HttpClient httpClient) {
        this(httpClient, RetryHandler.DEFAULT);
    }

    public KeyManager(HttpClient httpClient, RetryHandler retryHandler) {
        this.httpClient = httpClient;
        this.retryHandler = retryHandler;
    }

    /**
     * @param publicKey The PEM-encoded public key
     * @param algorithm The encryption algorithm (RSA-2048, RSA-4096, ECC-SECP256K1)
     * @param expiresIn Optional expiration time in seconds
     */
    public PublicKeyInfo register(String publicKey, String algorithm, Integer expiresIn, Map<String, Object> metadata) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .publicKey(publicKey)
                .algorithm(algorithm)
                .expiresIn(expiresIn)
                .metadata(metadata)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.post("api/register", request, PublicKeyInfo.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    public PublicKeyInfo register(String publicKey) throws Exception {
        return register(publicKey, "RSA-4096", null, null);
    }

    public PublicKeyInfo get(String keyId) throws Exception {
        return retryHandler.execute(() -> {
            try {
                return httpClient.get("api/keys/" + keyId, null, PublicKeyInfo.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    public PublicKeyInfo getByChannel(String channelId) throws Exception {
        return retryHandler.execute(() -> {
            try {
                return httpClient.get("api/register", Map.of("channelId", channelId), PublicKeyInfo.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    /**
     * @param confirmationHours Hours to wait for confirmation
     */
    public ApiResponse<?> revoke(String keyId, String reason, Integer confirmationHours) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .reason(reason)
                .confirmationHours(confirmationHours)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.delete("api/keys/" + keyId, request, Map.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    public ApiResponse<?> revoke(String keyId, String reason) throws Exception {
        return revoke(keyId, reason, 24);
    }
}

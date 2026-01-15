// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.managers;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import securenotify.types.ApiResponse;
import securenotify.types.ChannelInfo;
import securenotify.types.PublicKeyInfo;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for KeyManager.
 */
@ExtendWith(MockitoExtension.class)
class KeyManagerTest {

    @Mock
    private HttpClient httpClient;

    private KeyManager keyManager;
    private RetryHandler retryHandler;

    @BeforeEach
    void setUp() {
        retryHandler = RetryHandler.DEFAULT;
        keyManager = new KeyManager(httpClient, retryHandler);
    }

    @Test
    void testRegister() throws Exception {
        // Arrange
        PublicKeyInfo expectedKey = new PublicKeyInfo();
        expectedKey.setId("key-123");
        expectedKey.setChannelId("channel-123");
        expectedKey.setAlgorithm("RSA-4096");

        ApiResponse<PublicKeyInfo> response = ApiResponse.success(expectedKey);
        when(httpClient.post(anyString(), any(), eq(PublicKeyInfo.class))).thenReturn(response);

        // Act
        PublicKeyInfo result = keyManager.register("-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----");

        // Assert
        assertNotNull(result);
        assertEquals("key-123", result.getId());
        assertEquals("RSA-4096", result.getAlgorithm());
        verify(httpClient).post(eq("api/register"), any(), eq(PublicKeyInfo.class));
    }

    @Test
    void testRegisterWithAlgorithm() throws Exception {
        // Arrange
        PublicKeyInfo expectedKey = new PublicKeyInfo();
        expectedKey.setId("key-456");
        expectedKey.setAlgorithm("ECC-SECP256K1");

        ApiResponse<PublicKeyInfo> response = ApiResponse.success(expectedKey);
        when(httpClient.post(anyString(), any(), eq(PublicKeyInfo.class))).thenReturn(response);

        // Act
        PublicKeyInfo result = keyManager.register("public-key", "ECC-SECP256K1", null, null);

        // Assert
        assertNotNull(result);
        assertEquals("ECC-SECP256K1", result.getAlgorithm());
    }

    @Test
    void testGet() throws Exception {
        // Arrange
        PublicKeyInfo expectedKey = new PublicKeyInfo();
        expectedKey.setId("key-123");
        expectedKey.setChannelId("channel-123");

        ApiResponse<PublicKeyInfo> response = ApiResponse.success(expectedKey);
        when(httpClient.get(anyString(), isNull(), eq(PublicKeyInfo.class))).thenReturn(response);

        // Act
        PublicKeyInfo result = keyManager.get("key-123");

        // Assert
        assertNotNull(result);
        assertEquals("key-123", result.getId());
        verify(httpClient).get(eq("api/keys/key-123"), isNull(), eq(PublicKeyInfo.class));
    }

    @Test
    void testRevoke() throws Exception {
        // Arrange
        Map<String, Object> revocationResult = Map.of("status", "confirmed");
        ApiResponse<Map<String, Object>> response = ApiResponse.success(revocationResult);
        when(httpClient.delete(anyString(), any(), eq(Map.class))).thenReturn((ApiResponse) response);

        // Act
        ApiResponse<?> result = keyManager.revoke("key-123", "Compromised");

        // Assert
        assertNotNull(result);
        assertTrue(result.isSuccess());
    }
}

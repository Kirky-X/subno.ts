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
import securenotify.types.PaginationResult;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ChannelManager.
 */
@ExtendWith(MockitoExtension.class)
class ChannelManagerTest {

    @Mock
    private HttpClient httpClient;

    private ChannelManager channelManager;
    private RetryHandler retryHandler;

    @BeforeEach
    void setUp() {
        retryHandler = RetryHandler.DEFAULT;
        channelManager = new ChannelManager(httpClient, retryHandler);
    }

    @Test
    void testCreate() throws Exception {
        // Arrange
        ChannelInfo expectedChannel = new ChannelInfo();
        expectedChannel.setId("channel-123");
        expectedChannel.setType("encrypted");

        ApiResponse<ChannelInfo> response = ApiResponse.success(expectedChannel);
        when(httpClient.post(anyString(), any(), eq(ChannelInfo.class))).thenReturn(response);

        // Act
        ChannelInfo result = channelManager.create("encrypted");

        // Assert
        assertNotNull(result);
        assertEquals("channel-123", result.getId());
        assertEquals("encrypted", result.getType());
    }

    @Test
    void testCreateWithOptions() throws Exception {
        // Arrange
        ChannelInfo expectedChannel = new ChannelInfo();
        expectedChannel.setId("my-channel");
        expectedChannel.setName("Test Channel");
        expectedChannel.setType("public");

        ApiResponse<ChannelInfo> response = ApiResponse.success(expectedChannel);
        when(httpClient.post(anyString(), any(), eq(ChannelInfo.class))).thenReturn(response);

        // Act
        ChannelInfo result = channelManager.create("my-channel", "Test Channel", "Test description",
                "public", "user-1", 86400, null);

        // Assert
        assertNotNull(result);
        assertEquals("my-channel", result.getId());
        assertEquals("Test Channel", result.getName());
    }

    @Test
    void testGet() throws Exception {
        // Arrange
        ChannelInfo expectedChannel = new ChannelInfo();
        expectedChannel.setId("channel-123");
        expectedChannel.setActive(true);

        ApiResponse<ChannelInfo> response = ApiResponse.success(expectedChannel);
        when(httpClient.get(anyString(), isNull(), eq(ChannelInfo.class))).thenReturn(response);

        // Act
        ChannelInfo result = channelManager.get("channel-123");

        // Assert
        assertNotNull(result);
        assertTrue(result.isActive());
        verify(httpClient).get(eq("api/channels/channel-123"), isNull(), eq(ChannelInfo.class));
    }

    @Test
    void testList() throws Exception {
        // Arrange
        ChannelManager.ChannelListResponse expectedResponse = new ChannelManager.ChannelListResponse();
        ChannelInfo[] channels = {new ChannelInfo(), new ChannelInfo()};
        channels[0].setId("channel-1");
        channels[1].setId("channel-2");
        expectedResponse.setChannels(channels);
        expectedResponse.setPagination(new PaginationResult(2, 50, 0, false));

        ApiResponse<ChannelManager.ChannelListResponse> response = ApiResponse.success(expectedResponse);
        when(httpClient.post(anyString(), any(), eq(ChannelManager.ChannelListResponse.class))).thenReturn(response);

        // Act
        ChannelManager.ChannelListResponse result = channelManager.list();

        // Assert
        assertNotNull(result);
        assertEquals(2, result.getChannels().length);
        assertFalse(result.getPagination().isHasMore());
    }

    @Test
    void testDelete() throws Exception {
        // Arrange
        ApiResponse<Object> response = ApiResponse.success(null);
        when(httpClient.delete(anyString(), eq(Map.class))).thenReturn(response);

        // Act
        ApiResponse<Object> result = channelManager.delete("channel-123");

        // Assert
        assertNotNull(result);
        assertTrue(result.isSuccess());
        verify(httpClient).delete(eq("api/channels/channel-123"), eq(Map.class));
    }
}

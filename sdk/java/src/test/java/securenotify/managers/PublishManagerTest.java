// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.managers;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import securenotify.types.ApiResponse;
import securenotify.types.MessageInfo;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for PublishManager.
 */
@ExtendWith(MockitoExtension.class)
class PublishManagerTest {

    @Mock
    private HttpClient httpClient;

    private PublishManager publishManager;
    private RetryHandler retryHandler;

    @BeforeEach
    void setUp() {
        retryHandler = RetryHandler.DEFAULT;
        publishManager = new PublishManager(httpClient, retryHandler);
    }

    @Test
    void testSend() throws Exception {
        // Arrange
        MessageInfo.MessagePublishResponse expectedResponse = new MessageInfo.MessagePublishResponse();
        expectedResponse.setMessageId("msg-123");
        expectedResponse.setChannel("channel-123");

        ApiResponse<MessageInfo.MessagePublishResponse> response = ApiResponse.success(expectedResponse);
        when(httpClient.post(anyString(), any(), eq(MessageInfo.MessagePublishResponse.class))).thenReturn(response);

        // Act
        MessageInfo.MessagePublishResponse result = publishManager.send("channel-123", "Hello, World!");

        // Assert
        assertNotNull(result);
        assertEquals("msg-123", result.getMessageId());
        assertEquals("channel-123", result.getChannel());
    }

    @Test
    void testSendCritical() throws Exception {
        // Arrange
        MessageInfo.MessagePublishResponse expectedResponse = new MessageInfo.MessagePublishResponse();
        expectedResponse.setMessageId("msg-456");
        expectedResponse.setChannel("channel-123");

        ApiResponse<MessageInfo.MessagePublishResponse> response = ApiResponse.success(expectedResponse);
        when(httpClient.post(anyString(), any(), eq(MessageInfo.MessagePublishResponse.class))).thenReturn(response);

        // Act
        MessageInfo.MessagePublishResponse result = publishManager.sendCritical("channel-123", "Critical alert!");

        // Assert
        assertNotNull(result);
        assertEquals("msg-456", result.getMessageId());
    }

    @Test
    void testSendWithOptions() throws Exception {
        // Arrange
        MessageInfo.MessagePublishResponse expectedResponse = new MessageInfo.MessagePublishResponse();
        expectedResponse.setMessageId("msg-789");
        expectedResponse.setChannel("channel-123");

        ApiResponse<MessageInfo.MessagePublishResponse> response = ApiResponse.success(expectedResponse);
        when(httpClient.post(anyString(), any(), eq(MessageInfo.MessagePublishResponse.class))).thenReturn(response);

        // Act
        MessageInfo.MessagePublishResponse result = publishManager.send(
                "channel-123",
                "Test message",
                "high",
                "user-1",
                true,
                false,
                true,
                "signature123"
        );

        // Assert
        assertNotNull(result);
        assertEquals("msg-789", result.getMessageId());
    }

    @Test
    void testGetQueueStatus() throws Exception {
        // Arrange
        MessageInfo.QueueStatusResponse expectedResponse = new MessageInfo.QueueStatusResponse();
        expectedResponse.setChannel("channel-123");
        expectedResponse.setQueueLength(5);

        ApiResponse<MessageInfo.QueueStatusResponse> response = ApiResponse.success(expectedResponse);
        when(httpClient.get(anyString(), anyMap(), eq(MessageInfo.QueueStatusResponse.class))).thenReturn(response);

        // Act
        MessageInfo.QueueStatusResponse result = publishManager.getQueueStatus("channel-123");

        // Assert
        assertNotNull(result);
        assertEquals(5, result.getQueueLength());
    }

    @Test
    void testGetMessage() throws Exception {
        // Arrange
        MessageInfo expectedMessage = new MessageInfo();
        expectedMessage.setId("msg-123");
        expectedMessage.setMessage("Test message");

        ApiResponse<MessageInfo> response = ApiResponse.success(expectedMessage);
        when(httpClient.get(anyString(), isNull(), eq(MessageInfo.class))).thenReturn(response);

        // Act
        MessageInfo result = publishManager.getMessage("msg-123");

        // Assert
        assertNotNull(result);
        assertEquals("msg-123", result.getId());
        verify(httpClient).get(eq("api/publish/msg-123"), isNull(), eq(MessageInfo.class));
    }
}

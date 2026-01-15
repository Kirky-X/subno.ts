// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import org.junit.jupiter.api.Test;
import securenotify.exceptions.NetworkException;
import securenotify.exceptions.ApiException;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for RetryHandler.
 */
class RetryHandlerTest {

    @Test
    void testSuccessfulCallNoRetries() throws Exception {
        // Arrange
        AtomicInteger callCount = new AtomicInteger(0);
        RetryHandler handler = new RetryHandler(3, 100, 1000, 2.0, false);

        // Act
        String result = handler.execute(() -> {
            callCount.incrementAndGet();
            return "success";
        });

        // Assert
        assertEquals("success", result);
        assertEquals(1, callCount.get());
    }

    @Test
    void testRetryOnException() throws Exception {
        // Arrange
        AtomicInteger callCount = new AtomicInteger(0);
        RetryHandler handler = new RetryHandler(3, 10, 100, 2.0, false);

        // Act
        String result = handler.execute(() -> {
            callCount.incrementAndGet();
            if (callCount.get() < 2) {
                throw new NetworkException("Temporary failure");
            }
            return "success";
        });

        // Assert
        assertEquals("success", result);
        assertEquals(2, callCount.get());
    }

    @Test
    void testMaxRetriesExceeded() {
        // Arrange
        AtomicInteger callCount = new AtomicInteger(0);
        RetryHandler handler = new RetryHandler(2, 10, 100, 2.0, false);

        // Act & Assert
        assertThrows(NetworkException.class, () ->
                handler.execute(() -> {
                    callCount.incrementAndGet();
                    throw new NetworkException("Connection timeout");
                })
        );

        assertEquals(3, callCount.get()); // Initial + 2 retries
    }

    @Test
    void testNonRetryableException() {
        // Arrange
        AtomicInteger callCount = new AtomicInteger(0);
        RetryHandler handler = new RetryHandler(3, 10, 100, 2.0, false);

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () ->
                handler.execute(() -> {
                    callCount.incrementAndGet();
                    throw new IllegalArgumentException("Non-retryable error");
                })
        );

        assertEquals(1, callCount.get()); // No retries for non-retryable exceptions
    }

    @Test
    void testDefaultConfiguration() {
        // Arrange & Act
        RetryHandler handler = new RetryHandler();

        // Assert
        assertEquals(3, handler.getMaxRetries());
        assertEquals(1000, handler.getInitialDelayMs());
        assertEquals(30000, handler.getMaxDelayMs());
        assertEquals(2.0, handler.getBackoffMultiplier());
        assertTrue(handler.isJitterEnabled());
    }

    @Test
    void testCustomConfiguration() {
        // Arrange & Act
        RetryHandler handler = new RetryHandler(5, 500, 10000, 1.5, false);

        // Assert
        assertEquals(5, handler.getMaxRetries());
        assertEquals(500, handler.getInitialDelayMs());
        assertEquals(10000, handler.getMaxDelayMs());
        assertEquals(1.5, handler.getBackoffMultiplier());
        assertFalse(handler.isJitterEnabled());
    }

    @Test
    void testBuilder() {
        // Arrange & Act
        RetryHandler handler = new RetryHandler.Builder()
                .maxRetries(4)
                .initialDelayMs(200)
                .maxDelayMs(5000)
                .backoffMultiplier(1.8)
                .jitter(false)
                .build();

        // Assert
        assertEquals(4, handler.getMaxRetries());
        assertEquals(200, handler.getInitialDelayMs());
        assertEquals(5000, handler.getMaxDelayMs());
        assertEquals(1.8, handler.getBackoffMultiplier());
        assertFalse(handler.isJitterEnabled());
    }

    @Test
    void testRetryOnApiServerError() throws Exception {
        // Arrange
        AtomicInteger callCount = new AtomicInteger(0);
        RetryHandler handler = new RetryHandler(3, 10, 100, 2.0, false);

        // Act
        String result = handler.execute(() -> {
            callCount.incrementAndGet();
            if (callCount.get() < 2) {
                throw new ApiException(500, "Internal Server Error");
            }
            return "success";
        });

        // Assert
        assertEquals("success", result);
        assertEquals(2, callCount.get());
    }

    @Test
    void testNoRetryOnApiClientError() {
        // Arrange
        AtomicInteger callCount = new AtomicInteger(0);
        RetryHandler handler = new RetryHandler(3, 10, 100, 2.0, false);

        // Act & Assert
        assertThrows(ApiException.class, () ->
                handler.execute(() -> {
                    callCount.incrementAndGet();
                    throw new ApiException(400, "Bad Request");
                })
        );

        assertEquals(1, callCount.get()); // No retries for client errors
    }
}

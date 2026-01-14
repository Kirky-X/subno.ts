// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import securenotify.exceptions.ApiException;
import securenotify.exceptions.NetworkException;
import securenotify.exceptions.RateLimitException;

import java.util.Random;
import java.util.function.Supplier;

/**
 * Retry handler with exponential backoff and jitter.
 */
public class RetryHandler {

    private static final Logger logger = LoggerFactory.getLogger(RetryHandler.class);

    private final int maxRetries;
    private final long initialDelayMs;
    private final long maxDelayMs;
    private final double backoffMultiplier;
    private final boolean jitter;
    private final Random random = new Random();

    /**
     * Default retry configuration.
     */
    public static final RetryHandler DEFAULT = new RetryHandler(3, 1000, 30000, 2.0, true);

    public RetryHandler() {
        this(3, 1000, 30000, 2.0, true);
    }

    public RetryHandler(int maxRetries, long initialDelayMs, long maxDelayMs,
                        double backoffMultiplier, boolean jitter) {
        this.maxRetries = maxRetries;
        this.initialDelayMs = initialDelayMs;
        this.maxDelayMs = maxDelayMs;
        this.backoffMultiplier = backoffMultiplier;
        this.jitter = jitter;
    }

    /**
     * Execute a supplier with retry logic.
     *
     * @param supplier The supplier to execute
     * @param <T>      The return type
     * @return The result of the supplier
     * @throws Exception if all retries fail
     */
    public <T> T execute(Supplier<T> supplier) throws Exception {
        int attempt = 0;
        long delay = initialDelayMs;

        while (true) {
            try {
                return supplier.get();
            } catch (Exception e) {
                attempt++;

                if (!shouldRetry(e) || attempt > maxRetries) {
                    logger.warn("Retry attempt {}/{} failed, no more retries", attempt, maxRetries);
                    throw e;
                }

                long actualDelay = calculateDelay(delay, attempt);
                logger.warn("Retry attempt {}/{} after {}ms: {}",
                        attempt, maxRetries, actualDelay, e.getMessage());

                Thread.sleep(actualDelay);
                delay = Math.min((long) (delay * backoffMultiplier), maxDelayMs);
            }
        }
    }

    /**
     * Execute an async supplier with retry logic.
     *
     * @param supplier The async supplier to execute
     * @param <T>      The return type
     * @return The result of the supplier
     * @throws Exception if all retries fail
     */
    public <T> java.util.concurrent.CompletableFuture<T> executeAsync(
            java.util.function.Supplier<java.util.concurrent.CompletableFuture<T>> supplier) throws Exception {

        int attempt = 0;
        long delay = initialDelayMs;

        while (true) {
            try {
                return supplier.get();
            } catch (Exception e) {
                attempt++;

                if (!shouldRetry(e) || attempt > maxRetries) {
                    logger.warn("Retry attempt {}/{} failed, no more retries", attempt, maxRetries);
                    throw e;
                }

                long actualDelay = calculateDelay(delay, attempt);
                logger.warn("Retry attempt {}/{} after {}ms: {}",
                        attempt, maxRetries, actualDelay, e.getMessage());

                Thread.sleep(actualDelay);
                delay = Math.min((long) (delay * backoffMultiplier), maxDelayMs);
            }
        }
    }

    /**
     * Check if an exception should trigger a retry.
     */
    private boolean shouldRetry(Exception e) {
        // Retry on network errors
        if (e instanceof NetworkException) {
            return ((NetworkException) e).isRetryable();
        }

        // Retry on rate limit errors
        if (e instanceof RateLimitException) {
            return true;
        }

        // Retry on server errors (5xx)
        if (e instanceof ApiException && ((ApiException) e).isServerError()) {
            return true;
        }

        // Retry on gateway errors and timeouts
        if (e instanceof ApiException) {
            int code = ((ApiException) e).getStatusCode();
            return code == 408 || code == 502 || code == 503 || code == 504;
        }

        return false;
    }

    /**
     * Calculate the delay with optional jitter.
     */
    private long calculateDelay(long baseDelay, int attempt) {
        if (!jitter) {
            return baseDelay;
        }

        // Add random jitter of ±25%
        double jitterFactor = 0.75 + (random.nextDouble() * 0.5);
        long delay = (long) (baseDelay * jitterFactor);

        // Reduce delay for rate limit errors
        if (attempt == 1) {
            delay = Math.min(delay, 1000); // First retry after 1 second max
        }

        return delay;
    }

    /**
     * Calculate retry-after delay from RateLimitException.
     */
    public static long getRetryAfterDelay(RateLimitException e) {
        return e.getWaitTimeMillis();
    }

    // Getters for configuration
    public int getMaxRetries() {
        return maxRetries;
    }

    public long getInitialDelayMs() {
        return initialDelayMs;
    }

    public long getMaxDelayMs() {
        return maxDelayMs;
    }

    public double getBackoffMultiplier() {
        return backoffMultiplier;
    }

    public boolean isJitterEnabled() {
        return jitter;
    }

    /**
     * Builder for custom retry configurations.
     */
    public static class Builder {
        private int maxRetries = 3;
        private long initialDelayMs = 1000;
        private long maxDelayMs = 30000;
        private double backoffMultiplier = 2.0;
        private boolean jitter = true;

        public Builder maxRetries(int maxRetries) {
            this.maxRetries = maxRetries;
            return this;
        }

        public Builder initialDelayMs(long delayMs) {
            this.initialDelayMs = delayMs;
            return this;
        }

        public Builder maxDelayMs(long delayMs) {
            this.maxDelayMs = delayMs;
            return this;
        }

        public Builder backoffMultiplier(double multiplier) {
            this.backoffMultiplier = multiplier;
            return this;
        }

        public Builder jitter(boolean enabled) {
            this.jitter = enabled;
            return this;
        }

        public RetryHandler build() {
            return new RetryHandler(maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier, jitter);
        }
    }
}

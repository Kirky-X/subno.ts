// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Token bucket rate limiter for preventing API abuse.
 * <p>
 * This implementation uses a semaphore to control the rate of requests.
 * Tokens are refilled at a constant rate, and requests must acquire a token
 * before proceeding.
 */
public class RateLimiter {
    private final Semaphore semaphore;
    private final int maxTokens;
    private final long refillIntervalMs;
    private final int tokensPerRefill;
    private long lastRefillTime;

    /**
     * Create a new rate limiter.
     *
     * @param maxTokens        Maximum number of tokens available
     * @param tokensPerRefill  Number of tokens to add per refill interval
     * @param refillIntervalMs Time between token refills in milliseconds
     */
    public RateLimiter(int maxTokens, int tokensPerRefill, long refillIntervalMs) {
        this.maxTokens = maxTokens;
        this.tokensPerRefill = tokensPerRefill;
        this.refillIntervalMs = refillIntervalMs;
        this.semaphore = new Semaphore(maxTokens, true);
        this.lastRefillTime = System.currentTimeMillis();
    }

    /**
     * Create a default rate limiter (10 requests per second).
     */
    public RateLimiter() {
        this(10, 10, 1000);
    }

    /**
     * Attempt to acquire a token.
     *
     * @param timeoutMs Maximum time to wait for a token in milliseconds
     * @return true if token was acquired, false if timeout occurred
     */
    public synchronized boolean tryAcquire(long timeoutMs) {
        refillTokens();
        try {
            return semaphore.tryAcquire(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /**
     * Acquire a token, blocking until one is available.
     *
     * @throws InterruptedException if interrupted while waiting
     */
    public void acquire() throws InterruptedException {
        refillTokens();
        semaphore.acquire();
    }

    /**
     * Refill tokens based on elapsed time.
     */
    private void refillTokens() {
        long now = System.currentTimeMillis();
        long elapsed = now - lastRefillTime;

        if (elapsed >= refillIntervalMs) {
            int intervals = (int) (elapsed / refillIntervalMs);
            int tokensToAdd = Math.min(tokensPerRefill * intervals, maxTokens - semaphore.availablePermits());

            if (tokensToAdd > 0) {
                semaphore.release(tokensToAdd);
            }

            lastRefillTime = now;
        }
    }

    /**
     * Get the number of available tokens.
     *
     * @return Available token count
     */
    public int getAvailableTokens() {
        refillTokens();
        return semaphore.availablePermits();
    }

    /**
     * Check if a token is available without acquiring it.
     *
     * @return true if at least one token is available
     */
    public boolean isAvailable() {
        return getAvailableTokens() > 0;
    }
}
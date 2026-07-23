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
     * Create a default rate limiter (10 requests per second).
     */
    public RateLimiter() {
        this(10, 10, 1000);
    }

    public synchronized boolean tryAcquire(long timeoutMs) {
        refillTokens();
        try {
            return semaphore.tryAcquire(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    public void acquire() throws InterruptedException {
        refillTokens();
        semaphore.acquire();
    }

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

    public int getAvailableTokens() {
        refillTokens();
        return semaphore.availablePermits();
    }

    public boolean isAvailable() {
        return getAvailableTokens() > 0;
    }
}
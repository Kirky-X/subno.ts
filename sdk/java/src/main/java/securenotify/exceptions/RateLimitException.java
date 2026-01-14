// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.exceptions;

/**
 * Exception for rate limit errors (429 Too Many Requests).
 */
public class RateLimitException extends SecureNotifyException {

    private final int retryAfterSeconds;
    private final long limitResetAt;

    public RateLimitException(String message) {
        super(message, "RATE_LIMIT");
        this.retryAfterSeconds = -1;
        this.limitResetAt = -1;
    }

    public RateLimitException(String message, int retryAfterSeconds) {
        super(message, "RATE_LIMIT");
        this.retryAfterSeconds = retryAfterSeconds;
        this.limitResetAt = System.currentTimeMillis() + (retryAfterSeconds * 1000L);
    }

    public RateLimitException(String message, int retryAfterSeconds, long limitResetAt) {
        super(message, "RATE_LIMIT");
        this.retryAfterSeconds = retryAfterSeconds;
        this.limitResetAt = limitResetAt;
    }

    /**
     * Get the number of seconds to wait before retrying.
     *
     * @return seconds to wait, or -1 if not specified
     */
    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }

    /**
     * Get the timestamp when the rate limit resets.
     *
     * @return epoch millis, or -1 if not available
     */
    public long getLimitResetAt() {
        return limitResetAt;
    }

    /**
     * Calculate the recommended wait time in milliseconds.
     *
     * @return milliseconds to wait, or calculated from reset time if available
     */
    public long getWaitTimeMillis() {
        if (retryAfterSeconds > 0) {
            return retryAfterSeconds * 1000L;
        }
        if (limitResetAt > 0) {
            long wait = limitResetAt - System.currentTimeMillis();
            return wait > 0 ? wait : 1000;
        }
        return 5000; // Default 5 seconds
    }

    @Override
    public String toString() {
        return String.format("RateLimitException[retryAfter=%ds]: %s", retryAfterSeconds, getMessage());
    }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.exceptions;

/**
 * Exception for network-related errors (connection failures, timeouts, etc.).
 */
public class NetworkException extends SecureNotifyException {

    private final boolean isTimeout;
    private final boolean isConnectionRefused;

    public NetworkException(String message) {
        super(message, "NETWORK_ERROR");
        this.isTimeout = false;
        this.isConnectionRefused = false;
    }

    public NetworkException(String message, Throwable cause) {
        super(message, "NETWORK_ERROR", cause);
        this.isTimeout = message != null && message.toLowerCase().contains("timeout");
        this.isConnectionRefused = message != null && message.toLowerCase().contains("connection refused");
    }

    public NetworkException(String message, String errorCode, Throwable cause) {
        super(message, errorCode, cause);
        this.isTimeout = message != null && message.toLowerCase().contains("timeout");
        this.isConnectionRefused = message != null && message.toLowerCase().contains("connection refused");
    }

    public boolean isTimeout() {
        return isTimeout;
    }

    public boolean isConnectionRefused() {
        return isConnectionRefused;
    }

    /**
     * Check if this network error is retryable.
     * Timeouts and connection refused are typically retryable.
     */
    public boolean isRetryable() {
        return isTimeout || isConnectionRefused || getMessage() != null && (
                getMessage().toLowerCase().contains("temporary failure") ||
                getMessage().toLowerCase().contains("name or service not known") ||
                getMessage().toLowerCase().contains("no route to host")
        );
    }

    @Override
    public String toString() {
        return String.format("NetworkException[%s]: %s", getErrorCode(), getMessage());
    }
}

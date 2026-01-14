// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.exceptions;

/**
 * Exception for API-related errors (4xx, 5xx responses).
 */
public class ApiException extends SecureNotifyException {

    private final int statusCode;
    private final String responseBody;

    public ApiException(int statusCode, String message) {
        super(message, "API_ERROR");
        this.statusCode = statusCode;
        this.responseBody = null;
    }

    public ApiException(int statusCode, String message, String errorCode) {
        super(message, errorCode);
        this.statusCode = statusCode;
        this.responseBody = null;
    }

    public ApiException(int statusCode, String message, String responseBody, String errorCode) {
        super(message, errorCode);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public ApiException(int statusCode, String message, Throwable cause) {
        super(message, "API_ERROR", cause);
        this.statusCode = statusCode;
        this.responseBody = null;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getResponseBody() {
        return responseBody;
    }

    /**
     * Check if this is a client error (4xx).
     */
    public boolean isClientError() {
        return statusCode >= 400 && statusCode < 500;
    }

    /**
     * Check if this is a server error (5xx).
     */
    public boolean isServerError() {
        return statusCode >= 500;
    }

    /**
     * Check if this is an authentication error.
     */
    public boolean isAuthenticationError() {
        return statusCode == 401 || statusCode == 403;
    }

    /**
     * Check if this is a rate limit error.
     */
    public boolean isRateLimitError() {
        return statusCode == 429;
    }

    /**
     * Check if this error is retryable (server errors are typically retryable).
     */
    public boolean isRetryable() {
        return isServerError() || statusCode == 408 || statusCode == 502 || statusCode == 503 || statusCode == 504;
    }

    @Override
    public String toString() {
        return String.format("ApiException[%d, %s]: %s", statusCode, getErrorCode(), getMessage());
    }
}

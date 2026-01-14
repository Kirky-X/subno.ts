// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.exceptions;

/**
 * Base exception for all SecureNotify SDK errors.
 */
public class SecureNotifyException extends RuntimeException {

    private final String errorCode;

    public SecureNotifyException(String message) {
        super(message);
        this.errorCode = "UNKNOWN";
    }

    public SecureNotifyException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
    }

    public SecureNotifyException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "UNKNOWN";
    }

    public SecureNotifyException(String message, String errorCode, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }

    @Override
    public String toString() {
        return String.format("SecureNotifyException[%s]: %s", errorCode, getMessage());
    }
}

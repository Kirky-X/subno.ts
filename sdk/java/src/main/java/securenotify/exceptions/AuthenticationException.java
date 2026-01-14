// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.exceptions;

/**
 * Exception for authentication/authorization errors.
 */
public class AuthenticationException extends SecureNotifyException {

    private final String authType;

    public AuthenticationException(String message) {
        super(message, "AUTH_ERROR");
        this.authType = "unknown";
    }

    public AuthenticationException(String message, String authType) {
        super(message, "AUTH_ERROR");
        this.authType = authType;
    }

    public AuthenticationException(String message, Throwable cause) {
        super(message, "AUTH_ERROR", cause);
        this.authType = "unknown";
    }

    public String getAuthType() {
        return authType;
    }

    @Override
    public String toString() {
        return String.format("AuthenticationException[%s]: %s", authType, getMessage());
    }
}

# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

from typing import Optional, Dict, Any
from enum import Enum


class ErrorCode(Enum):
    """Error codes returned by the SecureNotify API."""

    # Success (no error)
    SUCCESS = "SUCCESS"

    # Authentication errors (4xx)
    AUTH_REQUIRED = "AUTH_REQUIRED"
    AUTH_FAILED = "AUTH_FAILED"
    FORBIDDEN = "FORBIDDEN"

    # Resource errors (4xx)
    NOT_FOUND = "NOT_FOUND"
    CHANNEL_EXISTS = "CHANNEL_EXISTS"
    KEY_EXPIRED = "KEY_EXPIRED"
    RESOURCE_EXISTS = "RESOURCE_EXISTS"

    # Request errors (4xx)
    VALIDATION_ERROR = "VALIDATION_ERROR"
    MESSAGE_TOO_LARGE = "MESSAGE_TOO_LARGE"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"

    # Server errors (5xx)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    BAD_GATEWAY = "BAD_GATEWAY"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT"

    # Client-side errors
    NETWORK_ERROR = "NETWORK_ERROR"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    CONNECTION_ERROR = "CONNECTION_ERROR"
    SERIALIZATION_ERROR = "SERIALIZATION_ERROR"
    DESERIALIZATION_ERROR = "DESERIALIZATION_ERROR"

    # SSE errors
    SSE_CONNECTION_ERROR = "SSE_CONNECTION_ERROR"
    SSE_HEARTBEAT_TIMEOUT = "SSE_HEARTBEAT_TIMEOUT"

    # SDK errors
    INVALID_OPTIONS = "INVALID_OPTIONS"
    MISSING_API_KEY = "MISSING_API_KEY"
    INVALID_BASE_URL = "INVALID_BASE_URL"


# Retryable error codes
RETRYABLE_ERRORS = {
    ErrorCode.RATE_LIMIT_EXCEEDED,
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.BAD_GATEWAY,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.GATEWAY_TIMEOUT,
    ErrorCode.NETWORK_ERROR,
    ErrorCode.TIMEOUT_ERROR,
    ErrorCode.CONNECTION_ERROR,
    ErrorCode.SSE_CONNECTION_ERROR,
    ErrorCode.SSE_HEARTBEAT_TIMEOUT,
}

# Non-retryable error codes
NON_RETRYABLE_ERRORS = {
    ErrorCode.AUTH_REQUIRED,
    ErrorCode.AUTH_FAILED,
    ErrorCode.FORBIDDEN,
    ErrorCode.NOT_FOUND,
    ErrorCode.CHANNEL_EXISTS,
    ErrorCode.KEY_EXPIRED,
    ErrorCode.RESOURCE_EXISTS,
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.MESSAGE_TOO_LARGE,
}


class SecureNotifyError(Exception):
    """Base exception class for SecureNotify SDK."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __str__(self) -> str:
        if self.details:
            return f"{self.message} (details: {self.details})"
        return self.message


class SecureNotifyApiError(SecureNotifyError):
    """Exception raised when API returns an error."""

    def __init__(
        self,
        status_code: int,
        error_code: ErrorCode,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ):
        super().__init__(message, details)
        self.status_code = status_code
        self.error_code = error_code
        self.request_id = request_id

    @property
    def is_retryable(self) -> bool:
        return self.error_code in RETRYABLE_ERRORS


class SecureNotifyConnectionError(SecureNotifyError):
    """Exception raised when connection fails."""

    def __init__(
        self,
        message: str = "Connection failed",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, details)


class SecureNotifyTimeoutError(SecureNotifyError):
    """Exception raised when request times out."""

    def __init__(
        self,
        message: str = "Request timed out",
        timeout: Optional[float] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, details)
        self.timeout = timeout


class SecureNotifyAuthenticationError(SecureNotifyError):
    """Exception raised when authentication fails."""

    def __init__(
        self,
        message: str = "Authentication failed",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, details)


class SecureNotifyRateLimitError(SecureNotifyApiError):
    """Exception raised when rate limited."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[float] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=429,
            error_code=ErrorCode.RATE_LIMIT_EXCEEDED,
            message=message,
            details=details,
        )
        self.retry_after = retry_after


def get_error_class(error_code: ErrorCode) -> type:
    """Get the appropriate exception class for an error code."""
    auth_errors = {
        ErrorCode.AUTH_REQUIRED,
        ErrorCode.AUTH_FAILED,
    }

    if error_code in auth_errors:
        return SecureNotifyAuthenticationError
    elif error_code == ErrorCode.RATE_LIMIT_EXCEEDED:
        return SecureNotifyRateLimitError
    elif error_code in RETRYABLE_ERRORS:
        return SecureNotifyApiError
    else:
        return SecureNotifyApiError

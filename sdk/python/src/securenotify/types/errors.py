"""Error Types and Exceptions.

Defines custom exception classes for SecureNotify SDK.
"""

from typing import Optional, Dict, Any
from enum import Enum


class ErrorCode(Enum):
    """Error codes returned by the SecureNotify API."""

    # Success (no error)
    SUCCESS = 0

    # Authentication errors (1xx)
    AUTH_REQUIRED = 1001
    AUTH_INVALID = 1002
    AUTH_EXPIRED = 1003
    AUTH_INSUFFICIENT_PERMISSIONS = 1004

    # Resource errors (2xx)
    RESOURCE_NOT_FOUND = 2001
    RESOURCE_EXISTS = 2002
    RESOURCE_EXPIRED = 2003
    RESOURCE_INVALID = 2004

    # Request errors (3xx)
    REQUEST_INVALID = 3001
    REQUEST_TOO_LARGE = 3002
    REQUEST_RATE_LIMITED = 3003

    # Server errors (5xx)
    SERVER_INTERNAL_ERROR = 5001
    SERVER_UNAVAILABLE = 5002
    SERVER_TIMEOUT = 5003

    # SDK errors (9xxx)
    SDK_CONNECTION_ERROR = 9001
    SDK_TIMEOUT_ERROR = 9002
    SDK_SERIALIZATION_ERROR = 9003
    SDK_RETRY_EXHAUSTED = 9004


# Retryable error codes
RETRYABLE_ERRORS = {
    ErrorCode.SERVER_UNAVAILABLE,
    ErrorCode.SERVER_TIMEOUT,
    ErrorCode.REQUEST_RATE_LIMITED,
    ErrorCode.SDK_CONNECTION_ERROR,
    ErrorCode.SDK_TIMEOUT_ERROR,
}

# Non-retryable error codes
NON_RETRYABLE_ERRORS = {
    ErrorCode.AUTH_REQUIRED,
    ErrorCode.AUTH_INVALID,
    ErrorCode.AUTH_EXPIRED,
    ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCode.RESOURCE_EXISTS,
    ErrorCode.RESOURCE_EXPIRED,
    ErrorCode.RESOURCE_INVALID,
    ErrorCode.REQUEST_INVALID,
    ErrorCode.REQUEST_TOO_LARGE,
    ErrorCode.SERVER_INTERNAL_ERROR,
    ErrorCode.SDK_SERIALIZATION_ERROR,
    ErrorCode.SDK_RETRY_EXHAUSTED,
}


class SecureNotifyError(Exception):
    """Base exception class for SecureNotify SDK."""

    def __init__(
        self,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        """Initialize SecureNotifyError.

        Args:
            message: Error message.
            details: Additional error details.
        """
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __str__(self) -> str:
        """Return string representation."""
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
        request_id: Optional[str] = None
    ):
        """Initialize SecureNotifyApiError.

        Args:
            status_code: HTTP status code.
            error_code: Error code from API.
            message: Error message from API.
            details: Additional error details.
            request_id: Request ID for debugging.
        """
        super().__init__(message, details)
        self.status_code = status_code
        self.error_code = error_code
        self.request_id = request_id

    @property
    def is_retryable(self) -> bool:
        """Check if the error is retryable."""
        return self.error_code in RETRYABLE_ERRORS


class SecureNotifyConnectionError(SecureNotifyError):
    """Exception raised when connection fails."""

    def __init__(
        self,
        message: str = "Connection failed",
        details: Optional[Dict[str, Any]] = None
    ):
        """Initialize SecureNotifyConnectionError.

        Args:
            message: Error message.
            details: Additional error details.
        """
        super().__init__(message, details)


class SecureNotifyTimeoutError(SecureNotifyError):
    """Exception raised when request times out."""

    def __init__(
        self,
        message: str = "Request timed out",
        timeout: Optional[float] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Initialize SecureNotifyTimeoutError.

        Args:
            message: Error message.
            timeout: Timeout in seconds.
            details: Additional error details.
        """
        super().__init__(message, details)
        self.timeout = timeout


class SecureNotifyAuthenticationError(SecureNotifyError):
    """Exception raised when authentication fails."""

    def __init__(
        self,
        message: str = "Authentication failed",
        details: Optional[Dict[str, Any]] = None
    ):
        """Initialize SecureNotifyAuthenticationError.

        Args:
            message: Error message.
            details: Additional error details.
        """
        super().__init__(message, details)


class SecureNotifyRateLimitError(SecureNotifyApiError):
    """Exception raised when rate limited."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[float] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Initialize SecureNotifyRateLimitError.

        Args:
            message: Error message.
            retry_after: Seconds to wait before retry.
            details: Additional error details.
        """
        super().__init__(
            status_code=429,
            error_code=ErrorCode.REQUEST_RATE_LIMITED,
            message=message,
            details=details
        )
        self.retry_after = retry_after


def get_error_class(error_code: ErrorCode) -> type:
    """Get the appropriate exception class for an error code.

    Args:
        error_code: Error code from API.

    Returns:
        Exception class to use.
    """
    if error_code == ErrorCode.AUTH_REQUIRED:
        return SecureNotifyAuthenticationError
    elif error_code == ErrorCode.AUTH_INVALID:
        return SecureNotifyAuthenticationError
    elif error_code == ErrorCode.AUTH_EXPIRED:
        return SecureNotifyAuthenticationError
    elif error_code == ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS:
        return SecureNotifyAuthenticationError
    elif error_code == ErrorCode.REQUEST_RATE_LIMITED:
        return SecureNotifyRateLimitError
    elif error_code in RETRYABLE_ERRORS:
        return SecureNotifyApiError
    else:
        return SecureNotifyApiError

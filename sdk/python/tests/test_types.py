"""Unit tests for API types."""

import pytest
from datetime import datetime

from securenotify.types.api import (
    RegisterPublicKeyRequest,
    RegisterPublicKeyResponse,
    ChannelCreateRequest,
    ChannelCreateResponse,
    MessagePublishRequest,
    MessagePriority,
    ChannelType,
    ApiKeyCreateRequest,
)
from securenotify.types.errors import (
    SecureNotifyError,
    SecureNotifyApiError,
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
    SecureNotifyAuthenticationError,
    ErrorCode,
)


class TestApiTypes:
    """Tests for API type definitions."""

    def test_register_public_key_request_valid(self):
        """Test valid register public key request."""
        request = RegisterPublicKeyRequest(
            public_key="-----BEGIN PUBLIC KEY-----",
            algorithm="RSA-4096"
        )
        assert request.public_key == "-----BEGIN PUBLIC KEY-----"
        assert request.algorithm == "RSA-4096"
        assert request.expires_in is None
        assert request.metadata is None

    def test_register_public_key_request_with_options(self):
        """Test register request with optional fields."""
        request = RegisterPublicKeyRequest(
            public_key="-----BEGIN PUBLIC KEY-----",
            algorithm="RSA-2048",
            expires_in=3600,
            metadata={"key_usage": "signing"}
        )
        assert request.expires_in == 3600
        assert request.metadata == {"key_usage": "signing"}

    def test_register_public_key_request_missing_public_key(self):
        """Test that missing public_key raises ValueError."""
        with pytest.raises(ValueError):
            RegisterPublicKeyRequest(
                public_key="",
                algorithm="RSA-4096"
            )

    def test_register_public_key_request_missing_algorithm(self):
        """Test that missing algorithm raises ValueError."""
        with pytest.raises(ValueError):
            RegisterPublicKeyRequest(
                public_key="-----BEGIN PUBLIC KEY-----",
                algorithm=""
            )

    def test_channel_create_request_valid(self):
        """Test valid channel create request."""
        request = ChannelCreateRequest(
            name="my-channel",
            channel_type=ChannelType.ENCRYPTED
        )
        assert request.name == "my-channel"
        assert request.channel_type == ChannelType.ENCRYPTED

    def test_channel_create_request_all_types(self):
        """Test channel creation with all types."""
        for channel_type in ChannelType:
            request = ChannelCreateRequest(
                name="test",
                channel_type=channel_type
            )
            assert request.channel_type == channel_type

    def test_message_publish_request_valid(self):
        """Test valid message publish request."""
        request = MessagePublishRequest(
            channel="my-channel",
            message="Hello, World!"
        )
        assert request.channel == "my-channel"
        assert request.message == "Hello, World!"
        assert request.priority == MessagePriority.NORMAL
        assert request.encrypted is True

    def test_message_publish_request_custom_priority(self):
        """Test message publish with custom priority."""
        request = MessagePublishRequest(
            channel="my-channel",
            message="Urgent!",
            priority=MessagePriority.CRITICAL
        )
        assert request.priority == MessagePriority.CRITICAL

    def test_message_priority_values(self):
        """Test message priority enum values."""
        assert MessagePriority.CRITICAL.value == 100
        assert MessagePriority.HIGH.value == 75
        assert MessagePriority.NORMAL.value == 50
        assert MessagePriority.LOW.value == 25
        assert MessagePriority.BULK.value == 0

    def test_api_key_create_request_valid(self):
        """Test valid API key create request."""
        request = ApiKeyCreateRequest(
            name="My API Key",
            permissions=["publish", "subscribe"]
        )
        assert request.name == "My API Key"
        assert request.permissions == ["publish", "subscribe"]


class TestErrorTypes:
    """Tests for error type definitions."""

    def test_secure_notify_error_message(self):
        """Test SecureNotifyError message."""
        error = SecureNotifyError("Test error")
        assert str(error) == "Test error"
        assert error.message == "Test error"
        assert error.details == {}

    def test_secure_notify_error_with_details(self):
        """Test SecureNotifyError with details."""
        error = SecureNotifyError(
            "Test error",
            details={"key": "value"}
        )
        assert error.details == {"key": "value"}

    def test_secure_notify_api_error(self):
        """Test SecureNotifyApiError properties."""
        error = SecureNotifyApiError(
            status_code=400,
            error_code=ErrorCode.REQUEST_INVALID,
            message="Invalid request",
            request_id="req-123"
        )
        assert error.status_code == 400
        assert error.error_code == ErrorCode.REQUEST_INVALID
        assert error.request_id == "req-123"
        assert not error.is_retryable

    def test_secure_notify_api_error_retryable(self):
        """Test retryable error detection."""
        error = SecureNotifyApiError(
            status_code=503,
            error_code=ErrorCode.SERVER_UNAVAILABLE,
            message="Service unavailable"
        )
        assert error.is_retryable

    def test_secure_notify_connection_error(self):
        """Test SecureNotifyConnectionError."""
        error = SecureNotifyConnectionError("Connection failed")
        assert "Connection failed" in str(error)

    def test_secure_notify_timeout_error(self):
        """Test SecureNotifyTimeoutError."""
        error = SecureNotifyTimeoutError(
            message="Timed out",
            timeout=30.0
        )
        assert error.timeout == 30.0

    def test_secure_notify_authentication_error(self):
        """Test SecureNotifyAuthenticationError."""
        error = SecureNotifyAuthenticationError("Invalid API key")
        assert "Invalid API key" in str(error)

    def test_error_code_values(self):
        """Test ErrorCode enum values."""
        assert ErrorCode.SUCCESS.value == 0
        assert ErrorCode.AUTH_REQUIRED.value == 1001
        assert ErrorCode.SERVER_INTERNAL_ERROR.value == 5001

"""Unit tests for retry mechanism."""

import pytest
import asyncio

from securenotify.utils.retry import (
    RetryConfig,
    with_retry,
    DEFAULT_RETRY_CONFIG,
)
from securenotify.types.errors import (
    SecureNotifyApiError,
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
    SecureNotifyAuthenticationError,
    ErrorCode,
)


class TestRetryConfig:
    """Tests for RetryConfig."""

    def test_default_config_values(self):
        """Test default retry configuration values."""
        config = RetryConfig()
        assert config.max_retries == 3
        assert config.initial_delay == 1.0
        assert config.max_delay == 30.0
        assert config.backoff_multiplier == 2.0
        assert config.jitter is True

    def test_custom_config(self):
        """Test custom retry configuration."""
        config = RetryConfig(
            max_retries=5,
            initial_delay=2.0,
            max_delay=60.0,
            backoff_multiplier=3.0,
            jitter=False
        )
        assert config.max_retries == 5
        assert config.initial_delay == 2.0
        assert config.max_delay == 60.0
        assert config.backoff_multiplier == 3.0
        assert config.jitter is False

    def test_should_retry_max_retries_exceeded(self):
        """Test that retries stop after max_retries."""
        config = RetryConfig(max_retries=2)
        error = SecureNotifyConnectionError("Connection failed")

        assert config.should_retry(error, 0)  # First attempt, should retry
        assert config.should_retry(error, 1)  # Second attempt, should retry
        assert not config.should_retry(error, 2)  # Third attempt, should NOT retry
        assert not config.should_retry(error, 3)  # Beyond max, should NOT retry

    def test_should_retry_connection_error(self):
        """Test that connection errors are retryable."""
        config = RetryConfig()
        error = SecureNotifyConnectionError("Connection failed")

        assert config.should_retry(error, 0)
        assert config.should_retry(error, 1)

    def test_should_retry_timeout_error(self):
        """Test that timeout errors are retryable."""
        config = RetryConfig()
        error = SecureNotifyTimeoutError("Timed out")

        assert config.should_retry(error, 0)

    def test_should_not_retry_auth_error(self):
        """Test that authentication errors are not retryable."""
        config = RetryConfig()
        error = SecureNotifyAuthenticationError("Invalid key")

        assert not config.should_retry(error, 0)

    def test_should_not_retry_resource_not_found(self):
        """Test that not found errors are not retryable."""
        config = RetryConfig()
        error = SecureNotifyApiError(
            status_code=404,
            error_code=ErrorCode.NOT_FOUND,
            message="Not found"
        )

        assert not config.should_retry(error, 0)

    def test_should_retry_server_unavailable(self):
        """Test that server unavailable errors are retryable."""
        config = RetryConfig()
        error = SecureNotifyApiError(
            status_code=503,
            error_code=ErrorCode.SERVICE_UNAVAILABLE,
            message="Service unavailable"
        )

        assert config.should_retry(error, 0)

    def test_get_delay_exponential_backoff(self):
        """Test exponential backoff calculation."""
        config = RetryConfig(
            initial_delay=1.0,
            max_delay=100.0,
            backoff_multiplier=2.0,
            jitter=False
        )

        # First retry: 1.0 * 2^0 = 1.0
        assert config.get_delay(0) == 1.0

        # Second retry: 1.0 * 2^1 = 2.0
        assert config.get_delay(1) == 2.0

        # Third retry: 1.0 * 2^2 = 4.0
        assert config.get_delay(2) == 4.0

    def test_get_delay_max_cap(self):
        """Test that delay is capped at max_delay."""
        config = RetryConfig(
            initial_delay=10.0,
            max_delay=30.0,
            backoff_multiplier=3.0,
            jitter=False
        )

        # 10 * 3^2 = 90, should be capped at 30
        assert config.get_delay(2) == 30.0

    def test_get_delay_with_jitter(self):
        """Test that jitter adds randomness."""
        config = RetryConfig(
            initial_delay=10.0,
            max_delay=100.0,
            backoff_multiplier=2.0,
            jitter=True
        )

        delays = set()
        for _ in range(100):
            delay = config.get_delay(0)
            delays.add(delay)

        # With jitter, delays should vary
        assert len(delays) > 1


class TestWithRetry:
    """Tests for with_retry function."""

    @pytest.mark.asyncio
    async def test_successful_function(self):
        """Test that successful function returns immediately."""
        async def successful_func():
            return "success"

        result = await with_retry(successful_func)
        assert result == "success"

    @pytest.mark.asyncio
    async def test_retry_on_connection_error(self):
        """Test retry on connection error."""
        attempts = []

        async def failing_func():
            attempts.append(1)
            if len(attempts) < 2:
                raise SecureNotifyConnectionError("Connection failed")
            return "success"

        result = await with_retry(failing_func)
        assert result == "success"
        assert len(attempts) == 2

    @pytest.mark.asyncio
    async def test_max_retries_exhausted(self):
        """Test that error is raised after max retries."""
        config = RetryConfig(max_retries=2)
        attempts = []

        async def always_fail():
            attempts.append(1)
            raise SecureNotifyConnectionError("Always fails")

        with pytest.raises(SecureNotifyConnectionError):
            await with_retry(always_fail, config)

        # Should have tried 3 times (initial + 2 retries)
        assert len(attempts) == 3

    @pytest.mark.asyncio
    async def test_no_retry_on_non_retryable_error(self):
        """Test that non-retryable errors are raised immediately."""
        config = RetryConfig(max_retries=3)
        attempts = []

        async def always_fail():
            attempts.append(1)
            raise SecureNotifyAuthenticationError("Auth failed")

        with pytest.raises(SecureNotifyAuthenticationError):
            await with_retry(always_fail, config)

        # Should only try once
        assert len(attempts) == 1

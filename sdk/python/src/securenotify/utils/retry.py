"""Retry Mechanism with Exponential Backoff.

Implements retry logic with configurable backoff strategy.
"""

import asyncio
import secrets
import time
from typing import Callable, TypeVar, Awaitable, Optional

from securenotify.types.errors import (
    SecureNotifyApiError,
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
)


T = TypeVar("T")


def _get_crypto_jitter(range_val: float) -> float:
    """Generate cryptographically secure random jitter within range.

    Args:
        range_val: Maximum absolute value of jitter.

    Returns:
        Random float in range [-range_val, range_val].
    """
    # Generate 8 random bytes and convert to float in range [0, 1)
    random_bytes = secrets.token_bytes(8)
    random_value = int.from_bytes(random_bytes, "big") / (2**64 - 1)
    return (random_value * 2 * range_val) - range_val


class RetryConfig:
    """Configuration for retry behavior."""

    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 30.0,
        backoff_multiplier: float = 2.0,
        jitter: bool = True,
        retryable_exceptions: Optional[tuple] = None,
        non_retryable_exceptions: Optional[tuple] = None,
    ):
        """Initialize retry configuration.

        Args:
            max_retries: Maximum number of retry attempts.
            initial_delay: Initial delay between retries (seconds).
            max_delay: Maximum delay between retries (seconds).
            backoff_multiplier: Multiplier for exponential backoff.
            jitter: Whether to add random jitter to delays.
            retryable_exceptions: Exceptions that should trigger retry.
            non_retryable_exceptions: Exceptions that should not trigger retry.
        """
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.backoff_multiplier = backoff_multiplier
        self.jitter = jitter
        self.retryable_exceptions = retryable_exceptions or (
            SecureNotifyConnectionError,
            SecureNotifyTimeoutError,
        )
        self.non_retryable_exceptions = non_retryable_exceptions or (
            SecureNotifyApiError,
        )

    def should_retry(self, exception: Exception, attempt: int) -> bool:
        """Determine if an exception should trigger a retry.

        Args:
            exception: The exception that was raised.
            attempt: Current attempt number (0-indexed).

        Returns:
            True if the exception is retryable.
        """
        if attempt >= self.max_retries:
            return False

        # Check for non-retryable exceptions
        for exc_type in self.non_retryable_exceptions:
            if isinstance(exception, exc_type):
                if isinstance(exception, SecureNotifyApiError):
                    return exception.is_retryable
                return False

        # Check for retryable exceptions
        for exc_type in self.retryable_exceptions:
            if isinstance(exception, exc_type):
                return True

        return False

    def get_delay(self, attempt: int) -> float:
        """Calculate delay before next retry.

        Args:
            attempt: Current attempt number (0-indexed).

        Returns:
            Delay in seconds.
        """
        delay = self.initial_delay * (self.backoff_multiplier**attempt)
        delay = min(delay, self.max_delay)

        if self.jitter:
            # Add cryptographically secure random jitter (±25%)
            jitter_range = delay * 0.25
            delay = delay + _get_crypto_jitter(jitter_range)

        return max(0, delay)


DEFAULT_RETRY_CONFIG = RetryConfig()


async def with_retry(
    func: Callable[[], Awaitable[T]], config: Optional[RetryConfig] = None
) -> T:
    """Execute a function with retry logic.

    Args:
        func: Async function to execute.
        config: Retry configuration. Uses default if not provided.

    Returns:
        Result of the function.

    Raises:
        The last exception if all retries are exhausted.
    """
    config = config or DEFAULT_RETRY_CONFIG
    last_exception = None

    for attempt in range(config.max_retries + 1):
        try:
            return await func()
        except Exception as e:
            last_exception = e

            if not config.should_retry(e, attempt):
                raise

            delay = config.get_delay(attempt)
            if delay > 0:
                await asyncio.sleep(delay)

    raise last_exception


class RetryableException(Exception):
    """Exception indicating the operation can be retried."""

    def __init__(self, message: str, retry_after: Optional[float] = None):
        """Initialize RetryableException.

        Args:
            message: Error message.
            retry_after: Recommended delay before retry.
        """
        super().__init__(message)
        self.retry_after = retry_after

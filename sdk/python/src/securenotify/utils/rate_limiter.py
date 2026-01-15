"""Rate Limiter Utility.

Implements token bucket rate limiting to prevent API abuse.
"""

import asyncio
import time
from typing import Optional


class RateLimiter:
    """Token bucket rate limiter.

    Limits the rate of API requests to prevent abuse and accidental DDoS.
    """

    def __init__(
        self,
        max_tokens: int = 10,
        refill_rate: float = 1.0,
        refill_interval: float = 1.0,
    ):
        """Initialize rate limiter.

        Args:
            max_tokens: Maximum number of tokens in the bucket.
            refill_rate: Number of tokens to add per refill interval.
            refill_interval: Time interval between refills in seconds.
        """
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate
        self.refill_interval = refill_interval

        self.tokens = max_tokens
        self.last_refill = time.time()
        self._lock = asyncio.Lock()

    async def acquire(self, timeout: Optional[float] = None) -> bool:
        """Acquire a token from the bucket.

        Args:
            timeout: Maximum time to wait for a token (None = wait indefinitely).

        Returns:
            True if token acquired, False if timeout exceeded.
        """
        async with self._lock:
            # Refill tokens
            now = time.time()
            elapsed = now - self.last_refill

            if elapsed >= self.refill_interval:
                refill_cycles = int(elapsed / self.refill_interval)
                tokens_to_add = refill_cycles * self.refill_rate
                self.tokens = min(self.max_tokens, self.tokens + tokens_to_add)
                self.last_refill = now

            # Check if token available
            if self.tokens >= 1:
                self.tokens -= 1
                return True

            # Wait for token
            if timeout is not None and timeout <= 0:
                return False

            # Calculate wait time
            tokens_needed = 1
            refill_cycles_needed = (tokens_needed - self.tokens) / self.refill_rate
            wait_time = refill_cycles_needed * self.refill_interval

            if timeout is not None and wait_time > timeout:
                return False

            await asyncio.sleep(wait_time)
            self.tokens -= 1
            return True

    async def __aenter__(self):
        """Async context manager entry."""
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        pass

    def get_available_tokens(self) -> int:
        """Get current number of available tokens.

        Returns:
            Number of available tokens.
        """
        return int(self.tokens)
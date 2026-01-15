"""Integration tests for SDK optimizations.

Tests the following optimizations:
1. Rate limiter functionality
2. Metrics collection
3. Response caching
4. Input validation
"""

import pytest
import asyncio
import time
from securenotify.utils.rate_limiter import RateLimiter
from securenotify.utils.metrics import MetricsCollector, MetricsContext
from securenotify.utils.cache import ResponseCache
from securenotify.utils.http import validate_channel_id


class TestRateLimiter:
    """Test rate limiter functionality."""

    @pytest.mark.asyncio
    async def test_rate_limiter_basic(self):
        """Test basic rate limiter functionality."""
        limiter = RateLimiter(max_tokens=5, refill_rate=5, refill_interval=1.0)

        # Should be able to acquire 5 tokens immediately
        for i in range(5):
            acquired = await limiter.acquire(timeout=0.1)
            assert acquired is True, f"Should acquire token {i+1}"

        # Next acquisition should fail (rate limited)
        acquired = await limiter.acquire(timeout=0.1)
        assert acquired is False, "Should be rate limited"

    @pytest.mark.asyncio
    async def test_rate_limiter_refill(self):
        """Test rate limiter token refill."""
        limiter = RateLimiter(max_tokens=2, refill_rate=10, refill_interval=0.1)

        # Acquire all tokens
        await limiter.acquire(timeout=0.1)
        await limiter.acquire(timeout=0.1)

        # Should be rate limited (no timeout means immediate check)
        acquired = await limiter.acquire(timeout=0)
        assert acquired is False

        # Wait for refill
        await asyncio.sleep(0.15)

        # Should be able to acquire again
        acquired = await limiter.acquire(timeout=0.1)
        assert acquired is True


class TestMetricsCollector:
    """Test metrics collection functionality."""

    def test_metrics_basic(self):
        """Test basic metrics recording."""
        collector = MetricsCollector(max_samples=100)

        # Record some samples
        collector.record("/api/test", 100, True)
        collector.record("/api/test", 150, True)
        collector.record("/api/test", 50, False)

        # Get stats
        stats = collector.get_stats("/api/test")

        assert stats.count == 3
        assert stats.success_count == 2
        assert stats.failure_count == 1
        assert stats.avg_duration_ms == 100.0
        assert stats.min_duration_ms == 50
        assert stats.max_duration_ms == 150

    def test_metrics_summary(self):
        """Test metrics summary."""
        collector = MetricsCollector(max_samples=100)

        # Record samples for different endpoints
        collector.record("/api/endpoint1", 100, True)
        collector.record("/api/endpoint1", 150, True)
        collector.record("/api/endpoint2", 200, False)

        # Get summary
        summary = collector.get_summary()

        assert summary.total_requests == 3
        assert summary.total_success == 2
        assert summary.total_failures == 1
        assert summary.success_rate == 2/3
        assert summary.endpoint_count == 2

    def test_metrics_reset(self):
        """Test metrics reset."""
        collector = MetricsCollector(max_samples=100)

        # Record some samples
        collector.record("/api/test", 100, True)
        collector.record("/api/test", 150, True)

        # Reset
        collector.reset()

        # Should be empty
        stats = collector.get_stats("/api/test")
        assert stats.count == 0

    def test_metrics_context(self):
        """Test metrics context manager."""
        collector = MetricsCollector(max_samples=100)

        # Use context manager
        with MetricsContext(collector, "/api/test") as ctx:
            time.sleep(0.01)  # Simulate some work
            ctx.markSuccess()

        # Check that sample was recorded
        stats = collector.get_stats("/api/test")
        assert stats.count == 1
        assert stats.success_count == 1


class TestResponseCache:
    """Test response cache functionality."""

    def test_cache_basic(self):
        """Test basic cache operations."""
        cache = ResponseCache(default_ttl=60)

        # Set a value
        cache.set("key1", {"data": "test"}, ttl=60)

        # Get the value
        result = cache.get("key1")
        assert result is not None
        assert result["data"] == "test"

        # Get non-existent key
        result = cache.get("nonexistent")
        assert result is None

    def test_cache_expiration(self):
        """Test cache expiration."""
        cache = ResponseCache(default_ttl=1)  # 1 second TTL

        # Set a value
        cache.set("key1", {"data": "test"}, ttl=1)

        # Should be available immediately
        result = cache.get("key1")
        assert result is not None

        # Wait for expiration
        time.sleep(1.1)

        # Should be expired
        result = cache.get("key1")
        assert result is None

    def test_cache_delete(self):
        """Test cache deletion."""
        cache = ResponseCache(default_ttl=60)

        # Set a value
        cache.set("key1", {"data": "test"}, ttl=60)

        # Delete it
        deleted = cache.delete("key1")
        assert deleted is True

        # Should be gone
        result = cache.get("key1")
        assert result is None

        # Delete non-existent key
        deleted = cache.delete("nonexistent")
        assert deleted is False

    def test_cache_clear(self):
        """Test cache clear."""
        cache = ResponseCache(default_ttl=60)

        # Add multiple values
        cache.set("key1", {"data": "test1"}, ttl=60)
        cache.set("key2", {"data": "test2"}, ttl=60)

        # Clear all
        cache.clear()

        # All should be gone
        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_cache_cleanup_expired(self):
        """Test cleanup of expired entries."""
        cache = ResponseCache(default_ttl=1)

        # Add entries with different TTLs
        cache.set("key1", {"data": "test1"}, ttl=1)
        cache.set("key2", {"data": "test2"}, ttl=10)

        # Wait for first to expire
        time.sleep(1.1)

        # Cleanup expired
        removed = cache.cleanup_expired()

        assert removed == 1
        assert cache.get("key1") is None
        assert cache.get("key2") is not None


class TestInputValidation:
    """Test input validation functionality."""

    def test_validate_channel_id_valid(self):
        """Test valid channel IDs."""
        # Valid channel IDs
        assert validate_channel_id("valid-channel") is True
        assert validate_channel_id("ValidChannel123") is True
        assert validate_channel_id("test_channel_123") is True
        assert validate_channel_id("a") is True  # Single character
        assert validate_channel_id("a" * 256) is True  # Max length

    def test_validate_channel_id_invalid(self):
        """Test invalid channel IDs."""
        # Invalid channel IDs
        assert validate_channel_id("") is False  # Empty
        assert validate_channel_id("test channel") is False  # Space
        assert validate_channel_id("test@channel") is False  # Special char
        assert validate_channel_id("a" * 257) is False  # Too long
        assert validate_channel_id("test.channel") is False  # Dot
        assert validate_channel_id("test:channel") is False  # Colon


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
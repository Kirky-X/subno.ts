"""Response Cache Utility.

Provides simple in-memory caching for API responses to reduce redundant requests.
"""

import time
from typing import Optional, Any, Dict
from threading import Lock
from dataclasses import dataclass


@dataclass
class CacheEntry:
    """A cache entry with value and expiration."""
    value: Any
    expires_at: float


class ResponseCache:
    """Simple in-memory response cache with TTL support."""

    def __init__(self, default_ttl: int = 60):
        """Initialize response cache.

        Args:
            default_ttl: Default time-to-live in seconds.
        """
        self.default_ttl = default_ttl
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache.

        Args:
            key: Cache key.

        Returns:
            Cached value if exists and not expired, None otherwise.
        """
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None

            if entry.expires_at < time.time():
                # Expired, remove it
                del self._cache[key]
                return None

            return entry.value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a value in cache.

        Args:
            key: Cache key.
            value: Value to cache.
            ttl: Time-to-live in seconds (uses default if not specified).
        """
        if ttl is None:
            ttl = self.default_ttl

        entry = CacheEntry(
            value=value,
            expires_at=time.time() + ttl
        )

        with self._lock:
            self._cache[key] = entry

    def delete(self, key: str) -> bool:
        """Delete a value from cache.

        Args:
            key: Cache key.

        Returns:
            True if key was deleted, False if not found.
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()

    def cleanup_expired(self) -> int:
        """Remove all expired entries.

        Returns:
            Number of entries removed.
        """
        now = time.time()
        expired_keys = []

        with self._lock:
            for key, entry in self._cache.items():
                if entry.expires_at < now:
                    expired_keys.append(key)

            for key in expired_keys:
                del self._cache[key]

        return len(expired_keys)

    def size(self) -> int:
        """Get the number of entries in cache.

        Returns:
            Number of cache entries.
        """
        with self._lock:
            return len(self._cache)
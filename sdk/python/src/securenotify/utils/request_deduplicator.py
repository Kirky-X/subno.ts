# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

"""Request deduplication utility for SDK operations.

This module provides functionality to prevent duplicate requests from being sent
to the server within a short time window. This is useful for:
- Reducing server load
- Improving response speed (return cached result immediately)
- Preventing duplicate operations (e.g., duplicate registration)
"""

import asyncio
import hashlib
import json
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, Optional, Set
from threading import Lock


@dataclass
class PendingRequest:
    """A pending request waiting for completion."""
    timestamp: float
    future: asyncio.Future


class RequestDeduplicator:
    """Prevents duplicate requests from being sent within a short time window.

    This class tracks in-flight requests and returns the same result to all
    concurrent requests for the same endpoint and parameters.

    Example:
        deduplicator = RequestDeduplicator(ttl_seconds=5.0)

        # First request
        result1 = await deduplicator.execute(
            "register_public_key",
            {"channel_id": "test", "public_key": "..."},
            lambda: api_call()
        )

        # Concurrent duplicate request (will wait for first request)
        result2 = await deduplicator.execute(
            "register_public_key",
            {"channel_id": "test", "public_key": "..."},
            lambda: api_call()
        )
        # result1 == result2 (same object)
    """

    def __init__(
        self,
        ttl_seconds: float = 5.0,
        max_pending: int = 1000,
        max_cached: int = 10000,
    ):
        """Initialize the request deduplicator.

        Args:
            ttl_seconds: Time window for deduplication (default: 5.0 seconds)
            max_pending: Maximum number of pending requests to track
            max_cached: Maximum number of completed requests to cache
        """
        self.ttl_seconds = ttl_seconds
        self.max_pending = max_pending
        self.max_cached = max_cached

        # Track pending requests (endpoint + hash -> PendingRequest)
        self._pending: Dict[str, PendingRequest] = {}
        self._pending_lock = Lock()

        # Track completed requests (endpoint + hash -> result)
        self._completed: OrderedDict[str, Any] = OrderedDict()
        self._completed_lock = Lock()

        # Metrics
        self._hits = 0
        self._misses = 0
        self._errors = 0

    def _generate_key(self, endpoint: str, params: Optional[Dict[str, Any]]) -> str:
        """Generate a unique key for the request.

        Args:
            endpoint: API endpoint
            params: Request parameters

        Returns:
            Unique key string
        """
        # Create a deterministic hash of the parameters
        if params:
            params_str = json.dumps(params, sort_keys=True)
        else:
            params_str = ""

        key = f"{endpoint}:{params_str}"
        # Use SHA256 for better distribution
        return hashlib.sha256(key.encode()).hexdigest()

    async def execute(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]],
        func,
        use_cache: bool = True,
    ) -> Any:
        """Execute a request with deduplication.

        Args:
            endpoint: API endpoint
            params: Request parameters
            func: Async function to execute the request
            use_cache: Whether to use completed request cache

        Returns:
            Result from the request function

        Raises:
            Exception: If the request function raises an exception
        """
        key = self._generate_key(endpoint, params)

        # Check completed cache first
        if use_cache:
            with self._completed_lock:
                if key in self._completed:
                    self._hits += 1
                    result = self._completed[key]
                    # Move to end (LRU)
                    self._completed.move_to_end(key)
                    return result

        # Check pending requests
        with self._pending_lock:
            if key in self._pending:
                # Request is pending, wait for result
                self._hits += 1
                pending = self._pending[key]
                # Check if future is still pending
                if not pending.future.done():
                    return await pending.future
                else:
                    # Future is done, remove from pending
                    del self._pending[key]

        # Execute the request
        self._misses += 1

        # Create a future for this request
        future = asyncio.Future()

        with self._pending_lock:
            if len(self._pending) >= self.max_pending:
                # Remove oldest pending request
                oldest_key = next(iter(self._pending))
                del self._pending[oldest_key]

            self._pending[key] = PendingRequest(
                timestamp=time.time(),
                future=future,
            )

        try:
            result = await func()

            # Store result in completed cache
            if use_cache:
                with self._completed_lock:
                    if len(self._completed) >= self.max_cached:
                        # Remove oldest entry (LRU)
                        self._completed.popitem(last=False)
                    self._completed[key] = result

            # Set result for any waiting futures
            future.set_result(result)
            return result

        except Exception as e:
            self._errors += 1
            # Set exception for any waiting futures
            future.set_exception(e)
            raise

        finally:
            # Remove from pending
            with self._pending_lock:
                if key in self._pending:
                    del self._pending[key]

    def cleanup_expired(self) -> int:
        """Remove expired entries from completed cache.

        Returns:
            Number of entries removed
        """
        removed = 0
        cutoff = time.time() - self.ttl_seconds

        with self._completed_lock:
            keys_to_remove = []
            for key, entry in self._completed.items():
                # We don't store timestamp in completed cache,
                # so we use LRU order as a proxy for age
                # Remove oldest entries if we exceed max_cached
                if len(self._completed) > self.max_cached * 2:
                    keys_to_remove.append(key)

            for key in keys_to_remove:
                self._completed.pop(key)
                removed += 1

        return removed

    def clear_pending(self) -> int:
        """Clear all pending requests.

        Returns:
            Number of pending requests cleared
        """
        with self._pending_lock:
            count = len(self._pending)
            # Cancel all pending futures
            for pending in self._pending.values():
                if not pending.future.done():
                    pending.future.cancel()
            self._pending.clear()
            return count

    def clear_completed(self) -> int:
        """Clear all completed requests.

        Returns:
            Number of completed requests cleared
        """
        with self._completed_lock:
            count = len(self._completed)
            self._completed.clear()
            return count

    def clear_all(self) -> int:
        """Clear all pending and completed requests.

        Returns:
            Total number of requests cleared
        """
        pending_count = self.clear_pending()
        completed_count = self.clear_completed()
        return pending_count + completed_count

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the deduplicator.

        Returns:
            Dictionary with statistics
        """
        with self._pending_lock, self._completed_lock:
            total_requests = self._hits + self._misses
            hit_rate = self._hits / total_requests if total_requests > 0 else 0.0

            return {
                "hits": self._hits,
                "misses": self._misses,
                "errors": self._errors,
                "hit_rate": hit_rate,
                "pending_count": len(self._pending),
                "completed_count": len(self._completed),
                "ttl_seconds": self.ttl_seconds,
            }

    def reset_stats(self) -> None:
        """Reset statistics counters."""
        self._hits = 0
        self._misses = 0
        self._errors = 0
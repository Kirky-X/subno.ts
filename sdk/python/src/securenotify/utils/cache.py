# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

"""In-memory response cache with TTL support."""

import time
from typing import Optional, Any, Dict
from threading import Lock
from dataclasses import dataclass


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class ResponseCache:
    def __init__(self, default_ttl: int = 60):
        self.default_ttl = default_ttl
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None

            if entry.expires_at < time.time():
                del self._cache[key]
                return None

            return entry.value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        if ttl is None:
            ttl = self.default_ttl

        entry = CacheEntry(
            value=value,
            expires_at=time.time() + ttl
        )

        with self._lock:
            self._cache[key] = entry

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def cleanup_expired(self) -> int:
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
        with self._lock:
            return len(self._cache)
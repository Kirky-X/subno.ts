# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

from typing import Optional, List, Dict, Any
from datetime import datetime

from securenotify.types.api import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyInfo,
)
from securenotify.utils.helpers import parse_datetime
from .base import BaseManager


class ApiKeyManager(BaseManager):
    async def create(
        self, name: str, permissions: List[str], expires_in: Optional[int] = None
    ) -> ApiKeyCreateResponse:
        """Create a new API key.

        Raises:
            ValueError: If name or permissions is empty.
            SecureNotifyApiError: On API error.
        """
        request = ApiKeyCreateRequest(
            name=name, permissions=permissions, expires_in=expires_in
        )
        return await self._execute("create_api_key", request)

    async def get(self, key_id: str) -> ApiKeyInfo:
        data = await self._execute("get_api_key", key_id)
        return ApiKeyInfo(
            id=data["id"],
            key_prefix=data["key_prefix"],
            name=data["name"],
            permissions=data["permissions"],
            is_active=data["is_active"],
            created_at=parse_datetime(data, "created_at"),
            last_used_at=parse_datetime(data, "last_used_at"),
            expires_at=parse_datetime(data, "expires_at"),
        )

    async def list(self) -> List[ApiKeyInfo]:
        data = await self._execute("list_api_keys")
        keys = []
        for item in data.get("keys", []):
            keys.append(
                ApiKeyInfo(
                    id=item["id"],
                    key_prefix=item["key_prefix"],
                    name=item["name"],
                    permissions=item["permissions"],
                    is_active=item["is_active"],
                    created_at=parse_datetime(item, "created_at"),
                    last_used_at=parse_datetime(item, "last_used_at"),
                    expires_at=parse_datetime(item, "expires_at"),
                )
            )
        return keys

    async def revoke(self, key_id: str) -> Dict[str, Any]:
        return await self._execute("revoke_api_key", key_id)

# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

from typing import Optional, List, Dict, Any
from datetime import datetime

from securenotify.types.api import (
    RegisterPublicKeyRequest,
    RegisterPublicKeyResponse,
    PublicKeyInfo,
)
from securenotify.utils.helpers import parse_datetime
from .base import BaseManager


class KeyManager(BaseManager):
    async def register(
        self,
        public_key: str,
        algorithm: str,
        expires_in: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> RegisterPublicKeyResponse:
        """Register a new public key.

        Raises:
            ValueError: If public_key or algorithm is empty.
            SecureNotifyApiError: On API error.
        """
        request = RegisterPublicKeyRequest(
            public_key=public_key,
            algorithm=algorithm,
            expires_in=expires_in,
            metadata=metadata,
        )
        return await self._execute("register_public_key", request)

    async def get(self, key_id: str) -> PublicKeyInfo:
        data = await self._execute("get_public_key", key_id)
        return PublicKeyInfo(
            id=data["id"],
            channel_id=data["channel_id"],
            public_key=data["public_key"],
            algorithm=data["algorithm"],
            created_at=parse_datetime(data, "created_at"),
            expires_at=parse_datetime(data, "expires_at"),
            last_used_at=parse_datetime(data, "last_used_at"),
            metadata=data.get("metadata"),
        )

    async def list(self) -> List[PublicKeyInfo]:
        data = await self._execute("list_public_keys")
        keys = []
        for item in data.get("keys", []):
            keys.append(
                PublicKeyInfo(
                    id=item["id"],
                    channel_id=item["channel_id"],
                    public_key=item["public_key"],
                    algorithm=item["algorithm"],
                    created_at=parse_datetime(item, "created_at"),
                    expires_at=parse_datetime(item, "expires_at"),
                    last_used_at=parse_datetime(item, "last_used_at"),
                    metadata=item.get("metadata"),
                )
            )
        return keys

    async def revoke(self, key_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        return await self._execute("revoke_public_key", key_id, reason)

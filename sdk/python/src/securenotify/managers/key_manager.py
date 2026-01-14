"""Key Manager.

Manages public key registration and retrieval.
"""

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
    """Manages public key operations."""

    async def register(
        self,
        public_key: str,
        algorithm: str,
        expires_in: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> RegisterPublicKeyResponse:
        """Register a new public key.

        Args:
            public_key: PEM formatted public key.
            algorithm: Encryption algorithm (e.g., "RSA-4096", "ECC-SECP256K1").
            expires_in: Key expiry in seconds (optional).
            metadata: Additional metadata (optional).

        Returns:
            Registration response with key_id and channel_id.

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
        """Get public key information.

        Args:
            key_id: The key ID.

        Returns:
            Public key information.

        Raises:
            SecureNotifyApiError: On API error.
        """
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
        """List all public keys.

        Returns:
            List of public key information.

        Raises:
            SecureNotifyApiError: On API error.
        """
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
        """Revoke a public key.

        Args:
            key_id: The key ID to revoke.
            reason: Revocation reason (optional).

        Returns:
            Revocation confirmation.

        Raises:
            SecureNotifyApiError: On API error.
        """
        return await self._execute("revoke_public_key", key_id, reason)

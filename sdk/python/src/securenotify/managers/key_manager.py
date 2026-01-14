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
from securenotify.utils.http import HttpClient
from securenotify.utils.retry import with_retry, RetryConfig


class KeyManager:
    """Manages public key operations."""

    def __init__(self, http_client: HttpClient, retry_config: Optional[RetryConfig] = None):
        """Initialize key manager.

        Args:
            http_client: HTTP client for API calls.
            retry_config: Retry configuration.
        """
        self._http = http_client
        self._retry_config = retry_config

    async def register(
        self,
        public_key: str,
        algorithm: str,
        expires_in: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
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
            metadata=metadata
        )

        async def do_register():
            return await self._http.register_public_key(request)

        return await with_retry(do_register, self._retry_config)

    async def get(self, key_id: str) -> PublicKeyInfo:
        """Get public key information.

        Args:
            key_id: The key ID.

        Returns:
            Public key information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_get():
            data = await self._http.get_public_key(key_id)
            return PublicKeyInfo(
                id=data["id"],
                channel_id=data["channel_id"],
                public_key=data["public_key"],
                algorithm=data["algorithm"],
                created_at=datetime.fromisoformat(data["created_at"]),
                expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
                last_used_at=datetime.fromisoformat(data["last_used_at"]) if data.get("last_used_at") else None,
                metadata=data.get("metadata")
            )

        return await with_retry(do_get, self._retry_config)

    async def list(self) -> List[PublicKeyInfo]:
        """List all public keys.

        Returns:
            List of public key information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_list():
            data = await self._http.list_public_keys()
            keys = []
            for item in data.get("keys", []):
                keys.append(PublicKeyInfo(
                    id=item["id"],
                    channel_id=item["channel_id"],
                    public_key=item["public_key"],
                    algorithm=item["algorithm"],
                    created_at=datetime.fromisoformat(item["created_at"]),
                    expires_at=datetime.fromisoformat(item["expires_at"]) if item.get("expires_at") else None,
                    last_used_at=datetime.fromisoformat(item["last_used_at"]) if item.get("last_used_at") else None,
                    metadata=item.get("metadata")
                ))
            return keys

        return await with_retry(do_list, self._retry_config)

    async def revoke(
        self,
        key_id: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Revoke a public key.

        Args:
            key_id: The key ID to revoke.
            reason: Revocation reason (optional).

        Returns:
            Revocation confirmation.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_revoke():
            return await self._http.revoke_public_key(key_id, reason)

        return await with_retry(do_revoke, self._retry_config)

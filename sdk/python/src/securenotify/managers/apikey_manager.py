"""API Key Manager.

Manages API key creation and retrieval.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from securenotify.types.api import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyInfo,
)
from securenotify.utils.http import HttpClient
from securenotify.utils.retry import with_retry, RetryConfig


class ApiKeyManager:
    """Manages API key operations."""

    def __init__(self, http_client: HttpClient, retry_config: Optional[RetryConfig] = None):
        """Initialize API key manager.

        Args:
            http_client: HTTP client for API calls.
            retry_config: Retry configuration.
        """
        self._http = http_client
        self._retry_config = retry_config

    async def create(
        self,
        name: str,
        permissions: List[str],
        expires_in: Optional[int] = None
    ) -> ApiKeyCreateResponse:
        """Create a new API key.

        Args:
            name: Name for the API key.
            permissions: List of permission strings.
            expires_in: Key expiry in seconds (optional).

        Returns:
            API key creation response with the new key.

        Raises:
            ValueError: If name or permissions is empty.
            SecureNotifyApiError: On API error.
        """
        request = ApiKeyCreateRequest(
            name=name,
            permissions=permissions,
            expires_in=expires_in
        )

        async def do_create():
            return await self._http.create_api_key(request)

        return await with_retry(do_create, self._retry_config)

    async def get(self, key_id: str) -> ApiKeyInfo:
        """Get API key information.

        Args:
            key_id: The key ID.

        Returns:
            API key information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_get():
            data = await self._http.get_api_key(key_id)
            return ApiKeyInfo(
                id=data["id"],
                key_prefix=data["key_prefix"],
                name=data["name"],
                permissions=data["permissions"],
                is_active=data["is_active"],
                created_at=datetime.fromisoformat(data["created_at"]),
                last_used_at=datetime.fromisoformat(data["last_used_at"]) if data.get("last_used_at") else None,
                expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None
            )

        return await with_retry(do_get, self._retry_config)

    async def list(self) -> List[ApiKeyInfo]:
        """List all API keys.

        Returns:
            List of API key information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_list():
            data = await self._http.list_api_keys()
            keys = []
            for item in data.get("keys", []):
                keys.append(ApiKeyInfo(
                    id=item["id"],
                    key_prefix=item["key_prefix"],
                    name=item["name"],
                    permissions=item["permissions"],
                    is_active=item["is_active"],
                    created_at=datetime.fromisoformat(item["created_at"]),
                    last_used_at=datetime.fromisoformat(item["last_used_at"]) if item.get("last_used_at") else None,
                    expires_at=datetime.fromisoformat(item["expires_at"]) if item.get("expires_at") else None
                ))
            return keys

        return await with_retry(do_list, self._retry_config)

    async def revoke(self, key_id: str) -> Dict[str, Any]:
        """Revoke an API key.

        Args:
            key_id: The key ID to revoke.

        Returns:
            Revocation confirmation.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_revoke():
            return await self._http.revoke_api_key(key_id)

        return await with_retry(do_revoke, self._retry_config)

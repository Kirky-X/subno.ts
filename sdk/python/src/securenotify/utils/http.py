"""HTTP Client Utility.

Provides async HTTP client with authentication and serialization.
"""

import json
from dataclasses import asdict
from typing import Optional, Dict, Any, Type, TypeVar
from datetime import datetime

import httpx
from httpx import Response

from securenotify.types.errors import (
    SecureNotifyApiError,
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
    SecureNotifyAuthenticationError,
    SecureNotifyRateLimitError,
    ErrorCode,
)
from securenotify.types.api import (
    RegisterPublicKeyRequest,
    RegisterPublicKeyResponse,
    ChannelCreateRequest,
    ChannelCreateResponse,
    MessagePublishRequest,
    MessagePublishResponse,
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
)


T = TypeVar("T")


class HttpClient:
    """HTTP client for SecureNotify API."""

    def __init__(
        self, base_url: str, api_key: str, timeout: float = 30.0, verify: bool = True
    ):
        """Initialize HTTP client.

        Args:
            base_url: Base URL for the API.
            api_key: API key for authentication.
            timeout: Request timeout in seconds.
            verify: Whether to verify SSL certificates.
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.verify = verify

        self._client: Optional[httpx.AsyncClient] = None

    @property
    def headers(self) -> Dict[str, str]:
        """Get default headers for requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout, verify=self.verify)
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    def _parse_error_response(self, response: Response) -> SecureNotifyApiError:
        """Parse error response from API.

        Args:
            response: HTTP response with error.

        Returns:
            SecureNotifyApiError instance.
        """
        try:
            error_data = response.json()
            error_code = ErrorCode(
                error_data.get("error_code", ErrorCode.INTERNAL_ERROR.value)
            )
            message = error_data.get("message", "Unknown error")
            details = error_data.get("details")
            request_id = response.headers.get("x-request-id")

            if error_code == ErrorCode.RATE_LIMIT_EXCEEDED:
                retry_after = float(response.headers.get("retry-after", 60))
                return SecureNotifyRateLimitError(
                    message=message, retry_after=retry_after, details=details
                )

            if error_code in (ErrorCode.AUTH_REQUIRED, ErrorCode.AUTH_FAILED):
                return SecureNotifyAuthenticationError(message=message, details=details)

            return SecureNotifyApiError(
                status_code=response.status_code,
                error_code=error_code,
                message=message,
                details=details,
                request_id=request_id,
            )
        except (json.JSONDecodeError, ValueError):
            return SecureNotifyApiError(
                status_code=response.status_code,
                error_code=ErrorCode.INTERNAL_ERROR,
                message=f"Server error (status: {response.status_code})",
                request_id=response.headers.get("x-request-id"),
            )

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make an HTTP request.

        Args:
            method: HTTP method.
            endpoint: API endpoint.
            data: Request body data.
            params: Query parameters.

        Returns:
            Response data as dictionary.

        Raises:
            SecureNotifyApiError: On API error.
            SecureNotifyConnectionError: On connection error.
            SecureNotifyTimeoutError: On timeout.
        """
        client = await self._get_client()
        url = f"{self.base_url}{endpoint}"

        try:
            response = await client.request(
                method=method, url=url, headers=self.headers, json=data, params=params
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 204:
                return {}
            else:
                raise self._parse_error_response(response)

        except httpx.TimeoutException:
            raise SecureNotifyTimeoutError(
                message=f"Request timed out after {self.timeout}s", timeout=self.timeout
            )
        except httpx.ConnectError as e:
            raise SecureNotifyConnectionError(message=f"Connection failed: {str(e)}")
        except httpx.DecodingError as e:
            raise SecureNotifyApiError(
                status_code=0,
                error_code=ErrorCode.SDK_SERIALIZATION_ERROR,
                message=f"Failed to decode response: {str(e)}",
            )

    # Public Key Methods
    async def register_public_key(
        self, request: RegisterPublicKeyRequest
    ) -> RegisterPublicKeyResponse:
        """Register a new public key.

        Args:
            request: Registration request.

        Returns:
            Registration response.
        """
        data = asdict(request)
        # Remove None values to keep payload clean
        data = {k: v for k, v in data.items() if v is not None}

        result = await self._request("POST", "/api/register", data=data)
        return RegisterPublicKeyResponse(
            key_id=result["key_id"],
            channel_id=result["channel_id"],
            created_at=datetime.fromisoformat(result["created_at"]),
            expires_at=datetime.fromisoformat(result["expires_at"])
            if result.get("expires_at")
            else None,
        )

    async def get_public_key(self, key_id: str) -> Dict[str, Any]:
        """Get public key information.

        Args:
            key_id: Key ID.

        Returns:
            Public key information.
        """
        return await self._request("GET", f"/api/keys/{key_id}")

    async def list_public_keys(self) -> Dict[str, Any]:
        """List all public keys.

        Returns:
            List of public keys.
        """
        return await self._request("GET", "/api/keys")

    async def revoke_public_key(
        self, key_id: str, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Revoke a public key.

        Args:
            key_id: Key ID.
            reason: Revocation reason.

        Returns:
            Revocation confirmation.
        """
        data = {}
        if reason is not None:
            data["reason"] = reason

        return await self._request("POST", f"/api/keys/{key_id}/revoke", data=data)

    # Channel Methods
    async def create_channel(
        self, request: ChannelCreateRequest
    ) -> ChannelCreateResponse:
        """Create a new channel.

        Args:
            request: Channel creation request.

        Returns:
            Channel creation response.
        """
        data = asdict(request)
        # Convert enum to value
        data["type"] = data["channel_type"].value
        del data["channel_type"]
        # Remove None values to keep payload clean
        data = {k: v for k, v in data.items() if v is not None}

        result = await self._request("POST", "/api/channels", data=data)
        from securenotify.types.api import ChannelType

        return ChannelCreateResponse(
            channel_id=result["channel_id"],
            name=result["name"],
            channel_type=ChannelType(result["type"]),
            created_at=datetime.fromisoformat(result["created_at"]),
            expires_at=datetime.fromisoformat(result["expires_at"])
            if result.get("expires_at")
            else None,
        )

    async def get_channel(self, channel_id: str) -> Dict[str, Any]:
        """Get channel information.

        Args:
            channel_id: Channel ID.

        Returns:
            Channel information.
        """
        return await self._request("GET", f"/api/channels/{channel_id}")

    async def list_channels(self) -> Dict[str, Any]:
        """List all channels.

        Returns:
            List of channels.
        """
        return await self._request("GET", "/api/channels")

    # Publish Methods
    async def publish_message(
        self, request: MessagePublishRequest
    ) -> MessagePublishResponse:
        """Publish a message to a channel.

        Args:
            request: Message publish request.

        Returns:
            Message publish response.
        """
        data = asdict(request)
        # Convert enum to value
        data["priority"] = data["priority"].value
        # Remove None values to keep payload clean
        data = {k: v for k, v in data.items() if v is not None}

        result = await self._request("POST", "/api/publish", data=data)
        return MessagePublishResponse(
            message_id=result["message_id"],
            channel=result["channel"],
            timestamp=datetime.fromisoformat(result["timestamp"]),
            auto_created=result.get("auto_created", False),
        )

    async def get_queue_status(self, channel: str) -> Dict[str, Any]:
        """Get message queue status for a channel.

        Args:
            channel: Channel ID.

        Returns:
            Queue status information.
        """
        return await self._request("GET", f"/api/publish", params={"channel": channel})

    # API Key Methods
    async def create_api_key(
        self, request: ApiKeyCreateRequest
    ) -> ApiKeyCreateResponse:
        """Create a new API key.

        Args:
            request: API key creation request.

        Returns:
            API key creation response.
        """
        data = asdict(request)
        # Remove None values to keep payload clean
        data = {k: v for k, v in data.items() if v is not None}

        result = await self._request("POST", "/api/keys", data=data)
        return ApiKeyCreateResponse(
            key_id=result["key_id"],
            key=result["key"],
            key_prefix=result["key_prefix"],
            name=result["name"],
            permissions=result["permissions"],
            created_at=datetime.fromisoformat(result["created_at"]),
            expires_at=datetime.fromisoformat(result["expires_at"])
            if result.get("expires_at")
            else None,
        )

    async def get_api_key(self, key_id: str) -> Dict[str, Any]:
        """Get API key information.

        Args:
            key_id: Key ID.

        Returns:
            API key information.
        """
        return await self._request("GET", f"/api/keys/{key_id}")

    async def list_api_keys(self) -> Dict[str, Any]:
        """List all API keys.

        Returns:
            List of API keys.
        """
        return await self._request("GET", "/api/keys")

    async def revoke_api_key(self, key_id: str) -> Dict[str, Any]:
        """Revoke an API key.

        Args:
            key_id: Key ID.

        Returns:
            Revocation confirmation.
        """
        return await self._request("DELETE", f"/api/keys/{key_id}")

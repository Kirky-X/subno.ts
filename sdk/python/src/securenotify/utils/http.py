"""HTTP Client Utility.

Provides async HTTP client with authentication and serialization.
"""

import re
from dataclasses import asdict
from typing import Optional, Dict, Any, Type, TypeVar
from datetime import datetime

import httpx
from httpx import Response

# Try to use orjson for faster JSON parsing (PERFORMANCE FIX)
try:
    import orjson as json_parser

    HAS_ORJSON = True
except ImportError:
    import json as json_parser

    HAS_ORJSON = False

from securenotify.utils.metrics import MetricsCollector, MetricsContext
from securenotify.utils.cache import ResponseCache
from securenotify.utils.request_deduplicator import RequestDeduplicator


# Channel ID validation pattern: alphanumeric, hyphens, underscores, 1-256 chars
CHANNEL_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,256}$")

# Key ID validation pattern: similar to channel ID
KEY_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,256}$")


def validate_channel_id(channel_id: str) -> bool:
    """Validate channel ID format.

    Args:
        channel_id: Channel ID to validate.

    Returns:
        True if valid, False otherwise.
    """
    if not channel_id:
        return False
    return bool(CHANNEL_ID_PATTERN.match(channel_id))


def validate_key_id(key_id: str) -> bool:
    """Validate key ID format.

    Args:
        key_id: Key ID to validate.

    Returns:
        True if valid, False otherwise.
    """
    if not key_id:
        return False
    return bool(KEY_ID_PATTERN.match(key_id))


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
from .rate_limiter import RateLimiter


T = TypeVar("T")


class HttpClient:
    """HTTP client for SecureNotify API."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = 30.0,
        verify: bool = True,
        enable_rate_limit: bool = True,
        enable_metrics: bool = False,
        enable_cache: bool = False,
        enable_deduplication: bool = False,
    ):
        """Initialize HTTP client.

        Args:
            base_url: Base URL for the API.
            api_key: API key for authentication.
            timeout: Request timeout in seconds.
            verify: Whether to verify SSL certificates.
            enable_rate_limit: Whether to enable client-side rate limiting.
            enable_metrics: Whether to enable performance metrics collection.
            enable_cache: Whether to enable response caching.
            enable_deduplication: Whether to enable request deduplication.
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        # SSL certificate verification - security requirement
        self._verify = verify

        self._client: Optional[httpx.AsyncClient] = None

        # Add rate limiter to prevent API abuse (PERFORMANCE FIX)
        self._rate_limiter = (
            RateLimiter(max_tokens=10, refill_rate=1.0, refill_interval=1.0)
            if enable_rate_limit
            else None
        )

        # Performance metrics collector (PERFORMANCE FIX)
        self._metrics_collector = MetricsCollector() if enable_metrics else None

        # Response cache to reduce redundant requests (PERFORMANCE FIX)
        self._cache = ResponseCache(default_ttl=60) if enable_cache else None
        self._enable_cache = enable_cache

        # Request deduplicator to prevent duplicate requests (PERFORMANCE FIX)
        self._request_deduplicator = (
            RequestDeduplicator(ttl_seconds=5.0) if enable_deduplication else None
        )
        self._enable_deduplication = enable_deduplication

    @property
    def headers(self) -> Dict[str, str]:
        """Get default headers for requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SecureNotify-Python/0.1.0",  # Add User-Agent header
        }

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async HTTP client."""
        if self._client is None or self._client.is_closed:
            # Configure connection pool limits to prevent resource exhaustion
            limits = httpx.Limits(
                max_keepalive_connections=20, max_connections=100, keepalive_expiry=30.0
            )
            # Add max_redirects to prevent SSRF attacks
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                verify=self._verify,
                limits=limits,
                follow_redirects=True,
                max_redirects=5,  # Limit redirects to prevent SSRF
            )
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

            # Sanitize error message to prevent information disclosure (SECURITY FIX)
            if "password" in message.lower() or "token" in message.lower():
                message = "Authentication error"

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
            SecureNotifyRateLimitError: If client-side rate limit exceeded.
        """
        # Apply rate limiting if enabled (PERFORMANCE FIX)
        if self._rate_limiter:
            acquired = await self._rate_limiter.acquire(timeout=30.0)
            if not acquired:
                raise SecureNotifyRateLimitError(
                    message="Client-side rate limit exceeded. Please retry later.",
                    retry_after=1.0,
                )

        # Apply request deduplication if enabled (PERFORMANCE FIX)
        async def execute_request():
            import uuid

            # Generate unique request ID for tracing
            request_id = str(uuid.uuid4())

            # Add request ID to headers
            headers = self.headers.copy()
            headers["X-Request-ID"] = request_id

            # Check cache for GET requests if enabled (PERFORMANCE FIX)
            cache_key = None
            if self._enable_cache and self._cache and method == "GET":
                # Create cache key from endpoint and params
                cache_key = f"{method}:{endpoint}:{str(sorted(params.items()) if params else '')}"
                cached_value = self._cache.get(cache_key)
                if cached_value is not None:
                    return cached_value

            client = await self._get_client()
            url = f"{self.base_url}{endpoint}"

            # Use metrics context to track request performance (PERFORMANCE FIX)
            metrics_ctx = (
                MetricsContext(self._metrics_collector, endpoint)
                if self._metrics_collector
                else None
            )

            try:
                if metrics_ctx:
                    metrics_ctx.__enter__()

                response = await client.request(
                    method=method, url=url, headers=headers, json=data, params=params
                )

                if response.status_code == 200:
                    # Use orjson for faster JSON parsing if available (PERFORMANCE FIX)
                    if HAS_ORJSON:
                        result = json_parser.loads(response.content)
                    else:
                        result = response.json()

                    # Cache successful GET responses (PERFORMANCE FIX)
                    if (
                        self._enable_cache
                        and self._cache
                        and method == "GET"
                        and cache_key
                    ):
                        self._cache.set(cache_key, result, ttl=60)

                    if metrics_ctx:
                        metrics_ctx.__exit__(None, None, None)

                    return result
                elif response.status_code == 204:
                    if metrics_ctx:
                        metrics_ctx.__exit__(None, None, None)
                    return {}
                else:
                    if metrics_ctx:
                        metrics_ctx.__exit__(Exception, None, None)
                    raise self._parse_error_response(response)

            except httpx.TimeoutException:
                raise SecureNotifyTimeoutError(
                    message=f"Request timed out after {self.timeout}s",
                    timeout=self.timeout,
                )
            except httpx.ConnectError as e:
                raise SecureNotifyConnectionError(
                    message=f"Connection failed: {str(e)}"
                )
            except httpx.DecodingError as e:
                raise SecureNotifyApiError(
                    status_code=0,
                    error_code=ErrorCode.SDK_SERIALIZATION_ERROR,
                    message=f"Failed to decode response: {str(e)}",
                )

        if self._enable_deduplication and self._request_deduplicator:
            # Use deduplicator for all requests
            dedup_key = f"{method}:{endpoint}"
            dedup_params = {**(data or {}), **(params or {})}
            return await self._request_deduplicator.execute(
                dedup_key, dedup_params, execute_request, use_cache=(method == "GET")
            )
        else:
            # Execute request directly
            return await execute_request()

        import uuid

        # Generate unique request ID for tracing
        request_id = str(uuid.uuid4())

        # Add request ID to headers
        headers = self.headers.copy()
        headers["X-Request-ID"] = request_id

        # Check cache for GET requests if enabled (PERFORMANCE FIX)
        cache_key = None
        if self._enable_cache and self._cache and method == "GET":
            # Create cache key from endpoint and params
            cache_key = (
                f"{method}:{endpoint}:{str(sorted(params.items()) if params else '')}"
            )
            cached_value = self._cache.get(cache_key)
            if cached_value is not None:
                return cached_value

        client = await self._get_client()
        url = f"{self.base_url}{endpoint}"

        # Use metrics context to track request performance (PERFORMANCE FIX)
        metrics_ctx = (
            MetricsContext(self._metrics_collector, endpoint)
            if self._metrics_collector
            else None
        )

        try:
            if metrics_ctx:
                metrics_ctx.__enter__()

            response = await client.request(
                method=method, url=url, headers=headers, json=data, params=params
            )

            if response.status_code == 200:
                # Use orjson for faster JSON parsing if available (PERFORMANCE FIX)
                if HAS_ORJSON:
                    result = json_parser.loads(response.content)
                else:
                    result = response.json()

                # Cache successful GET responses (PERFORMANCE FIX)
                if self._enable_cache and self._cache and method == "GET" and cache_key:
                    self._cache.set(cache_key, result, ttl=60)

                if metrics_ctx:
                    metrics_ctx.__exit__(None, None, None)

                return result
            elif response.status_code == 204:
                if metrics_ctx:
                    metrics_ctx.__exit__(None, None, None)
                return {}
            else:
                if metrics_ctx:
                    metrics_ctx.__exit__(Exception, None, None)
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

        Raises:
            ValueError: If key_id format is invalid.
        """
        # Validate key_id format (SECURITY FIX)
        if not validate_key_id(key_id):
            raise ValueError(f"Invalid key_id format: {key_id}")

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

    # Cache management methods (PERFORMANCE FIX)

    def clear_cache(self) -> None:
        """Clear all cached responses."""
        if self._cache:
            self._cache.clear()

    def cleanup_cache(self) -> int:
        """Remove expired cache entries.

        Returns:
            Number of entries removed.
        """
        if self._cache:
            return self._cache.cleanup_expired()
        return 0

    def get_cache_size(self) -> int:
        """Get the number of cached entries.

        Returns:
            Number of cache entries.
        """
        if self._cache:
            return self._cache.size()
        return 0

    # Deduplicator management methods (PERFORMANCE FIX)

    def clear_pending_requests(self) -> int:
        """Clear all pending duplicate requests.

        Returns:
            Number of pending requests cleared.
        """
        if self._request_deduplicator:
            return self._request_deduplicator.clear_pending()
        return 0

    def clear_completed_requests(self) -> int:
        """Clear all completed duplicate requests.

        Returns:
            Number of completed requests cleared.
        """
        if self._request_deduplicator:
            return self._request_deduplicator.clear_completed()
        return 0

    def clear_all_requests(self) -> int:
        """Clear all pending and completed duplicate requests.

        Returns:
            Total number of requests cleared.
        """
        if self._request_deduplicator:
            return self._request_deduplicator.clear_all()
        return 0

    def cleanup_expired_requests(self) -> int:
        """Remove expired entries from request deduplicator.

        Returns:
            Number of entries removed.
        """
        if self._request_deduplicator:
            return self._request_deduplicator.cleanup_expired()
        return 0

    def get_deduplicator_stats(self) -> Dict[str, Any]:
        """Get statistics about the request deduplicator.

        Returns:
            Dictionary with statistics or empty dict if disabled.
        """
        if self._request_deduplicator:
            return self._request_deduplicator.get_stats()
        return {}

    def reset_deduplicator_stats(self) -> None:
        """Reset deduplicator statistics counters."""
        if self._request_deduplicator:
            self._request_deduplicator.reset_stats()

    def deduplication_enabled(self) -> bool:
        """Check if request deduplication is enabled.

        Returns:
            True if enabled, False otherwise.
        """
        return self._enable_deduplication

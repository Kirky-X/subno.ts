"""SecureNotify Client.

Main client class for SecureNotify SDK with sync/async support.
"""

import asyncio
from typing import Optional, Dict, Any, Callable, Awaitable
from contextlib import asynccontextmanager

from securenotify.utils.http import HttpClient
from securenotify.utils.connection import SSEClient
from securenotify.utils.retry import RetryConfig

from securenotify.managers.key_manager import KeyManager
from securenotify.managers.channel_manager import ChannelManager
from securenotify.managers.publish_manager import PublishManager
from securenotify.managers.subscribe_manager import SubscribeManager
from securenotify.managers.apikey_manager import ApiKeyManager

from securenotify.types.api import (
    MessagePriority,
    ChannelType,
)

# URL regex pattern for validation
_URL_PATTERN = (
    r"^https://[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(/[^ \n]*)?$"
)


def _validate_base_url(base_url: str) -> None:
    """Validate base URL format.

    Args:
        base_url: URL to validate.

    Raises:
        ValueError: If URL is invalid or doesn't use HTTPS.
    """
    if not isinstance(base_url, str):
        raise ValueError("base_url must be a string")

    if not base_url.startswith("https://"):
        raise ValueError("base_url must use HTTPS protocol")

    if len(base_url) < 10:
        raise ValueError("base_url is too short")


def _validate_api_key(api_key: str) -> None:
    """Validate API key format.

    Args:
        api_key: API key to validate.

    Raises:
        ValueError: If API key is invalid.
    """
    if not isinstance(api_key, str):
        raise ValueError("api_key must be a string")

    if len(api_key) < 8:
        raise ValueError("api_key must be at least 8 characters")


def _validate_timeout(timeout: float) -> None:
    """Validate timeout value.

    Args:
        timeout: Timeout value in seconds.

    Raises:
        ValueError: If timeout is invalid.
    """
    if not isinstance(timeout, (int, float)):
        raise ValueError("timeout must be a number")

    if timeout <= 0:
        raise ValueError("timeout must be positive")


class SecureNotifyClient:
    """Main client for SecureNotify API.

    Provides both async and sync interfaces for all operations.

    Example (async):
        ```python
        import asyncio
        from securenotify import SecureNotifyClient

        async def main():
            async with SecureNotifyClient(
                base_url="http://localhost:3000",
                api_key="your-api-key"
            ) as client:
                # Register a public key
                await client.keys.register(
                    public_key="-----BEGIN PUBLIC KEY-----...",
                    algorithm="RSA-4096"
                )

                # Publish a message
                await client.publish.send(
                    channel="my-channel",
                    message="Hello, World!"
                )

                # Subscribe to messages
                await client.subscribe.subscribe(
                    channel="my-channel",
                    handler=lambda msg: print(f"Received: {msg}")
                )

        asyncio.run(main())
        ```

    Example (sync):
        ```python
        from securenotify import SecureNotifyClient

        with SecureNotifyClient(
            base_url="http://localhost:3000",
            api_key="your-api-key"
        ) as client:
            # Register a public key
            client.keys.register(
                public_key="-----BEGIN PUBLIC KEY-----...",
                algorithm="RSA-4096"
            )

            # Publish a message
            client.publish.send(
                channel="my-channel",
                message="Hello, World!"
            )
        ```
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = 30.0,
        verify: bool = True,
        retry_config: Optional[RetryConfig] = None,
        heartbeat_interval: float = 30.0,
        sse_timeout: float = 60.0,
    ):
        """Initialize SecureNotify client.

        Args:
            base_url: Base URL for the SecureNotify API.
            api_key: API key for authentication.
            timeout: HTTP request timeout in seconds.
            verify: Whether to verify SSL certificates.
            retry_config: Retry configuration for failed requests.
            heartbeat_interval: SSE heartbeat interval in seconds.
            sse_timeout: SSE connection timeout in seconds.

        Raises:
            ValueError: If any parameter has an invalid value.
        """
        # Validate configuration parameters
        _validate_base_url(base_url)
        _validate_api_key(api_key)
        _validate_timeout(timeout)

        if heartbeat_interval <= 0:
            raise ValueError("heartbeat_interval must be positive")
        if sse_timeout <= 0:
            raise ValueError("sse_timeout must be positive")

        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.verify = verify
        self.heartbeat_interval = heartbeat_interval
        self.sse_timeout = sse_timeout

        self._retry_config = retry_config
        self._http_client: Optional[HttpClient] = None
        self._sse_client: Optional[SSEClient] = None
        self._closed = False

        # Managers
        self._key_manager: Optional[KeyManager] = None
        self._channel_manager: Optional[ChannelManager] = None
        self._publish_manager: Optional[PublishManager] = None
        self._subscribe_manager: Optional[SubscribeManager] = None
        self._apikey_manager: Optional[ApiKeyManager] = None

        # Sync mode
        self._sync_lock = asyncio.Lock()

    def _get_http_client(self) -> HttpClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = HttpClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                verify=self.verify,
            )
        return self._http_client

    def _get_sse_client(self) -> SSEClient:
        """Get or create SSE client."""
        if self._sse_client is None:
            self._sse_client = SSEClient(
                base_url=self.base_url,
                api_key=self.api_key,
                heartbeat_interval=self.heartbeat_interval,
                timeout=self.sse_timeout,
            )
        return self._sse_client

    def _get_key_manager(self) -> KeyManager:
        """Get key manager."""
        if self._key_manager is None:
            self._key_manager = KeyManager(
                http_client=self._get_http_client(), retry_config=self._retry_config
            )
        return self._key_manager

    def _get_channel_manager(self) -> ChannelManager:
        """Get channel manager."""
        if self._channel_manager is None:
            self._channel_manager = ChannelManager(
                http_client=self._get_http_client(), retry_config=self._retry_config
            )
        return self._channel_manager

    def _get_publish_manager(self) -> PublishManager:
        """Get publish manager."""
        if self._publish_manager is None:
            self._publish_manager = PublishManager(
                http_client=self._get_http_client(), retry_config=self._retry_config
            )
        return self._publish_manager

    def _get_subscribe_manager(self) -> SubscribeManager:
        """Get subscribe manager."""
        if self._subscribe_manager is None:
            self._subscribe_manager = SubscribeManager(
                sse_client=self._get_sse_client()
            )
        return self._subscribe_manager

    def _get_apikey_manager(self) -> ApiKeyManager:
        """Get API key manager."""
        if self._apikey_manager is None:
            self._apikey_manager = ApiKeyManager(
                http_client=self._get_http_client(), retry_config=self._retry_config
            )
        return self._apikey_manager

    @property
    def keys(self) -> KeyManager:
        """Access key management operations."""
        return self._get_key_manager()

    @property
    def channels(self) -> ChannelManager:
        """Access channel management operations."""
        return self._get_channel_manager()

    @property
    def publish(self) -> PublishManager:
        """Access publish operations."""
        return self._get_publish_manager()

    @property
    def subscribe(self) -> SubscribeManager:
        """Access subscribe operations."""
        return self._get_subscribe_manager()

    @property
    def apikeys(self) -> ApiKeyManager:
        """Access API key management operations."""
        return self._get_apikey_manager()

    async def aclose(self) -> None:
        """Close the client and release resources.

        Closes all active connections and background tasks.
        """
        if self._closed:
            return

        self._closed = True

        # Close SSE connections
        if self._sse_client:
            await self._sse_client.disconnect()

        # Close HTTP client
        if self._http_client:
            await self._http_client.close()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.aclose()

    def __enter__(self):
        """Sync context manager entry.

        Returns:
            Self for use in sync context.
        """
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Sync context manager exit.

        Properly handles async cleanup in sync context (SECURITY FIX).
        """
        # Schedule async cleanup with proper event loop handling
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If event loop is already running, schedule cleanup task
                loop.create_task(self.aclose())
            else:
                loop.run_until_complete(self.aclose())
        except RuntimeError:
            # No event loop running - create a new one
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(self.aclose())
            except Exception:
                pass  # Last resort - resources may be cleaned up on process exit


# Sync wrapper utilities
def _run_async(coro):
    """Run an async coroutine in a new event loop.

    Creates a new event loop, runs the coroutine, and ensures proper cleanup
    to prevent resource leaks.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        # Cancel all remaining tasks
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()
        asyncio.set_event_loop(None)


class SyncSecureNotifyClient:
    """Synchronous wrapper for SecureNotifyClient.

    Provides a synchronous interface to the async client.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = 30.0,
        verify: bool = True,
        retry_config: Optional[RetryConfig] = None,
        heartbeat_interval: float = 30.0,
        sse_timeout: float = 60.0,
    ):
        """Initialize sync client.

        Args:
            base_url: Base URL for the SecureNotify API.
            api_key: API key for authentication.
            timeout: HTTP request timeout in seconds.
            verify: Whether to verify SSL certificates.
            retry_config: Retry configuration.
            heartbeat_interval: SSE heartbeat interval.
            sse_timeout: SSE connection timeout.
        """
        self._async_client = SecureNotifyClient(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            verify=verify,
            retry_config=retry_config,
            heartbeat_interval=heartbeat_interval,
            sse_timeout=sse_timeout,
        )

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        _run_async(self._async_client.aclose())

    def close(self):
        """Close the client."""
        _run_async(self._async_client.aclose())

    @property
    def keys(self):
        """Access key management operations (sync)."""
        return SyncKeyManager(self._async_client.keys)

    @property
    def channels(self):
        """Access channel management operations (sync)."""
        return SyncChannelManager(self._async_client.channels)

    @property
    def publish(self):
        """Access publish operations (sync)."""
        return SyncPublishManager(self._async_client.publish)

    @property
    def subscribe(self):
        """Access subscribe operations (sync)."""
        return SyncSubscribeManager(self._async_client.subscribe)

    @property
    def apikeys(self):
        """Access API key management operations (sync)."""
        return SyncApiKeyManager(self._async_client.apikeys)


class SyncKeyManager:
    """Synchronous wrapper for KeyManager."""

    def __init__(self, async_manager):
        self._manager = async_manager

    def register(
        self,
        public_key: str,
        algorithm: str,
        expires_in: int = None,
        metadata: dict = None,
    ):
        return _run_async(
            self._manager.register(public_key, algorithm, expires_in, metadata)
        )

    def get(self, key_id: str):
        return _run_async(self._manager.get(key_id))

    def list(self):
        return _run_async(self._manager.list())

    def revoke(self, key_id: str, reason: str = None):
        return _run_async(self._manager.revoke(key_id, reason))


class SyncChannelManager:
    """Synchronous wrapper for ChannelManager."""

    def __init__(self, async_manager):
        self._manager = async_manager

    def create(
        self,
        name: str,
        channel_type=ChannelType.ENCRYPTED,
        description: str = None,
        ttl: int = None,
        metadata: dict = None,
    ):
        return _run_async(
            self._manager.create(name, channel_type, description, ttl, metadata)
        )

    def get(self, channel_id: str):
        return _run_async(self._manager.get(channel_id))

    def list(self):
        return _run_async(self._manager.list())


class SyncPublishManager:
    """Synchronous wrapper for PublishManager."""

    def __init__(self, async_manager):
        self._manager = async_manager

    def send(
        self,
        channel: str,
        message: str,
        priority=MessagePriority.NORMAL,
        sender: str = None,
        encrypted: bool = True,
        signature: str = None,
        cache: bool = True,
    ):
        return _run_async(
            self._manager.send(
                channel, message, priority, sender, encrypted, signature, cache
            )
        )

    def get_queue_status(self, channel: str):
        return _run_async(self._manager.get_queue_status(channel))

    def send_critical(
        self, channel: str, message: str, sender: str = None, encrypted: bool = True
    ):
        return _run_async(
            self._manager.send_critical(channel, message, sender, encrypted)
        )

    def send_high(
        self, channel: str, message: str, sender: str = None, encrypted: bool = True
    ):
        return _run_async(self._manager.send_high(channel, message, sender, encrypted))

    def send_bulk(self, channel: str, message: str):
        return _run_async(self._manager.send_bulk(channel, message))


class SyncSubscribeManager:
    """Synchronous wrapper for SubscribeManager."""

    def __init__(self, async_manager):
        self._manager = async_manager

    def subscribe(self, channel: str, handler: Callable, auto_reconnect: bool = True):
        async def async_handler(msg):
            handler(msg)

        return _run_async(
            self._manager.subscribe(channel, async_handler, auto_reconnect)
        )

    def unsubscribe(self, channel: str):
        return _run_async(self._manager.unsubscribe(channel))


class SyncApiKeyManager:
    """Synchronous wrapper for ApiKeyManager."""

    def __init__(self, async_manager):
        self._manager = async_manager

    def create(self, name: str, permissions: list, expires_in: int = None):
        return _run_async(self._manager.create(name, permissions, expires_in))

    def get(self, key_id: str):
        return _run_async(self._manager.get(key_id))

    def list(self):
        return _run_async(self._manager.list())

    def revoke(self, key_id: str):
        return _run_async(self._manager.revoke(key_id))

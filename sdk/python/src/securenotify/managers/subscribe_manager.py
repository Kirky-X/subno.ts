"""Subscribe Manager.

Manages SSE subscriptions for real-time message delivery.
"""

import asyncio
from typing import Callable, Awaitable, Optional, Dict, Any

from securenotify.utils.connection import SSEClient, ConnectionState
from securenotify.types.errors import SecureNotifyConnectionError


class SubscribeManager:
    """Manages real-time subscriptions via SSE."""

    def __init__(
        self,
        sse_client: SSEClient
    ):
        """Initialize subscribe manager.

        Args:
            sse_client: SSE client for connections.
        """
        self._sse = sse_client
        self._active_subscriptions: Dict[str, asyncio.Task] = {}

    @property
    def is_connected(self) -> bool:
        """Check if any subscription is active."""
        return self._sse.is_connected

    @property
    def connection_state(self) -> ConnectionState:
        """Get current connection state."""
        return self._sse.state

    async def subscribe(
        self,
        channel: str,
        handler: Callable[[Any], Awaitable[None]],
        auto_reconnect: bool = True
    ) -> None:
        """Subscribe to a channel for real-time messages.

        Args:
            channel: Channel ID to subscribe to.
            handler: Async callback function for received messages.
            auto_reconnect: Whether to auto-reconnect on disconnect.

        Raises:
            SecureNotifyConnectionError: If subscription fails.
        """
        if channel in self._active_subscriptions:
            # Already subscribed, just update handler
            self._sse.subscribe(channel, handler)
            return

        # Register handler
        self._sse.subscribe(channel, handler)

        # Create subscription task
        async def subscription_task():
            await self._sse.connect(channel)

        task = asyncio.create_task(subscription_task())
        self._active_subscriptions[channel] = task

        try:
            await task
        except asyncio.CancelledError:
            self._active_subscriptions.pop(channel, None)
            raise
        except SecureNotifyConnectionError:
            self._active_subscriptions.pop(channel, None)
            raise

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe from a channel.

        Args:
            channel: Channel ID to unsubscribe from.
        """
        # Cancel subscription task
        task = self._active_subscriptions.pop(channel, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Unregister handler
        self._sse.unsubscribe(channel)

    async def unsubscribe_all(self) -> None:
        """Unsubscribe from all channels."""
        channels = list(self._active_subscriptions.keys())
        for channel in channels:
            await self.unsubscribe(channel)

    async def subscribe_heartbeat(
        self,
        handler: Callable[[Any], Awaitable[None]]
    ) -> None:
        """Register a heartbeat handler.

        Called when no message received within heartbeat interval.

        Args:
            handler: Async callback function for heartbeat events.
        """
        self._sse.subscribe("__heartbeat__", handler)

    def set_reconnect_config(
        self,
        reconnect_delay: float = 1.0,
        max_attempts: int = 10
    ) -> None:
        """Configure reconnection behavior.

        Args:
            reconnect_delay: Initial delay before reconnecting.
            max_attempts: Maximum reconnect attempts.
        """
        self._sse.reconnect_delay = reconnect_delay
        self._sse.max_reconnect_attempts = max_attempts

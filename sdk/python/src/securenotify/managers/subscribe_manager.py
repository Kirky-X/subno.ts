# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

"""Manages SSE subscriptions for real-time message delivery."""

import asyncio
from typing import Callable, Awaitable, Optional, Dict, Any

from securenotify.utils.connection import SSEClient, ConnectionState
from securenotify.types.errors import SecureNotifyConnectionError


class SubscribeManager:
    def __init__(self, sse_client: SSEClient):
        self._sse = sse_client
        self._active_subscriptions: Dict[str, asyncio.Task] = {}

    @property
    def is_connected(self) -> bool:
        return self._sse.is_connected

    @property
    def connection_state(self) -> ConnectionState:
        return self._sse.state

    async def subscribe(
        self,
        channel: str,
        handler: Callable[[Any], Awaitable[None]],
        auto_reconnect: bool = True,
    ) -> None:
        """Subscribe to a channel for real-time messages.

        Raises:
            SecureNotifyConnectionError: If subscription fails.
        """
        if channel in self._active_subscriptions:
            # Already subscribed, just update handler
            self._sse.subscribe(channel, handler)
            return

        self._sse.subscribe(channel, handler)

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
        task = self._active_subscriptions.pop(channel, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        self._sse.unsubscribe(channel)

    async def unsubscribe_all(self) -> None:
        channels = list(self._active_subscriptions.keys())
        for channel in channels:
            await self.unsubscribe(channel)

    async def subscribe_heartbeat(
        self, handler: Callable[[Any], Awaitable[None]]
    ) -> None:
        """Register a heartbeat handler.

        Called when no message received within heartbeat interval.
        """
        self._sse.subscribe("__heartbeat__", handler)

    def set_reconnect_config(
        self, reconnect_delay: float = 1.0, max_attempts: int = 10
    ) -> None:
        self._sse.reconnect_delay = reconnect_delay
        self._sse.max_reconnect_attempts = max_attempts

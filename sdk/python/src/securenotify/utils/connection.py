# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

"""Async SSE client with auto-reconnect and heartbeat detection."""

import asyncio
import io
import json
import logging
import re
from typing import Optional, Callable, Dict, Any, Awaitable
from enum import Enum

import httpx

from securenotify.types.errors import (
    SecureNotifyConnectionError,
    SecureNotifyTimeoutError,
)
from .http import validate_channel_id


class ConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"


class SSEClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        heartbeat_interval: float = 30.0,
        reconnect_delay: float = 1.0,
        max_reconnect_attempts: int = 10,
        timeout: float = 60.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.heartbeat_interval = heartbeat_interval
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_attempts = max_reconnect_attempts
        self.timeout = timeout

        self._state = ConnectionState.DISCONNECTED
        self._subscriptions: Dict[str, Callable] = {}
        self._client: Optional[httpx.AsyncClient] = None
        self._listener_task: Optional[asyncio.Task] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._stop_event: Optional[asyncio.Event] = None
        self._last_event_id: Optional[str] = None

        # Setup logger for security-aware logging (SECURITY FIX)
        self._logger = logging.getLogger(__name__)

    @property
    def state(self) -> ConnectionState:
        return self._state

    @property
    def is_connected(self) -> bool:
        return self._state == ConnectionState.CONNECTED

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "text/event-stream",
        }
        if self._last_event_id:
            headers["Last-Event-ID"] = self._last_event_id
        return headers

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            # Add max_redirects to prevent SSRF attacks
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
                max_redirects=5,  # Limit redirects to prevent SSRF
            )
        return self._client

    async def connect(self, channel: str) -> None:
        """Connect to a channel.

        Raises:
            SecureNotifyConnectionError: If connection fails.
            ValueError: If channel ID is invalid.
        """
        # Validate channel ID format (SECURITY FIX)
        if not validate_channel_id(channel):
            raise ValueError(
                f"Invalid channel ID '{channel}'. "
                "Channel ID must be 1-256 characters and contain only alphanumeric characters, hyphens, and underscores."
            )

        self._stop_event = asyncio.Event()
        self._state = ConnectionState.CONNECTING

        try:
            client = await self._get_client()
            url = f"{self.base_url}/api/subscribe?channel={channel}"

            async with client.stream(
                "GET", url, headers=self._get_headers()
            ) as response:
                if response.status_code != 200:
                    raise SecureNotifyConnectionError(
                        f"Failed to subscribe: status {response.status_code}"
                    )

                self._state = ConnectionState.CONNECTED
                self._last_event_id = None

                self._heartbeat_task = asyncio.create_task(self._heartbeat_monitor())
                self._listener_task = asyncio.create_task(
                    self._event_listener(response, channel)
                )

                await self._listener_task

        except asyncio.CancelledError:
            self._state = ConnectionState.DISCONNECTED
            raise
        except Exception as e:
            self._state = ConnectionState.DISCONNECTED
            raise SecureNotifyConnectionError(f"Connection failed: {str(e)}") from e

    async def _event_listener(self, response: httpx.Response, channel: str) -> None:
        # Use StringIO for efficient string building (PERFORMANCE FIX)
        event_buffer = io.StringIO()
        event_type = "message"
        event_id = None

        try:
            async for chunk in response.aiter_text():
                event_buffer.write(chunk)

                buffer_value = event_buffer.getvalue()
                while "\n" in buffer_value:
                    line, remaining = buffer_value.split("\n", 1)
                    buffer_value = remaining
                    line = line.rstrip("\r")

                    if line.startswith(":"):
                        continue

                    if ":" in line:
                        field, value = line.split(":", 1)
                        value = value.lstrip(" ")

                        if field == "event":
                            event_type = value
                        elif field == "id":
                            event_id = value
                        elif field == "data":
                            await self._handle_event(
                                channel=channel,
                                event_type=event_type,
                                data=value,
                                event_id=event_id,
                            )
                            event_type = "message"
                            event_id = None
                        elif field == "retry":
                            # Handle server-specified retry interval
                            try:
                                self.reconnect_delay = float(value)
                            except ValueError:
                                pass
                    elif line == "":
                        event_type = "message"
                        event_id = None

                event_buffer = io.StringIO(buffer_value)

        except asyncio.CancelledError:
            raise
        except Exception:
            if not self._stop_event.is_set():
                await self._reconnect(channel)

    async def _handle_event(
        self, channel: str, event_type: str, data: str, event_id: Optional[str]
    ) -> None:
        if event_id:
            self._last_event_id = event_id

        # Reset heartbeat on any event
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            self._heartbeat_task = asyncio.create_task(self._heartbeat_monitor())

        try:
            parsed_data = json.loads(data) if data.startswith("{") else data
        except json.JSONDecodeError:
            parsed_data = data

        handler = self._subscriptions.get(channel)
        if handler:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(parsed_data)
                else:
                    handler(parsed_data)
            except Exception as e:
                # Log handler error but don't stop listening (SECURITY FIX: use logger instead of print)
                self._logger.warning(f"Handler error for channel {channel}: {e}")

    async def _heartbeat_monitor(self) -> None:
        """Monitor for heartbeat messages.

        Sends a ping if no message received within interval.
        """
        try:
            await asyncio.sleep(self.heartbeat_interval)

            handler = self._subscriptions.get("__heartbeat__")
            if handler:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler({"type": "heartbeat"})
                    else:
                        handler({"type": "heartbeat"})
                except Exception:
                    pass
        except asyncio.CancelledError:
            raise

    async def _reconnect(self, channel: str) -> None:
        """Attempt to reconnect after disconnection with exponential backoff."""
        if self._stop_event.is_set():
            return

        self._state = ConnectionState.RECONNECTING

        for attempt in range(self.max_reconnect_attempts):
            if self._stop_event.is_set():
                return

            delay = self.reconnect_delay * (2 ** min(attempt, 5))
            await asyncio.sleep(delay)

            try:
                await self.connect(channel)
                return
            except Exception:
                continue

        self._state = ConnectionState.DISCONNECTED
        raise SecureNotifyConnectionError(
            f"Failed to reconnect after {self.max_reconnect_attempts} attempts"
        )

    def subscribe(
        self, channel: str, handler: Callable[[Any], Awaitable[None]]
    ) -> None:
        self._subscriptions[channel] = handler

    def unsubscribe(self, channel: str) -> None:
        self._subscriptions.pop(channel, None)

    async def disconnect(self) -> None:
        """Disconnect from all channels."""
        self._stop_event.set()

        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            self._heartbeat_task = None

        if self._listener_task:
            self._listener_task.cancel()
            self._listener_task = None

        if self._client:
            await self._client.aclose()
            self._client = None

        self._state = ConnectionState.DISCONNECTED
        self._subscriptions.clear()

    async def subscribe_and_wait(
        self,
        channel: str,
        handler: Callable[[Any], Awaitable[None]],
        stop_event: Optional[asyncio.Event] = None,
    ) -> None:
        self.subscribe(channel, handler)

        try:
            await self.connect(channel)

            if stop_event:
                await stop_event.wait()
            else:
                await asyncio.Event().wait()
        except asyncio.CancelledError:
            raise
        finally:
            self._subscriptions.pop(channel, None)

"""Publish Manager.

Manages message publishing and queue status.
"""

from typing import Optional, Dict, Any
from datetime import datetime

from securenotify.types.api import (
    MessagePublishRequest,
    MessagePublishResponse,
    MessagePriority,
    QueueStatusInfo,
)
from securenotify.utils.http import HttpClient
from securenotify.utils.retry import with_retry, RetryConfig


class PublishManager:
    """Manages message publishing operations."""

    def __init__(self, http_client: HttpClient, retry_config: Optional[RetryConfig] = None):
        """Initialize publish manager.

        Args:
            http_client: HTTP client for API calls.
            retry_config: Retry configuration.
        """
        self._http = http_client
        self._retry_config = retry_config

    async def send(
        self,
        channel: str,
        message: str,
        priority: MessagePriority = MessagePriority.NORMAL,
        sender: Optional[str] = None,
        encrypted: bool = True,
        signature: Optional[str] = None,
        cache: bool = True
    ) -> MessagePublishResponse:
        """Send a message to a channel.

        Args:
            channel: Channel ID.
            message: Message content.
            priority: Message priority (default: NORMAL).
            sender: Sender identifier (optional).
            encrypted: Whether message is encrypted (default: True).
            message_signature: Message signature for verification (optional).
            cache: Whether to cache the message (default: True).

        Returns:
            Message publish response with message_id.

        Raises:
            ValueError: If channel or message is empty.
            SecureNotifyApiError: On API error.
        """
        request = MessagePublishRequest(
            channel=channel,
            message=message,
            priority=priority,
            sender=sender,
            encrypted=encrypted,
            signature=signature,
            cache=cache
        )

        async def do_send():
            return await self._http.publish_message(request)

        return await with_retry(do_send, self._retry_config)

    async def get_queue_status(self, channel: str) -> QueueStatusInfo:
        """Get message queue status for a channel.

        Args:
            channel: Channel ID.

        Returns:
            Queue status information.

        Raises:
            SecureNotifyApiError: On API error.
        """
        async def do_get_status():
            data = await self._http.get_queue_status(channel)
            return QueueStatusInfo(
                channel=data["channel"],
                pending_count=data["pending_count"],
                priority_counts=data.get("priority_counts", {})
            )

        return await with_retry(do_get_status, self._retry_config)

    async def send_critical(
        self,
        channel: str,
        message: str,
        sender: Optional[str] = None,
        encrypted: bool = True
    ) -> MessagePublishResponse:
        """Send a critical priority message.

        Args:
            channel: Channel ID.
            message: Message content.
            sender: Sender identifier (optional).
            encrypted: Whether message is encrypted (default: True).

        Returns:
            Message publish response.
        """
        return await self.send(
            channel=channel,
            message=message,
            priority=MessagePriority.CRITICAL,
            sender=sender,
            encrypted=encrypted
        )

    async def send_high(
        self,
        channel: str,
        message: str,
        sender: Optional[str] = None,
        encrypted: bool = True
    ) -> MessagePublishResponse:
        """Send a high priority message.

        Args:
            channel: Channel ID.
            message: Message content.
            sender: Sender identifier (optional).
            encrypted: Whether message is encrypted (default: True).

        Returns:
            Message publish response.
        """
        return await self.send(
            channel=channel,
            message=message,
            priority=MessagePriority.HIGH,
            sender=sender,
            encrypted=encrypted
        )

    async def send_bulk(
        self,
        channel: str,
        message: str
    ) -> MessagePublishResponse:
        """Send a bulk priority message.

        For low-priority messages that can be delayed.

        Args:
            channel: Channel ID.
            message: Message content.

        Returns:
            Message publish response.
        """
        return await self.send(
            channel=channel,
            message=message,
            priority=MessagePriority.BULK
        )

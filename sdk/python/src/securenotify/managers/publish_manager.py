# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

from typing import Optional, Dict, Any
from datetime import datetime

from securenotify.types.api import (
    MessagePublishRequest,
    MessagePublishResponse,
    MessagePriority,
    QueueStatusInfo,
)
from .base import BaseManager
from securenotify.utils.http import validate_channel_id


class PublishManager(BaseManager):
    async def send(
        self,
        channel: str,
        message: str,
        priority: MessagePriority = MessagePriority.NORMAL,
        sender: Optional[str] = None,
        encrypted: bool = True,
        signature: Optional[str] = None,
        cache: bool = True,
    ) -> MessagePublishResponse:
        """Send a message to a channel.

        Raises:
            ValueError: If channel or message is empty or invalid.
            SecureNotifyApiError: On API error.
        """
        # Validate channel ID format (SECURITY FIX)
        if not validate_channel_id(channel):
            raise ValueError(
                f"Invalid channel ID '{channel}'. "
                "Channel ID must be 1-256 characters and contain only alphanumeric characters, hyphens, and underscores."
            )

        if not message or not isinstance(message, str):
            raise ValueError("Message must be a non-empty string")

        request = MessagePublishRequest(
            channel=channel,
            message=message,
            priority=priority,
            sender=sender,
            encrypted=encrypted,
            signature=signature,
            cache=cache,
        )
        return await self._execute("publish_message", request)

    async def get_queue_status(self, channel: str) -> QueueStatusInfo:
        data = await self._execute("get_queue_status", channel)
        return QueueStatusInfo(
            channel=data["channel"],
            pending_count=data["pending_count"],
            priority_counts=data.get("priority_counts", {}),
        )

    async def send_critical(
        self,
        channel: str,
        message: str,
        sender: Optional[str] = None,
        encrypted: bool = True,
    ) -> MessagePublishResponse:
        return await self.send(
            channel=channel,
            message=message,
            priority=MessagePriority.CRITICAL,
            sender=sender,
            encrypted=encrypted,
        )

    async def send_high(
        self,
        channel: str,
        message: str,
        sender: Optional[str] = None,
        encrypted: bool = True,
    ) -> MessagePublishResponse:
        return await self.send(
            channel=channel,
            message=message,
            priority=MessagePriority.HIGH,
            sender=sender,
            encrypted=encrypted,
        )

    async def send_bulk(self, channel: str, message: str) -> MessagePublishResponse:
        """Send a bulk priority message.

        For low-priority messages that can be delayed.
        """
        return await self.send(
            channel=channel, message=message, priority=MessagePriority.BULK
        )
